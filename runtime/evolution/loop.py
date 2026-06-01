"""AHE Algorithm 1 — one iteration (v1).

Order (paraphrasing §3.4):

  0. **Attribute prior round.** If a pending Change Manifest exists
     from the previous iteration, compare its claimed_fixes /
     at_risk_regressions against the CURRENT rollout's pass/fail and
     roll it to history with a verdict. If verdict is ``regressed``,
     restore the files the prior Evolve Agent edited (file-level
     rollback per §3.3).
  1. **Rollout.** Replay each eval task ``k`` times against the
     current harness (v1: k=2 default; v0 was k=1).
  2. **Distill.** Pack the rollout into evidence:
        - raw pass/fail corpus (v0 layer)
        - root-cause clusters via Agent Debugger Lite (v1 layer)
  3. **Edit.** Spawn the Evolve Agent sandbox; it reads the corpus +
     NexAU snapshot + manifest history, edits one or more harness
     files, and writes a fresh pending manifest.
  4. **Snapshot for rollback.** Save the pre-edit content of every
     file the agent claims to have touched, so the NEXT iteration's
     verdict can revert if predictions miss.
  5. **Commit.** Snapshot the workspace back (already done inside
     :func:`evolve.run_evolve`); invalidate the per-agent executor
     cache so the next chat request recompiles with the edits.

v1 limitations (vs the paper, still):
  - Verdict is coarse pass/fail per task — no per-claim grading
  - No Clean step yet (rollouts don't carry base64 / tool dumps)
  - No git tag per iteration; the manifest archive timestamp is the
    only iteration marker on disk
"""

from __future__ import annotations

import logging
import secrets
import time
from typing import Any, Optional

from runtime.evolution.analysis import write_analysis_report
from runtime.evolution.distill import cluster_failures, summarize_rollout
from runtime.evolution.evolve import run_evolve
from runtime.evolution.rollout import run_rollout
from runtime.evolution.validator import ValidationReport, validate_workspace
from runtime.evolution.types import (
    ChangeEvaluation,
    ChangeRecord,
    EvolveOutcome,
    IterationResult,
    RolloutResult,
    VerificationResult,
)


logger = logging.getLogger("runtime.evolution.loop")


DEFAULT_K = 2


