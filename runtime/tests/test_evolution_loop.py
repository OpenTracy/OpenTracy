"""Smoke test for the AHE evolution orchestrator.

Wires the loop end-to-end with mocked components:
  - per-agent executor → stub that returns canned ExecutionRecords
  - SandboxRun → stub that simulates the Evolve Agent writing a
    pending manifest into the workspace

Then asserts the IterationResult shape + verifies the pending manifest
landed and the per-agent cache was invalidated.
"""

from __future__ import annotations

import io
import json
import tarfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional
from unittest.mock import MagicMock, patch

import pytest

from runtime.evolution import run_one_iteration
from runtime.evolution.types import Evidence, RolloutResult, TaskOutcome


# ---------------------------------------------------------------------------
# Stubs
# ---------------------------------------------------------------------------


@dataclass
class _StubRecord:
    response: str
    duration_ms: float = 12.0
    success: bool = True
    error: Optional[str] = None


class _StubExecutor:
    """Returns the same canned response for any task. Lets the rollout
    assert tasks were replayed without depending on the real pipeline."""

    def __init__(self, response: str = "stub-response", succeed: bool = True):
        self.calls: list[str] = []
        self._response = response
        self._succeed = succeed

    def run(self, request, history=None, session_id=None):
        self.calls.append(request)
        return None, _StubRecord(
            response=self._response,
            success=self._succeed,
            error=None if self._succeed else "stub-error",
        )


def _make_fake_sandbox_factory(pending_manifest: dict[str, Any] | None):
    """Return a fake SandboxRun class that simulates the Evolve Agent.

    Preserves the uploaded workspace tar in the snapshot back so
    history dirs etc. aren't wiped — mimics what a real sandbox
    does (it untars on entry, runs claude, re-tars EVERYTHING on
    exit). On top of the uploaded contents the fake injects a fresh
    pending manifest + a new skill file to represent the Evolve
    Agent's edits."""

    class _Sandbox:
        def __init__(self, *, anthropic_key, template=None, timeout_s=300):
            self.anthropic_key = anthropic_key
            self._uploaded_tar: bytes = b""

        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

        def upload_workspace_tar(self, data: bytes) -> None:
            self._uploaded_tar = data

        def run_claude(self, _prompt, *, system=None, model=None):
            yield {"type": "stdout", "data": "Evolved! Edited skills/plan_first.md."}
            yield {"type": "done", "exit_code": 0}

        def snapshot_workspace_tar(self) -> bytes:
            # Start from the uploaded tar so all existing files survive
            # (history archives, memory, prompts, etc.). Then overlay the
            # Evolve Agent's "edits" on top.
            buf_in = io.BytesIO(self._uploaded_tar) if self._uploaded_tar else None
            buf_out = io.BytesIO()
            seen: set[str] = set()
            with tarfile.open(fileobj=buf_out, mode="w:gz") as tar_out:
                if buf_in is not None:
                    with tarfile.open(fileobj=buf_in, mode="r:gz") as tar_in:
                        for member in tar_in.getmembers():
                            if member.name in (
                                ".opentracy/manifest/pending.json",
                                ".opentracy/skills/plan_first.md",
                            ):
                                # We'll re-add updated versions below.
                                continue
                            extracted = tar_in.extractfile(member)
                            tar_out.addfile(
                                member,
                                io.BytesIO(extracted.read()) if extracted else None,
                            )
                            seen.add(member.name)
                if pending_manifest is not None:
                    payload = json.dumps(pending_manifest, indent=2).encode("utf-8")
                    info = tarfile.TarInfo(".opentracy/manifest/pending.json")
                    info.size = len(payload)
                    tar_out.addfile(info, io.BytesIO(payload))
                skill_payload = b"# Plan first\nAlways plan first.\n"
                info = tarfile.TarInfo(".opentracy/skills/plan_first.md")
                info.size = len(skill_payload)
                tar_out.addfile(info, io.BytesIO(skill_payload))
            return buf_out.getvalue()

    return _Sandbox


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def isolated_workspace(tmp_path, monkeypatch):
    """Per-test workspace store rooted in tmp_path; agent_id = 'demo'."""
    from runtime.workspaces import store as ws_store

    monkeypatch.setattr(
        ws_store, "_agents_root", lambda root=None: root if root else tmp_path,
    )
    (tmp_path / "demo").mkdir(exist_ok=True)
    yield ws_store.get_workspace("demo", root=tmp_path)


@pytest.fixture
def stub_executor():
    return _StubExecutor()


@pytest.fixture(autouse=True)
def _stubs(monkeypatch, stub_executor):
    # BYOK resolver → fake key so the loop doesn't fall over.
    monkeypatch.setattr(
        "runtime.agents.secrets.get_secret",
        lambda provider, agent_id=None: "sk-ant-fake",
    )
    # Multi-tenant gate ON so the per-agent executor path is taken.
    monkeypatch.setattr(
        "runtime.tenants.feature.is_multi_tenant_enabled",
        lambda: True,
    )
    # Pin the active tenant.
    from runtime import tenant_context as tctx
    tctx.set_active("acme")

    # Resolver returns the stub executor, no matter what dir is on disk.
    from runtime.executor import per_agent as pae
    monkeypatch.setattr(
        pae, "get_executor_for_agent",
        lambda tenant, agent, *, fallback_executor=None, agents_root=None: stub_executor,
    )
    # v1: cluster_failures makes a real Anthropic call by default —
    # short-circuit to identity so tests don't hit the network.
    from runtime.evolution import loop as _loop
    monkeypatch.setattr(
        _loop, "cluster_failures",
        lambda evidence, *, anthropic_key, model=None: evidence,
    )
    yield
    tctx.set_active(None)


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


def test_iteration_replays_tasks_and_returns_rollout(isolated_workspace, stub_executor):
    factory = _make_fake_sandbox_factory(pending_manifest={
        "changed_files": [".opentracy/skills/plan_first.md"],
        "claimed_fixes": ["agent skips planning"],
        "rationale": "fail rate suggests no upfront plan",
    })
    result = run_one_iteration(
        agent_id="demo",
        tasks=["how do I reset my password?", "where's my order?"],
        sandbox_factory=factory,
        k=1,
    )

    assert stub_executor.calls == [
        "how do I reset my password?",
        "where's my order?",
    ]
    assert result.rollout.passed == 2
    assert result.rollout.failed == 0
    assert all(o.response == "stub-response" for o in result.rollout.outcomes)


def test_iteration_writes_evidence_summary(isolated_workspace):
    factory = _make_fake_sandbox_factory(pending_manifest=None)
    result = run_one_iteration(
        agent_id="demo",
        tasks=["t1"],
        sandbox_factory=factory,
        k=1,
    )
    assert "Rollout:" in result.evidence.summary
    assert "PASS" in result.evidence.summary


def test_iteration_evolve_writes_pending_manifest(isolated_workspace):
    manifest = {
        "changed_files": [".opentracy/skills/plan_first.md"],
        "claimed_fixes": ["plan more"],
        "at_risk_regressions": ["slower on cold tasks"],
        "rationale": "evidence X",
    }
    factory = _make_fake_sandbox_factory(pending_manifest=manifest)
    result = run_one_iteration(
        agent_id="demo",
        tasks=["t1"],
        sandbox_factory=factory,
        k=1,
    )
    assert result.evolve.pending_manifest is not None
    assert result.evolve.pending_manifest["claimed_fixes"] == ["plan more"]
    # files_edited picks up the new file the sandbox dropped.
    assert ".opentracy/skills/plan_first.md" in result.evolve.files_edited


