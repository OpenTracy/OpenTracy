"""Tests for the multi-agent registry (P2.0)."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from runtime.agents.registry import (
    activate,
    create_agent,
    delete_agent,
    ensure_bootstrapped,
    get_agent,
    get_active,
    get_registry,
    list_agents,
    live_agent_dir,
    update_agent,
)


@pytest.fixture
def workspace(tmp_path):
    """Tmp workspace with a pre-seeded ``agent/`` dir to migrate."""
    agent_dir = tmp_path / "agent"
    (agent_dir / "prompts").mkdir(parents=True)
    (agent_dir / "pipeline").mkdir()
    (agent_dir / "agent.yaml").write_text("agent:\n  version: v0.0.1\n")
    (agent_dir / "prompts" / "system.md").write_text("You are a helpful assistant.")
    (agent_dir / "pipeline" / "route.yaml").write_text("stage: route\n")
    return {
        "tmp": tmp_path,
        "root": tmp_path / "agents",
        "live": agent_dir,
    }


# ---------------------------------------------------------------------------
# Bootstrap
# ---------------------------------------------------------------------------


def test_bootstrap_migrates_legacy_agent_dir(workspace):
    """First run with a legacy ``agent/`` → registry written with _default
    seeded from the live dir."""
    reg = ensure_bootstrapped(root=workspace["root"], live_dir=workspace["live"])

    assert reg.active == "_default"
    assert len(reg.agents) == 1
    assert reg.agents[0].id == "_default"

    # _default got the live dir's contents
    seeded = workspace["root"] / "_default"
    assert (seeded / "agent.yaml").is_file()
    assert "You are a helpful assistant" in (seeded / "prompts" / "system.md").read_text()


def test_live_agent_dir_resolves_active_and_specific(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    agent_dir = tmp_path / "agent"
    (agent_dir / "pipeline").mkdir(parents=True)
    (agent_dir / "agent.yaml").write_text("agent:\n  version: v0.0.1\n")
    ensure_bootstrapped()  # default root agents/ under cwd → agents/_default

    active = live_agent_dir()
    assert active is not None and active.name == "_default" and active.is_dir()
    assert live_agent_dir("_default") == active
    assert live_agent_dir("nonexistent-agent") is None


def test_bootstrap_is_idempotent(workspace):
    """Running bootstrap twice doesn't duplicate _default or clobber state."""
    ensure_bootstrapped(root=workspace["root"], live_dir=workspace["live"])
    # Mutate the registry between runs to verify the second call is a no-op
    update_agent("_default", name="renamed", root=workspace["root"])
    reg = ensure_bootstrapped(root=workspace["root"], live_dir=workspace["live"])
    assert len(reg.agents) == 1
    assert reg.agents[0].name == "renamed"


def test_bootstrap_with_no_live_dir(tmp_path):
    """Cold install — no ``agent/`` yet. Bootstrap still produces a
    registry with an empty _default placeholder."""
    reg = ensure_bootstrapped(
        root=tmp_path / "agents",
        live_dir=tmp_path / "no-such-agent",
    )
    assert reg.active == "_default"
    assert (tmp_path / "agents" / "_default").is_dir()


# ---------------------------------------------------------------------------
# Create / list / get
# ---------------------------------------------------------------------------


def test_create_agent_writes_dir_and_registry(workspace):
    ensure_bootstrapped(root=workspace["root"], live_dir=workspace["live"])

    meta = create_agent(
        {
            "name": "shopify-support",
            "model": "claude-haiku-4-5",
            "prompt": "You support a Shopify store.",
            "template": "support",
            "tools": [],
            "channels": ["web"],
        },
        root=workspace["root"],
    )

    assert meta.id == "shopify-support"
    assert meta.model == "claude-haiku-4-5"

    agent_dir = workspace["root"] / "shopify-support"
    assert agent_dir.is_dir()
    assert (agent_dir / "prompts" / "system.md").is_file()
    body = (agent_dir / "prompts" / "system.md").read_text()
    assert "Shopify store" in body
    assert "trainable surface" in body
    # Pipeline copied from the committed template
    assert (agent_dir / "agent.yaml").is_file()
    # Onboarding snapshot saved
    snapshot = json.loads((agent_dir / "onboarding.json").read_text())
    assert snapshot["name"] == "shopify-support"

    # Registry now has 2 entries
    reg = get_registry(root=workspace["root"])
    assert {a.id for a in reg.agents} == {"_default", "shopify-support"}
    # Active didn't change — create alone doesn't activate
    assert reg.active == "_default"