def run_one_iteration(
    *,
    agent_id: str,
    tasks: list[str],
    tenant_id: Optional[str] = None,
    k: int = DEFAULT_K,
    n_variants: int = 1,
    sandbox_factory: Optional[Any] = None,
    iteration_id: Optional[str] = None,
) -> IterationResult:
    """Run one AHE iteration against ``agent_id``.

    ``k`` controls replay count per task in the rollout phase (v1
    default 2; pass 1 to reproduce v0 behavior). ``iteration_id``
    can be pre-supplied by the caller (e.g. the REST endpoint that
    needs to return the same id in its 202 response); a fresh id is
    minted when omitted.
    """
    if iteration_id is None:
        iteration_id = _new_iteration_id()
    started = time.time()
    logger.warning(
        "evolve: iteration %s starting for agent=%s tasks=%d k=%d",
        iteration_id, agent_id, len(tasks), k,
    )

    # Resolve dependencies lazily so the module imports cheaply and
    # tests can stub each layer independently.
    from runtime.agents.secrets import get_secret
    from runtime.executor import per_agent as _per_agent
    from runtime.tenant_context import get_active as get_tenant
    from runtime.workspaces import get_workspace

    if tenant_id is None:
        tenant_id = get_tenant(default="")

    anthropic_key = get_secret("anthropic", agent_id=agent_id)
    if not anthropic_key:
        raise RuntimeError(
            "evolve: no Anthropic key for agent — set BYOK first"
        )

    workspace = get_workspace(agent_id)

    # 0a. Attribute prior round (if any pending manifest).
    pending_before = workspace.read_pending_manifest()
    baseline_before = workspace.read_pending_baseline()

    # 1. Rollout (k>=1). Pass agent_id so the rollout pins
    # agent_context — without that, stages that lazily read the
    # active agent (claude_code strategy reads the workspace via
    # ``get_workspace(get_active())``) fall back to ``_default`` and
    # use the wrong harness state, which silently invalidates every
    # downstream signal (evidence, evolve, verdict).
    # ``write_trace`` makes every rollout call persist a trace under
    # ``traces/<agent>/raw/<date>.jsonl`` — same path the chat
    # endpoint uses — so Technical → Traces shows the rollout runs.
    from runtime.executor.tracing import write_trace as _write_trace

    def _persist_trace(record: Any) -> Optional[str]:
        return _write_trace(record, agent_id=agent_id)

    executor = _resolve_executor_for_evolution(agent_id, tenant_id)

    # Wave E — semantic verifier: catches off-persona / off-policy
    # responses that pipeline-success alone would let slide through as
    # PASS. The rollout uses this to flip mechanical PASS → semantic
    # FAIL with reason, which then feeds the distill clusterer + the
    # Evolve Agent's evidence corpus. Without it, agents that produce
    # plausible-but-wrong text always look "fine" and the loop
    # converges to "nothing to improve" prematurely.
    from runtime.evolution.verifier import grade_for_rollout as _grade
    workspace_for_grader = workspace
    def _semantic_verifier(*, task: str, response: str) -> tuple[bool, Optional[str]]:
        return _grade(
            task=task,
            response=response,
            success=True,
            error=None,
            system_prompt=workspace_for_grader.read_system_prompt(),
            anthropic_key=anthropic_key,
        )

    rollout: RolloutResult = run_rollout(
        executor=executor,
        tasks=tasks,
        k=k,
        agent_id=agent_id,
        write_trace=_persist_trace,
        semantic_verifier=_semantic_verifier,
    )

    # 0b. Verdict on the prior round, using THIS round's rollout.
    #     If any change earned ROLLBACK_AND_PIVOT, apply scoped
    #     file-level rollback for just that change's files.
    verification = _verify_previous(
        workspace=workspace,
        pending=pending_before,
        baseline=baseline_before,
        rollout=rollout,
        iteration_id=iteration_id,
    )

    # 2. Distill — raw summary + LLM-clustered failures.
    evidence = summarize_rollout(rollout)
    evidence = cluster_failures(evidence, anthropic_key=anthropic_key)

    # 2b. Layered analysis (AHE §3.2 Experience Observability).
    # Writes .opentracy/analysis/{iteration_id}/{overview.md, detail/}
    # so the Evolve Agent reads pre-built reports rather than digging
    # through raw traces. Best-effort: never tank the iteration on
    # analysis-write failure.
    try:
        write_analysis_report(
            workspace, iteration_id=iteration_id, evidence=evidence,
        )
    except Exception as exc:  # pragma: no cover — defensive
        logger.warning("evolve: analysis write failed: %s", exc, exc_info=True)

    # 3 + 4. Pre-snapshot, edit (sandboxed), persist rollback snapshot.
    pre_edit_files = _snapshot_files(workspace)
    variant_summaries: list[dict[str, Any]] = []
    if n_variants <= 1:
        try:
            evolve_outcome: EvolveOutcome = run_evolve(
                workspace=workspace,
                anthropic_key=anthropic_key,
                agent_id=agent_id,
                evidence_summary=_evidence_for_evolve(evidence, iteration_id),
                sandbox_factory=sandbox_factory,
            )
        except Exception as exc:
            logger.warning("evolve: edit phase failed: %s", exc, exc_info=True)
            evolve_outcome = EvolveOutcome(
                files_edited=[],
                pending_manifest=None,
                raw_response=f"[error] {type(exc).__name__}: {exc}",
            )
    else:
        # Best-of-N: spawn one evolve per strategy hint, pick the
        # winner (validator-clean + most predicted_fixes), restore the
        # workspace to the winner's state. Cross-variant summaries go
        # to history so the next iter can learn from losers too.
        from runtime.evolution.variants import (
            apply_winner_to_workspace,
            default_strategy_hints,
            pick_winner,
            run_variants,
        )

        hints = default_strategy_hints(n_variants)
        try:
            outcomes = run_variants(
                workspace=workspace,
                anthropic_key=anthropic_key,
                agent_id=agent_id,
                evidence_summary=_evidence_for_evolve(evidence, iteration_id),
                strategy_hints=hints,
                sandbox_factory=sandbox_factory,
            )
            variant_summaries = [o.summary() for o in outcomes]
            winner = pick_winner(outcomes)
            if winner is None:
                evolve_outcome = EvolveOutcome(
                    files_edited=[],
                    pending_manifest=None,
                    raw_response="[error] best-of-n produced no outcomes",
                )
            else:
                apply_winner_to_workspace(workspace, winner)
                evolve_outcome = winner.evolve
                # Surface cross-variant info so history.py logs it and
                # the next agent sees which strategies were tried.
                evolve_outcome.variant_summaries = list(variant_summaries)
                evolve_outcome.chosen_variant_index = winner.index
                logger.warning(
                    "evolve: best-of-%d picked variant #%d "
                    "(predicted_fixes=%d, validator_critical=%d)",
                    n_variants, winner.index,
                    winner.num_predicted_fixes,
                    len(winner.validation.critical),
                )
        except Exception as exc:
            logger.warning("evolve: best-of-n failed: %s", exc, exc_info=True)
            evolve_outcome = EvolveOutcome(
                files_edited=[],
                pending_manifest=None,
                raw_response=f"[error] best-of-n: {type(exc).__name__}: {exc}",
            )

    _persist_rollback_snapshot(
        workspace=workspace,
        iteration_id=iteration_id,
        pre_edit_files=pre_edit_files,
        pending_manifest=evolve_outcome.pending_manifest,
    )

    # 4b. Validate workspace integrity post-evolve. Any critical issue
    # (missing file, constraint_level path mismatch, Python syntax
    # error in middleware) → full rollback. The iteration is internally
    # broken; there's nothing to attribute against and shipping it
    # would crash the next chat call.
    validation = _run_validation(
        workspace=workspace,
        pending_manifest=evolve_outcome.pending_manifest,
    )
    if validation.has_critical:
        logger.warning(
            "evolve: validation failed with %d critical issue(s) — "
            "rolling back iteration %s",
            len(validation.critical), iteration_id,
        )
        try:
            rolled = workspace.apply_rollback()
            logger.warning(
                "evolve: validation rollback restored %d file(s): %s",
                len(rolled), rolled,
            )
        except Exception as exc:  # pragma: no cover — defensive
            logger.warning("evolve: validation rollback failed: %s", exc)
        # Archive the dud manifest with a validation_failed verdict so
        # the next agent sees what tripped — and skip baseline / cache
        # invalidation since the workspace is back to pre-edit state.
        try:
            workspace.roll_pending_to_history(outcome={
                "verdict": "validation_failed",
                "issues": [i.to_dict() for i in validation.critical],
            })
        except Exception as exc:  # pragma: no cover
            logger.warning("evolve: archive on validation fail: %s", exc)
        evolve_outcome = EvolveOutcome(
            files_edited=[],
            pending_manifest=None,
            raw_response=(
                evolve_outcome.raw_response
                + f"\n[validation_failed] {len(validation.critical)} critical issue(s)"
            ),
        )
    elif evolve_outcome.pending_manifest:
        # Snapshot the rollout outcomes alongside the new pending
        # manifest so the NEXT iteration can compute per-change flip
        # attribution against this pre-edits baseline. We persist
        # even when no pending was written — the next iteration's
        # verifier just won't have a pending to attribute against,
        # which is the existing no_signal path.
        try:
            workspace.write_pending_baseline(
                iteration_id=iteration_id,
                task_outcomes=_task_outcomes_for_baseline(rollout),
            )
        except Exception as exc:  # pragma: no cover — defensive
            logger.warning("evolve: failed to persist pending baseline: %s", exc)

    # 5. Drop the per-agent executor cache so the next chat picks up
    # whatever the Evolve Agent just wrote.
    _per_agent.invalidate(tenant_id, agent_id)

    duration_s = time.time() - started
    logger.warning(
        "evolve: iteration %s done in %.1fs verdict=%s edited=%d",
        iteration_id, duration_s, verification.verdict,
        len(evolve_outcome.files_edited),
    )

    result = IterationResult(
        iteration_id=iteration_id,
        agent_id=agent_id,
        tenant_id=tenant_id or None,
        verification=verification,
        rollout=rollout,
        evidence=evidence,
        evolve=evolve_outcome,
    )

    # 7. Bridge — publish a Lesson + eval report so the iteration
    # shows up as a review card in the Evolution timeline. Best-effort:
    # publication failures must not mask the iteration outcome.
    # The trajectory verifier (AHE §3.3) needs the agent's contract +
    # the prior iteration's pending manifest so each case can be graded
    # against claimed fixes / at-risk regressions.
    try:
        from runtime.evolution.bridge import publish_iteration
        system_prompt = workspace.read_system_prompt()
        publish_iteration(
            result,
            system_prompt=system_prompt,
            pending_before=pending_before or {},
            anthropic_key=anthropic_key,
        )
    except Exception as exc:  # pragma: no cover — defensive
        logger.warning("evolve: bridge publish failed: %s", exc, exc_info=True)

    # 8. Append a narrative entry to evolution_history.md so the next
    # Evolve Agent reads "what happened so far" before deciding what to
    # try next. Best-effort — never tank the iteration on history-write.
    try:
        from runtime.evolution.history import append_history_entry
        append_history_entry(workspace, result)
    except Exception as exc:  # pragma: no cover — defensive
        logger.warning("evolve: history append failed: %s", exc, exc_info=True)

    return result