def test_iteration_with_no_prior_pending_records_no_signal(isolated_workspace):
    factory = _make_fake_sandbox_factory(pending_manifest=None)
    result = run_one_iteration(
        agent_id="demo",
        tasks=["t1"],
        sandbox_factory=factory,
        k=1,
    )
    assert result.verification.verdict == "no_signal"
    assert result.verification.pending_archived_to is None


def test_iteration_verifies_prior_pending_and_archives(isolated_workspace):
    # Seed a prior pending manifest BEFORE running the loop.
    isolated_workspace.write_pending_manifest({
        "claimed_fixes": ["agent A"],
        "at_risk_regressions": ["maybe B"],
    })
    factory = _make_fake_sandbox_factory(pending_manifest={
        "claimed_fixes": ["new fix"],
        "rationale": "follow-up",
    })
    result = run_one_iteration(
        agent_id="demo",
        tasks=["t1", "t2"],
        sandbox_factory=factory,
        k=1,
    )
    # All rollouts passed → confirmed verdict on prior pending.
    assert result.verification.verdict == "confirmed"
    assert result.verification.pending_archived_to is not None
    history = isolated_workspace.list_manifest_history()
    assert len(history) == 1
    assert history[0]["outcome"]["verdict"] == "confirmed"
    # The newly-written pending manifest replaces the old one.
    new_pending = isolated_workspace.read_pending_manifest()
    assert new_pending["claimed_fixes"] == ["new fix"]


def test_iteration_verdict_regressed_when_failures_with_at_risk(isolated_workspace):
    isolated_workspace.write_pending_manifest({
        "claimed_fixes": [],
        "at_risk_regressions": ["might fail Y"],
    })
    factory = _make_fake_sandbox_factory(pending_manifest=None)
    # Use a failing executor.
    from runtime.executor import per_agent as pae
    failing = _StubExecutor(succeed=False)
    pae.get_executor_for_agent = lambda *a, **k: failing  # type: ignore[assignment]

    result = run_one_iteration(
        agent_id="demo", tasks=["t1"], sandbox_factory=factory, k=1,
    )
    assert result.rollout.failed == 1
    assert result.verification.verdict == "regressed"


def test_iteration_verdict_mixed_when_failures_without_predictions(isolated_workspace):
    isolated_workspace.write_pending_manifest({
        "claimed_fixes": ["something else"],
        "at_risk_regressions": [],
    })
    factory = _make_fake_sandbox_factory(pending_manifest=None)
    from runtime.executor import per_agent as pae
    failing = _StubExecutor(succeed=False)
    pae.get_executor_for_agent = lambda *a, **k: failing  # type: ignore[assignment]

    result = run_one_iteration(
        agent_id="demo", tasks=["t1"], sandbox_factory=factory, k=1,
    )
    assert result.verification.verdict == "mixed"


def test_iteration_raises_without_anthropic_key(isolated_workspace, monkeypatch):
    monkeypatch.setattr(
        "runtime.agents.secrets.get_secret",
        lambda provider, agent_id=None: None,
    )
    factory = _make_fake_sandbox_factory(pending_manifest=None)
    with pytest.raises(RuntimeError, match="no Anthropic key"):
        run_one_iteration(
            agent_id="demo", tasks=["t1"], sandbox_factory=factory,
        )


def test_iteration_invalidates_per_agent_cache(isolated_workspace, monkeypatch):
    invalidated: list = []
    from runtime.executor import per_agent as pae
    monkeypatch.setattr(
        pae, "invalidate",
        lambda tenant, agent: invalidated.append((tenant, agent)) or True,
    )
    factory = _make_fake_sandbox_factory(pending_manifest=None)
    run_one_iteration(
        agent_id="demo", tasks=["t1"], sandbox_factory=factory, k=1,
    )
    assert invalidated == [("acme", "demo")]


# ---------------------------------------------------------------------------
# v1 — k>=2, clustering, file-level rollback
# ---------------------------------------------------------------------------


def test_iteration_with_k_2_replays_every_task_twice(isolated_workspace, stub_executor):
    """k=2 means each task is run twice. Outcomes count goes up but
    per-task aggregates (passed/failed) stay anchored to the unique
    task list — majority-pass per task."""
    factory = _make_fake_sandbox_factory(pending_manifest=None)
    run_one_iteration(
        agent_id="demo",
        tasks=["t1", "t2"],
        sandbox_factory=factory,
        k=2,
    )
    # 2 tasks × 2 replays = 4 executor.run calls.
    assert stub_executor.calls == ["t1", "t2", "t1", "t2"]


def test_iteration_with_k_2_majority_pass_per_task(isolated_workspace, monkeypatch):
    """Mix of pass+fail per task. With k=3, 2/3 majority counts as
    PASS, 1/3 majority counts as FAIL — flaky flag set when split."""
    factory = _make_fake_sandbox_factory(pending_manifest=None)

    # Per-task result schedule: t1 always passes, t2 fails on run 0 only.
    state = {"run": -1}
    def _run(task, history=None, session_id=None):
        state["run"] += 1
        idx_in_round = state["run"] % 2  # alternates t1/t2 within a round
        round_num = state["run"] // 2
        if task == "t2" and round_num == 0:
            return None, _StubRecord(response="oops", success=False, error="boom")
        return None, _StubRecord(response="ok", success=True)

    from runtime.executor import per_agent as pae
    monkeypatch.setattr(
        pae, "get_executor_for_agent",
        lambda *a, **kw: type("E", (), {"run": staticmethod(_run)})(),
    )

    result = run_one_iteration(
        agent_id="demo",
        tasks=["t1", "t2"],
        sandbox_factory=factory,
        k=3,
    )
    aggs = result.rollout.task_aggregates
    assert aggs["t1"]["passed_runs"] == 3
    assert aggs["t1"]["majority_pass"] is True
    assert aggs["t2"]["passed_runs"] == 2  # 2 of 3 passed (failed only run 0)
    assert aggs["t2"]["majority_pass"] is True
    assert aggs["t2"]["flaky"] is True
    assert result.rollout.flaky_tasks == ["t2"]


def test_iteration_calls_cluster_failures_with_evidence(isolated_workspace, monkeypatch):
    """Distill phase composes summarize + cluster. Verify the stub is
    invoked with the post-summarize Evidence + the BYOK key."""
    calls = []
    factory = _make_fake_sandbox_factory(pending_manifest=None)

    from runtime.evolution import loop as _loop

    def _spy(evidence, *, anthropic_key, model=None):
        calls.append({"evidence": evidence, "anthropic_key": anthropic_key})
        return evidence

    monkeypatch.setattr(_loop, "cluster_failures", _spy)

    run_one_iteration(
        agent_id="demo", tasks=["t1"], sandbox_factory=factory, k=1,
    )
    assert len(calls) == 1
    assert calls[0]["anthropic_key"] == "sk-ant-fake"
    assert "Rollout:" in calls[0]["evidence"].summary


