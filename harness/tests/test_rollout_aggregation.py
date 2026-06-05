from evals.runners.runner import aggregate_per_golden, flaky_goldens
from evals.types import EvalCase, Report, RubricResult
from experiments.runner import _aggregate_views, _summary_view


def _case(golden_id, passed, duration_ms=100.0):
    return EvalCase(
        golden_id=golden_id,
        request="q",
        response="a",
        duration_ms=duration_ms,
        success=True,
        error=None,
        trace_id=None,
        rubric_results=[
            RubricResult(rubric="r", type="t", score=1.0 if passed else 0.0, passed=passed)
        ],
    )


def _report(pass_map, overall, duration_ms=100.0):
    cases = [_case(g, ok, duration_ms) for g, ok in pass_map.items()]
    summary = {"overall_score": overall, "pass_rate": overall, "per_rubric": {"r": overall},
               "n_passed": sum(pass_map.values()), "n_total": len(pass_map)}
    return Report(suite="s", agent_version="v", started_at="t", finished_at="t",
                  cases=cases, summary=summary)


def test_aggregate_per_golden_empty():
    assert aggregate_per_golden([]) == {}


def test_aggregate_per_golden_fraction():
    out = aggregate_per_golden([{"g1": True}, {"g1": False}, {"g1": True}])
    assert out == {"g1": round(2 / 3, 4)}


def test_aggregate_per_golden_union_of_keys():
    out = aggregate_per_golden([{"g1": True}, {"g2": True}])
    assert out == {"g1": 0.5, "g2": 0.5}


def test_flaky_goldens_only_split_ones():
    assert flaky_goldens({"g1": 0.5, "g2": 1.0, "g3": 0.0}) == ["g1"]


def test_aggregate_views_majority_and_flaky():
    reports = [
        _report({"g1": True, "g2": True, "g3": False}, 0.66),
        _report({"g1": True, "g2": False, "g3": False}, 0.33),
        _report({"g1": True, "g2": False, "g3": False}, 0.33),
    ]
    view = _aggregate_views(reports)
    assert view["per_golden"] == {"g1": True, "g2": False, "g3": False}
    assert view["per_golden_passrate"] == {"g1": 1.0, "g2": round(1 / 3, 4), "g3": 0.0}
    assert view["flaky"] == ["g2"]
    assert view["overall_score"] == round((0.66 + 0.33 + 0.33) / 3, 4)


def test_aggregate_views_single_matches_summary_view_core():
    report = _report({"g1": True, "g2": False}, 0.5)
    agg = _aggregate_views([report])
    single = _summary_view(report)
    for key in ("overall_score", "pass_rate", "per_golden", "avg_latency_ms"):
        assert agg[key] == single[key]
    assert agg["flaky"] == []