def test_create_agent_seeds_starter_datasets(workspace):
    """A new agent ships with a goldens eval dataset + an empty growing
    rag-gaps dataset, so the mining→projection→eval loop works out of the box."""
    from router.data.dataset_io import get_current_version, load_current

    ensure_bootstrapped(root=workspace["root"], live_dir=workspace["live"])
    meta = create_agent({"name": "seeded", "prompt": "x"}, root=workspace["root"])

    ds_dir = workspace["root"] / meta.id / "datasets"
    # goldens — projected from the shared evals/golden library, non-growing.
    assert get_current_version("goldens", datasets_dir=ds_dir) == 1
    goldens = load_current("goldens", datasets_dir=ds_dir)
    assert goldens.size() > 0
    assert goldens.metadata.growing is False
    # rag-gaps — empty growing dataset wired to the failed-lookups adapter.
    assert get_current_version("rag-gaps", datasets_dir=ds_dir) == 1
    rag = load_current("rag-gaps", datasets_dir=ds_dir)
    assert rag.size() == 0
    assert rag.metadata.growing is True
    assert rag.metadata.source == "failed lookups"


def test_create_agent_slug_collision_appends_suffix(workspace):
    ensure_bootstrapped(root=workspace["root"], live_dir=workspace["live"])
    create_agent({"name": "support", "prompt": "x"}, root=workspace["root"])
    second = create_agent({"name": "support", "prompt": "y"}, root=workspace["root"])
    assert second.id != "support"
    assert second.id.startswith("support-")


def test_list_agents_returns_all(workspace):
    ensure_bootstrapped(root=workspace["root"], live_dir=workspace["live"])
    create_agent({"name": "a", "prompt": "x"}, root=workspace["root"])
    create_agent({"name": "b", "prompt": "y"}, root=workspace["root"])
    agents = list_agents(root=workspace["root"])
    assert {a.id for a in agents} == {"_default", "a", "b"}


def test_get_agent_missing_returns_none(workspace):
    ensure_bootstrapped(root=workspace["root"], live_dir=workspace["live"])
    assert get_agent("nonexistent", root=workspace["root"]) is None


# ---------------------------------------------------------------------------
# Activate
# ---------------------------------------------------------------------------


def test_activate_flips_active_and_fires_hook(workspace):
    """Activation only flips the registry pointer + fires the hook — the
    catalog entry is the live surface, nothing is copied."""
    ensure_bootstrapped(root=workspace["root"], live_dir=workspace["live"])
    create_agent(
        {"name": "new-agent", "prompt": "New prompt body."},
        root=workspace["root"],
    )

    hook_called: list[str] = []
    meta = activate(
        "new-agent",
        root=workspace["root"],
        on_activate=lambda m: hook_called.append(m.id),
    )

    assert meta.id == "new-agent"
    assert get_active(root=workspace["root"]).id == "new-agent"
    assert hook_called == ["new-agent"]
    # The new agent's own catalog dir still holds its prompt.
    body = (workspace["root"] / "new-agent" / "prompts" / "system.md").read_text()
    assert "New prompt body" in body


def test_activate_unknown_agent_raises(workspace):
    ensure_bootstrapped(root=workspace["root"], live_dir=workspace["live"])
    with pytest.raises(KeyError):
        activate("nonexistent", root=workspace["root"])


# ---------------------------------------------------------------------------
# Delete
# ---------------------------------------------------------------------------


def test_delete_soft_deletes_and_drops_from_registry(workspace):
    ensure_bootstrapped(root=workspace["root"], live_dir=workspace["live"])
    create_agent({"name": "to-go", "prompt": "x"}, root=workspace["root"])
    delete_agent("to-go", root=workspace["root"])
    assert get_agent("to-go", root=workspace["root"]) is None
    # Soft delete moved files into _deleted/
    bucket = workspace["root"] / "_deleted"
    assert bucket.is_dir()
    survivors = list(bucket.iterdir())
    assert any("to-go" in s.name for s in survivors)


def test_cannot_delete_default(workspace):
    ensure_bootstrapped(root=workspace["root"], live_dir=workspace["live"])
    with pytest.raises(ValueError):
        delete_agent("_default", root=workspace["root"])


def test_cannot_delete_active(workspace):
    ensure_bootstrapped(root=workspace["root"], live_dir=workspace["live"])
    create_agent({"name": "x", "prompt": "y"}, root=workspace["root"])
    activate("x", root=workspace["root"])
    with pytest.raises(ValueError):
        delete_agent("x", root=workspace["root"])


# ---------------------------------------------------------------------------
# Update
# ---------------------------------------------------------------------------


def test_update_agent_changes_metadata(workspace):
    ensure_bootstrapped(root=workspace["root"], live_dir=workspace["live"])
    update_agent("_default", name="My Agent", description="hello", root=workspace["root"])
    meta = get_agent("_default", root=workspace["root"])
    assert meta.name == "My Agent"
    assert meta.description == "hello"


# ---------------------------------------------------------------------------
# P3.0 — model propagates into route.yaml
# ---------------------------------------------------------------------------