def test_iteration_passes_clusters_to_evolve_agent(isolated_workspace, monkeypatch):
    """When cluster_failures returns clusters, they show up in the
    evidence_summary that run_evolve is invoked with."""
    from runtime.evolution import loop as _loop
    from runtime.evolution.types import EvidenceCluster

    def _add_clusters(evidence, *, anthropic_key, model=None):
        evidence.clusters = [
            EvidenceCluster(
                root_cause="agent-skipped-planning",
                tasks=["t1"],
                severity=4,
                notes="model jumped to action without scoping",
            ),
        ]
        return evidence
    monkeypatch.setattr(_loop, "cluster_failures", _add_clusters)

    captured = {}
    real_run_evolve = _loop.run_evolve
    def _spy_evolve(**kwargs):
        captured["evidence_summary"] = kwargs.get("evidence_summary")
        return real_run_evolve(**kwargs)
    monkeypatch.setattr(_loop, "run_evolve", _spy_evolve)

    factory = _make_fake_sandbox_factory(pending_manifest=None)
    run_one_iteration(
        agent_id="demo", tasks=["t1"], sandbox_factory=factory, k=1,
    )
    summary = captured["evidence_summary"]
    assert "Agent Debugger clusters" in summary
    assert "agent-skipped-planning" in summary
    assert "[severity 4]" in summary


def test_rollback_snapshot_persists_post_evolve(isolated_workspace):
    """When the Evolve Agent declares changed_files, the loop writes
    a rollback snapshot capturing the pre-edit content of those
    files. Files that existed pre-edit are captured as content;
    new files are captured as None (rollback = unlink)."""
    # Seed system_prompt.md with known content BEFORE evolve runs.
    sp = isolated_workspace.path / ".opentracy" / "system_prompt.md"
    sp.write_text("ORIGINAL PROMPT", encoding="utf-8")

    factory = _make_fake_sandbox_factory(pending_manifest={
        "changed_files": [
            ".opentracy/system_prompt.md",      # edited (existed before)
            ".opentracy/skills/plan_first.md",  # newly created
        ],
        "claimed_fixes": ["agent will plan now"],
        "at_risk_regressions": [],
    })
    run_one_iteration(
        agent_id="demo", tasks=["t1"], sandbox_factory=factory, k=1,
    )
    snapshot = isolated_workspace.read_rollback_snapshot()
    assert snapshot is not None
    assert snapshot["files"][".opentracy/system_prompt.md"] == "ORIGINAL PROMPT"
    # The skill file is NEW post-edit → snapshot value None means
    # rollback = unlink.
    assert snapshot["files"][".opentracy/skills/plan_first.md"] is None


def test_rollback_applied_on_regressed_verdict(isolated_workspace):
    """Two-iteration scenario:
      iter 1: evolve edits system_prompt.md → rollback snapshot saved.
      iter 2: rollout fails AND prior pending had at_risk_regressions
              → verdict=regressed → rollback restores original prompt.
    """
    isolated_workspace.path.joinpath(".opentracy", "system_prompt.md").write_text(
        "PROMPT BEFORE", encoding="utf-8",
    )

    # iter 1: edit + predict regression risk.
    factory_iter1 = _make_fake_sandbox_factory(pending_manifest={
        "changed_files": [".opentracy/system_prompt.md"],
        "claimed_fixes": ["x"],
        "at_risk_regressions": ["y might break"],
    })
    run_one_iteration(
        agent_id="demo", tasks=["t1"], sandbox_factory=factory_iter1, k=1,
    )
    # After iter 1, the fake sandbox replaced the prompt content
    # via the workspace tar roundtrip... but our fake sandbox doesn't
    # actually mutate the prompt — it only injects skills/plan_first.md
    # and the pending manifest. So the rollback snapshot captures the
    # current (still "PROMPT BEFORE") content as if it had been edited.
    snapshot = isolated_workspace.read_rollback_snapshot()
    assert snapshot["files"][".opentracy/system_prompt.md"] == "PROMPT BEFORE"

    # Manually flip the prompt to simulate an "edit" that broke things.
    isolated_workspace.path.joinpath(".opentracy", "system_prompt.md").write_text(
        "PROMPT AFTER (broken)", encoding="utf-8",
    )

    # iter 2: rollout fails → regressed verdict → rollback should restore.
    from runtime.executor import per_agent as pae
    failing = _StubExecutor(succeed=False)
    pae.get_executor_for_agent = lambda *a, **k: failing  # type: ignore[assignment]

    factory_iter2 = _make_fake_sandbox_factory(pending_manifest=None)
    result2 = run_one_iteration(
        agent_id="demo", tasks=["t1"], sandbox_factory=factory_iter2, k=1,
    )
    assert result2.verification.verdict == "regressed"
    assert ".opentracy/system_prompt.md" in result2.verification.delta["rollback_applied"]
    # Prompt content reverted.
    assert isolated_workspace.path.joinpath(".opentracy", "system_prompt.md").read_text() == "PROMPT BEFORE"
    # Snapshot was consumed.
    assert isolated_workspace.read_rollback_snapshot() is None


def test_confirmed_verdict_clears_stale_rollback_snapshot(isolated_workspace):
    """When the rollout passes (verdict=confirmed) the snapshot is
    obsolete — the edits are now the new baseline. Snapshot dropped."""
    # Seed pending + rollback snapshot from a "prior iteration".
    isolated_workspace.write_pending_manifest({
        "claimed_fixes": ["fixed"],
        "at_risk_regressions": [],
    })
    isolated_workspace.write_rollback_snapshot(
        iteration_id="prior",
        files={".opentracy/system_prompt.md": "STALE BACKUP"},
    )
    factory = _make_fake_sandbox_factory(pending_manifest=None)
    result = run_one_iteration(
        agent_id="demo", tasks=["t1"], sandbox_factory=factory, k=1,
    )
    assert result.verification.verdict == "confirmed"
    # The OLD rollback snapshot must be gone (confirmed → no rollback).
    # A NEW one is written only if the new pending manifest declares
    # changed_files; here pending_manifest=None so no new snapshot.
    assert isolated_workspace.read_rollback_snapshot() is None


# ---------------------------------------------------------------------------
# Wave A — per-change attribution, KEEP/IMPROVE/ROLLBACK_AND_PIVOT, scoped rollback
# ---------------------------------------------------------------------------


def _seed_iteration_one_with_baseline(
    workspace, *, baseline_task_outcomes, pending_changes, files_to_seed=None,
):
    """Seed the workspace as if iteration N had just finished:
      - prior pending manifest with a ``changes`` array
      - matching pending_baseline (task outcomes pre-edits)
      - rollback_snapshot keyed by change_id (so iteration N+1 can do
        scoped rollback if a change pivots)
      - optional pre-existing files to act as "edited" so the file_map
        in the snapshot has a real predecessor content.
    """
    for rel, content in (files_to_seed or {}).items():
        target = workspace.path / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")

    workspace.write_pending_manifest({
        "rationale": "wave-A test seed",
        "changes": pending_changes,
        # legacy mirrors so the iteration-level verdict has something
        "changed_files": [f for c in pending_changes for f in c.get("files", [])],
        "claimed_fixes": [
            t for c in pending_changes for t in c.get("predicted_fixes", [])
        ],
        "at_risk_regressions": [
            t for c in pending_changes for t in c.get("risk_tasks", [])
        ],
    })
    workspace.write_pending_baseline(
        iteration_id="evo-prior", task_outcomes=baseline_task_outcomes,
    )
    by_change = {}
    for c in pending_changes:
        bucket = {}
        for rel in c.get("files", []):
            # Stored pre-edit content = whatever we just seeded; new
            # files become None so rollback unlinks them.
            seeded = (files_to_seed or {}).get(rel)
            bucket[rel] = seeded
        if bucket:
            by_change[c["id"]] = {"files": bucket}
    if by_change:
        workspace.write_rollback_snapshot(
            iteration_id="evo-prior", by_change=by_change,
        )


