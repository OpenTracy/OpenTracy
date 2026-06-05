from evals.runners.runner import per_golden_pass
from evals.scoring import compare_two_tier, two_tier_key
from evals.types import EvalCase, Report, RubricResult


def _case(golden_id, success, passed, duration_ms=100.0):
    return EvalCase(
        golden_id=golden_id,
        request="q",
        response="a",
        duration_ms=duration_ms,
        success=success,
        error=None,
        trace_id=None,
        rubric_results=[
            RubricResult(rubric="r", type="t", score=1.0 if passed else 0.0, passed=passed)
        ],
    )


def _report(cases):
    return Report(
        suite="s", agent_version="v", started_at="t", finished_at="t", cases=cases, summary={}
    )


def test_two_tier_prefers_higher_pass_rate():
    a = {"pass_rate": 0.8, "avg_latency_ms": 500.0}
    b = {"pass_rate": 0.6, "avg_latency_ms": 100.0}
    assert compare_two_tier(a, b) == 1


def test_two_tier_breaks_tie_on_lower_latency():
    a = {"pass_rate": 0.8, "avg_latency_ms": 100.0}
    b = {"pass_rate": 0.8, "avg_latency_ms": 500.0}
    assert compare_two_tier(a, b) == 1
    assert two_tier_key(a) > two_tier_key(b)


def test_two_tier_handles_missing_fields():
    assert two_tier_key({}) == (0.0, 0.0)


def test_per_golden_pass_requires_success_and_all_rubrics():
    report = _report(
        [_case("g1", True, True), _case("g2", True, False), _case("g3", False, True)]
    )
    assert per_golden_pass(report) == {"g1": True, "g2": False, "g3": False}
