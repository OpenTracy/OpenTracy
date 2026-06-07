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


def test_prediction_honesty_warns_on_unpredicted_regression():
    pred = Prediction(
        rubric="overall",
        expected_delta=0.1,
        rationale="x",
        predicted_fixes=frozenset(["g2"]),
    )
    c = make_critic("prediction_honesty")
    v = c.verdict(_ctx({"per_golden": {"fixed": ["g2"], "regressed": ["g9"]}}, prediction=pred))
    assert not v.approved
    assert v.severity == "warn"


def test_prediction_honesty_does_not_warn_on_correctly_predicted_regression():
    pred = Prediction(
        rubric="overall",
        expected_delta=0.1,
        rationale="x",
        predicted_regressions=frozenset(["g1"]),
    )
    c = make_critic("prediction_honesty")
    v = c.verdict(_ctx({"per_golden": {"fixed": [], "regressed": ["g1"]}}, prediction=pred))
    assert v.approved


def test_prediction_honesty_passes_without_predicted_sets():
    c = make_critic("prediction_honesty")
    assert c.verdict(_ctx({"per_golden": {"regressed": []}})).approved


def test_regression_budget_at_exact_budget_passes():
    c = make_critic("regression_budget", {"max_regressions": 1})
    assert c.verdict(_ctx({"per_golden": {"regressed": ["g1"]}})).approved


def test_regression_budget_blocks_without_candidate_result():
    proposal = Proposal(mutations=[Mutation(file="pipeline/x.yaml", path="k", value=1)])
    ctx = CriticContext(proposal=proposal, candidate_result=None)
    v = make_critic("regression_budget").verdict(ctx)
    assert not v.approved and v.severity == "block"


def test_prediction_honesty_warns_on_missed_fix():
    pred = Prediction(
        rubric="overall", expected_delta=0.1, rationale="x",
        predicted_fixes=frozenset(["g1", "g2"]),
    )
    c = make_critic("prediction_honesty")
    v = c.verdict(_ctx({"per_golden": {"fixed": ["g1"], "regressed": []}}, prediction=pred))
    assert not v.approved and v.severity == "warn"


def test_prediction_honesty_approves_when_prediction_holds():
    pred = Prediction(
        rubric="overall", expected_delta=0.1, rationale="x",
        predicted_fixes=frozenset(["g1"]), predicted_regressions=frozenset(["g2"]),
    )
    c = make_critic("prediction_honesty")
    v = c.verdict(_ctx({"per_golden": {"fixed": ["g1"], "regressed": ["g2"]}}, prediction=pred))
    assert v.approved


def test_eval_lift_tolerates_missing_overall_score():
    # A degenerate delta without overall_score must not crash the critic.
    c = make_critic("eval_lift")
    v = c.verdict(_ctx({}))
    assert v.approved  # default min_delta=0.0, missing score → 0.0 >= 0.0
