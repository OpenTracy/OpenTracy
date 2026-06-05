import pytest

from evals.scoring import selection_key, two_tier_key
from harness.blueprint import Blueprint
from harness.loop import _selection_fn, _split_critics


def test_blueprint_roundtrip(tmp_path):
    bp = Blueprint(
        version=2,
        post_critics=["eval_lift", ("regression_budget", {"max_regressions": 1})],
        selection="two_tier",
        promote_strategy="all",
    )
    path = tmp_path / "blueprint.yaml"
    bp.write_yaml(path)
    assert Blueprint.from_yaml(path) == bp


def test_blueprint_defaults_when_missing(tmp_path):
    bp = Blueprint.from_yaml(tmp_path / "nope.yaml")
    assert bp.pre_critics == ["scope"]
    assert bp.post_critics == ["eval_lift"]
    assert bp.selection == "selection_key"
    assert bp.promote_strategy == "best"


def test_blueprint_parses_critic_with_params(tmp_path):
    path = tmp_path / "bp.yaml"
    path.write_text(
        "post_critics:\n"
        "  - eval_lift\n"
        "  - {name: regression_budget, params: {max_regressions: 2}}\n"
    )
    bp = Blueprint.from_yaml(path)
    assert bp.post_critics == ["eval_lift", ("regression_budget", {"max_regressions": 2})]


def test_blueprint_invalid_selection_raises(tmp_path):
    path = tmp_path / "bp.yaml"
    path.write_text("selection: bogus\n")
    with pytest.raises(ValueError, match="selection"):
        Blueprint.from_yaml(path)


def test_selection_fn_resolves_and_rejects():
    assert _selection_fn("selection_key") is selection_key
    assert _selection_fn("two_tier") is two_tier_key
    with pytest.raises(ValueError):
        _selection_fn("nope")


def test_shipped_blueprint_loads_and_matches_defaults():
    assert Blueprint.from_yaml("policies/blueprint.yaml") == Blueprint()


def test_loop_builds_critics_with_blueprint_params():
    bp = Blueprint(post_critics=["eval_lift", ("regression_budget", {"max_regressions": 3})])
    _pre, post = _split_critics(bp.pre_critics, bp.post_critics)
    rb = next(c for c in post if c.name == "regression_budget")
    assert rb.params["max_regressions"] == 3