def _executor_with_schedule(monkeypatch, schedule):
    """Override the per-agent executor with one whose run() consults a
    {task: bool} pass/fail schedule. Calls are tallied for assertions."""
    calls = []

    def _run(task, history=None, session_id=None):
        calls.append(task)
        ok = schedule[task]
        return None, _StubRecord(
            response=f"resp-{task}",
            success=ok,
            error=None if ok else "stub-fail",
        )

    from runtime.executor import per_agent as pae
    monkeypatch.setattr(
        pae, "get_executor_for_agent",
        lambda *a, **kw: type("E", (), {"run": staticmethod(_run)})(),
    )
    return calls


def test_change_evaluation_decision_keep_when_all_fixes_land(
    isolated_workspace, monkeypatch,
):
    """Predicted t1 to flip fail→pass, no risks — t1 indeed passes
    this iteration → decision=KEEP, no rollback."""
    _seed_iteration_one_with_baseline(
        isolated_workspace,
        baseline_task_outcomes={"t1": "fail", "t2": "pass"},
        pending_changes=[{
            "id": "chg-1",
            "constraint_level": "skill",
            "files": [".opentracy/skills/wave_a_keep.md"],
            "failure_pattern": "plan-skipped",
            "predicted_fixes": ["t1"],
            "risk_tasks": [],
        }],
        files_to_seed={".opentracy/skills/wave_a_keep.md": "v1"},
    )
    _executor_with_schedule(monkeypatch, {"t1": True, "t2": True})

    factory = _make_fake_sandbox_factory(pending_manifest=None)
    result = run_one_iteration(
        agent_id="demo", tasks=["t1", "t2"], sandbox_factory=factory, k=1,
    )
    evals = result.verification.change_evaluations
    assert len(evals) == 1
    assert evals[0].decision == "KEEP"
    assert evals[0].confirmed_fixes == ["t1"]
    # KEEP → file stays as edited.
    assert (
        isolated_workspace.path / ".opentracy/skills/wave_a_keep.md"
    ).read_text() == "v1"


def test_change_evaluation_decision_improve_when_partial_fixes_land(
    isolated_workspace, monkeypatch,
):
    """Predicted t1+t2 to flip, only t1 lands → IMPROVE (right
    direction, refine same level), file stays."""
    _seed_iteration_one_with_baseline(
        isolated_workspace,
        baseline_task_outcomes={"t1": "fail", "t2": "fail"},
        pending_changes=[{
            "id": "chg-1",
            "constraint_level": "skill",
            "files": [".opentracy/skills/wave_a_improve.md"],
            "failure_pattern": "plan-skipped",
            "predicted_fixes": ["t1", "t2"],
            "risk_tasks": [],
        }],
        files_to_seed={".opentracy/skills/wave_a_improve.md": "v1"},
    )
    _executor_with_schedule(monkeypatch, {"t1": True, "t2": False})

    factory = _make_fake_sandbox_factory(pending_manifest=None)
    result = run_one_iteration(
        agent_id="demo", tasks=["t1", "t2"], sandbox_factory=factory, k=1,
    )
    ev = result.verification.change_evaluations[0]
    assert ev.decision == "IMPROVE"
    assert ev.confirmed_fixes == ["t1"]
    assert ev.missed_fixes == ["t2"]
    # IMPROVE → file stays.
    assert (
        isolated_workspace.path / ".opentracy/skills/wave_a_improve.md"
    ).read_text() == "v1"


def test_change_evaluation_decision_pivot_when_zero_fixes_land(
    isolated_workspace, monkeypatch,
):
    """Predicted t1 to flip, t1 still fails → ROLLBACK_AND_PIVOT,
    file restored to pre-edit content."""
    _seed_iteration_one_with_baseline(
        isolated_workspace,
        baseline_task_outcomes={"t1": "fail"},
        pending_changes=[{
            "id": "chg-1",
            "constraint_level": "skill",
            "files": [".opentracy/skills/wave_a_pivot.md"],
            "failure_pattern": "plan-skipped",
            "predicted_fixes": ["t1"],
            "risk_tasks": [],
        }],
        files_to_seed={".opentracy/skills/wave_a_pivot.md": "ORIGINAL"},
    )
    # Simulate the (failed) edit having modified the file on disk.
    (
        isolated_workspace.path / ".opentracy/skills/wave_a_pivot.md"
    ).write_text("FAILED EDIT", encoding="utf-8")
    _executor_with_schedule(monkeypatch, {"t1": False})

    factory = _make_fake_sandbox_factory(pending_manifest=None)
    result = run_one_iteration(
        agent_id="demo", tasks=["t1"], sandbox_factory=factory, k=1,
    )
    ev = result.verification.change_evaluations[0]
    assert ev.decision == "ROLLBACK_AND_PIVOT"
    assert ev.missed_fixes == ["t1"]
    # Rollback restored content.
    assert (
        isolated_workspace.path / ".opentracy/skills/wave_a_pivot.md"
    ).read_text() == "ORIGINAL"
    assert ".opentracy/skills/wave_a_pivot.md" in result.verification.delta["rollback_applied"]
    assert result.verification.delta["rolled_back_changes"] == ["chg-1"]


def test_scoped_rollback_only_touches_pivoted_changes(
    isolated_workspace, monkeypatch,
):
    """Two changes side-by-side: chg-A's prediction lands → KEEP,
    chg-B's prediction misses → ROLLBACK_AND_PIVOT. Only chg-B's
    file reverts; chg-A's stays edited."""
    _seed_iteration_one_with_baseline(
        isolated_workspace,
        baseline_task_outcomes={"a": "fail", "b": "fail"},
        pending_changes=[
            {
                "id": "chg-A",
                "constraint_level": "skill",
                "files": [".opentracy/skills/wave_a_scoped_a.md"],
                "failure_pattern": "fa",
                "predicted_fixes": ["a"],
                "risk_tasks": [],
            },
            {
                "id": "chg-B",
                "constraint_level": "system_prompt",
                "files": [".opentracy/skills/wave_a_scoped_b.md"],
                "failure_pattern": "fb",
                "predicted_fixes": ["b"],
                "risk_tasks": [],
            },
        ],
        files_to_seed={
            ".opentracy/skills/wave_a_scoped_a.md": "ORIGINAL-A",
            ".opentracy/skills/wave_a_scoped_b.md": "ORIGINAL-B",
        },
    )
    # Simulate both edits already on disk; one will be rolled back.
    (isolated_workspace.path / ".opentracy/skills/wave_a_scoped_a.md").write_text("EDIT-A")
    (isolated_workspace.path / ".opentracy/skills/wave_a_scoped_b.md").write_text("EDIT-B")
    _executor_with_schedule(monkeypatch, {"a": True, "b": False})

    factory = _make_fake_sandbox_factory(pending_manifest=None)
    result = run_one_iteration(
        agent_id="demo", tasks=["a", "b"], sandbox_factory=factory, k=1,
    )
    decisions = {ev.change_id: ev.decision for ev in result.verification.change_evaluations}
    assert decisions == {"chg-A": "KEEP", "chg-B": "ROLLBACK_AND_PIVOT"}
    # Scoped rollback: chg-A's file stays as the edit, chg-B's reverts.
    assert (
        isolated_workspace.path / ".opentracy/skills/wave_a_scoped_a.md"
    ).read_text() == "EDIT-A"
    assert (
        isolated_workspace.path / ".opentracy/skills/wave_a_scoped_b.md"
    ).read_text() == "ORIGINAL-B"
    assert result.verification.delta["rolled_back_changes"] == ["chg-B"]


