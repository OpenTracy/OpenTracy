"""Version snapshots — the rollback primitive.

When a candidate is promoted to live, the prior agent tree is snapshotted into
``<ledger_root>/<agent>/versions/<version_id>/agent/``. Rollback copies that
snapshot back over the live agent dir. Both the live agent dir and the versions
dir are resolved **per active agent (and tenant) at call time**, so each agent
has its own version lineage and a promotion for agent A never collides with
agent B (nor with the same agent id under another tenant).

Snapshots are content-addressed by the version string in agent.yaml. We trust
that version is bumped on every promotion (executor's responsibility).
"""

from __future__ import annotations

import shutil
from pathlib import Path
from typing import Optional

import yaml


# Runtime accumulation that is NOT the trainable surface. Excluded from version
# snapshots and candidate branches — copying it bloats snapshots and, since some
# of it lives under the agent dir, would recurse. Preserved across rollback.
_ACCUMULATION = (
    "experiments", "evals", "router", "datasets", "corpora", "workspace",
    "integrations", "mcp_servers", "secrets.env", "secrets.enc.json",
    "onboarding.json", "onboarding_session.json",
)
SURFACE_IGNORE = shutil.ignore_patterns(*_ACCUMULATION)


def _live_agent_dir() -> Path:
    """The active agent's catalog dir.

    Resolves the request/context active agent (the same ContextVar the ledger
    writer and the server config endpoints use), so versions, lessons, and
    prompt/route edits all scope to one agent within a request.
    """
    from runtime.agent_context import get_active
    from runtime.agents.registry import live_agent_dir

    d = live_agent_dir(get_active())
    if d is None:
        raise RuntimeError("no active agent resolved — registry not bootstrapped")
    return d


def _versions_dir() -> Path:
    """``<ledger_root>/<agent>/versions`` for the active agent.

    Routes through the tenant-aware ledger root (same one the ledger writer
    uses) so snapshots land under ``tenants/<t>/ledger/<agent>/versions`` in
    infra mode and never collide across tenants that share an agent id.
    """
    from runtime.agent_paths import _ledger_root

    return _ledger_root() / _live_agent_dir().name / "versions"


def resolve_live_dir() -> Path:
    """Public resolver — the dir the harness should treat as live right now."""
    return _live_agent_dir()


def read_version(agent_dir: Optional[Path | str] = None) -> str:
    """Read the current `version` from agent.yaml."""
    base = Path(agent_dir) if agent_dir is not None else _live_agent_dir()
    cfg_path = base / "agent.yaml"
    with cfg_path.open() as f:
        doc = yaml.safe_load(f) or {}
    return doc.get("agent", {}).get("version", "unknown")


def _read_version(agent_dir: Path) -> str:  # backward-compat alias
    return read_version(agent_dir)


def bump_patch(version: str) -> str:
    """v0.0.1 → v0.0.2 (or 0.0.1 → 0.0.2 if no `v` prefix).

    Shared version primitive; the executor and the rollback path both bump
    versions and must produce the same, distinct, snapshot-safe string.
    """
    has_v = version.startswith("v")
    core = version[1:] if has_v else version
    parts = core.split(".")
    if not parts[-1].isdigit():
        parts.append("1")
    else:
        parts[-1] = str(int(parts[-1]) + 1)
    return ("v" if has_v else "") + ".".join(parts)


def set_version(agent_dir: Path | str, new_version: str) -> None:
    """Write `new_version` into agent.yaml's agent.version (dir-based)."""
    cfg_path = Path(agent_dir) / "agent.yaml"
    with cfg_path.open() as f:
        doc = yaml.safe_load(f) or {}
    doc.setdefault("agent", {})["version"] = new_version
    with cfg_path.open("w") as f:
        yaml.safe_dump(doc, f, sort_keys=False)


def snapshot_path(version: str, versions_dir: Optional[Path | str] = None) -> Path:
    base = Path(versions_dir) if versions_dir is not None else _versions_dir()
    return base / version / "agent"


def snapshot_agent(
    agent_dir: Optional[Path | str] = None,
    versions_dir: Optional[Path | str] = None,
) -> tuple[str, Path]:
    """Copy the live agent dir into ``<versions>/<version>/agent``. Returns
    (version, path)."""
    base = Path(agent_dir) if agent_dir is not None else _live_agent_dir()
    version = _read_version(base)
    target = snapshot_path(version, versions_dir)
    if target.exists():
        # Already snapshotted — idempotent. Don't overwrite (would lose the
        # original snapshot if version got duplicated by mistake).
        return version, target
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copytree(base, target, ignore=SURFACE_IGNORE)
    return version, target


def list_snapshots(versions_dir: Optional[Path | str] = None) -> list[str]:
    root = Path(versions_dir) if versions_dir is not None else _versions_dir()
    if not root.exists():
        return []
    return sorted(
        d.name for d in root.iterdir() if (d / "agent" / "agent.yaml").exists()
    )


def restore_version(
    version: str,
    agent_dir: Optional[Path | str] = None,
    versions_dir: Optional[Path | str] = None,
) -> Path:
    """Replace the live agent dir with the snapshot for `version`."""
    base = Path(agent_dir) if agent_dir is not None else _live_agent_dir()
    snap = snapshot_path(version, versions_dir)
    if not snap.exists():
        raise FileNotFoundError(f"no snapshot for version {version!r}: {snap}")

    # Snapshot the *current* live agent first (so we can rollback the rollback).
    current_version, _ = snapshot_agent(base, versions_dir)
    if current_version == version:
        return base

    # Restore the surface from the snapshot but PRESERVE runtime accumulation
    # (router model, corpus, datasets, eval/experiment outputs, workspace).
    base.mkdir(parents=True, exist_ok=True)
    for item in list(base.iterdir()):
        if item.name in _ACCUMULATION:
            continue
        if item.is_dir():
            shutil.rmtree(item)
        else:
            item.unlink()
    shutil.copytree(snap, base, dirs_exist_ok=True)
    return base
