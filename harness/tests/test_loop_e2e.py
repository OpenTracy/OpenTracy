"""End-to-end loop lineage: a proposal's prediction + manifest verdict must
survive the real approve → promote (and queued → promote_queued) chain into the
ledger. Hermetic: the LLM-scoring step is stubbed; everything downstream runs.
"""

from __future__ import annotations

from types import SimpleNamespace

import pytest

from experiments.types import Mutation
from harness.types import (
    CriticVerdict,
    LoopOutcome,
    ManifestVerdict,
    Prediction,
    Proposal,
)
from ledger.writer import read_entries


def _write_agent(path, version):
    (path / "pipeline").mkdir(parents=True)
    (path / "agent.yaml").write_text(f"agent:\n  version: {version}\n")
    (path / "pipeline" / "retrieve.yaml").write_text("k: 5\n")


@pytest.fixture
def loop_env(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr("ledger.writer._LEDGER_ROOT", tmp_path / "ledger")
    _write_agent(tmp_path / "agent", "v0.0.1")
    cand_dir = tmp_path / "experiments" / "candidates" / "cand-e2e" / "agent"
    _write_agent(cand_dir, "v0.0.1")
    return tmp_path


def _outcome():
    pred = Prediction(
        rubric="overall", expected_delta=0.1, rationale="tighten retrieval",
        predicted_fixes=frozenset(["g1"]),
    )
    proposal = Proposal(
        mutations=[Mutation(file="pipeline/retrieve.yaml", path="k", value=8)],
        prediction=pred,
        description="bump k",
    )
    delta = {
        "overall_score": 0.1,
        "per_golden": {"fixed": ["g1"], "regressed": [], "unchanged": []},
    }
    candidate = {"pass_rate": 1.0, "overall_score": 0.9, "avg_latency_ms": 100.0}
    result = SimpleNamespace(candidate=candidate, delta=delta)
    return LoopOutcome(
        proposal=proposal,
        candidate_id="cand-e2e",
        verdicts=[CriticVerdict(critic="eval_lift", approved=True, reason="Δ ok")],
        candidate_result=result,
        manifest_verdict=ManifestVerdict.evaluate(pred, delta["per_golden"]),
        final="approved",
    )


def test_auto_promote_records_prediction_and_manifest(loop_env, monkeypatch):
    from harness.approver.policy import Policy
    from harness.loop import run_loop

    monkeypatch.setattr("harness.loop.propose_and_score", lambda *a, **k: [_outcome()])

    rounds = run_loop(
        [_outcome().proposal],
        "suite-ignored",
        policy=Policy(mode="auto", auto_min_lift=0.01),
        auto_promote=True,
    )

    assert rounds[0].promoted_version is not None
    promote = [e for e in read_entries() if e.kind == "promote"][-1]
    assert promote.payload["prediction"]["rubric"] == "overall"
    assert promote.payload["manifest_verdict"]["verdict"] == "keep"
    assert promote.payload["verdicts"][0]["critic"] == "eval_lift"


def test_queued_then_approved_carries_lineage_forward(loop_env, monkeypatch):
    from harness.approver.policy import Policy
    from harness.executor.promote import promote_queued
    from harness.loop import run_loop

    monkeypatch.setattr("harness.loop.propose_and_score", lambda *a, **k: [_outcome()])

    rounds = run_loop(
        [_outcome().proposal],
        "suite-ignored",
        policy=Policy(mode="review"),
    )
    lesson_id = rounds[0].queued_lesson_id
    assert lesson_id is not None

    # The queued_review entry already carries the decision data.
    queued = [e for e in read_entries() if e.kind == "queued_review"][-1]
    assert queued.payload["prediction"]["rubric"] == "overall"
    assert queued.payload["manifest_verdict"]["verdict"] == "keep"

    # A human approval must carry that lineage into the promote entry too.
    promote_queued(lesson_id, reviewer="alice")
    promote = [e for e in read_entries() if e.kind == "promote"][-1]
    assert promote.payload["human_approved"] is True
    assert promote.payload["reviewer"] == "alice"
    assert promote.payload["prediction"]["rubric"] == "overall"
    assert promote.payload["manifest_verdict"]["verdict"] == "keep"
    assert promote.payload["verdicts"][0]["critic"] == "eval_lift"
