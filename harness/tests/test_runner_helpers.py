from evals.types import EvalCase, Report, RubricResult
from experiments.runner import _compute_delta, _percentile, _summary_view


def _case(golden_id, success, passed, duration_ms):
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


def _report(cases, summary):
    return Report(
        suite="s", agent_version="v", started_at="t", finished_at="t", cases=cases, summary=summary
    )


def test_percentile_empty_is_zero():
    assert _percentile([], 0.95) == 0.0


def test_percentile_single_value():
    assert _percentile([42.0], 0.95) == 42.0


def test_percentile_picks_high_end():
    xs = [float(n) for n in range(1, 101)]
    assert _percentile(xs, 0.95) >= 90.0


def test_summary_view_populates_per_golden_and_latency():
    cases = [_case("g1", True, True, 100.0), _case("g2", True, False, 300.0)]
    summary = {"overall_score": 0.5, "pass_rate": 0.5, "per_rubric": {"r": 0.5},
               "n_passed": 1, "n_total": 2}
    view = _summary_view(_report(cases, summary))
    assert view["per_golden"] == {"g1": True, "g2": False}
    assert view["avg_latency_ms"] == 200.0
    assert view["p95_latency_ms"] >= 100.0


def test_summary_view_no_cases_zero_latency():
    view = _summary_view(_report([], {"overall_score": 0.0, "pass_rate": 0.0, "per_rubric": {}}))
    assert view["avg_latency_ms"] == 0.0
    assert view["p95_latency_ms"] == 0.0
    assert view["per_golden"] == {}


def _view(pass_map, overall, latency):
    return {"overall_score": overall, "pass_rate": overall, "per_rubric": {},
            "per_golden": pass_map, "avg_latency_ms": latency}


def test_compute_delta_latency_sign():
    d = _compute_delta(_view({"g1": True}, 0.0, 300.0), _view({"g1": True}, 0.0, 120.0))
    assert d["latency_ms_delta"] == -180.0


def test_compute_delta_golden_missing_in_candidate_counts_as_regressed():
    d = _compute_delta(_view({"g1": True}, 0.5, 0.0), _view({}, 0.5, 0.0))
    assert d["per_golden"]["regressed"] == ["g1"]


def test_compute_delta_new_golden_passing_counts_as_fixed():
    d = _compute_delta(_view({}, 0.0, 0.0), _view({"g2": True}, 0.5, 0.0))
    assert d["per_golden"]["fixed"] == ["g2"]
