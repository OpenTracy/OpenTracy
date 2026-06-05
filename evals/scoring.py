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


def compare_two_tier(a: dict[str, Any], b: dict[str, Any]) -> int:
    """Return 1 if a ranks above b, -1 if below, 0 if tied."""
    ka, kb = two_tier_key(a), two_tier_key(b)
    return (ka > kb) - (ka < kb)