# ---------------------------------------------------------------------------
# Internals
# ---------------------------------------------------------------------------


def _new_iteration_id() -> str:
    """Short, sortable, unique. Used in logs + future UI."""
    from datetime import datetime, timezone
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S")
    return f"evo-{stamp}-{secrets.token_hex(3)}"


def _resolve_executor_for_evolution(agent_id: str, tenant_id: str):
    """Resolve the per-agent executor for the evolution path.

    Unlike the chat path, the evolution loop MUST run against the
    agent's own compiled pipeline — never the default executor. If
    the per-agent compile fails, the rollout would run against the
    wrong harness (wrong BYOK, wrong agent_context, wrong system
    prompt) and silently invalidate every downstream signal: evidence
    would describe the default agent's behavior, evolve would edit
    the wrong workspace, and the verdict would be meaningless.

    Issue #56 documented the staging-incident form of this: per-agent
    compile failed → fell back to ``_state["executor"]`` → executor.run
    raised silently → background task died with no diagnosable logs.
    Now we raise explicitly so the caller's outer try/except logs it
    and clients see the failure instead of a phantom 202.
    """
    from runtime.executor import per_agent as _per_agent
    from runtime.tenants.feature import is_multi_tenant_enabled

    # OSS / single-tenant: the lifespan-bootstrapped default executor
    # IS the per-agent executor (only one agent exists). Falling back
    # to it is correct.
    if not is_multi_tenant_enabled():
        try:
            from runtime.server import _state as _server_state
            fallback = _server_state.get("executor")
        except Exception:
            fallback = None
        if fallback is None:
            raise RuntimeError(
                "evolve: no executor available (OSS mode + lifespan not booted)"
            )
        return fallback

    # Multi-tenant: NO fallback. If the per-agent compile fails the
    # whole iteration must abort with a real error.
    executor = _per_agent.get_executor_for_agent(
        tenant_id, agent_id, fallback_executor=None,
    )
    if executor is None:
        raise RuntimeError(
            f"evolve: per-agent executor unavailable for "
            f"(tenant={tenant_id!r}, agent={agent_id!r}). "
            "Falling back to the default executor is forbidden on the "
            "evolution path — it would run against the wrong BYOK + "
            "wrong workspace and invalidate every downstream signal. "
            "Fix the per-agent compile (often a missing variant in "
            "techniques/prompt_strategies/impl.py — see #54) and "
            "retry."
        )
    return executor


