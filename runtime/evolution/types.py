"""Dataclasses for the AHE evolution loop.

Tiny — most are dicts on the wire. The dataclass forms exist so
intermediate steps in :mod:`.loop` get typed access without sprinkling
``cast(...)`` everywhere.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Optional


@dataclass
class TaskOutcome:
    """One task replayed against the current harness.

    ``run_index`` tracks which of the ``k`` replays this outcome came
    from (0-indexed). Same ``task`` can appear multiple times in a
    rollout when ``k > 1``.
    """

    task: str
    response: str
    success: bool
    duration_ms: float
    trace_id: Optional[str] = None
    error: Optional[str] = None
    run_index: int = 0

    def to_dict(self) -> dict[str, Any]:
        return {
            "task": self.task,
            "response": self.response,
            "success": self.success,
            "duration_ms": self.duration_ms,
            "trace_id": self.trace_id,
            "error": self.error,
            "run_index": self.run_index,
        }


@dataclass
class RolloutResult:
    """Outcomes from one rollout (``k`` replays per task) + aggregates.

    ``outcomes`` is FLAT — one entry per (task, run_index). The
    derived properties group by ``task`` and apply majority-pass:
    a task counts as PASSED if more than half its runs succeeded,
    FLAKY if some-but-not-all passed.
    """

    outcomes: list[TaskOutcome] = field(default_factory=list)
    k: int = 1

    @property
    def task_aggregates(self) -> dict[str, dict[str, Any]]:
        """Per-task summary: ``{task: {passed_runs, total_runs, majority_pass, flaky}}``."""
        agg: dict[str, dict[str, Any]] = {}
        for o in self.outcomes:
            a = agg.setdefault(o.task, {"passed_runs": 0, "total_runs": 0})
            a["total_runs"] += 1
            if o.success and not o.error:
                a["passed_runs"] += 1
        for a in agg.values():
            a["majority_pass"] = a["passed_runs"] * 2 > a["total_runs"]
            a["flaky"] = 0 < a["passed_runs"] < a["total_runs"]
        return agg

    @property
    def passed(self) -> int:
        """Tasks with majority-pass."""
        return sum(1 for a in self.task_aggregates.values() if a["majority_pass"])

    @property
    def failed(self) -> int:
        """Tasks that did NOT pass on a majority basis (incl. all-fail)."""
        return len(self.task_aggregates) - self.passed

    @property
    def flaky_tasks(self) -> list[str]:
        return sorted(t for t, a in self.task_aggregates.items() if a["flaky"])

    @property
    def total_tasks(self) -> int:
        return len(self.task_aggregates)

    def to_dict(self) -> dict[str, Any]:
        return {
            "outcomes": [o.to_dict() for o in self.outcomes],
            "k": self.k,
            "passed": self.passed,
            "failed": self.failed,
            "total": self.total_tasks,
            "task_aggregates": self.task_aggregates,
            "flaky_tasks": self.flaky_tasks,
        }


@dataclass
class EvidenceCluster:
    """One root-cause cluster of related failures.

    Produced by :func:`runtime.evolution.distill.cluster_failures`
    (Agent Debugger Lite). Severity is 1..5 (5 = breaks the agent's
    core contract; 1 = polish). ``tasks`` references back into the
    rollout via the task string itself.
    """

    root_cause: str
    tasks: list[str] = field(default_factory=list)
    severity: int = 3
    notes: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "root_cause": self.root_cause,
            "tasks": list(self.tasks),
            "severity": self.severity,
            "notes": self.notes,
        }


@dataclass
class Evidence:
    """Distilled view of a rollout, shaped for the Evolve Agent.

    ``summary`` is the raw pass/fail corpus per task. ``clusters``
    is the v1 layered view (root-cause groups) produced by the
    Agent Debugger Lite LLM call; empty when the rollout passed
    cleanly (nothing to cluster).
    """

    rollout: RolloutResult
    summary: str
    clusters: list[EvidenceCluster] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "rollout": self.rollout.to_dict(),
            "summary": self.summary,
            "clusters": [c.to_dict() for c in self.clusters],
        }


@dataclass
class EvolveOutcome:
    """What the Evolve Agent sandbox did during one iteration.

    ``variant_summaries`` is populated only in Best-of-N mode — one
    compact dict per variant explored, in declaration order. The
    winner's index is also captured in :attr:`chosen_variant_index`
    so the next iteration's agent can see which strategy was picked
    and which were left on the table.
    """

    files_edited: list[str] = field(default_factory=list)
    pending_manifest: Optional[dict[str, Any]] = None
    raw_response: str = ""
    variant_summaries: list[dict[str, Any]] = field(default_factory=list)
    chosen_variant_index: Optional[int] = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "files_edited": list(self.files_edited),
            "pending_manifest": self.pending_manifest,
            "raw_response": self.raw_response,
            "variant_summaries": list(self.variant_summaries),
            "chosen_variant_index": self.chosen_variant_index,
        }


@dataclass
class ChangeRecord:
    """One harness edit inside a pending Change Manifest.

    Per AHE §3.3, the Evolve Agent must commit each edit with four
    fields the next round can falsify: failure evidence, root cause,
    targeted fix, predicted impact. Plus the *constraint level* — which
    of the seven NexAU component types this edit touched — so the loop
    can detect "same failure persists 2+ iterations at the same level
    → wrong component, pivot" (AHE §3.4 anti-pattern).

    ``failure_pattern`` is the machine-comparable key for matching a
    change across iterations: if the same failure_pattern keeps showing
    up despite KEEP/IMPROVE attempts at the same constraint_level, the
    next iteration's evolve agent must try a different level.
    """

    id: str
    constraint_level: str   # system_prompt | tool_desc | tool_impl | middleware | skill | sub_agent | memory
    files: list[str] = field(default_factory=list)
    failure_pattern: str = ""
    description: str = ""
    predicted_fixes: list[str] = field(default_factory=list)
    risk_tasks: list[str] = field(default_factory=list)
    why_this_component: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "constraint_level": self.constraint_level,
            "files": list(self.files),
            "failure_pattern": self.failure_pattern,
            "description": self.description,
            "predicted_fixes": list(self.predicted_fixes),
            "risk_tasks": list(self.risk_tasks),
            "why_this_component": self.why_this_component,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "ChangeRecord":
        return cls(
            id=str(data.get("id") or ""),
            constraint_level=str(data.get("constraint_level") or "unknown"),
            files=list(data.get("files") or []),
            failure_pattern=str(data.get("failure_pattern") or ""),
            description=str(data.get("description") or ""),
            predicted_fixes=list(data.get("predicted_fixes") or []),
            risk_tasks=list(data.get("risk_tasks") or []),
            why_this_component=str(data.get("why_this_component") or ""),
        )


@dataclass
class ChangeEvaluation:
    """Attribution + decision for ONE change after the next rollout.

    Computed by :func:`runtime.evolution.loop._verify_previous` once
    the rollout following a change's iteration is in. Drives the
    KEEP / IMPROVE / ROLLBACK_AND_PIVOT decision and feeds the next
    Evolve Agent so it learns from successes AND falsified attempts.
    """

    change_id: str
    constraint_level: str
    failure_pattern: str
    confirmed_fixes: list[str] = field(default_factory=list)
    missed_fixes: list[str] = field(default_factory=list)
    materialized_risks: list[str] = field(default_factory=list)
    decision: str = "KEEP"  # KEEP | IMPROVE | ROLLBACK_AND_PIVOT
    reason: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "change_id": self.change_id,
            "constraint_level": self.constraint_level,
            "failure_pattern": self.failure_pattern,
            "confirmed_fixes": list(self.confirmed_fixes),
            "missed_fixes": list(self.missed_fixes),
            "materialized_risks": list(self.materialized_risks),
            "decision": self.decision,
            "reason": self.reason,
        }


@dataclass
class VerificationResult:
    """Verdict on the prior iteration's pending manifest, if any.

    Verdict is one of ``confirmed`` / ``regressed`` / ``mixed`` /
    ``no_signal`` — chosen based on whether the claimed fixes and
    at-risk regressions actually moved in the current rollout's
    pass/fail relative to the prior one. Iteration-level rollup;
    per-change attribution lives in :attr:`change_evaluations`.
    """

    pending_archived_to: Optional[str] = None
    verdict: str = "no_signal"
    delta: dict[str, Any] = field(default_factory=dict)
    change_evaluations: list[ChangeEvaluation] = field(default_factory=list)
    unexpected_flips_to_pass: list[str] = field(default_factory=list)
    unexpected_flips_to_fail: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "pending_archived_to": self.pending_archived_to,
            "verdict": self.verdict,
            "delta": self.delta,
            "change_evaluations": [c.to_dict() for c in self.change_evaluations],
            "unexpected_flips_to_pass": list(self.unexpected_flips_to_pass),
            "unexpected_flips_to_fail": list(self.unexpected_flips_to_fail),
        }


@dataclass
class IterationResult:
    """End-to-end output of one ``run_one_iteration`` call."""

    iteration_id: str
    agent_id: str
    tenant_id: Optional[str]
    verification: VerificationResult
    rollout: RolloutResult
    evidence: Evidence
    evolve: EvolveOutcome

    def to_dict(self) -> dict[str, Any]:
        return {
            "iteration_id": self.iteration_id,
            "agent_id": self.agent_id,
            "tenant_id": self.tenant_id,
            "verification": self.verification.to_dict(),
            "rollout": self.rollout.to_dict(),
            "evidence": self.evidence.to_dict(),
            "evolve": self.evolve.to_dict(),
        }
