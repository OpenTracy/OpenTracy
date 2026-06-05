"""Harness data types: Proposal, Prediction, Critic*, LoopOutcome."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Optional

from experiments.types import Mutation


def kind_from_mutations(mutations: list[str]) -> str:
    """Map a candidate's mutations to one of the change kinds the policy
    overrides table can target. Used by both the executor (lesson labeling)
    and the approver (per-kind policy overrides).

    P15.3.7: the ``versions/router_config`` check comes BEFORE the legacy
    ``route`` check — otherwise the substring ``route`` inside
    ``router_config`` would match the legacy bucket. The legacy
    ``"router"`` kind still applies to ``pipeline/route.yaml`` knob edits.
    """
    files = {m.split(":")[0] for m in mutations}
    if any("versions/router_config" in f for f in files):
        return "router_config"
    if any(f.startswith("datasets/") for f in files):
        return "dataset"
    if any("retrieve" in f for f in files):
        return "rag"
    if any("rerank" in f for f in files):
        return "rerank"
    if any("route" in f for f in files):
        return "router"
    if any("generate" in f or "prompts/" in f for f in files):
        return "prompt"
    if any("memory" in f for f in files):
        return "memory"
    return "other"


@dataclass
class Prediction:
    """A falsifiable claim about what a Proposal will do (AHE pillar 3).

    `rubric` may be a specific eval rubric name (e.g. "keywords_match") or
    the special string "overall" to predict the aggregate score. Direction is
    encoded in the sign of expected_delta.
    """

    rubric: str                  # rubric name or "overall"
    expected_delta: float        # signed; positive = improvement
    rationale: str
    confidence: float = 0.5      # optional 0-1; future routing use
    # AHE Change Manifest: the two task-name sets an edit stakes its claim on.
    predicted_fixes: frozenset[str] = frozenset()
    predicted_regressions: frozenset[str] = frozenset()


@dataclass
class VerificationOutcome:
    """Did reality match the Prediction? Computed post-eval."""

    rubric: str
    expected_delta: float
    actual_delta: float
    direction_correct: bool      # sign(actual) == sign(expected)
    magnitude_met: bool           # abs(actual) >= abs(expected)
    verdict: str                  # "verified" | "partial" | "wrong" | "no_change"

    @classmethod
    def evaluate(
        cls, prediction: Prediction, actual_delta: float
    ) -> "VerificationOutcome":
        expected = prediction.expected_delta
        if expected == 0:
            verdict = "verified" if actual_delta == 0 else "no_change"
            return cls(
                rubric=prediction.rubric,
                expected_delta=expected,
                actual_delta=actual_delta,
                direction_correct=True,
                magnitude_met=actual_delta == 0,
                verdict=verdict,
            )

        same_sign = (actual_delta > 0 and expected > 0) or (
            actual_delta < 0 and expected < 0
        )
        magnitude_met = abs(actual_delta) >= abs(expected)

        if not same_sign and actual_delta != 0:
            verdict = "wrong"
        elif same_sign and magnitude_met:
            verdict = "verified"
        elif same_sign:
            verdict = "partial"
        else:
            verdict = "no_change"

        return cls(
            rubric=prediction.rubric,
            expected_delta=expected,
            actual_delta=actual_delta,
            direction_correct=same_sign,
            magnitude_met=magnitude_met,
            verdict=verdict,
        )


class EditVerdict(str, Enum):
    KEEP = "keep"
    IMPROVE = "improve"
    ROLLBACK_AND_PIVOT = "rollback_and_pivot"


@dataclass
class ManifestVerdict:
    """Per-edit verdict over the AHE Change Manifest (decision observability).

    Scores a Prediction's predicted_fixes/predicted_regressions against the
    candidate's realized per-golden delta. Precision/recall are tracked for
    both fixes and regressions — the regression axis is the one AHE finds the
    loop is blind to, so it is measured explicitly here.
    """

    verdict: EditVerdict
    fix_precision: float
    fix_recall: float
    regression_precision: float
    regression_recall: float
    realized_fixes: list[str]
    realized_regressions: list[str]
    unpredicted_regressions: list[str]
    net_fixes: int

    @classmethod
    def evaluate(
        cls, prediction: "Prediction", per_golden_delta: dict[str, Any]
    ) -> "ManifestVerdict":
        predicted_fixes = set(prediction.predicted_fixes)
        predicted_regressions = set(prediction.predicted_regressions)
        actual_fixes = set(per_golden_delta.get("fixed", []))
        actual_regressions = set(per_golden_delta.get("regressed", []))

        fix_tp = predicted_fixes & actual_fixes
        reg_tp = predicted_regressions & actual_regressions
        unpredicted = actual_regressions - predicted_regressions
        net = len(actual_fixes) - len(actual_regressions)

        def _ratio(num: int, den: int) -> float:
            return round(num / den, 4) if den else 0.0

        if net <= 0 or unpredicted:
            verdict = EditVerdict.ROLLBACK_AND_PIVOT
        elif predicted_fixes and predicted_fixes <= actual_fixes:
            verdict = EditVerdict.KEEP
        else:
            verdict = EditVerdict.IMPROVE

        return cls(
            verdict=verdict,
            fix_precision=_ratio(len(fix_tp), len(predicted_fixes)),
            fix_recall=_ratio(len(fix_tp), len(actual_fixes)),
            regression_precision=_ratio(len(reg_tp), len(predicted_regressions)),
            regression_recall=_ratio(len(reg_tp), len(actual_regressions)),
            realized_fixes=sorted(actual_fixes),
            realized_regressions=sorted(actual_regressions),
            unpredicted_regressions=sorted(unpredicted),
            net_fixes=net,
        )


@dataclass
class Proposal:
    """A candidate mutation the proposer wants to test.

    A Proposal does not yet have a candidate_id — it's pre-branching. The loop
    orchestrator turns approved Proposals into branched candidates. If a
    Prediction is attached, the loop verifies it post-eval and records the
    outcome in the ledger (AHE: decision observability).
    """

    mutations: list[Mutation]
    description: Optional[str] = None
    source: str = "heuristic"     # "heuristic" | "claude_code" | "human" | …
    metadata: dict[str, Any] = field(default_factory=dict)
    prediction: Optional[Prediction] = None


@dataclass
class CriticVerdict:
    """One critic's verdict on a Proposal (or candidate result)."""

    critic: str
    approved: bool
    reason: str
    severity: str = "info"  # "info" | "warn" | "block"


@dataclass
class CriticContext:
    """What a critic sees.

    Pre-flight critics (scope, budget) only see `proposal`.
    Post-eval critics (eval_lift, regression) also see `candidate_result`.
    """

    proposal: Proposal
    candidate_result: Optional[Any] = None  # experiments.runner.CandidateResult
    manifest_verdict: Optional[ManifestVerdict] = None


@dataclass
class LoopOutcome:
    """Final state of one proposer→critics→eval round for one Proposal."""

    proposal: Proposal
    candidate_id: Optional[str]            # set if the Proposal got branched
    verdicts: list[CriticVerdict] = field(default_factory=list)
    candidate_result: Optional[Any] = None # experiments.runner.CandidateResult
    verification: Optional[VerificationOutcome] = None   # if proposal had prediction
    manifest_verdict: Optional[ManifestVerdict] = None   # if prediction named task sets
    final: str = "pending"                 # "approved" | "rejected" | "pending"

    @property
    def approved(self) -> bool:
        return self.final == "approved"