def _verify_previous(
    *,
    workspace: Any,
    pending: Optional[dict[str, Any]],
    baseline: Optional[dict[str, Any]],
    rollout: RolloutResult,
    iteration_id: str,
) -> VerificationResult:
    """Compute verdict on the prior round's pending manifest + roll it
    to history. Per-change attribution computed when the pending has a
    ``changes`` array AND a matching pending_baseline is on disk —
    otherwise we fall back to the v1 iteration-level heuristic.

    Iteration-level verdict heuristic (preserved for legacy / flat
    manifests):
      - ``confirmed`` if rollout has ZERO majority-fail tasks
      - ``regressed`` if rollout has fails AND at_risk_regressions
        were predicted
      - ``mixed`` if there are fails but no predictions for them
      - ``no_signal`` if there's no pending manifest at all

    Wave-A addition (per-change):
      - For each change in pending.changes, compare predicted_fixes
        and risk_tasks against the baseline→current flip set.
      - Decide KEEP / IMPROVE / ROLLBACK_AND_PIVOT per change.
      - Scoped rollback applies only to files of PIVOTed changes.
    """
    if pending is None:
        return VerificationResult(verdict="no_signal")

    current_outcomes = _task_outcomes_for_baseline(rollout)
    baseline_outcomes: dict[str, str] = {}
    if baseline:
        raw = baseline.get("task_outcomes") or {}
        if isinstance(raw, dict):
            baseline_outcomes = {str(k): str(v) for k, v in raw.items()}

    flips_to_pass, flips_to_fail = _flips(baseline_outcomes, current_outcomes)

    # Per-change evaluation. Empty when no ``changes`` array; iteration
    # falls back to the flat verdict path.
    changes_data = pending.get("changes") or []
    change_evaluations: list[ChangeEvaluation] = []
    predicted_fixes_global: set[str] = set()
    risk_tasks_global: set[str] = set()
    for raw_change in changes_data:
        if not isinstance(raw_change, dict):
            continue
        change = ChangeRecord.from_dict(raw_change)
        if not change.id:
            continue
        predicted_fixes_global.update(change.predicted_fixes)
        risk_tasks_global.update(change.risk_tasks)
        evaluation = _evaluate_change(change, flips_to_pass, flips_to_fail)
        change_evaluations.append(evaluation)

    # Iteration-level verdict (still useful for the Lesson card and for
    # legacy flat manifests). Computed AFTER per-change attribution so
    # it can incorporate signal from the changes loop when present.
    failed = rollout.failed
    at_risk_flat = pending.get("at_risk_regressions") or []
    has_any_predictions = bool(predicted_fixes_global) or bool(at_risk_flat)
    if failed == 0:
        verdict = "confirmed"
    elif risk_tasks_global or at_risk_flat:
        verdict = "regressed"
    elif has_any_predictions:
        verdict = "mixed"
    else:
        verdict = "mixed" if failed else "confirmed"

    delta = {
        "passed": rollout.passed,
        "failed": rollout.failed,
        "total": rollout.total_tasks,
        "flaky": len(rollout.flaky_tasks),
    }

    # Scoped rollback for PIVOTed changes (Wave A). If we have per-change
    # decisions, only roll back files belonging to those changes — KEEP
    # and IMPROVE changes stay live so good edits aren't blown away by
    # one bad neighbor. When there are no changes, fall back to the v1
    # iteration-wide rollback driven by the verdict.
    rollback_applied: list[str] = []
    pivoted_ids = [
        ev.change_id for ev in change_evaluations
        if ev.decision == "ROLLBACK_AND_PIVOT"
    ]
    if change_evaluations:
        if pivoted_ids:
            try:
                rollback_applied = workspace.apply_rollback(
                    only_changes=pivoted_ids,
                )
                if rollback_applied:
                    logger.warning(
                        "evolve: scoped rollback applied for changes %s "
                        "→ %d files: %s",
                        pivoted_ids, len(rollback_applied), rollback_applied,
                    )
            except Exception as exc:  # pragma: no cover — defensive
                logger.warning("evolve: scoped rollback failed: %s", exc, exc_info=True)
        # If only some changes pivoted, the remaining buckets are still
        # in the snapshot — leave them. If no changes pivoted at all,
        # all edits stand and the snapshot is stale.
        if not pivoted_ids:
            try:
                workspace.clear_rollback_snapshot()
            except Exception:  # pragma: no cover
                pass
    else:
        # Legacy flat-manifest path.
        if verdict == "regressed":
            try:
                rollback_applied = workspace.apply_rollback()
                if rollback_applied:
                    logger.warning(
                        "evolve: file-level rollback applied to %d files: %s",
                        len(rollback_applied), rollback_applied,
                    )
            except Exception as exc:  # pragma: no cover — defensive
                logger.warning("evolve: rollback failed: %s", exc, exc_info=True)
        else:
            try:
                workspace.clear_rollback_snapshot()
            except Exception:  # pragma: no cover
                pass

    # Unexpected flips (not attributed to any change's prediction set).
    # These feed the next Evolve Agent — "you didn't predict this, so
    # your model of why it works is incomplete".
    unexpected_to_pass = sorted(flips_to_pass - predicted_fixes_global)
    unexpected_to_fail = sorted(flips_to_fail - risk_tasks_global)

    # Persist change_evaluation.json for the next agent to read.
    if change_evaluations:
        try:
            workspace.write_change_evaluation(
                iteration_id=iteration_id,
                verdict=verdict,
                evaluations=[ev.to_dict() for ev in change_evaluations],
                unexpected_flips_to_pass=unexpected_to_pass,
                unexpected_flips_to_fail=unexpected_to_fail,
            )
        except Exception as exc:  # pragma: no cover — defensive
            logger.warning(
                "evolve: failed to persist change_evaluation: %s", exc,
            )

    archive = workspace.roll_pending_to_history(outcome={
        "verdict": verdict,
        "delta": delta,
        "rollback_applied": rollback_applied,
        "rolled_back_changes": pivoted_ids,
    })
    return VerificationResult(
        pending_archived_to=str(archive) if archive else None,
        verdict=verdict,
        delta={
            **delta,
            "rollback_applied": rollback_applied,
            "rolled_back_changes": pivoted_ids,
        },
        change_evaluations=change_evaluations,
        unexpected_flips_to_pass=unexpected_to_pass,
        unexpected_flips_to_fail=unexpected_to_fail,
    )


