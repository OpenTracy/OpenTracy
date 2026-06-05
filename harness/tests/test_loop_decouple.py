from types import SimpleNamespace

from experiments.types import Mutation
from harness import loop
from harness.types import Prediction, Proposal


def _stub_branch_and_score(monkeypatch):
    monkeypatch.setattr(
        loop, "create_candidate", lambda muts, description=None: SimpleNamespace(id="cand_x")
    )
    result = SimpleNamespace(
        delta={
            "overall_score": 0.1,
            "per_rubric": {},
            "per_golden": {"fixed": ["g1"], "regressed": [], "unchanged": []},
        },
        candidate={},
    )
    monkeypatch.setattr(loop, "run_candidate", lambda cid, suite: result)


def _proposal(prediction):
    return Proposal(
        mutations=[Mutation(file="pipeline/x.yaml", path="k", value=1)],
        prediction=prediction,
    )


def test_per_golden_prediction_yields_manifest_not_verification(monkeypatch):
    _stub_branch_and_score(monkeypatch)
    p = _proposal(Prediction(
        rubric="overall", expected_delta=0.1, rationale="x",
        predicted_fixes=frozenset(["g1"]),
    ))
    out = loop.propose_and_score([p], "suite", pre_critics=[], post_critics=[])[0]
    assert out.manifest_verdict is not None
    assert out.verification is None


def test_rubric_only_prediction_yields_verification_not_manifest(monkeypatch):
    _stub_branch_and_score(monkeypatch)
    p = _proposal(Prediction(rubric="overall", expected_delta=0.1, rationale="x"))
    out = loop.propose_and_score([p], "suite", pre_critics=[], post_critics=[])[0]
    assert out.verification is not None
    assert out.manifest_verdict is None
