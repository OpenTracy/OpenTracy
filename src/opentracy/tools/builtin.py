"""Built-in tools: the minimal set the harness needs.

    read · bash · edit · write · grep · find · ls

Design rules:
- Every filesystem tool is CONFINED to the workspace root: paths are resolved
  and rejected if they escape (`..`, symlinks, absolute paths outside root).
  bash is the deliberate escape hatch — it runs with the user's own
  permissions, like any local coding agent. No sandbox; this is a personal
  harness operating on the user's machine.
- Outputs are clipped to MAX_OUTPUT chars so a huge file or command can't
  blow up the context window (the compressor prunes old tool results too).
- Descriptions state WHEN to use each tool, not just what it does.
"""

from __future__ import annotations

import re
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable

MAX_OUTPUT = 30_000
SKIP_DIRS = {".git", ".venv", "node_modules", "__pycache__", ".ipynb_checkpoints"}


class ToolError(Exception):
    """Recoverable tool failure — returned to the model as is_error."""


@dataclass(frozen=True)
class Tool:
    name: str
    description: str
    input_schema: dict[str, Any]
    handler: Callable[..., str]


def _clip(text: str) -> str:
    if len(text) <= MAX_OUTPUT:
        return text
    return text[:MAX_OUTPUT] + f"\n[... output clipped at {MAX_OUTPUT:,} chars ...]"


def _schema(properties: dict[str, Any], required: list[str]) -> dict[str, Any]:
    return {
        "type": "object",
        "properties": properties,
        "required": required,
        "additionalProperties": False,
    }