def _task_outcomes_for_baseline(rollout: RolloutResult) -> dict[str, str]:
    """Reduce the rollout's per-task aggregates to a baseline-friendly
    map of ``task → "pass" | "fail" | "flaky"``.

    A task is ``flaky`` when some-but-not-all replays passed; otherwise
    it's ``pass`` or ``fail`` based on majority. The next iteration's
    verifier treats flaky as fail for fix-prediction (we don't want to
    credit a "fix" that left the task still partially failing).
    """
    out: dict[str, str] = {}
    for task, agg in rollout.task_aggregates.items():
        if agg.get("flaky"):
            out[task] = "flaky"
        elif agg.get("majority_pass"):
            out[task] = "pass"
        else:
            out[task] = "fail"
    return out


def _flips(
    baseline: dict[str, str],
    current: dict[str, str],
) -> tuple[set[str], set[str]]:
    """Tasks that changed pass↔fail between baseline and current.

    ``flips_to_pass`` = tasks that were fail/flaky in baseline AND pass
    now. ``flips_to_fail`` = tasks that were pass in baseline AND
    fail/flaky now. New tasks (not in baseline) are NOT counted as
    flips — we have no signal on the change's effect for them.
    """
    flips_to_pass: set[str] = set()
    flips_to_fail: set[str] = set()
    for task, cur_state in current.items():
        base_state = baseline.get(task)
        if base_state is None:
            continue
        was_pass = base_state == "pass"
        is_pass = cur_state == "pass"
        if not was_pass and is_pass:
            flips_to_pass.add(task)
        elif was_pass and not is_pass:
            flips_to_fail.add(task)
    return flips_to_pass, flips_to_fail


