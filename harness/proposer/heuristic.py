"""Heuristic proposer — deterministic mutation strategies.

v0 strategy: sweep_knob — generate one Proposal per value of a single knob.
Cheap, deterministic, useful for asking "does this knob actually matter?".
"""

from __future__ import annotations

from typing import Any

from experiments.types import Mutation
from harness.proposer.prediction import predict_impact
from harness.types import Proposal


def sweep_knob(
    file: str,
    path: str,
    values: list[Any],
    description_prefix: str = "sweep",
    baseline_per_golden: dict[str, bool] | None = None,
) -> list[Proposal]:
    """Generate one Proposal per value, each mutating (file, path) to that value.

    When `baseline_per_golden` is given, each Proposal carries an evidence-
    grounded prediction so the loop can score it with ManifestVerdict.
    """
    if not values:
        raise ValueError("values must be non-empty")

    return [
        Proposal(
            mutations=[Mutation(file=file, path=path, value=v)],
            description=f"{description_prefix}: {file}:{path}={v}",
            source="heuristic_sweep",
            metadata={"strategy": "sweep_knob", "knob": f"{file}:{path}"},
            prediction=(
                predict_impact(
                    baseline_per_golden, rationale=f"{description_prefix} {file}:{path}={v}"
                )
                if baseline_per_golden is not None
                else None
            ),
        )
        for v in values
    ]