def build_builtin_tools(root: Path | str) -> list[Tool]:
    root = Path(root).resolve()

    def resolve(path: str) -> Path:
        candidate = (root / path).resolve() if not Path(path).is_absolute() else Path(path).resolve()
        if not (candidate == root or candidate.is_relative_to(root)):
            raise ToolError(f"path escapes the workspace root: {path}")
        return candidate

    def iter_files(base: Path):
        for p in sorted(base.rglob("*")):
            if any(part in SKIP_DIRS for part in p.parts):
                continue
            if p.is_file():
                yield p

    # ------------------------------------------------------------------

    def read(path: str, offset: int = 1, limit: int = 2000) -> str:
        target = resolve(path)
        if not target.is_file():
            raise ToolError(f"not a file: {path}")
        lines = target.read_text(encoding="utf-8", errors="replace").splitlines()
        window = lines[offset - 1 : offset - 1 + limit]
        numbered = "\n".join(f"{i + offset:>5}\t{line}" for i, line in enumerate(window))
        return _clip(numbered or "(empty file)")

    def write(path: str, content: str) -> str:
        target = resolve(path)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
        return f"wrote {len(content):,} chars to {target.relative_to(root)}"

    def edit(path: str, old_string: str, new_string: str, replace_all: bool = False) -> str:
        target = resolve(path)
        if not target.is_file():
            raise ToolError(f"not a file: {path}")
        text = target.read_text(encoding="utf-8")
        count = text.count(old_string)
        if count == 0:
            raise ToolError("old_string not found in file")
        if count > 1 and not replace_all:
            raise ToolError(
                f"old_string matches {count} times; make it unique or set replace_all=true"
            )
        replaced = text.replace(old_string, new_string) if replace_all else text.replace(
            old_string, new_string, 1
        )
        target.write_text(replaced, encoding="utf-8")
        return f"replaced {count if replace_all else 1} occurrence(s) in {target.relative_to(root)}"

    def bash(command: str, timeout_seconds: int = 60) -> str:
        timeout_seconds = min(timeout_seconds, 300)
        try:
            proc = subprocess.run(
                command, shell=True, cwd=root, capture_output=True,
                text=True, timeout=timeout_seconds, executable="/bin/bash",
            )
        except subprocess.TimeoutExpired:
            raise ToolError(f"command timed out after {timeout_seconds}s")
        output = (proc.stdout or "") + (proc.stderr or "")
        status = "" if proc.returncode == 0 else f"\n[exit code: {proc.returncode}]"
        return _clip((output or "(no output)") + status)

    def grep(pattern: str, path: str = ".", max_results: int = 50) -> str:
        base = resolve(path)
        try:
            regex = re.compile(pattern)
        except re.error as exc:
            raise ToolError(f"invalid regex: {exc}")
        hits = []
        for file in iter_files(base if base.is_dir() else base.parent):
            try:
                for lineno, line in enumerate(
                    file.read_text(encoding="utf-8", errors="ignore").splitlines(), 1
                ):
                    if regex.search(line):
                        hits.append(f"{file.relative_to(root)}:{lineno}: {line.strip()[:200]}")
                        if len(hits) >= max_results:
                            return _clip("\n".join(hits) + "\n[... max results reached ...]")
            except OSError:
                continue
        return _clip("\n".join(hits) or "(no matches)")

    def find(pattern: str, path: str = ".") -> str:
        base = resolve(path)
        matches = [
            str(p.relative_to(root))
            for p in iter_files(base)
            if p.match(pattern) or pattern.lower() in p.name.lower()
        ][:100]
        return _clip("\n".join(matches) or "(no files found)")

    def ls(path: str = ".") -> str:
        base = resolve(path)
        if not base.is_dir():
            raise ToolError(f"not a directory: {path}")
        entries = []
        for p in sorted(base.iterdir()):
            if p.name in SKIP_DIRS:
                continue
            suffix = "/" if p.is_dir() else f"  ({p.stat().st_size:,} bytes)"
            entries.append(f"{p.name}{suffix}")
        return _clip("\n".join(entries) or "(empty directory)")

    # ------------------------------------------------------------------

    return [
        Tool("read", (
            "Read a file from the workspace, with line numbers. Call this before "
            "editing any file, and to load a skill's SKILL.md when the skills index "
            "matches the task."),
            _schema({
                "path": {"type": "string", "description": "workspace-relative path"},
                "offset": {"type": "integer", "description": "1-based first line (default 1)"},
                "limit": {"type": "integer", "description": "max lines (default 2000)"},
            }, ["path"]), read),
        Tool("bash", (
            "Run a shell command in the workspace root. Use for anything the other "
            "tools don't cover: git, sqlite3 (e.g. searching sessions/transcripts.db), "
            "running tests, installing nothing without asking."),
            _schema({
                "command": {"type": "string"},
                "timeout_seconds": {"type": "integer", "description": "default 60, max 300"},
            }, ["command"]), bash),
        Tool("edit", (
            "Replace an exact string in a file. old_string must match exactly once "
            "(or set replace_all). Use for surgical changes — e.g. updating a fact in "
            "memory/memory.md without rewriting the file."),
            _schema({
                "path": {"type": "string"},
                "old_string": {"type": "string"},
                "new_string": {"type": "string"},
                "replace_all": {"type": "boolean"},
            }, ["path", "old_string", "new_string"]), edit),
        Tool("write", (
            "Create or overwrite a file (parent dirs created). Use to persist memory "
            "(memory/user.md, memory/memory.md — follow the write policies in their "
            "frontmatter) and any new files the task needs."),
            _schema({
                "path": {"type": "string"},
                "content": {"type": "string"},
            }, ["path", "content"]), write),
        Tool("grep", (
            "Regex search across workspace files; returns file:line: text. Use to "
            "locate where something is defined or mentioned before reading files."),
            _schema({
                "pattern": {"type": "string", "description": "Python regex"},
                "path": {"type": "string", "description": "dir to search (default .)"},
                "max_results": {"type": "integer", "description": "default 50"},
            }, ["pattern"]), grep),
        Tool("find", (
            "Find files by name/glob pattern (e.g. '*.md', 'SKILL.md'). Use when you "
            "know roughly the filename but not where it lives."),
            _schema({
                "pattern": {"type": "string"},
                "path": {"type": "string", "description": "dir to search (default .)"},
            }, ["pattern"]), find),
        Tool("ls", (
            "List a directory's entries. Use to orient yourself before reading or "
            "writing in an unfamiliar part of the workspace."),
            _schema({
                "path": {"type": "string", "description": "default ."},
            }, []), ls),
    ]