def _evaluate_change(
    change: ChangeRecord,
    flips_to_pass: set[str],
    flips_to_fail: set[str],
) -> ChangeEvaluation:
    """Decide KEEP / IMPROVE / ROLLBACK_AND_PIVOT for one change.

    Heuristics (Wave A — falsification core):
      - No claims at all → KEEP ("nothing to falsify; benefit of doubt")
      - Predictions held and no risks materialized → KEEP
      - Some predicted fixes landed AND no risks materialized but
        some predicted fixes missed → IMPROVE (right direction)
      - Zero predicted fixes landed OR materialized risks > confirmed
        fixes → ROLLBACK_AND_PIVOT (wrong constraint level for this
        failure pattern; next iteration must try a different level)
    """
    predicted = set(change.predicted_fixes)
    risks = set(change.risk_tasks)

    confirmed = sorted(predicted & flips_to_pass)
    missed = sorted(predicted - flips_to_pass)
    materialized = sorted(risks & flips_to_fail)

    if not predicted and not risks:
        decision = "KEEP"
        reason = "no claims made"
    elif not missed and not materialized:
        decision = "KEEP"
        reason = (
            f"all {len(confirmed)} predicted fix(es) landed; no risks materialized"
        )
    elif confirmed and not materialized:
        decision = "IMPROVE"
        reason = (
            f"{len(confirmed)}/{len(predicted)} predicted fix(es) landed; "
            "refine same constraint_level"
        )
    elif not confirmed:
        decision = "ROLLBACK_AND_PIVOT"
        reason = (
            f"0/{len(predicted)} predicted fix(es) landed at "
            f"constraint_level={change.constraint_level!r} — pivot"
        )
    elif len(materialized) > len(confirmed):
        decision = "ROLLBACK_AND_PIVOT"
        reason = (
            f"{len(materialized)} risk(s) materialized > "
            f"{len(confirmed)} fix(es) landed — net regression, pivot"
        )
    else:
        # Mixed but net-positive: some risks materialized but confirmed
        # >= materialized. Refine rather than abandon.
        decision = "IMPROVE"
        reason = (
            f"{len(confirmed)} fix(es) vs {len(materialized)} risk(s) — "
            "net positive, refine"
        )

    return ChangeEvaluation(
        change_id=change.id,
        constraint_level=change.constraint_level,
        failure_pattern=change.failure_pattern,
        confirmed_fixes=confirmed,
        missed_fixes=missed,
        materialized_risks=materialized,
        decision=decision,
        reason=reason,
    )