def test_change_evaluation_persisted_for_next_agent(
    isolated_workspace, monkeypatch,
):
    """After a verified iteration, change_evaluation.json is on disk and
    list_change_evaluations returns it newest-first."""
    _seed_iteration_one_with_baseline(
        isolated_workspace,
        baseline_task_outcomes={"t1": "fail"},
        pending_changes=[{
            "id": "chg-1",
            "constraint_level": "skill",
            "files": [".opentracy/skills/wave_a_persisted.md"],
            "failure_pattern": "plan-skipped",
            "predicted_fixes": ["t1"],
            "risk_tasks": [],
        }],
        files_to_seed={".opentracy/skills/wave_a_persisted.md": "v1"},
    )
    _executor_with_schedule(monkeypatch, {"t1": True})

    factory = _make_fake_sandbox_factory(pending_manifest=None)
    run_one_iteration(
        agent_id="demo", tasks=["t1"], sandbox_factory=factory, k=1,
    )
    history = isolated_workspace.list_change_evaluations(limit=5)
    assert len(history) == 1
    assert history[0]["evaluations"][0]["decision"] == "KEEP"
    assert history[0]["evaluations"][0]["constraint_level"] == "skill"


def test_pending_baseline_written_alongside_new_pending(
    isolated_workspace, monkeypatch,
):
    """When the Evolve Agent writes a new pending, the loop snapshots
    the current rollout outcomes so the NEXT iteration has a baseline
    to compute flip attribution against."""
    _executor_with_schedule(monkeypatch, {"t1": True, "t2": False})
    # plan_first.md is what the fake sandbox always injects — using
    # it here lets the post-evolve validator find the declared file
    # on disk (so the iteration survives to write a baseline).
    factory = _make_fake_sandbox_factory(pending_manifest={
        "rationale": "x",
        "changes": [{
            "id": "chg-1",
            "constraint_level": "skill",
            "files": [".opentracy/skills/plan_first.md"],
            "failure_pattern": "fp",
            "predicted_fixes": ["t2"],
            "risk_tasks": [],
        }],
        "changed_files": [".opentracy/skills/plan_first.md"],
        "claimed_fixes": ["t2"],
    })
    run_one_iteration(
        agent_id="demo", tasks=["t1", "t2"], sandbox_factory=factory, k=1,
    )
    baseline = isolated_workspace.read_pending_baseline()
    assert baseline is not None
    assert baseline["task_outcomes"] == {"t1": "pass", "t2": "fail"}


def test_legacy_flat_manifest_still_verifies_without_changes_array(
    isolated_workspace, monkeypatch,
):
    """Backward-compat: a pending without a ``changes`` array uses the
    iteration-level verdict heuristic and the iteration-wide rollback
    path. No change_evaluations are produced."""
    isolated_workspace.write_pending_manifest({
        "claimed_fixes": ["x"],
        "at_risk_regressions": ["maybe y"],
        "changed_files": [".opentracy/skills/legacy.md"],
    })
    _executor_with_schedule(monkeypatch, {"t1": False})

    factory = _make_fake_sandbox_factory(pending_manifest=None)
    result = run_one_iteration(
        agent_id="demo", tasks=["t1"], sandbox_factory=factory, k=1,
    )
    assert result.verification.change_evaluations == []
    assert result.verification.verdict == "regressed"


def test_iteration_result_has_expected_dict_shape(isolated_workspace):
    factory = _make_fake_sandbox_factory(pending_manifest=None)
    result = run_one_iteration(
        agent_id="demo", tasks=["t1"], sandbox_factory=factory, k=1,
    )
    data = result.to_dict()
    assert set(data.keys()) >= {
        "iteration_id", "agent_id", "tenant_id",
        "verification", "rollout", "evidence", "evolve",
    }
    assert data["iteration_id"].startswith("evo-")
    assert data["agent_id"] == "demo"
    assert data["tenant_id"] == "acme"


# ---------------------------------------------------------------------------
# Wave B — layered analysis, evolution_history, partial-pass, validator
# ---------------------------------------------------------------------------


def test_analysis_overview_and_detail_files_written(isolated_workspace, monkeypatch):
    """After distill the loop writes overview.md + detail/ for any
    failing/flaky task under .opentracy/analysis/{iter_id}/."""
    _executor_with_schedule(monkeypatch, {"t1": False, "t2": True})
    factory = _make_fake_sandbox_factory(pending_manifest=None)
    result = run_one_iteration(
        agent_id="demo", tasks=["t1", "t2"], sandbox_factory=factory, k=1,
    )
    base = isolated_workspace.path / ".opentracy/analysis" / result.iteration_id
    assert (base / "overview.md").is_file()
    overview = (base / "overview.md").read_text()
    assert "Pass@1:" in overview
    # t1 failed → gets a detail page; t2 passed → no detail page.
    detail_files = sorted(p.name for p in (base / "detail").iterdir())
    assert any("t1" in name for name in detail_files)
    assert not any("t2" in name for name in detail_files)


def test_analysis_gcs_old_iterations(isolated_workspace, monkeypatch):
    """Only the 5 newest analysis dirs are kept; older ones are GC'd."""
    from runtime.evolution.analysis import write_analysis_report
    from runtime.evolution.types import Evidence, RolloutResult, TaskOutcome

    base = isolated_workspace.path / ".opentracy/analysis"
    base.mkdir(parents=True, exist_ok=True)
    # Pre-seed 6 fake old iterations.
    for i in range(6):
        (base / f"evo-2026010{i}T000000-aaaa").mkdir()

    rollout = RolloutResult(outcomes=[TaskOutcome(task="t1", response="ok", success=True, duration_ms=1.0)], k=1)
    evidence = Evidence(rollout=rollout, summary="x")
    write_analysis_report(
        isolated_workspace,
        iteration_id="evo-20260109T000000-bbbb",
        evidence=evidence,
    )
    remaining = sorted(p.name for p in base.iterdir())
    # 6 old + 1 new = 7, but GC keeps only top-5 by name (desc).
    assert len(remaining) == 5
    assert "evo-20260109T000000-bbbb" in remaining


def test_evolution_history_appends_per_iteration(isolated_workspace, monkeypatch):
    """Each iteration appends one section to .opentracy/evolution_history.md."""
    _executor_with_schedule(monkeypatch, {"t1": True})
    factory = _make_fake_sandbox_factory(pending_manifest=None)
    r1 = run_one_iteration(
        agent_id="demo", tasks=["t1"], sandbox_factory=factory, k=1,
    )
    r2 = run_one_iteration(
        agent_id="demo", tasks=["t1"], sandbox_factory=factory, k=1,
    )
    history = (isolated_workspace.path / ".opentracy/evolution_history.md").read_text()
    assert r1.iteration_id in history
    assert r2.iteration_id in history
    assert history.index(r1.iteration_id) < history.index(r2.iteration_id)


