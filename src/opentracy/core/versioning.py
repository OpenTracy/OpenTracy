"""Agent versioning: a Git-backed version tree for the config plane (ADR-0007).

The agent IS its configuration files. This module tracks exactly that plane —
soul.md, agent.json, jobs.json, skills/ — in a dedicated hidden repository
(.opentracy/versions.git), one tagged commit per version, the commit message being
the structured changelog (what / why / expected impact). Rollback restores an
old version as a NEW version; history is never rewritten.

State (memory/, sessions/) is deliberately NOT versioned here: rolling back
the agent's behavior must not erase what it has learned.
"""

from __future__ import annotations

import subprocess
from dataclasses import dataclass
from pathlib import Path

# The config plane: what makes the agent THE agent.
CONFIG_PATHS = ("soul.md", "agent.json", "jobs.json", "skills")

_GIT_IDENTITY = [
    "-c", "user.name=opentracy",
    "-c", "user.email=opentracy@local",
]


class VersioningError(Exception):
    pass


@dataclass(frozen=True)
class Version:
    tag: str
    sha: str
    date: str
    subject: str


class AgentVersioner:
    def __init__(self, root: Path | str):
        self.root = Path(root).resolve()
        self.git_dir = self.root / ".opentracy" / "versions.git"
        self._migrate_legacy_state_dir()

    def _migrate_legacy_state_dir(self) -> None:
        """Workspaces created before the OpenTracy rename kept the version
        tree under .sar/ — adopt it in place so no history is lost."""
        legacy = self.root / ".sar"
        if self.git_dir.exists() or not (legacy / "versions.git").exists():
            return
        legacy.rename(self.git_dir.parent)

    # ------------------------------------------------------------------
    # plumbing
    # ------------------------------------------------------------------

    def _git(self, *args: str, check: bool = True) -> str:
        cmd = [
            "git", *_GIT_IDENTITY,
            f"--git-dir={self.git_dir}", f"--work-tree={self.root}",
            *args,
        ]
        proc = subprocess.run(cmd, capture_output=True, text=True, cwd=self.root)
        if check and proc.returncode != 0:
            raise VersioningError(
                f"git {' '.join(args[:2])} failed: {proc.stderr.strip()[:300]}"
            )
        return proc.stdout

    def _existing_paths(self) -> list[str]:
        return [p for p in CONFIG_PATHS if (self.root / p).exists()]

    @property
    def initialized(self) -> bool:
        return self.git_dir.exists()

    def ensure_init(self) -> None:
        """Create the hidden repo and the v1 baseline on first use."""
        if self.initialized:
            return
        self.git_dir.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(
            ["git", "init", "--bare", "--initial-branch=main", str(self.git_dir)],
            capture_output=True, text=True, check=True,
        )
        self._git("config", "core.bare", "false")
        self.commit_version(
            oneliner="baseline: initial agent configuration",
            body="- **What:** first snapshot of soul.md, agent.json, jobs.json, skills/\n"
                 "- **Why:** versioning enabled\n"
                 "- **Expected impact:** none — starting point for the version tree",
            trigger="init",
        )

    # ------------------------------------------------------------------
    # change detection
    # ------------------------------------------------------------------

    def is_dirty(self) -> bool:
        if not self.initialized:
            return False
        status = self._git("status", "--porcelain", "--", *self._existing_paths())
        return bool(status.strip())

    def pending_diff(self, max_chars: int = 8_000) -> str:
        """Human-readable summary of uncommitted config changes (tracked diff
        + untracked file list)."""
        paths = self._existing_paths()
        diff = self._git("diff", "HEAD", "--", *paths)
        untracked = self._git(
            "ls-files", "--others", "--exclude-standard", "--", *paths
        ).strip()
        if untracked:
            diff += "\n" + "\n".join(f"new file: {f}" for f in untracked.splitlines())
        diff = diff.strip()
        if len(diff) > max_chars:
            diff = diff[:max_chars] + "\n[... diff clipped ...]"
        return diff

    # ------------------------------------------------------------------
    # versions
    # ------------------------------------------------------------------

    def _tags(self) -> list[str]:
        out = self._git("tag", "-l", "v*", "--sort=v:refname")
        return [t for t in out.split() if t]

    def commit_version(self, oneliner: str, body: str, trigger: str) -> Version:
        self.ensure_init()
        self._git("add", "-A", "--", *self._existing_paths())
        message = f"{oneliner.strip()}\n\n{body.strip()}\n\nTrigger: {trigger}"
        self._git("commit", "--allow-empty", "-m", message)
        tag = f"v{len(self._tags()) + 1}"
        self._git("tag", tag)
        sha = self._git("rev-parse", "--short", "HEAD").strip()
        date = self._git("log", "-1", "--format=%cs").strip()
        return Version(tag=tag, sha=sha, date=date, subject=oneliner.strip())

    def list_versions(self) -> list[Version]:
        if not self.initialized:
            return []
        versions = []
        for tag in self._tags():
            line = self._git("log", "-1", "--format=%h|%cs|%s", tag).strip()
            sha, date, subject = line.split("|", 2)
            versions.append(Version(tag=tag, sha=sha, date=date, subject=subject))
        return versions

    def show(self, ref: str) -> str:
        self.ensure_init()
        message = self._git("show", "-s", "--format=%B", ref).strip()
        stat = self._git("show", "--stat", "--format=", ref).strip()
        return f"{message}\n\n{stat}" if stat else message

    def diff(self, ref_a: str, ref_b: str) -> str:
        self.ensure_init()
        return self._git("diff", ref_a, ref_b, "--", *CONFIG_PATHS).strip() or "(no differences)"

    # ------------------------------------------------------------------
    # rollback — a new version, never history rewriting
    # ------------------------------------------------------------------

    def rollback(self, ref: str) -> Version:
        self.ensure_init()
        current = self._tags()[-1] if self._tags() else "HEAD"

        # files tracked now but absent at ref must be deleted from the worktree
        now_files = set(self._git("ls-tree", "-r", "--name-only", "HEAD").splitlines())
        ref_files = set(self._git("ls-tree", "-r", "--name-only", ref).splitlines())
        for extra in sorted(now_files - ref_files):
            target = self.root / extra
            if target.exists():
                target.unlink()

        if ref_files:
            # checkout exactly the files known at ref — a blanket CONFIG_PATHS
            # pathspec fails if some config file never existed in history
            self._git("checkout", ref, "--", *sorted(ref_files))

        return self.commit_version(
            oneliner=f"rollback: restored agent configuration to {ref}",
            body=f"- **What:** config plane restored to the state of {ref}\n"
                 f"- **Why:** user-initiated rollback (was at {current})\n"
                 f"- **Expected impact:** behavior returns to how the agent acted at {ref}; "
                 f"versions after {ref} remain in history and can be re-applied",
            trigger=f"rollback from {current} to {ref}",
        )
