"""Harness loop orchestration: Proposal → critics → branch → score → critics.

This is the seam where the harness becomes self-driving. Given a list of
Proposals and a critic configuration, the loop:

  1. Runs all PRE-stage critics on each Proposal (cheap; skips bad mutations).
  2. For survivors: branches a candidate, runs the suite, scores.
  3. Runs all POST-stage critics on each candidate result (eval lift,
     regression checks).
  4. Returns one LoopOutcome per Proposal.

Approved outcomes are what the next phase (`harness/approver/`) consumes.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from evals.scoring import selection_key, two_tier_key
from experiments.branching import create_candidate
from experiments.runner import CandidateResult, run_candidate
from harness.approver import ApprovalDecision, Policy, decide
from harness.blueprint import Blueprint
from harness.critics import Critic, CriticStage, make_critic
from harness.executor import promote
from harness.executor.promote import (
    _manifest_verdict_dict,
    _prediction_dict,
    _verdicts_list,
    build_lesson,
)
from harness.types import (
    CriticContext,
    CriticVerdict,
    LoopOutcome,
    ManifestVerdict,
    Proposal,
    VerificationOutcome,
)
from ledger.versioning import LIVE_AGENT, read_version
from ledger.writer import write_entry, write_lesson

# A critic is named either bare ("scope") or with params (("eval_lift", {...})).
# The default critic set + selection live in harness.blueprint.Blueprint.
CriticSpec = str | tuple[str, dict]

_SELECTION_FNS = {"selection_key": selection_key, "two_tier": two_tier_key}


def _selection_fn(name: str):
    fn = _SELECTION_FNS.get(name)
    if fn is None:
        raise ValueError(f"unknown selection {name!r}; expected {sorted(_SELECTION_FNS)}")
    return fn


@dataclass
class LoopRound:
    """One full pass through the loop for a single proposal."""

    outcome: LoopOutcome
    decision: ApprovalDecision
    promoted_version: Optional[str] = None
    promoted_lesson_id: Optional[str] = None
    queued_lesson_id: Optional[str] = None


def _make_from_spec(spec: CriticSpec) -> Critic:
    if isinstance(spec, str):
        return make_critic(spec)
    name, params = spec
    return make_critic(name, params)


def _split_critics(
    pre_names: list[CriticSpec], post_names: list[CriticSpec]
) -> tuple[list[Critic], list[Critic]]:
    """Build critic instances and verify each is in its expected stage."""
    pre = [_make_from_spec(s) for s in pre_names]
    post = [_make_from_spec(s) for s in post_names]
    for c in pre:
        if c.stage != CriticStage.PRE:
            raise ValueError(f"critic {c.name!r} is {c.stage.value}, expected pre")
    for c in post:
        if c.stage != CriticStage.POST:
            raise ValueError(f"critic {c.name!r} is {c.stage.value}, expected post")
    return pre, post


def _run_critics(
    critics: list[Critic],
    ctx: CriticContext,
) -> tuple[list[CriticVerdict], bool]:
    """Run every critic; return verdicts and whether any blocked."""
    verdicts: list[CriticVerdict] = []
    blocked = False
    for c in critics:
        v = c.verdict(ctx)
        verdicts.append(v)
        if not v.approved and v.severity == "block":
            blocked = True
    return verdicts, blocked


def propose_and_score(
    proposals: list[Proposal],
    suite_path: Path | str,
    pre_critics: Optional[list[CriticSpec]] = None,
    post_critics: Optional[list[CriticSpec]] = None,
    blueprint: Optional[Blueprint] = None,
) -> list[LoopOutcome]:
    """Run the full pipeline for a batch of proposals.

    Returns one LoopOutcome per input proposal (same order). The caller
    decides what to do with `approved` outcomes — promote to live, queue
    for human review, etc.
    """
    bp = blueprint or Blueprint()
    pre, post = _split_critics(
        pre_critics if pre_critics is not None else bp.pre_critics,
        post_critics if post_critics is not None else bp.post_critics,
    )

    outcomes: list[LoopOutcome] = []
    for proposal in proposals:
        outcome = LoopOutcome(proposal=proposal, candidate_id=None)

        # Pre-flight critics
        ctx_pre = CriticContext(proposal=proposal)
        pre_verdicts, pre_blocked = _run_critics(pre, ctx_pre)
        outcome.verdicts.extend(pre_verdicts)

        if pre_blocked:
            outcome.final = "rejected"
            outcomes.append(outcome)
            continue

        # Branch + score
        manifest = create_candidate(proposal.mutations, description=proposal.description)
        outcome.candidate_id = manifest.id
        result: CandidateResult = run_candidate(manifest.id, suite_path)
        outcome.candidate_result = result

        # Verify prediction (AHE pillar 3) — opt-in: only when proposal made one.
        # Per-golden predictions are scored by the ManifestVerdict (the real
        # contract); rubric-only predictions (dataset/router) keep the scalar
        # VerificationOutcome. The two don't both run, so the rubric verdict is
        # never miscalibrated against a pass-rate-style expected_delta.
        if proposal.prediction is not None:
            if proposal.prediction.predicted_fixes or proposal.prediction.predicted_regressions:
                outcome.manifest_verdict = ManifestVerdict.evaluate(
                    proposal.prediction, result.delta.get("per_golden", {})
                )
            else:
                actual_delta = _actual_delta_for_rubric(result, proposal.prediction.rubric)
                outcome.verification = VerificationOutcome.evaluate(
                    proposal.prediction, actual_delta
                )

        # Post-eval critics
        ctx_post = CriticContext(
            proposal=proposal,
            candidate_result=result,
            manifest_verdict=outcome.manifest_verdict,
        )
        post_verdicts, post_blocked = _run_critics(post, ctx_post)
        outcome.verdicts.extend(post_verdicts)

        outcome.final = "rejected" if post_blocked else "approved"
        outcomes.append(outcome)

    return outcomes


def _actual_delta_for_rubric(result: "CandidateResult", rubric: str) -> float:
    """Pull the realized delta for a predicted rubric from a CandidateResult."""
    if rubric == "overall":
        return float(result.delta["overall_score"])
    return float(result.delta.get("per_rubric", {}).get(rubric, 0.0))


def run_loop(
    proposals: list[Proposal],
    suite_path: Path | str,
    pre_critics: Optional[list[CriticSpec]] = None,
    post_critics: Optional[list[CriticSpec]] = None,
    policy: Optional[Policy] = None,
    auto_promote: bool = False,
    promote_strategy: Optional[str] = None,   # "best" | "all" | "none"; default from blueprint
    blueprint: Optional[Blueprint] = None,
) -> list[LoopRound]:
    """Full pipeline including approver + executor.

    Steps:
      1. propose_and_score (Proposal → critics → branch → score → critics)
      2. For each outcome, ask the approver (mode in policies/auto_approve.yaml)
      3. If decision is AUTO_APPROVE *and* `auto_promote=True`, promote according
         to `promote_strategy`:
           - "best": only the single highest-Δoverall outcome promotes
           - "all":  every AUTO_APPROVE outcome promotes (sequential)
           - "none": don't promote even on AUTO_APPROVE (records-only run)

    Returns one LoopRound per input proposal.
    """
    bp = blueprint or Blueprint()
    strategy = promote_strategy if promote_strategy is not None else bp.promote_strategy
    if strategy not in {"best", "all", "none"}:
        raise ValueError(f"promote_strategy must be best|all|none, got {strategy!r}")

    outcomes = propose_and_score(proposals, suite_path, pre_critics, post_critics, blueprint=bp)
    pol = policy or Policy.from_yaml()

    decisions = [decide(o, pol) for o in outcomes]
    rounds = [LoopRound(outcome=o, decision=d) for o, d in zip(outcomes, decisions)]

    # Queue-for-human path. Write a provisional lesson + queued_review entry
    # so the UI Review queue can surface the candidate. The candidate's agent
    # already lives at experiments/candidates/<cand_id>/ — promote_queued()
    # reads it back when a human approves.
    live_version = read_version(LIVE_AGENT)
    for r in rounds:
        if r.decision != ApprovalDecision.QUEUE_HUMAN:
            continue
        if r.outcome.candidate_id is None:
            continue  # no branching happened (rejected at pre-flight)
        if r.queued_lesson_id is not None:
            continue  # idempotency

        delta = (
            r.outcome.candidate_result.delta if r.outcome.candidate_result else {}
        )
        delta_overall = delta.get("overall_score", 0.0) if delta else 0.0

        queued_payload: dict = {
            "mutations": [m.describe() for m in r.outcome.proposal.mutations],
            "delta": delta,
            "policy_mode": pol.mode,
            "verdicts": _verdicts_list(r.outcome.verdicts),
        }
        pred = r.outcome.proposal.prediction
        if pred is not None:
            queued_payload["prediction"] = _prediction_dict(pred)
        if r.outcome.manifest_verdict is not None:
            queued_payload["manifest_verdict"] = _manifest_verdict_dict(r.outcome.manifest_verdict)

        entry = write_entry(
            kind="queued_review",
            candidate_id=r.outcome.candidate_id,
            agent_version_before=live_version,
            summary=f"queued for human review (Δoverall={delta_overall:+.4f})",
            payload=queued_payload,
        )
        lesson = build_lesson(
            r.outcome,
            status="awaiting_review",
            parent_version=live_version,
            entry_id=entry.entry_id,
        )
        write_lesson(lesson)
        r.queued_lesson_id = lesson.id

    if not auto_promote or strategy == "none":
        return rounds

    eligible_idxs = [
        i for i, r in enumerate(rounds) if r.decision == ApprovalDecision.AUTO_APPROVE
    ]
    if not eligible_idxs:
        return rounds

    if strategy == "best":
        sel = _selection_fn(bp.selection)

        def _best_key(idx: int) -> tuple[float, ...]:
            cr = rounds[idx].outcome.candidate_result
            return sel(cr.candidate) if cr is not None else (float("-inf"),)

        best_idx = max(eligible_idxs, key=_best_key)
        version, lesson_id = promote(rounds[best_idx].outcome)
        rounds[best_idx].promoted_version = version
        rounds[best_idx].promoted_lesson_id = lesson_id
    else:  # "all" — sequential promotions
        for i in eligible_idxs:
            version, lesson_id = promote(rounds[i].outcome)
            rounds[i].promoted_version = version
            rounds[i].promoted_lesson_id = lesson_id

    return rounds