def test_partial_pass_cluster_emitted_when_flaky_and_k_gt_1(isolated_workspace, monkeypatch):
    """k>1 + a flaky task → distill emits a severity-5 partial-pass
    cluster on top of any LLM clusters."""
    # k=2 order: t1#0, t2#0, t1#1, t2#1. Fail only t2#0 so t2 is
    # 1/2 = flaky (not majority-fail).
    state = {"i": -1}

    def _run(task, history=None, session_id=None):
        state["i"] += 1
        if task == "t2" and state["i"] == 1:
            return None, _StubRecord(response="oops", success=False, error="boom")
        return None, _StubRecord(response="ok", success=True)

    from runtime.executor import per_agent as pae
    monkeypatch.setattr(
        pae, "get_executor_for_agent",
        lambda *a, **kw: type("E", (), {"run": staticmethod(_run)})(),
    )
    factory = _make_fake_sandbox_factory(pending_manifest=None)
    result = run_one_iteration(
        agent_id="demo", tasks=["t1", "t2"], sandbox_factory=factory, k=2,
    )
    clusters = result.evidence.clusters
    assert any("partial-pass" in c.root_cause for c in clusters)
    pp = next(c for c in clusters if "partial-pass" in c.root_cause)
    assert pp.severity == 5
    assert "t2" in pp.tasks


def test_partial_pass_cluster_skipped_when_k_eq_1(isolated_workspace, monkeypatch):
    _executor_with_schedule(monkeypatch, {"t1": False})
    factory = _make_fake_sandbox_factory(pending_manifest=None)
    result = run_one_iteration(
        agent_id="demo", tasks=["t1"], sandbox_factory=factory, k=1,
    )
    assert not any("partial-pass" in c.root_cause for c in result.evidence.clusters)


def test_validator_critical_missing_file_triggers_rollback(isolated_workspace, monkeypatch):
    """Pending claims a file that wasn't written → validation_failed
    verdict, pending dropped, no baseline written."""
    _executor_with_schedule(monkeypatch, {"t1": True})
    factory = _make_fake_sandbox_factory(pending_manifest={
        "rationale": "x",
        "changes": [{
            "id": "chg-1",
            "constraint_level": "skill",
            "files": [".opentracy/skills/never_written.md"],
            "failure_pattern": "fp",
            "predicted_fixes": ["t1"],
            "risk_tasks": [],
        }],
        "changed_files": [".opentracy/skills/never_written.md"],
    })
    result = run_one_iteration(
        agent_id="demo", tasks=["t1"], sandbox_factory=factory, k=1,
    )
    assert result.evolve.pending_manifest is None
    # Manifest archived as validation_failed; no new baseline persisted.
    history = isolated_workspace.list_manifest_history(limit=5)
    assert history[0]["outcome"]["verdict"] == "validation_failed"
    assert isolated_workspace.read_pending_baseline() is None


def test_validator_level_path_mismatch_is_critical(isolated_workspace, monkeypatch):
    """constraint_level=skill but file lives under middleware/ → critical."""
    from runtime.evolution.validator import validate_workspace

    (isolated_workspace.path / ".opentracy/middleware").mkdir(parents=True, exist_ok=True)
    (isolated_workspace.path / ".opentracy/middleware/wrong.py").write_text(
        "def x():\n    pass\n", encoding="utf-8",
    )
    report = validate_workspace(isolated_workspace, pending_manifest={
        "changes": [{
            "id": "chg-1",
            "constraint_level": "skill",
            "files": [".opentracy/middleware/wrong.py"],
        }],
    })
    assert report.has_critical
    codes = [i.code for i in report.critical]
    assert "level_path_mismatch" in codes


def test_validator_python_syntax_error_is_critical(isolated_workspace):
    from runtime.evolution.validator import validate_workspace

    mwdir = isolated_workspace.path / ".opentracy/middleware"
    mwdir.mkdir(parents=True, exist_ok=True)
    (mwdir / "broken.py").write_text("def x(\n    pass\n", encoding="utf-8")

    report = validate_workspace(isolated_workspace, pending_manifest={
        "changes": [{
            "id": "chg-1",
            "constraint_level": "middleware",
            "files": [".opentracy/middleware/broken.py"],
        }],
    })
    assert report.has_critical
    assert any(i.code == "python_syntax_error" for i in report.critical)


# ---------------------------------------------------------------------------
# Wave C — LongTermMEMORY pillar, Best-of-N variants, explore agent
# ---------------------------------------------------------------------------


def test_long_term_memory_seeded_and_readable(isolated_workspace):
    """ensure() seeds .opentracy/memory/long_term.md with the
    structured outline so the Evolve Agent has anchor sections to
    append into."""
    from runtime.workspaces.store import LONG_TERM_MEMORY_FILE

    path = isolated_workspace.path / LONG_TERM_MEMORY_FILE
    assert path.is_file()
    body = path.read_text()
    assert "Long-Term Memory" in body
    assert "Recurring pitfalls" in body
    assert "Proven strategies" in body
    # Direct read API returns the same content.
    assert isolated_workspace.read_long_term_memory() == body


def test_long_term_memory_surfaces_as_distinct_pillar(isolated_workspace):
    snapshot = isolated_workspace.list_nexau_components()
    assert snapshot["long_term_memory"] == ["long_term.md"]


def test_pick_winner_prefers_more_predicted_fixes(isolated_workspace):
    from runtime.evolution.types import EvolveOutcome
    from runtime.evolution.validator import ValidationReport
    from runtime.evolution.variants import VariantOutcome, pick_winner

    a = VariantOutcome(
        index=0, strategy_hint="A",
        evolve=EvolveOutcome(pending_manifest={
            "changes": [{"id": "c1", "predicted_fixes": ["t1"]}],
        }),
        validation=ValidationReport(),
    )
    b = VariantOutcome(
        index=1, strategy_hint="B",
        evolve=EvolveOutcome(pending_manifest={
            "changes": [{"id": "c1", "predicted_fixes": ["t1", "t2", "t3"]}],
        }),
        validation=ValidationReport(),
    )
    assert pick_winner([a, b]) is b


def test_pick_winner_rejects_variants_with_critical_validation(isolated_workspace):
    from runtime.evolution.types import EvolveOutcome
    from runtime.evolution.validator import ValidationIssue, ValidationReport
    from runtime.evolution.variants import VariantOutcome, pick_winner

    critical_but_ambitious = VariantOutcome(
        index=0, strategy_hint="A",
        evolve=EvolveOutcome(pending_manifest={
            "changes": [{"id": "c1", "predicted_fixes": ["t1", "t2", "t3"]}],
        }),
        validation=ValidationReport(issues=[
            ValidationIssue(code="missing_file", severity="critical", message="boom"),
        ]),
    )
    clean_but_modest = VariantOutcome(
        index=1, strategy_hint="B",
        evolve=EvolveOutcome(pending_manifest={
            "changes": [{"id": "c1", "predicted_fixes": ["t1"]}],
        }),
        validation=ValidationReport(),
    )
    # Clean variant wins even with fewer predictions — never adopt a
    # variant we'd just rollback for validation.
    assert pick_winner([critical_but_ambitious, clean_but_modest]) is clean_but_modest


