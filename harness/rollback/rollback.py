"""Rollback — restore live agent/ from a prior version snapshot."""

from __future__ import annotations

import shutil
from collections.abc import Iterable
from pathlib import Path

from ledger.versioning import (
    LIVE_AGENT,
    VERSIONS_DIR,
    bump_patch,
    list_snapshots,
    read_version,
    restore_version,
    set_version,
    snapshot_agent,
    snapshot_path,
)
from ledger.writer import write_entry


def _is_within(path: Path, base: Path) -> bool:
    try:
        path.resolve().relative_to(base.resolve())
        return True
    except ValueError:
        return False


def rollback_to(
    version: str,
    *,
    agent_dir: Path | str = LIVE_AGENT,
    reason: str = "manual rollback",
) -> str:
    """Restore live agent/ to a prior `version`. Records the rollback in the ledger.

    Returns the version now live (= `version`, except no-op if already there).
    """
    agent_dir = Path(agent_dir)
    old_version = read_version(agent_dir)
    if old_version == version:
        return version

    if version not in list_snapshots():
        raise FileNotFoundError(
            f"no snapshot for version {version!r}; available: {list_snapshots()}"
        )

    restore_version(version, agent_dir)

    write_entry(
        kind="rollback",
        agent_version_before=old_version,
        agent_version_after=version,
        summary=f"rolled back: {old_version} → {version} ({reason})",
        payload={"reason": reason},
    )
    return version


def rollback_edits(
    version: str,
    files: Iterable[str],
    *,
    agent_dir: Path | str = LIVE_AGENT,
    versions_dir: Path | str = VERSIONS_DIR,
    reason: str = "file-level rollback",
) -> dict[str, list[str]]:
    """Revert only `files` (agent/-relative) to their state at `version`.

    AHE-style file-granularity rollback of a rejected edit: restore each file
    from the `version` snapshot; a file the snapshot lacks (added after it) is
    removed to match. Bumps the live version and snapshots the current tree
    under it first so this is itself undoable, and records a rollback ledger
    entry. Returns {restored, removed, skipped}.
    """
    agent_dir = Path(agent_dir)
    snap = snapshot_path(version, versions_dir)
    if not snap.exists():
        raise FileNotFoundError(f"no snapshot for version {version!r}: {snap}")

    # Bump first, then snapshot: snapshot_agent is idempotent on the version
    # string, so snapshotting under the unchanged version would no-op and lose
    # the pre-rollback tree. The bump gives a fresh version with no snapshot yet.
    old_version = read_version(agent_dir)
    new_version = bump_patch(old_version)
    set_version(agent_dir, new_version)
    snapshot_agent(agent_dir, versions_dir)

    restored: list[str] = []
    removed: list[str] = []
    skipped: list[str] = []
    for rel in files:
        src = snap / rel
        dst = agent_dir / rel
        if not _is_within(dst, agent_dir) or not _is_within(src, snap):
            skipped.append(rel)
            continue
        if src.exists():
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dst)
            restored.append(rel)
        elif dst.exists():
            dst.unlink()
            removed.append(rel)

    write_entry(
        kind="rollback",
        agent_version_before=old_version,
        agent_version_after=new_version,
        summary=f"file-level rollback to {version}: {restored + removed} ({reason})",
        payload={
            "version": version,
            "restored": restored,
            "removed": removed,
            "skipped": skipped,
            "reason": reason,
        },
    )
    return {"restored": restored, "removed": removed, "skipped": skipped}
