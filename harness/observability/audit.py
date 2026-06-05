"""Performance audit — split a candidate's runtime into LLM vs tool/compute time.

Paper 2's evaluator decomposes execution into LLM-inference latency vs
tool/environment latency to tell whether a bottleneck is computational or
behavioral. In OpenTracy's pipeline the LLM turn is the ``generate`` stage; the
retrieve/rerank/route/memory stages are tool/compute. This classifies aggregated
stage timings accordingly.
"""

from __future__ import annotations

from typing import Any

LLM_STAGES = frozenset({"generate"})


def performance_audit(
    stage_ms: dict[str, float],
    *,
    llm_ms: float | None = None,
    tool_ms: float | None = None,
    n_llm_calls: int | None = None,
    llm_stages=LLM_STAGES,
) -> dict[str, Any]:
    """Split runtime into LLM vs tool/compute and name the bottleneck.

    Prefers the true split measured inside the generate loop (llm_ms/tool_ms).
    Falls back to classifying aggregated stage timings by `llm_stages` when the
    true split isn't available (offline runs, older result rows).
    """
    non_llm_stage_ms = sum(v for k, v in stage_ms.items() if k not in llm_stages)
    has_true_split = (
        llm_ms is not None
        and tool_ms is not None
        and (llm_ms > 0 or tool_ms > 0 or (n_llm_calls or 0) > 0)
    )
    if has_true_split:
        # true generate-inference time; tool = in-turn MCP + the pipeline's
        # other (retrieve/rerank/route) compute, which lives in stage_ms.
        tool_ms = float(tool_ms or 0.0) + non_llm_stage_ms
    else:
        llm_ms = sum(v for k, v in stage_ms.items() if k in llm_stages)
        tool_ms = non_llm_stage_ms
    llm_ms = round(float(llm_ms or 0.0), 3)
    tool_ms = round(float(tool_ms), 3)
    total = round(llm_ms + tool_ms, 3)
    if total == 0:
        bottleneck = "none"
    elif llm_ms > tool_ms:
        bottleneck = "llm"
    elif tool_ms > llm_ms:
        bottleneck = "tool"
    else:
        bottleneck = "balanced"
    return {
        "llm_ms": llm_ms,
        "tool_ms": tool_ms,
        "total_ms": total,
        "bottleneck": bottleneck,
        "llm_share": round(llm_ms / total, 4) if total else 0.0,
        "n_llm_calls": n_llm_calls,
    }