def test_pick_winner_tiebreak_by_lower_index(isolated_workspace):
    from runtime.evolution.types import EvolveOutcome
    from runtime.evolution.validator import ValidationReport
    from runtime.evolution.variants import VariantOutcome, pick_winner

    a = VariantOutcome(
        index=0, strategy_hint="A",
        evolve=EvolveOutcome(pending_manifest={
            "changes": [{"id": "c1", "predicted_fixes": ["t1"]}],
        }),
        validation=ValidationReport(),
    )
    b = VariantOutcome(
        index=1, strategy_hint="B",
        evolve=EvolveOutcome(pending_manifest={
            "changes": [{"id": "c1", "predicted_fixes": ["t1"]}],
        }),
        validation=ValidationReport(),
    )
    assert pick_winner([a, b]) is a


def _make_variant_sandbox_factory(by_hint_key: dict[str, Optional[dict]]):
    """Sandbox factory keyed on a substring of the variant's strategy
    hint (e.g. ``"STRUCTURAL"``). Lookup happens inside ``run_claude``
    where the actual system prompt is visible — this is thread-safe
    under parallel ThreadPoolExecutor execution (each sandbox reads
    its own system prompt, no race on a shared counter)."""

    class _Sandbox:
        def __init__(self, *, anthropic_key, template=None, timeout_s=300):
            self._uploaded_tar = b""
            self._pending: Optional[dict] = None
            self._marker_key: Optional[str] = None

        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

        def upload_workspace_tar(self, data):
            self._uploaded_tar = data

        def run_claude(self, _prompt, *, system=None, model=None):
            sys_text = system or ""
            for key, manifest in by_hint_key.items():
                if key in sys_text:
                    self._pending = manifest
                    self._marker_key = key
                    break
            yield {"type": "stdout", "data": f"variant {self._marker_key} done"}
            yield {"type": "done", "exit_code": 0}

        def snapshot_workspace_tar(self):
            buf_in = io.BytesIO(self._uploaded_tar) if self._uploaded_tar else None
            buf_out = io.BytesIO()
            with tarfile.open(fileobj=buf_out, mode="w:gz") as tar_out:
                if buf_in is not None:
                    with tarfile.open(fileobj=buf_in, mode="r:gz") as tar_in:
                        for member in tar_in.getmembers():
                            if member.name == ".opentracy/manifest/pending.json":
                                continue
                            extracted = tar_in.extractfile(member)
                            tar_out.addfile(
                                member,
                                io.BytesIO(extracted.read()) if extracted else None,
                            )
                if self._pending is not None:
                    payload = json.dumps(self._pending, indent=2).encode("utf-8")
                    info = tarfile.TarInfo(".opentracy/manifest/pending.json")
                    info.size = len(payload)
                    tar_out.addfile(info, io.BytesIO(payload))
                marker_name = (
                    self._marker_key or "unknown"
                ).lower().replace(" ", "_")
                marker = f"variant-{marker_name}".encode("utf-8")
                info = tarfile.TarInfo(f".opentracy/skills/variant_{marker_name}.md")
                info.size = len(marker)
                tar_out.addfile(info, io.BytesIO(marker))
            return buf_out.getvalue()

    return _Sandbox


def test_best_of_n_picks_winner_with_more_predicted_fixes(
    isolated_workspace, monkeypatch,
):
    """n_variants=2: GUIDANCE variant promises more fixes → wins →
    its marker file persists, loser's file is gone. Hint matching is
    thread-safe so this works under the parallel ThreadPoolExecutor."""
    _executor_with_schedule(monkeypatch, {"t1": True})
    factory = _make_variant_sandbox_factory({
        # Variant 0 (STRUCTURAL) — modest
        "STRUCTURAL": {
            "rationale": "modest",
            "changes": [{
                "id": "chg-structural",
                "constraint_level": "middleware",
                "files": [".opentracy/skills/variant_structural.md"],
                "predicted_fixes": ["t1"],
                "risk_tasks": [],
            }],
        },
        # Variant 1 (GUIDANCE) — ambitious, wins
        "GUIDANCE": {
            "rationale": "ambitious",
            "changes": [{
                "id": "chg-guidance",
                "constraint_level": "skill",
                "files": [".opentracy/skills/variant_guidance.md"],
                "predicted_fixes": ["t1", "t2", "t3"],
                "risk_tasks": [],
            }],
        },
    })
    result = run_one_iteration(
        agent_id="demo", tasks=["t1"], sandbox_factory=factory,
        k=1, n_variants=2,
    )
    assert result.evolve.chosen_variant_index == 1
    assert len(result.evolve.variant_summaries) == 2
    # Winner's file on disk; loser's file gone after winner restore.
    assert (isolated_workspace.path / ".opentracy/skills/variant_guidance.md").is_file()
    assert not (isolated_workspace.path / ".opentracy/skills/variant_structural.md").exists()


def test_n_variants_default_one_keeps_single_evolve_path(
    isolated_workspace, monkeypatch,
):
    """n_variants defaults to 1 → no variant_summaries written, prior
    behavior preserved."""
    _executor_with_schedule(monkeypatch, {"t1": True})
    factory = _make_fake_sandbox_factory(pending_manifest=None)
    result = run_one_iteration(
        agent_id="demo", tasks=["t1"], sandbox_factory=factory, k=1,
    )
    assert result.evolve.variant_summaries == []
    assert result.evolve.chosen_variant_index is None


def test_explore_agent_writes_findings_file(isolated_workspace):
    """seed_workspace_via_explore drives a sandbox + collects the
    findings file the sandbox produced. v1 smoke: fake sandbox writes
    a deterministic findings.md so we can assert it landed."""
    from runtime.evolution.explore import (
        ExploreSource,
        seed_workspace_via_explore,
    )

    class _ExploreSandbox:
        def __init__(self, *, anthropic_key, timeout_s=300):
            self._uploaded = b""

        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

        def upload_workspace_tar(self, data):
            self._uploaded = data

        def run_claude(self, _prompt, *, system=None, model=None):
            assert "EXPLORE agent" in system
            assert "explore_findings.md" in system
            yield {"type": "stdout", "data": "wrote findings"}
            yield {"type": "done", "exit_code": 0}

        def snapshot_workspace_tar(self):
            buf_in = io.BytesIO(self._uploaded)
            buf_out = io.BytesIO()
            with tarfile.open(fileobj=buf_in, mode="r:gz") as tar_in, \
                 tarfile.open(fileobj=buf_out, mode="w:gz") as tar_out:
                for member in tar_in.getmembers():
                    extracted = tar_in.extractfile(member)
                    tar_out.addfile(
                        member,
                        io.BytesIO(extracted.read()) if extracted else None,
                    )
                payload = (
                    b"# Explore findings\n\n"
                    b"## Domain conventions\n- pattern (https://example.com)\n"
                )
                info = tarfile.TarInfo(".opentracy/skills/explore_findings.md")
                info.size = len(payload)
                tar_out.addfile(info, io.BytesIO(payload))
            return buf_out.getvalue()

    outcome = seed_workspace_via_explore(
        workspace=isolated_workspace,
        anthropic_key="sk-ant-fake",
        sources=[
            ExploreSource(type="url", url="https://example.com",
                          focus="patterns"),
        ],
        sandbox_factory=_ExploreSandbox,
    )
    assert outcome.error is None
    assert ".opentracy/skills/explore_findings.md" in outcome.files_written
    assert outcome.sources_explored == 1
    body = (
        isolated_workspace.path / ".opentracy/skills/explore_findings.md"
    ).read_text()
    assert "Domain conventions" in body