def _seed_route_yaml(agent_dir, model: str = "claude-haiku-4-5") -> None:
    pipeline = agent_dir / "pipeline"
    pipeline.mkdir(parents=True, exist_ok=True)
    (pipeline / "route.yaml").write_text(
        "stage: route\n"
        "technique: routing\n"
        "variant: small_first\n"
        "knobs:\n"
        "  confidence_threshold: 0.8\n"
        f"  small: {model}\n"
        "  big: claude-sonnet-4-6\n"
        "  escalate_on_failure: true\n"
    )


def test_create_agent_propagates_model_to_route_yaml(workspace):
    """The model picked during onboarding lands in the new agent's
    route.yaml (small knob) so /run actually uses it. The new agent is
    seeded from the committed template, so the other knobs come from it."""
    ensure_bootstrapped(root=workspace["root"], live_dir=workspace["live"])

    meta = create_agent(
        {
            "name": "haiku-tester",
            "model": "claude-sonnet-4-6",
            "prompt": "You are a tester.",
        },
        root=workspace["root"],
    )
    route_body = (
        workspace["root"] / meta.id / "pipeline" / "route.yaml"
    ).read_text()
    assert "small: claude-sonnet-4-6" in route_body
    # Other knobs come from the template
    assert "big: claude-sonnet-4-6" in route_body
    assert "confidence_threshold: 0.7" in route_body
    assert "escalate_on_failure: true" in route_body


def test_update_agent_model_rewrites_route_yaml(workspace):
    _seed_route_yaml(workspace["live"])
    ensure_bootstrapped(root=workspace["root"], live_dir=workspace["live"])

    update_agent("_default", model="claude-opus-4-7", root=workspace["root"])
    route_body = (
        workspace["root"] / "_default" / "pipeline" / "route.yaml"
    ).read_text()
    assert "small: claude-opus-4-7" in route_body
    # Registry metadata also updated
    meta = get_agent("_default", root=workspace["root"])
    assert meta.model == "claude-opus-4-7"


# ---------------------------------------------------------------------------
# S2 — seed from the committed template + strip inherited state
# ---------------------------------------------------------------------------


def test_bootstrap_seeds_default_from_template(tmp_path):
    """No ``live_dir`` override → ``_default`` is seeded from the committed
    ``templates/agent/`` so a fresh checkout boots a working pipeline."""
    reg = ensure_bootstrapped(root=tmp_path / "agents")
    assert reg.active == "_default"

    default_dir = tmp_path / "agents" / "_default"
    assert (default_dir / "agent.yaml").is_file()
    route = (default_dir / "pipeline" / "route.yaml").read_text()
    assert "small: claude-haiku-4-5" in route
    assert (default_dir / "improvement.yaml").is_file()
    assert (default_dir / "mcp.json").is_file()


def test_create_agent_strips_inherited_state(workspace):
    """``seed_from`` an agent carrying secrets / integrations / workspace /
    onboarding session → the new agent starts isolated, with mcp.json and
    improvement.yaml reset to the template defaults."""
    ensure_bootstrapped(root=workspace["root"], live_dir=workspace["live"])

    # Pollute _default with per-agent state a new agent must not inherit.
    src = workspace["root"] / "_default"
    (src / "secrets.env").write_text("API_KEY=super-secret\n")
    (src / "onboarding_session.json").write_text("{}\n")
    (src / "integrations").mkdir()
    (src / "integrations" / "slack.json").write_text("{}\n")
    (src / "workspace" / ".opentracy").mkdir(parents=True)
    (src / "workspace" / ".opentracy" / "state.json").write_text("{}\n")
    (src / "mcp.json").write_text('{"servers": [{"name": "leak"}]}\n')

    meta = create_agent(
        {"name": "isolated", "prompt": "Fresh agent."},
        root=workspace["root"],
        seed_from="_default",
    )

    new_dir = workspace["root"] / meta.id
    # Inherited state is gone
    assert not (new_dir / "secrets.env").exists()
    assert not (new_dir / "onboarding_session.json").exists()
    assert not (new_dir / "integrations").exists()
    assert not (new_dir / "workspace").exists()
    # mcp.json / improvement.yaml reset to the template defaults
    assert "leak" not in (new_dir / "mcp.json").read_text()
    assert (new_dir / "improvement.yaml").is_file()
    # But the trainable surface (prompt) was still applied
    assert "Fresh agent." in (new_dir / "prompts" / "system.md").read_text()


def test_set_route_yaml_no_op_when_missing(workspace, tmp_path):
    """No route.yaml in the agent dir → we log + skip, no crash."""
    ensure_bootstrapped(root=workspace["root"], live_dir=workspace["live"])
    # Manually remove the seeded route.yaml from _default
    target = workspace["root"] / "_default" / "pipeline" / "route.yaml"
    if target.is_file():
        target.unlink()
    # update_agent should not raise
    update_agent("_default", model="claude-opus-4-7", root=workspace["root"])
    meta = get_agent("_default", root=workspace["root"])
    assert meta.model == "claude-opus-4-7"  # metadata still updated
