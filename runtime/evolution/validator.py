"""Workspace validator — integrity gate on the Evolve Agent's output.

Static checks run after :mod:`runtime.evolution.evolve` returns and
before the pending manifest is committed:

  - every file declared in a ``changes[].files`` entry exists on disk
  - the change's ``constraint_level`` matches the file's path bucket
    (e.g. ``constraint_level=skill`` files must live under
    ``.opentracy/skills/``)
  - any Python middleware the agent shipped actually parses with
    :func:`ast.parse` (a typo in middleware is a runtime crash on the
    NEXT chat call — catch it here, before it ships)

Any ``critical`` issue means the loop must full-rollback the pending
edits. This is distinct from ``ROLLBACK_AND_PIVOT``: pivot rolls back
because a *prediction* didn't land; validation_failed rolls back
because the iteration is internally broken — there's nothing to
predict against.

The validator is fail-closed: when in doubt about a check (unreadable
file, unknown constraint level), emit a warning rather than a critical
so we don't punish weird-but-legal edits.
"""

from __future__ import annotations

import ast
import logging
from dataclasses import dataclass, field
from typing import Any, Optional


logger = logging.getLogger("runtime.evolution.validator")


# Map each constraint_level to the path prefix(es) its files must live
# under. ``system_prompt`` is the only single-file level — anything
# else is a directory bucket so the agent can add multiple files.
_LEVEL_PATHS: dict[str, tuple[str, ...]] = {
    "system_prompt": (".opentracy/system_prompt.md",),
    "tool_desc":     (".opentracy/tools/",),
    "tool_impl":     (".opentracy/tools/",),
    "middleware":    (".opentracy/middleware/",),
    "skill":         (".opentracy/skills/",),
    "sub_agent":     (".opentracy/subagents/",),
    "memory":        (".opentracy/memory/",),
}


@dataclass
class ValidationIssue:
    code: str
    severity: str  # "critical" | "warning"
    message: str
    change_id: Optional[str] = None
    file: Optional[str] = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "code": self.code,
            "severity": self.severity,
            "message": self.message,
            "change_id": self.change_id,
            "file": self.file,
        }


@dataclass
class ValidationReport:
    issues: list[ValidationIssue] = field(default_factory=list)

    @property
    def critical(self) -> list[ValidationIssue]:
        return [i for i in self.issues if i.severity == "critical"]

    @property
    def has_critical(self) -> bool:
        return any(i.severity == "critical" for i in self.issues)

    def to_dict(self) -> dict[str, Any]:
        return {
            "issues": [i.to_dict() for i in self.issues],
            "critical_count": len(self.critical),
        }


def validate_workspace(
    workspace: Any,
    *,
    pending_manifest: Optional[dict[str, Any]],
) -> ValidationReport:
    """Run static integrity checks on the workspace post-evolve.

    Returns a :class:`ValidationReport`. The caller decides what to do
    with critical issues — typically a full rollback + history entry
    marking the iteration as ``validation_failed``.

    No-op when ``pending_manifest`` is missing or has no ``changes``:
    nothing was declared, nothing to validate.
    """
    report = ValidationReport()
    if not pending_manifest:
        return report

    changes = pending_manifest.get("changes") or []
    if not changes:
        # Legacy flat manifest — only check Python syntax on whatever
        # middleware files are present, since the agent didn't tell us
        # which they are. Skip per-change checks.
        _validate_python_files(workspace, report)
        return report

    for raw in changes:
        if not isinstance(raw, dict):
            report.issues.append(ValidationIssue(
                code="invalid_change_entry",
                severity="critical",
                message="changes[] entry is not an object",
            ))
            continue

        cid = str(raw.get("id") or "")
        level = str(raw.get("constraint_level") or "").strip()
        files = raw.get("files") or []

        if level and level not in _LEVEL_PATHS:
            report.issues.append(ValidationIssue(
                code="unknown_constraint_level",
                severity="warning",
                message=f"unknown constraint_level {level!r}",
                change_id=cid,
            ))

        allowed = _LEVEL_PATHS.get(level)

        for rel in files:
            if not isinstance(rel, str) or not rel.strip():
                report.issues.append(ValidationIssue(
                    code="invalid_file_entry",
                    severity="critical",
                    message="files[] entry is not a string",
                    change_id=cid,
                ))
                continue
            full = workspace.path / rel
            if not full.exists():
                report.issues.append(ValidationIssue(
                    code="missing_file",
                    severity="critical",
                    message=(
                        f"declared file does not exist on disk: {rel}"
                    ),
                    change_id=cid,
                    file=rel,
                ))
                continue
            if allowed is not None and not _path_matches_level(rel, allowed):
                report.issues.append(ValidationIssue(
                    code="level_path_mismatch",
                    severity="critical",
                    message=(
                        f"constraint_level={level!r} but file lives "
                        f"outside its bucket: {rel} (expected prefix "
                        f"one of {list(allowed)})"
                    ),
                    change_id=cid,
                    file=rel,
                ))

    _validate_python_files(workspace, report)
    return report


# ---------------------------------------------------------------------------
# Internals
# ---------------------------------------------------------------------------


def _path_matches_level(rel: str, allowed: tuple[str, ...]) -> bool:
    """``system_prompt`` matches a single file path; everything else is
    a directory prefix."""
    for a in allowed:
        if a.endswith("/"):
            if rel.startswith(a):
                return True
        else:
            if rel == a:
                return True
    return False


def _validate_python_files(workspace: Any, report: ValidationReport) -> None:
    """ast.parse every ``.py`` file under ``.opentracy/middleware/`` and
    ``.opentracy/tools/``. A SyntaxError here is critical: importing
    the module on the next chat call would crash the executor."""
    candidate_dirs = (
        workspace.path / ".opentracy" / "middleware",
        workspace.path / ".opentracy" / "tools",
    )
    for cdir in candidate_dirs:
        if not cdir.exists():
            continue
        for path in cdir.rglob("*.py"):
            try:
                source = path.read_text(encoding="utf-8")
            except (OSError, UnicodeDecodeError) as exc:
                report.issues.append(ValidationIssue(
                    code="unreadable_python",
                    severity="warning",
                    message=f"cannot read python file: {exc}",
                    file=str(path.relative_to(workspace.path)),
                ))
                continue
            try:
                ast.parse(source, filename=str(path))
            except SyntaxError as exc:
                report.issues.append(ValidationIssue(
                    code="python_syntax_error",
                    severity="critical",
                    message=(
                        f"SyntaxError at {exc.lineno}:{exc.offset}: "
                        f"{exc.msg}"
                    ),
                    file=str(path.relative_to(workspace.path)),
                ))
