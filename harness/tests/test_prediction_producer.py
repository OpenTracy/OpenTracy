from harness.proposer.heuristic import sweep_knob
from harness.proposer.prediction import predict_impact
from harness.types import EditVerdict, ManifestVerdict


def test_predict_impact_defaults_to_failing_goldens():
    pred = predict_impact(
        {"g1": True, "g2": False, "g3": False}, rationale="r"
    )
    assert pred.predicted_fixes == frozenset({"g2", "g3"})
    assert pred.predicted_regressions == frozenset()
    assert pred.expected_delta == round(2 / 3, 4)


def test_predict_impact_explicit_sets_override():
    pred = predict_impact(
        {"g1": True, "g2": False},
        rationale="r",
        predicted_fixes=["g2"],
        predicted_regressions=["g1"],
    )
    assert pred.predicted_fixes == frozenset({"g2"})
    assert pred.predicted_regressions == frozenset({"g1"})


def test_predict_impact_empty_baseline():
    pred = predict_impact({}, rationale="r")
    assert pred.predicted_fixes == frozenset()
    assert pred.expected_delta == 0.0


def test_sweep_knob_without_baseline_has_no_prediction():
    props = sweep_knob("pipeline/retrieve.yaml", "knobs.k", [8, 12])
    assert all(p.prediction is None for p in props)


def test_sweep_knob_with_baseline_attaches_prediction():
    baseline = {"g1": True, "g2": False}
    props = sweep_knob("pipeline/retrieve.yaml", "knobs.k", [8], baseline_per_golden=baseline)
    assert len(props) == 1
    assert props[0].prediction is not None
    assert props[0].prediction.predicted_fixes == frozenset({"g2"})


def test_producer_feeds_manifest_verdict():
    pred = predict_impact({"g1": True, "g2": False, "g3": False}, rationale="r")
    # edit fixed g2 only; g3 still failing, no regressions
    verdict = ManifestVerdict.evaluate(
        pred, {"fixed": ["g2"], "regressed": [], "unchanged": ["g1", "g3"]}
    )
    assert verdict.verdict == EditVerdict.IMPROVE
    assert verdict.fix_recall == 1.0
    assert verdict.fix_precision == 0.5
