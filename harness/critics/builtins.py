"""Built-in critics for v0.

- ScopeCritic (pre)        : every mutation.file must match config/claude_code.yaml
                             `mutable` allowlist. The hard boundary that stops
                             the loop from touching the framework.
- EvalLiftCritic (post)    : candidate's Δoverall_score must be ≥ a threshold.
                             The quality gate.
- NoCriticalRegression (post): no rubric may regress below an absolute floor.
                               Avoids "won overall, broke something critical".
"""

from __future__ import annotations

import fnmatch
import posixpath
from pathlib import Path
from typing import Any, Optional

import yaml

from harness.critics.base import Critic, CriticStage, register_critic
from harness.types import CriticContext, CriticVerdict, EditVerdict


@register_critic
class ScopeCritic(Critic):
    """Each mutation's file must match the `mutable` allowlist.

    Mutations carry agent/-relative file paths (e.g. "pipeline/retrieve.yaml").
    The allowlist patterns are repo-relative (e.g. "agent/**"). We prepend
    "agent/" before checking.

    Params:
      config_path: str = "config/claude_code.yaml"
    """

    name = "scope"
    stage = CriticStage.PRE

    def __init__(self, params: Optional[dict[str, Any]] = None) -> None:
        super().__init__(params)
        self._config_path = Path(self.params.get("config_path", "config/claude_code.yaml"))
        self._cache: Optional[dict[str, Any]] = None

    def _load(self) -> dict[str, Any]:
        if self._cache is None:
            with self._config_path.open() as f:
                self._cache = yaml.safe_load(f) or {}
        return self._cache

    def verdict(self, ctx: CriticContext) -> CriticVerdict:
        cfg = self._load()
        mutable: list[str] = cfg.get("mutable", [])
        if not mutable:
            return CriticVerdict(
                critic=self.name,
                approved=False,
                reason=f"{self._config_path}: no `mutable` patterns; refusing all mutations",
                severity="block",
            )

        violations: list[str] = []
        for m in ctx.proposal.mutations:
            # Mutations are agent/-relative; canonicalize so `..` traversal
            # doesn't sneak past fnmatch (which is pure string matching).
            effective = posixpath.normpath(f"agent/{m.file}")
            if effective.startswith(".."):
                violations.append(f"{m.file} (escapes repo root via ..)")
                continue
            if not any(fnmatch.fnmatch(effective, pat) for pat in mutable):
                violations.append(effective)

        if violations:
            return CriticVerdict(
                critic=self.name,
                approved=False,
                reason=f"scope violations: {violations}",
                severity="block",
            )
        return CriticVerdict(
            critic=self.name,
            approved=True,
            reason=f"{len(ctx.proposal.mutations)} mutation(s) within allowlist",
        )


@register_critic
class EvalLiftCritic(Critic):
    """Candidate must score better than baseline by at least `min_delta`.

    Default min_delta=0.0 means "non-regressing" passes; >0 requires real lift.

    Params:
      min_delta: float = 0.0
    """

    name = "eval_lift"
    stage = CriticStage.POST

    def verdict(self, ctx: CriticContext) -> CriticVerdict:
        if ctx.candidate_result is None:
            return CriticVerdict(
                critic=self.name,
                approved=False,
                reason="no candidate_result available (post-stage critic needs scored candidate)",
                severity="block",
            )

        min_delta = float(self.params.get("min_delta", 0.0))
        delta = float((ctx.candidate_result.delta or {}).get("overall_score", 0.0))

        if delta >= min_delta:
            return CriticVerdict(
                critic=self.name,
                approved=True,
                reason=f"Δoverall={delta:+.4f} >= {min_delta:+.4f}",
            )
        return CriticVerdict(
            critic=self.name,
            approved=False,
            reason=f"Δoverall={delta:+.4f} < {min_delta:+.4f}",
            severity="block",
        )


@register_critic
class NoCriticalRegression(Critic):
    """No per-rubric score may drop below `floor`.

    Catches "won on average but tanked a key rubric" — a Goodhart guard.

    Params:
      floor: float = 0.0     # candidate per-rubric score must be >= floor
      rubrics: list[str] = []  # if non-empty, only check these rubric names
    """

    name = "no_critical_regression"
    stage = CriticStage.POST

    def verdict(self, ctx: CriticContext) -> CriticVerdict:
        if ctx.candidate_result is None:
            return CriticVerdict(
                critic=self.name, approved=False,
                reason="no candidate_result available", severity="block",
            )

        floor = float(self.params.get("floor", 0.0))
        watched: list[str] = list(self.params.get("rubrics", []))
        per_rubric: dict[str, float] = ctx.candidate_result.candidate["per_rubric"]

        offenders: list[str] = []
        for name, score in per_rubric.items():
            if watched and name not in watched:
                continue
            if score < floor:
                offenders.append(f"{name}={score:.3f}")

        if offenders:
            return CriticVerdict(
                critic=self.name,
                approved=False,
                reason=f"rubrics below floor {floor}: {offenders}",
                severity="block",
            )
        return CriticVerdict(
            critic=self.name,
            approved=True,
            reason=f"all rubrics ≥ floor {floor}",
        )


