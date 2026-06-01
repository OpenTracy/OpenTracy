"""Rollout phase — replay every eval task ``k`` times against the harness.

Paper §3.4 recommends k≥2 so per-task variance feeds the distill step
(one flaky run gets caught instead of miscategorizing the task). v1
defaults to k=2 — cheap signal upgrade vs k=1.

Uses the per-agent executor cache so the rollout sees the EXACT same
pipeline a chat request would. Each replay writes a trace through the
normal tracing path; the IDs come back on the outcomes so the UI can
deep-link.
"""

from __future__ import annotations

import logging
import time
from typing import Any, Optional

from runtime.evolution.types import RolloutResult, TaskOutcome


logger = logging.getLogger("runtime.evolution.rollout")


def run_rollout(
    *,
    executor: Any,
    tasks: list[str],
    k: int = 2,
    write_trace: Any = None,
    agent_id: Optional[str] = None,
    semantic_verifier: Optional[Any] = None,
) -> RolloutResult:
    """Replay each task ``k`` times. Returns the flat list of outcomes.

    ``executor`` is the resolved per-agent PipelineExecutor (caller is
    responsible for resolving — keeps this module testable).
    ``write_trace`` captures trace IDs when supplied; omit in tests.
    ``agent_id`` pins the process-global agent context for the
    duration of the rollout — without it, stages that lazily resolve
    the active agent (the claude_code strategy reads the workspace
    via ``get_workspace(get_active())``) fall back to ``_default``
    and load the wrong harness state. Pass the same id used to
    resolve ``executor``.

    Ordering: task A run 0, task B run 0, ..., task A run 1, task B
    run 1, ... — interleaved so retries see fresh model state rather
    than two back-to-back runs that may share spurious cache effects.
    """
    if k < 1:
        raise ValueError(f"k must be >= 1, got {k}")

    # Pin agent_context so stage-level get_active() resolves to this
    # agent for every executor.run() below. Restore the prior value on
    # exit so background callers (harness, OSS) don't see drift.
    prev_agent: Optional[str] = None
    pinned = False
    if agent_id:
        from runtime import agent_context as _agent_ctx
        prev_agent = _agent_ctx.get_active(default="")
        _agent_ctx.set_active(agent_id)
        pinned = True

    outcomes: list[TaskOutcome] = []
    try:
        for run_index in range(k):
            for task in tasks:
                if not isinstance(task, str) or not task.strip():
                    continue
                started = time.perf_counter()
                try:
                    _ctx, record = executor.run(task)
                except Exception as exc:
                    duration_ms = (time.perf_counter() - started) * 1000.0
                    logger.warning("rollout task failed: %s", exc, exc_info=True)
                    outcomes.append(TaskOutcome(
                        task=task,
                        response="",
                        success=False,
                        duration_ms=duration_ms,
                        error=f"{type(exc).__name__}: {exc}",
                        run_index=run_index,
                    ))
                    continue

                trace_id: str | None = None
                if write_trace is not None:
                    try:
                        trace_id = write_trace(record)
                    except Exception as exc:  # pragma: no cover — defensive
                        logger.warning("rollout write_trace failed: %s", exc)

                mech_response = getattr(record, "response", "") or ""
                mech_success = bool(getattr(record, "success", True))
                mech_error: Optional[str] = getattr(record, "error", None)

                # Semantic verifier (Wave E). Only override when the
                # pipeline succeeded mechanically — if it already
                # failed, the mechanical reason is more useful than a
                # second-order judge call. The verifier is fail-open:
                # any judge problem leaves the mechanical verdict
                # untouched.
                if mech_success and not mech_error and semantic_verifier is not None:
                    try:
                        sem_pass, sem_reason = semantic_verifier(
                            task=task,
                            response=mech_response,
                        )
                        if not sem_pass:
                            logger.warning(
                                "rollout: semantic verifier failed task=%r reason=%s",
                                task, sem_reason,
                            )
                            mech_success = False
                            mech_error = f"semantic_verifier: {sem_reason}"
                    except Exception as exc:  # pragma: no cover — defensive
                        logger.warning(
                            "rollout: semantic verifier crashed for task=%r: %s",
                            task, exc,
                        )

                outcomes.append(TaskOutcome(
                    task=task,
                    response=mech_response,
                    success=mech_success,
                    duration_ms=float(getattr(record, "duration_ms", 0.0)),
                    trace_id=trace_id,
                    error=mech_error,
                    run_index=run_index,
                ))
    finally:
        if pinned:
            from runtime import agent_context as _agent_ctx
            _agent_ctx.set_active(prev_agent or None)

    return RolloutResult(outcomes=outcomes, k=k)
