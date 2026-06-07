"""Build the AHE Change-Manifest prediction a proposer stakes on an edit.

An edit's predicted impact is two golden-id sets: which goldens it expects to
fix and which it puts at risk. A caller that knows its target (e.g. an Evolve
agent reasoning over failure analysis) passes them explicitly; absent that, the
evidence-grounded default predicts the edit fixes the currently-failing goldens
and regresses none. The loop then scores the prediction with ManifestVerdict.
"""

from __future__ import annotations

from collections.abc import Iterable

from harness.types import Prediction


def predict_impact(
    baseline_per_golden: dict[str, bool],
    *,
    rationale: str,
    predicted_fixes: Iterable[str] | None = None,
    predicted_regressions: Iterable[str] | None = None,
) -> Prediction:
    """Stake a per-golden prediction. Defaults: fix the currently-failing
    goldens, regress none."""
    if predicted_fixes is None:
        fixes = frozenset(g for g, ok in baseline_per_golden.items() if not ok)
    else:
        fixes = frozenset(predicted_fixes)
    regressions = frozenset(predicted_regressions or ())

    n = len(baseline_per_golden)
    expected_delta = round(len(fixes) / n, 4) if n else 0.0
    return Prediction(
        rubric="overall",
        expected_delta=expected_delta,
        rationale=rationale,
        predicted_fixes=fixes,
        predicted_regressions=regressions,
    )