@register_critic
class RegressionBudgetCritic(Critic):
    """Block when more goldens flipped pass→fail than `max_regressions`.

    Per-task regression guard: fires even when Δoverall ≥ 0, catching the
    "won on average but broke N goldens" case the aggregate score hides.

    Params:
      max_regressions: int = 0
    """

    name = "regression_budget"
    stage = CriticStage.POST

    def verdict(self, ctx: CriticContext) -> CriticVerdict:
        if ctx.candidate_result is None:
            return CriticVerdict(
                critic=self.name, approved=False,
                reason="no candidate_result available", severity="block",
            )

        max_regressions = int(self.params.get("max_regressions", 0))
        per_golden = ctx.candidate_result.delta.get("per_golden", {})
        regressed = list(per_golden.get("regressed", []))

        if len(regressed) > max_regressions:
            return CriticVerdict(
                critic=self.name,
                approved=False,
                reason=(
                    f"{len(regressed)} golden(s) regressed "
                    f"(budget {max_regressions}): {regressed}"
                ),
                severity="block",
            )
        return CriticVerdict(
            critic=self.name,
            approved=True,
            reason=f"{len(regressed)} regression(s) within budget {max_regressions}",
        )


@register_critic
class PredictionHonestyCritic(Critic):
    """Warn (never block) when a prediction was inaccurate.

    Inaccurate means a predicted fix didn't land, or a regression appeared that
    the edit did NOT predict (a surprise). A regression that was correctly
    predicted is honest and does not warn — matching ManifestVerdict, which only
    forces a rollback on *unpredicted* regressions. A learning signal, not a
    gate: it makes the loop's regression blindness visible round over round.
    """

    name = "prediction_honesty"
    stage = CriticStage.POST

    def verdict(self, ctx: CriticContext) -> CriticVerdict:
        pred = ctx.proposal.prediction
        if pred is None or not (pred.predicted_fixes or pred.predicted_regressions):
            return CriticVerdict(
                critic=self.name, approved=True, reason="no predicted task sets to check",
            )
        if ctx.candidate_result is None:
            return CriticVerdict(
                critic=self.name, approved=False,
                reason="no candidate_result available", severity="block",
            )

        per_golden = ctx.candidate_result.delta.get("per_golden", {})
        actual_fixes = set(per_golden.get("fixed", []))
        actual_regressions = set(per_golden.get("regressed", []))
        missed_fixes = set(pred.predicted_fixes) - actual_fixes
        unpredicted_regressions = actual_regressions - set(pred.predicted_regressions)

        if missed_fixes or unpredicted_regressions:
            return CriticVerdict(
                critic=self.name,
                approved=False,
                reason=(
                    f"missed fixes={sorted(missed_fixes)}; "
                    f"unpredicted regressions={sorted(unpredicted_regressions)}"
                ),
                severity="warn",
            )
        return CriticVerdict(
            critic=self.name, approved=True, reason="prediction matched outcome",
        )


@register_critic
class ManifestGateCritic(Critic):
    """Block promotion when the per-edit manifest verdict is ROLLBACK_AND_PIVOT.

    Turns the manifest verdict from advisory into enforcement. With no verdict
    (the proposal staked no per-golden prediction) there is nothing to gate on,
    so it passes. Opt-in via the blueprint, like regression_budget.
    """

    name = "manifest_gate"
    stage = CriticStage.POST

    def verdict(self, ctx: CriticContext) -> CriticVerdict:
        mv = ctx.manifest_verdict
        if mv is None:
            return CriticVerdict(
                critic=self.name, approved=True, reason="no manifest verdict to gate on",
            )
        if mv.verdict == EditVerdict.ROLLBACK_AND_PIVOT:
            return CriticVerdict(
                critic=self.name,
                approved=False,
                reason=(
                    f"manifest verdict {mv.verdict.value}; "
                    f"unpredicted regressions={mv.unpredicted_regressions}"
                ),
                severity="block",
            )
        return CriticVerdict(
            critic=self.name, approved=True, reason=f"manifest verdict {mv.verdict.value}",
        )