def test_explore_agent_errors_when_sources_empty(isolated_workspace):
    from runtime.evolution.explore import seed_workspace_via_explore

    outcome = seed_workspace_via_explore(
        workspace=isolated_workspace,
        anthropic_key="sk-ant-fake",
        sources=[],
    )
    assert outcome.error == "no sources provided"
    assert outcome.files_written == []


# ---------------------------------------------------------------------------
# Wave D — parallel variants (ThreadPoolExecutor + per-variant scratch dirs)
# ---------------------------------------------------------------------------


def test_run_variants_parallel_keeps_correct_winner(isolated_workspace):
    """With max_workers > 1, variants run concurrently but the
    winner-selection result must match the sequential outcome
    (heuristic is deterministic). The sandbox decides what to emit by
    reading the strategy hint from the system prompt — that's the only
    truly thread-safe handle each variant has on its identity (counter
    order in ``__init__`` races with thread scheduling)."""
    import threading
    import time
    from runtime.evolution.variants import (
        pick_winner, run_variants,
    )

    concurrent_starts: list[float] = []
    barrier = threading.Barrier(2)

    # Map hint substring → (file marker, predicted_fixes for manifest).
    by_hint = {
        "AMBITIOUS": ("ambitious", ["t1", "t2"]),
        "MODEST":    ("modest",    ["t1"]),
    }

    class _Sandbox:
        def __init__(self, *, anthropic_key, template=None, timeout_s=300):
            self._tar = b""
            self._marker: str = "unknown"
            self._predicted: list[str] = []

        def __enter__(self):
            concurrent_starts.append(time.perf_counter())
            return self

        def __exit__(self, *exc):
            return False

        def upload_workspace_tar(self, data):
            self._tar = data

        def run_claude(self, _prompt, *, system=None, model=None):
            sys_text = system or ""
            for key, (marker, predicted) in by_hint.items():
                if key in sys_text:
                    self._marker = marker
                    self._predicted = predicted
                    break
            # Block so both variants must enter concurrently — asserts
            # the pool actually parallelizes.
            barrier.wait(timeout=5)
            yield {"type": "stdout", "data": f"{self._marker} ok"}
            yield {"type": "done", "exit_code": 0}

        def snapshot_workspace_tar(self):
            buf_in = io.BytesIO(self._tar)
            buf_out = io.BytesIO()
            with tarfile.open(fileobj=buf_in, mode="r:gz") as tin, \
                 tarfile.open(fileobj=buf_out, mode="w:gz") as tout:
                for m in tin.getmembers():
                    data = tin.extractfile(m)
                    tout.addfile(
                        m, io.BytesIO(data.read()) if data else None,
                    )
                marker_payload = self._marker.encode("utf-8")
                file_rel = f".opentracy/skills/p_{self._marker}.md"
                info = tarfile.TarInfo(file_rel)
                info.size = len(marker_payload)
                tout.addfile(info, io.BytesIO(marker_payload))
                manifest = json.dumps({"changes": [{
                    "id": f"c-{self._marker}",
                    "constraint_level": "skill",
                    "files": [file_rel],
                    "predicted_fixes": self._predicted,
                    "risk_tasks": [],
                }]}).encode("utf-8")
                info = tarfile.TarInfo(".opentracy/manifest/pending.json")
                info.size = len(manifest)
                tout.addfile(info, io.BytesIO(manifest))
            return buf_out.getvalue()

    outcomes = run_variants(
        workspace=isolated_workspace,
        anthropic_key="sk-ant-fake",
        agent_id="demo",
        evidence_summary="x",
        # Hint 0 → MODEST (1 predicted_fix), hint 1 → AMBITIOUS (2).
        strategy_hints=["MODEST", "AMBITIOUS"],
        sandbox_factory=_Sandbox,
        max_workers=2,
    )
    # Both sandboxes entered concurrently (barrier didn't time out).
    assert len(concurrent_starts) == 2
    # Outcomes returned in declaration order despite parallel execution.
    assert [o.index for o in outcomes] == [0, 1]
    winner = pick_winner(outcomes)
    assert winner is not None
    assert winner.index == 1  # AMBITIOUS variant (2 predicted_fixes)
    # And the winner's manifest carries the ambitious payload.
    assert (winner.evolve.pending_manifest or {}).get("changes", [{}])[0].get(
        "predicted_fixes",
    ) == ["t1", "t2"]


def test_semantic_verifier_flips_mechanical_pass_to_fail(isolated_workspace, monkeypatch):
    """Wave E: verifier overrides mechanical PASS when response is
    off-contract. Without this, agents that produce off-persona text
    always score PASS mechanically and the loop converges prematurely
    to 'nothing to improve'."""
    # Mechanically successful executor — but the verifier will reject.
    _executor_with_schedule(monkeypatch, {"t1": True, "t2": True})

    # Force the verifier to reject t1 and accept t2.
    from runtime.evolution import verifier as _ver

    def _fake_grade(*, task, response, success, error, system_prompt, anthropic_key, model=None):
        if task == "t1":
            return False, "violates persona: revealed underlying model"
        return True, None

    monkeypatch.setattr(_ver, "grade_for_rollout", _fake_grade)

    factory = _make_fake_sandbox_factory(pending_manifest=None)
    result = run_one_iteration(
        agent_id="demo", tasks=["t1", "t2"], sandbox_factory=factory, k=1,
    )
    # t1 was flipped by the verifier; t2 stays passed.
    aggs = result.rollout.task_aggregates
    assert aggs["t1"]["passed_runs"] == 0  # verifier said no
    assert aggs["t2"]["passed_runs"] == 1
    # And the per-task outcome carries the verifier reason.
    t1_outcome = next(o for o in result.rollout.outcomes if o.task == "t1")
    assert t1_outcome.error is not None
    assert "violates persona" in t1_outcome.error


def test_run_variants_max_workers_one_is_sequential(isolated_workspace):
    """max_workers=1 still works — falls back to sequential loop."""
    from runtime.evolution.variants import run_variants

    order: list[int] = []

    class _Sandbox:
        def __init__(self, *, anthropic_key, template=None, timeout_s=300):
            self._tar = b""
            self._idx = len(order)
            order.append(self._idx)

        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

        def upload_workspace_tar(self, data):
            self._tar = data

        def run_claude(self, _prompt, *, system=None, model=None):
            yield {"type": "done", "exit_code": 0}

        def snapshot_workspace_tar(self):
            return self._tar

    outcomes = run_variants(
        workspace=isolated_workspace,
        anthropic_key="k",
        agent_id="demo",
        evidence_summary="x",
        strategy_hints=["A", "B", "C"],
        sandbox_factory=_Sandbox,
        max_workers=1,
    )
    assert order == [0, 1, 2]  # strict serial start order
    assert [o.index for o in outcomes] == [0, 1, 2]
