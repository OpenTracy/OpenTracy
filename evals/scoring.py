"""Two-tier candidate scoring: pass-rate first, latency as the tiebreaker.

OpenTracy's instantiation of the (deliberately formula-free) two-tier metric
from "The Last Harness You'll Ever Build" (arxiv 2604.21003): a candidate is
better when it passes more, and ties break toward lower latency.
"""

from __future__ import annotations

from typing import Any


def two_tier_key(summary: dict[str, Any]) -> tuple[float, float]:
    """Sort key for a candidate summary view: higher is better on both axes."""
    pass_rate = float(summary.get("pass_rate") or 0.0)
    avg_latency_ms = float(summary.get("avg_latency_ms") or 0.0)
    return (pass_rate, -avg_latency_ms)


def selection_key(summary: dict[str, Any]) -> tuple[float, float, float]:
    """Quality-aware selection key: pass-rate, then response quality, then -latency.

    OpenTracy's refinement of the paper's two-tier metric. overall_score (mean
    rubric score) is our response-quality signal, so it breaks pass-rate ties
    before latency does — this keeps the loop from promoting a faster-but-worse
    answer over an equally-passing, higher-quality one.
    """
    pass_rate = float(summary.get("pass_rate") or 0.0)
    quality = float(summary.get("overall_score") or 0.0)
    avg_latency_ms = float(summary.get("avg_latency_ms") or 0.0)
    return (pass_rate, quality, -avg_latency_ms)
