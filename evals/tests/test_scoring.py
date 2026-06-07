from evals.runners.runner import per_golden_pass
from evals.scoring import selection_key, two_tier_key
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
    assert two_tier_key(a) > two_tier_key(b)


def test_two_tier_breaks_tie_on_lower_latency():
    a = {"pass_rate": 0.8, "avg_latency_ms": 100.0}
    b = {"pass_rate": 0.8, "avg_latency_ms": 500.0}
    assert two_tier_key(a) > two_tier_key(b)


def test_two_tier_handles_missing_fields():
    assert two_tier_key({}) == (0.0, 0.0)


def test_two_tier_handles_none_fields():
    assert two_tier_key({"pass_rate": None, "avg_latency_ms": None}) == (0.0, 0.0)


def test_selection_key_none_fields_default_to_zero():
    assert selection_key({}) == (0.0, 0.0, 0.0)
    assert selection_key({"pass_rate": None, "overall_score": None}) == (0.0, 0.0, 0.0)


def test_selection_key_passrate_dominates_quality():
    high_pass = {"pass_rate": 0.9, "overall_score": 0.10, "avg_latency_ms": 100.0}
    high_quality = {"pass_rate": 0.5, "overall_score": 0.99, "avg_latency_ms": 100.0}
    assert selection_key(high_pass) > selection_key(high_quality)


def test_selection_key_breaks_passrate_tie_on_quality():
    high_q = {"pass_rate": 0.8, "overall_score": 0.95, "avg_latency_ms": 100.0}
    low_q = {"pass_rate": 0.8, "overall_score": 0.70, "avg_latency_ms": 100.0}
    assert selection_key(high_q) > selection_key(low_q)


def test_selection_key_falls_back_to_latency_when_quality_tied():
    fast = {"pass_rate": 0.8, "overall_score": 0.8, "avg_latency_ms": 100.0}
    slow = {"pass_rate": 0.8, "overall_score": 0.8, "avg_latency_ms": 500.0}
    assert selection_key(fast) > selection_key(slow)


def test_per_golden_pass_requires_success_and_all_rubrics():
    report = _report(
        [_case("g1", True, True), _case("g2", True, False), _case("g3", False, True)]
    )
    assert per_golden_pass(report) == {"g1": True, "g2": False, "g3": False}
