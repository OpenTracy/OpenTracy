"""Distillation pass — raw → structured corpus.

Reads from existing data (ledger, traces, experiments/results, candidates) and
produces DistilledSession + DistilledEpoch artifacts in traces/distilled/.

Every distilled artifact is content-addressable and idempotent: rerunning the
distillation over the same inputs produces the same output (modulo timestamp
of distillation itself). This means tools can re-distill anytime without fear.
"""

from __future__ import annotations

import json
from dataclasses import asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from experiments.branching import list_candidates
from harness.observability.audit import performance_audit
from harness.observability.types import (
    DistilledEpoch,
    DistilledSession,
    EpochCounts,
    SessionAggregate,
    TopEvent,
)
from ledger.writer import read_entries, read_lessons

SESSIONS_DIR = Path("traces/distilled/sessions")
EPOCHS_DIR = Path("traces/distilled/epochs")
RESULTS_GLOB = Path("experiments/results")


# ---------- helpers ----------


def _read_jsonl(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    out: list[dict[str, Any]] = []
    with path.open() as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            out.append(json.loads(line))
    return out


def _all_results() -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for p in sorted(RESULTS_GLOB.glob("*.jsonl")):
        out.extend(_read_jsonl(p))
    return out


def _now_iso() -> str:
    return (
        datetime.now(timezone.utc)
        .isoformat(timespec="milliseconds")
        .replace("+00:00", "Z")
    )


# ---------- session distillation ----------


def distill_session(
    candidate_id: str,
    sessions_dir: Path | str = SESSIONS_DIR,
) -> DistilledSession:
    """Build a DistilledSession for one candidate from existing artifacts.

    Sources:
      - experiments/candidates/<id>/manifest.json  (mutations, parent, created_at)
      - experiments/results/*.jsonl                (latest row for this candidate)
      - ledger/entries/*.jsonl                     (entries with this candidate_id)
      - ledger/lessons/*.json                      (lesson if promoted)
    """
    # Find manifest
    manifest = next((m for m in list_candidates() if m.id == candidate_id), None)
    if manifest is None:
        raise FileNotFoundError(f"candidate not found: {candidate_id}")

    # Latest result for this candidate
    rows = [r for r in _all_results() if r.get("candidate_id") == candidate_id]
    latest = rows[-1] if rows else None

    # Ledger entries for this candidate (causal chain)
    ledger_rows = [e for e in read_entries(agent_id="__all__") if e.candidate_id == candidate_id]

    # Lesson if any
    lessons = [le for le in read_lessons(agent_id="__all__") if le.candidate_id == candidate_id]
    lesson = lessons[-1] if lessons else None

    # Decide final_decision + promoted_version + blocking_critic
    final_decision: Optional[str] = None
    promoted_version: Optional[str] = None
    blocking_critic: Optional[str] = None

    promote_entries = [e for e in ledger_rows if e.kind == "promote"]
    if promote_entries:
        final_decision = "auto_approve"
        promoted_version = promote_entries[-1].agent_version_after
    elif any(e.kind == "rejected" for e in ledger_rows):
        final_decision = "rejected_by_critic"
    elif any(e.kind == "queued_review" for e in ledger_rows):
        final_decision = "queued_for_review"
    elif latest is not None:
        final_decision = "scored_only"

    agg: Optional[SessionAggregate] = None
    if latest is not None:
        cand = latest.get("candidate", {})
        n_total = int(cand.get("n_total", 0))
        n_passed = int(cand.get("n_passed", 0))
        agg = SessionAggregate(
            n_traces=n_total,
            n_passed=n_passed,
            n_failed=max(0, n_total - n_passed),
            avg_latency_ms=float(cand.get("avg_latency_ms", 0.0) or 0.0),
            p95_latency_ms=float(cand.get("p95_latency_ms", 0.0) or 0.0),
        )

    performance_dict: Optional[dict[str, Any]] = None
    if latest is not None:
        cand_view = latest.get("candidate", {})
        performance_dict = performance_audit(
            cand_view.get("stage_ms", {}),
            llm_ms=cand_view.get("llm_ms"),
            tool_ms=cand_view.get("tool_ms"),
            n_llm_calls=cand_view.get("n_llm_calls"),
        )

    # Recover the prediction + verdict from the latest decision entry — promoted,
    # queued for review, or rejected (not just promoted).
    prediction_dict: Optional[dict[str, Any]] = None
    actual_dict: Optional[dict[str, Any]] = None
    prediction_verified: Optional[bool] = None
    decision_entries = [
        e for e in ledger_rows if e.kind in ("promote", "queued_review", "rejected")
    ]
    if decision_entries:
        pl = decision_entries[-1].payload or {}
        pred = pl.get("prediction")
        if pred:
            prediction_dict = {
                "rubric": pred.get("rubric"),
                "expected_delta": pred.get("expected_delta"),
                "rationale": pred.get("rationale"),
            }
        # A payload can carry the rubric-scalar verification AND the per-golden
        # manifest verdict; keep them in separate namespaces so neither clobbers
        # the other, and treat the prediction as verified only if every present
        # signal verified.
        actual: dict[str, Any] = {}
        verdicts: list[bool] = []
        verif = pl.get("verification")
        if verif:
            actual["rubric"] = {
                "rubric": verif.get("rubric"),
                "actual_delta": verif.get("actual_delta"),
                "verdict": verif.get("verdict"),
            }
            verdicts.append(verif.get("verdict") == "verified")
        mv = pl.get("manifest_verdict")
        if mv:
            actual["manifest"] = {
                "verdict": mv.get("verdict"),
                "fix_recall": mv.get("fix_recall"),
                "regression_recall": mv.get("regression_recall"),
            }
            verdicts.append(mv.get("verdict") == "keep")
        if actual:
            actual_dict = actual
            prediction_verified = all(verdicts) if verdicts else None

    # Build summary
    mutations_str = ", ".join(m.describe() for m in manifest.mutations)
    if latest is not None:
        delta = latest["delta"]["overall_score"]
        score = latest["candidate"]["overall_score"]
        summary = (
            f"Candidate {candidate_id} mutated [{mutations_str}] from {manifest.parent_version}. "
            f"Suite={latest.get('suite')}: overall={score:.3f}, Δ={delta:+.4f} vs baseline. "
        )
    else:
        summary = (
            f"Candidate {candidate_id} mutated [{mutations_str}] from {manifest.parent_version}. "
            "No suite run recorded."
        )

    if promoted_version:
        summary += f"Promoted → {promoted_version}."
    elif final_decision is not None:
        summary += f"Outcome: {final_decision}."

    if lesson is not None:
        summary += f" Lesson {lesson.id} captured."

    session = DistilledSession(
        session_id=f"sess_{candidate_id}",
        kind="experiment",
        started_at=manifest.created_at,
        ended_at=(
            ledger_rows[-1].timestamp if ledger_rows else manifest.created_at
        ),
        candidate_id=candidate_id,
        parent_version=manifest.parent_version,
        suite=latest.get("suite") if latest else None,
        proposal_source=None,            # not tracked in v0
        mutations=[m.describe() for m in manifest.mutations],
        prediction=prediction_dict,
        actual=actual_dict,
        prediction_verified=prediction_verified,
        aggregate=agg,
        performance=performance_dict,
        overall_score=(latest["candidate"]["overall_score"] if latest else None),
        pass_rate=(latest["candidate"]["pass_rate"] if latest else None),
        delta_overall=(latest["delta"]["overall_score"] if latest else None),
        final_decision=final_decision,
        promoted_version=promoted_version,
        blocking_critic=blocking_critic,
        ledger_entries=[e.entry_id for e in ledger_rows],
        trace_ids=[],                    # could correlate by timestamp; v0 leaves empty
        lesson_id=lesson.id if lesson else None,
        summary=summary,
    )

    # Persist
    out_dir = Path(sessions_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / f"{session.session_id}.json"
    with path.open("w") as f:
        json.dump(asdict(session), f, indent=2, ensure_ascii=False)
    return session


def distill_all_sessions(sessions_dir: Path | str = SESSIONS_DIR) -> list[DistilledSession]:
    out: list[DistilledSession] = []
    for m in list_candidates():
        try:
            out.append(distill_session(m.id, sessions_dir))
        except Exception as e:
            print(f"  warn: failed to distill {m.id}: {e}")
    return out


# ---------- epoch distillation ----------


def _entries_in_window(start_iso: str, end_iso: str) -> list:
    return [e for e in read_entries(agent_id="__all__") if start_iso <= e.timestamp <= end_iso]


def _build_top_events(entries: list, max_events: int = 8) -> list[TopEvent]:
    events: list[TopEvent] = []
    for e in entries:
        if e.kind == "promote":
            events.append(
                TopEvent(
                    kind="promotion",
                    when=e.timestamp,
                    summary=e.summary or f"{e.agent_version_before} → {e.agent_version_after}",
                    candidate_id=e.candidate_id,
                    version=e.agent_version_after,
                    ledger_entry_id=e.entry_id,
                )
            )
        elif e.kind == "rollback":
            events.append(
                TopEvent(
                    kind="rollback",
                    when=e.timestamp,
                    summary=e.summary or f"{e.agent_version_before} → {e.agent_version_after}",
                    version=e.agent_version_after,
                    ledger_entry_id=e.entry_id,
                )
            )
    # cap to most recent N
    return events[-max_events:]


def _epoch_summary(counts: EpochCounts, kind: str, span: str) -> str:
    bits: list[str] = [f"{kind} epoch {span}:"]
    bits.append(f"{counts.n_promoted} promotion(s)")
    if counts.n_rolled_back:
        bits.append(f"{counts.n_rolled_back} rollback(s)")
    if counts.n_rejected_by_critic or counts.n_rejected_by_policy:
        bits.append(
            f"{counts.n_rejected_by_critic + counts.n_rejected_by_policy} rejection(s)"
        )
    if counts.n_proposals:
        bits.append(f"{counts.n_proposals} proposal(s) seen in ledger")
    return ", ".join(bits) + "."


def distill_day(date_str: str, epochs_dir: Path | str = EPOCHS_DIR) -> DistilledEpoch:
    """date_str: 'YYYY-MM-DD'."""
    start = f"{date_str}T00:00:00.000Z"
    end = f"{date_str}T23:59:59.999Z"
    entries = _entries_in_window(start, end)

    counts = EpochCounts(
        n_proposals=sum(1 for e in entries if e.kind == "proposal"),
        n_branched=sum(1 for e in entries if e.kind == "candidate_run"),
        n_promoted=sum(1 for e in entries if e.kind == "promote"),
        n_rolled_back=sum(1 for e in entries if e.kind == "rollback"),
        n_rejected_by_critic=sum(1 for e in entries if e.kind == "rejected"),
        n_rejected_by_policy=sum(1 for e in entries if e.kind == "queued_review"),
    )

    versions: list[str] = []
    for e in entries:
        for v in (e.agent_version_before, e.agent_version_after):
            if v and v not in versions:
                versions.append(v)

    epoch = DistilledEpoch(
        epoch_id=f"day:{date_str}",
        kind="day",
        started_at=start,
        ended_at=end,
        counts=counts,
        top_events=_build_top_events(entries),
        sessions=[],  # could correlate via candidate_id timestamps; defer
        referenced_versions=versions,
        summary=_epoch_summary(counts, "Daily", date_str),
    )

    out_dir = Path(epochs_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / f"day_{date_str}.json"
    with path.open("w") as f:
        json.dump(asdict(epoch), f, indent=2, ensure_ascii=False)
    return epoch


def distill_version(version: str, epochs_dir: Path | str = EPOCHS_DIR) -> DistilledEpoch:
    """All ledger activity where this version was either before or after."""
    entries = [
        e
        for e in read_entries(agent_id="__all__")
        if e.agent_version_before == version or e.agent_version_after == version
    ]
    if not entries:
        raise ValueError(f"no ledger entries reference version {version!r}")

    started_at = entries[0].timestamp
    ended_at = entries[-1].timestamp
    counts = EpochCounts(
        n_proposals=sum(1 for e in entries if e.kind == "proposal"),
        n_branched=sum(1 for e in entries if e.kind == "candidate_run"),
        n_promoted=sum(1 for e in entries if e.kind == "promote" and e.agent_version_after == version),
        n_rolled_back=sum(1 for e in entries if e.kind == "rollback" and e.agent_version_before == version),
        n_rejected_by_critic=0,
        n_rejected_by_policy=0,
    )

    epoch = DistilledEpoch(
        epoch_id=f"version:{version}",
        kind="version",
        started_at=started_at,
        ended_at=ended_at,
        counts=counts,
        top_events=_build_top_events(entries),
        sessions=[],
        referenced_versions=[version],
        summary=_epoch_summary(counts, "Version", version),
    )

    out_dir = Path(epochs_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / f"version_{version}.json"
    with path.open("w") as f:
        json.dump(asdict(epoch), f, indent=2, ensure_ascii=False)
    return epoch
