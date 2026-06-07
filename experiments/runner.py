"""Run a candidate against a suite and record the delta vs baseline.

This is what makes the loop start to move: every candidate gets compared to
the live agent under the same suite, with the same goldens and rubrics, and
the result is appended (immutable) to experiments/results/.
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from evals.runners.runner import (
    aggregate_per_golden,
    flaky_goldens,
    per_golden_pass,
    run_suite,
)
from experiments.branching import candidate_agent_path, list_candidates
from experiments.types import CandidateManifest



@dataclass
class CandidateResult:
    candidate_id: str
    suite: str
    parent_version: str
    mutations: list[str]
    recorded_at: str
    baseline: dict[str, Any]
    candidate: dict[str, Any]
    delta: dict[str, Any] = field(default_factory=dict)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def _percentile(xs: list[float], q: float) -> float:
    if not xs:
        return 0.0
    s = sorted(xs)
    k = max(0, min(len(s) - 1, int(q * (len(s) - 1))))
    return round(s[k], 2)


def _summary_view(report: Any) -> dict[str, Any]:
    """Trim a Report to what we pin in the JSONL: aggregates + per-golden + latency."""
    summary = report.summary
    durations = [float(c.duration_ms) for c in report.cases]
    return {
        "overall_score": summary.get("overall_score"),
        "pass_rate": summary.get("pass_rate"),
        "per_rubric": dict(summary.get("per_rubric", {})),
        "n_passed": summary.get("n_passed"),
        "n_total": summary.get("n_total"),
        "per_golden": per_golden_pass(report),
        "avg_latency_ms": round(sum(durations) / len(durations), 2) if durations else 0.0,
        "p95_latency_ms": _percentile(durations, 0.95),
        "stage_ms": dict(summary.get("stage_ms", {})),
        "llm_ms": summary.get("llm_ms", 0.0),
        "tool_ms": summary.get("tool_ms", 0.0),
        "n_llm_calls": summary.get("n_llm_calls", 0),
    }


def _mean(xs: list[float]) -> float:
    return round(sum(xs) / len(xs), 4) if xs else 0.0


def _aggregate_views(reports: list[Any]) -> dict[str, Any]:
    """Aggregate k single-rollout views into one (AHE k≥2: stabilize pass@1).

    per_golden collapses to a majority bool (so the delta logic and critics are
    unchanged); per_golden_passrate + flaky carry the variance the extra
    rollouts buy.
    """
    views = [_summary_view(r) for r in reports]
    passrate = aggregate_per_golden([per_golden_pass(r) for r in reports])
    rubric_keys: set[str] = set().union(*(v["per_rubric"].keys() for v in views))
    stage_keys: set[str] = set().union(*(v["stage_ms"].keys() for v in views))
    return {
        "overall_score": _mean([v["overall_score"] for v in views]),
        "pass_rate": _mean([v["pass_rate"] for v in views]),
        "per_rubric": {k: _mean([v["per_rubric"].get(k, 0.0) for v in views]) for k in rubric_keys},
        "n_passed": views[-1]["n_passed"],
        "n_total": views[-1]["n_total"],
        "per_golden": {g: rate >= 0.5 for g, rate in passrate.items()},
        "per_golden_passrate": passrate,
        "flaky": flaky_goldens(passrate),
        "avg_latency_ms": _mean([v["avg_latency_ms"] for v in views]),
        "p95_latency_ms": _mean([v["p95_latency_ms"] for v in views]),
        "stage_ms": {k: _mean([v["stage_ms"].get(k, 0.0) for v in views]) for k in stage_keys},
        "llm_ms": _mean([v["llm_ms"] for v in views]),
        "tool_ms": _mean([v["tool_ms"] for v in views]),
        "n_llm_calls": _mean([v["n_llm_calls"] for v in views]),
    }


def _compute_delta(baseline: dict[str, Any], candidate: dict[str, Any]) -> dict[str, Any]:
    base_pg: dict[str, bool] = baseline.get("per_golden", {})
    cand_pg: dict[str, bool] = candidate.get("per_golden", {})
    ids = set(base_pg) | set(cand_pg)
    return {
        "overall_score": round(candidate["overall_score"] - baseline["overall_score"], 4),
        "pass_rate": round(candidate["pass_rate"] - baseline["pass_rate"], 4),
        "per_rubric": {
            k: round(candidate["per_rubric"].get(k, 0.0) - baseline["per_rubric"].get(k, 0.0), 4)
            for k in baseline["per_rubric"].keys() | candidate["per_rubric"].keys()
        },
        "per_golden": {
            "fixed": sorted(g for g in ids if cand_pg.get(g) and not base_pg.get(g)),
            "regressed": sorted(g for g in ids if base_pg.get(g) and not cand_pg.get(g)),
            "unchanged": sorted(g for g in ids if bool(base_pg.get(g)) == bool(cand_pg.get(g))),
        },
        "latency_ms_delta": round(
            candidate.get("avg_latency_ms", 0.0) - baseline.get("avg_latency_ms", 0.0), 2
        ),
    }


def _load_manifest(candidate_id: str) -> CandidateManifest:
    for m in list_candidates():
        if m.id == candidate_id:
            return m
    raise FileNotFoundError(f"candidate not found: {candidate_id}")


def run_candidate(
    candidate_id: str,
    suite_path: Path | str,
    baseline_agent: Optional[Path | str] = None,
    results_dir: Optional[Path | str] = None,
    write_result: bool = True,
    n_rollouts: int = 1,
) -> CandidateResult:
    """Run baseline + candidate against the same suite; record the delta.

    ``baseline_agent`` defaults to the active agent's agent.yaml so the delta
    is measured against the same surface the candidate was branched from.

    n_rollouts > 1 runs each suite k times and aggregates per-golden pass-rates
    (AHE Algorithm 1: k≥2 rollouts stabilize pass@1). Default 1 is unchanged.
    """
    if n_rollouts < 1:
        raise ValueError(f"n_rollouts must be >= 1, got {n_rollouts}")
    if baseline_agent is None:
        from ledger.versioning import resolve_live_dir

        baseline_agent = resolve_live_dir() / "agent.yaml"
    manifest = _load_manifest(candidate_id)
    cand_yaml = candidate_agent_path(candidate_id)
    if not cand_yaml.exists():
        raise FileNotFoundError(f"candidate agent.yaml missing: {cand_yaml}")

    # Run baseline first so the candidate sees identical golden state.
    baseline_reports = [
        run_suite(suite_path, agent_path=baseline_agent, write_report=False)
        for _ in range(n_rollouts)
    ]
    candidate_reports = [
        run_suite(suite_path, agent_path=cand_yaml, write_report=False)
        for _ in range(n_rollouts)
    ]

    # Persist the candidate's full report so the UI Lesson view can recover the
    # trace lineage later (lesson.candidate_id → cand_<id>.json → cases[].trace_id).
    _persist_candidate_report(candidate_id, candidate_reports[-1])

    if n_rollouts == 1:
        baseline_view = _summary_view(baseline_reports[0])
        candidate_view = _summary_view(candidate_reports[0])
    else:
        baseline_view = _aggregate_views(baseline_reports)
        candidate_view = _aggregate_views(candidate_reports)
    delta = _compute_delta(baseline_view, candidate_view)

    result = CandidateResult(
        candidate_id=candidate_id,
        suite=baseline_reports[0].suite,
        parent_version=manifest.parent_version,
        mutations=[m.describe() for m in manifest.mutations],
        recorded_at=_now_iso(),
        baseline=baseline_view,
        candidate=candidate_view,
        delta=delta,
    )

    if write_result:
        if results_dir is None:
            from runtime.agent_paths import experiments_results_dir
            results_dir = experiments_results_dir()
        _append_result(result, results_dir)

    return result


def _persist_candidate_report(
    candidate_id: str, report: Any, reports_dir: Optional[Path | str] = None
) -> Path:
    if reports_dir is None:
        from runtime.agent_paths import evals_reports_dir
        reports_dir = evals_reports_dir()
    out_dir = Path(reports_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / f"cand_{candidate_id}.json"
    with path.open("w") as f:
        json.dump(asdict(report), f, indent=2, default=str)
    return path


def _append_result(result: CandidateResult, results_dir: Path | str) -> Path:
    out_dir = Path(results_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    path = out_dir / f"{today}.jsonl"
    with path.open("a") as f:
        f.write(json.dumps(asdict(result), ensure_ascii=False) + "\n")
    return path