def _snapshot_files(workspace: Any) -> dict[str, Optional[str]]:
    """Snapshot every UTF-8 file in the workspace into a path→content map.

    Used to populate the rollback snapshot AFTER we learn which files
    the Evolve Agent claims to have changed. We snapshot everything
    up front because we don't know in advance which files will be in
    the pending manifest; the post-evolve step picks the right entries.

    Binary files are skipped — Claude Code workspaces are text-heavy,
    and binary blobs (model weights, tarballs) shouldn't live here.
    """
    out: dict[str, Optional[str]] = {}
    try:
        files = workspace.list_files(max_files=10_000)
    except Exception:
        return out
    for rel in files:
        path = workspace.path.joinpath(rel)
        try:
            out[rel] = path.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            # Skip binary or unreadable — rollback can't help here.
            continue
    return out


def _persist_rollback_snapshot(
    *,
    workspace: Any,
    iteration_id: str,
    pre_edit_files: dict[str, Optional[str]],
    pending_manifest: Optional[dict[str, Any]],
) -> None:
    """Write the rollback snapshot scoped to the files the pending
    manifest declared as changed.

    When the pending manifest carries a ``changes`` array (Wave A
    schema), the snapshot is written **per change** so the next
    iteration's verifier can apply a *scoped* rollback to only the
    changes that earned ROLLBACK_AND_PIVOT — KEEP / IMPROVE changes
    stay live.

    For legacy flat manifests (only ``changed_files``), falls back to
    the v1 iteration-wide snapshot.

    For paths the Evolve Agent CREATED (not in ``pre_edit_files``),
    record ``None`` — the rollback action becomes ``unlink``. For
    paths the agent EDITED, record the pre-edit content.
    """
    if not pending_manifest:
        return

    def _snap_file(rel: str) -> Optional[tuple[str, Optional[str]]]:
        if not isinstance(rel, str) or not rel.strip():
            return None
        # Only record entries the agent actually shipped — if a path
        # was claimed but the workspace doesn't show it (lying agent
        # / tar miss), skip rather than poison the snapshot.
        post_edit = workspace.path.joinpath(rel)
        if not post_edit.exists():
            return None
        return rel, pre_edit_files.get(rel)  # None if newly created

    changes = pending_manifest.get("changes") or []
    if changes:
        by_change: dict[str, dict[str, Optional[str]]] = {}
        for raw_change in changes:
            if not isinstance(raw_change, dict):
                continue
            cid = raw_change.get("id")
            if not isinstance(cid, str) or not cid.strip():
                continue
            bucket: dict[str, Optional[str]] = {}
            for rel in raw_change.get("files") or []:
                snap = _snap_file(rel)
                if snap is None:
                    continue
                bucket[snap[0]] = snap[1]
            if bucket:
                by_change[cid] = {"files": bucket}
        if not by_change:
            return
        try:
            workspace.write_rollback_snapshot(
                iteration_id=iteration_id, by_change=by_change,
            )
        except Exception as exc:  # pragma: no cover — defensive
            logger.warning(
                "evolve: failed to persist scoped rollback snapshot: %s", exc,
            )
        return

    # Legacy flat manifest path.
    declared = pending_manifest.get("changed_files") or []
    if not declared:
        return

    snapshot: dict[str, Optional[str]] = {}
    for rel in declared:
        snap = _snap_file(rel)
        if snap is None:
            continue
        snapshot[snap[0]] = snap[1]

    if not snapshot:
        return
    try:
        workspace.write_rollback_snapshot(
            iteration_id=iteration_id, files=snapshot,
        )
    except Exception as exc:  # pragma: no cover — defensive
        logger.warning("evolve: failed to persist rollback snapshot: %s", exc)


