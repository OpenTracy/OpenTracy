from harness.types import EditVerdict, ManifestVerdict, Prediction


def _pred(fixes=(), regs=()):
    return Prediction(
        rubric="overall",
        expected_delta=0.1,
        rationale="x",
        predicted_fixes=frozenset(fixes),
        predicted_regressions=frozenset(regs),
    )


def test_keep_when_predicted_fixes_land_cleanly():
    v = ManifestVerdict.evaluate(
        _pred(fixes=["g1", "g2"]),
        {"fixed": ["g1", "g2"], "regressed": [], "unchanged": []},
    )
    assert v.verdict == EditVerdict.KEEP
    assert v.fix_precision == 1.0
    assert v.fix_recall == 1.0


def test_rollback_on_unpredicted_regression():
    v = ManifestVerdict.evaluate(
        _pred(fixes=["g1"]),
        {"fixed": ["g1"], "regressed": ["g9"], "unchanged": []},
    )
    assert v.verdict == EditVerdict.ROLLBACK_AND_PIVOT
    assert v.unpredicted_regressions == ["g9"]


def test_rollback_when_net_not_positive():
    v = ManifestVerdict.evaluate(
        _pred(fixes=["g1"], regs=["g2"]),
        {"fixed": ["g1"], "regressed": ["g2"], "unchanged": []},
    )
    assert v.verdict == EditVerdict.ROLLBACK_AND_PIVOT
    assert v.regression_precision == 1.0
    assert v.regression_recall == 1.0


def test_improve_when_fixes_partial():
    v = ManifestVerdict.evaluate(
        _pred(fixes=["g1", "g2"]),
        {"fixed": ["g1"], "regressed": [], "unchanged": ["g2"]},
    )
    assert v.verdict == EditVerdict.IMPROVE
    assert v.fix_recall == 1.0
    assert v.fix_precision == 0.5


def test_empty_prediction_yields_zero_ratios():
    v = ManifestVerdict.evaluate(_pred(), {"fixed": [], "regressed": [], "unchanged": []})
    assert v.fix_precision == 0.0
    assert v.regression_recall == 0.0
    assert v.verdict == EditVerdict.ROLLBACK_AND_PIVOT
