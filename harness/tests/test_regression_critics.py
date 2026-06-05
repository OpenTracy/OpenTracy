from types import SimpleNamespace

from experiments.types import Mutation
from harness.critics import make_critic
from harness.types import CriticContext, Prediction, Proposal


def _ctx(delta, prediction=None):
    proposal = Proposal(
        mutations=[Mutation(file="pipeline/x.yaml", path="k", value=1)],
        prediction=prediction,
    )
    return CriticContext(proposal=proposal, candidate_result=SimpleNamespace(delta=delta))


def test_regression_budget_blocks_over_budget():
    c = make_critic("regression_budget")
    v = c.verdict(_ctx({"per_golden": {"regressed": ["g1"]}}))
    assert not v.approved
    assert v.severity == "block"


def test_regression_budget_allows_within_budget():
    c = make_critic("regression_budget", {"max_regressions": 1})
    v = c.verdict(_ctx({"per_golden": {"regressed": ["g1"]}}))
    assert v.approved


def test_regression_budget_tolerates_missing_per_golden():
    c = make_critic("regression_budget")
    assert c.verdict(_ctx({})).approved


def test_prediction_honesty_warns_on_materialized_regression():
    pred = Prediction(
        rubric="overall",
        expected_delta=0.1,
        rationale="x",
        predicted_regressions=frozenset(["g1"]),
    )
    c = make_critic("prediction_honesty")
    v = c.verdict(_ctx({"per_golden": {"fixed": [], "regressed": ["g1"]}}, prediction=pred))
    assert not v.approved
    assert v.severity == "warn"


def test_prediction_honesty_passes_without_predicted_sets():
    c = make_critic("prediction_honesty")
    assert c.verdict(_ctx({"per_golden": {"regressed": []}})).approved
