"""Create candidate directories by branching the active agent + applying mutations."""

from __future__ import annotations

import json
import secrets
import shutil
from dataclasses import asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

import yaml

from experiments.types import CandidateManifest, Mutation
from runtime.compiler.loader import load_agent


def _candidates_dir(candidates_dir: Optional[Path | str]) -> Path:
    if candidates_dir is not None:
        return Path(candidates_dir)
    from runtime.agent_paths import candidates_dir as _resolve
    return _resolve()


def _new_candidate_id() -> str:
    ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S")
    rand = secrets.token_hex(2)
    return f"cand_{ts}_{rand}"


def _now_iso() -> str:
    return (
        datetime.now(timezone.utc)
        .isoformat(timespec="seconds")
        .replace("+00:00", "Z")
    )


def _set_dotted(d: dict[str, Any], path: str, value: Any) -> None:
    parts = path.split(".")
    cur: Any = d
    for p in parts[:-1]:
        if not isinstance(cur, dict) or p not in cur:
            raise KeyError(f"path {path!r}: intermediate key {p!r} missing")
        cur = cur[p]
    if not isinstance(cur, dict):
        raise KeyError(f"path {path!r}: target is not a dict")
    if parts[-1] not in cur:
        raise KeyError(f"path {path!r}: leaf key {parts[-1]!r} missing")
    cur[parts[-1]] = value


def _apply_mutation(candidate_dir: Path, m: Mutation) -> None:
    target = candidate_dir / "agent" / m.file
    if not target.exists():
        raise FileNotFoundError(f"mutation target {target} does not exist in candidate")
    with target.open() as f:
        doc = yaml.safe_load(f)
    if not isinstance(doc, dict):
        raise ValueError(f"{target} root is not a mapping; cannot apply path {m.path}")
    _set_dotted(doc, m.path, m.value)
    with target.open("w") as f:
        yaml.safe_dump(doc, f, sort_keys=False)


def create_candidate(
    mutations: list[Mutation],
    description: Optional[str] = None,
    baseline_dir: Optional[Path | str] = None,
    candidates_dir: Optional[Path | str] = None,
) -> CandidateManifest:
    """Branch the active agent's surface into a new candidate dir and apply
    mutations.

    ``baseline_dir`` defaults to the active agent (``agents/<id>/``) so a
    candidate is branched from the same surface ``promote`` will swap it back
    over. Returns the candidate manifest; the candidate's agent.yaml is fully
    runnable on its own.
    """
    if not mutations:
        raise ValueError("at least one mutation required")

    if baseline_dir is None:
        from ledger.versioning import resolve_live_dir

        baseline_dir = resolve_live_dir()
    baseline_dir = Path(baseline_dir)
    candidates_dir = _candidates_dir(candidates_dir)
    candidates_dir.mkdir(parents=True, exist_ok=True)

    cid = _new_candidate_id()
    cand_root = candidates_dir / cid
    cand_root.mkdir(parents=True, exist_ok=False)

    # Copy the agent's trainable surface (yaml + pipeline + prompts + config) —
    # NOT runtime accumulation, which lives under the agent dir and would recurse.
    from ledger.versioning import SURFACE_IGNORE
    shutil.copytree(baseline_dir, cand_root / "agent", ignore=SURFACE_IGNORE)

    # Read baseline version (before any mutation applies to the candidate copy)
    baseline_cfg = load_agent(baseline_dir / "agent.yaml")

    # Apply each mutation in order
    for m in mutations:
        _apply_mutation(cand_root, m)

    manifest = CandidateManifest(
        id=cid,
        parent_version=baseline_cfg.version,
        parent_path=str((baseline_dir / "agent.yaml").resolve()),
        created_at=_now_iso(),
        description=description,
        mutations=list(mutations),
    )
    with (cand_root / "manifest.json").open("w") as f:
        json.dump(asdict(manifest), f, indent=2)

    return manifest


def candidate_agent_path(candidate_id: str, candidates_dir: Optional[Path | str] = None) -> Path:
    """Path to a candidate's agent.yaml — feed this to run_suite."""
    return _candidates_dir(candidates_dir) / candidate_id / "agent" / "agent.yaml"


def list_candidates(candidates_dir: Optional[Path | str] = None) -> list[CandidateManifest]:
    """Return all candidate manifests, oldest first."""
    root = _candidates_dir(candidates_dir)
    if not root.exists():
        return []
    out: list[CandidateManifest] = []
    for d in sorted(root.iterdir()):
        manifest_path = d / "manifest.json"
        if not manifest_path.exists():
            continue
        with manifest_path.open() as f:
            data = json.load(f)
        out.append(
            CandidateManifest(
                id=data["id"],
                parent_version=data["parent_version"],
                parent_path=data["parent_path"],
                created_at=data["created_at"],
                description=data.get("description"),
                mutations=[Mutation(**m) for m in data["mutations"]],
            )
        )
    return out
