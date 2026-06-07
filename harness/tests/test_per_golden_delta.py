from experiments.runner import _compute_delta


def _view(pass_map, overall, pass_rate, latency):
    return {
        "overall_score": overall,
        "pass_rate": pass_rate,
        "per_rubric": {},
        "per_golden": pass_map,
        "avg_latency_ms": latency,
    }


def test_compute_delta_classifies_goldens():
    base = _view({"g1": False, "g2": True, "g3": True}, 0.5, 0.5, 200.0)
    cand = _view({"g1": True, "g2": False, "g3": True}, 0.6, 0.6, 150.0)
    d = _compute_delta(base, cand)
    assert d["per_golden"]["fixed"] == ["g1"]
    assert d["per_golden"]["regressed"] == ["g2"]
    assert d["per_golden"]["unchanged"] == ["g3"]
    assert d["latency_ms_delta"] == -50.0


def test_compute_delta_empty_per_golden():
    base = _view({}, 0.0, 0.0, 0.0)
    cand = _view({}, 0.0, 0.0, 0.0)
    d = _compute_delta(base, cand)
    assert d["per_golden"] == {"fixed": [], "regressed": [], "unchanged": []}