def _run_validation(
    *,
    workspace: Any,
    pending_manifest: Optional[dict[str, Any]],
) -> ValidationReport:
    """Wrap :func:`validate_workspace` with a try/except so a validator
    bug doesn't tank an otherwise-fine iteration. Returns an empty
    report on failure (i.e. treat as "no issues found" rather than
    forcing a spurious rollback)."""
    try:
        return validate_workspace(
            workspace, pending_manifest=pending_manifest,
        )
    except Exception as exc:  # pragma: no cover — defensive
        logger.warning("evolve: validator crashed: %s", exc, exc_info=True)
        return ValidationReport()


def _evidence_for_evolve(evidence: Any, iteration_id: str) -> str:
    """Render the evidence (raw summary + clusters) for the Evolve Agent.

    Points the agent at the pre-built layered analysis files. Reading
    those is mandatory by the agent prompt; this string is the in-line
    fallback / quick reference.
    """
    parts = [
        f"📊 Pre-built analysis (read FIRST): "
        f"`.opentracy/analysis/{iteration_id}/overview.md` "
        f"+ per-task `detail/<slug>.md`.",
        "",
        evidence.summary,
    ]
    if evidence.clusters:
        parts.append("")
        parts.append("--- Agent Debugger clusters ---")
        for c in sorted(evidence.clusters, key=lambda x: -x.severity):
            parts.append(
                f"[severity {c.severity}] {c.root_cause} "
                f"({len(c.tasks)} task(s))"
            )
            for t in c.tasks:
                parts.append(f"    - {t!r}")
            if c.notes:
                parts.append(f"    notes: {c.notes}")
    return "\n".join(parts)
