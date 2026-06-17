"""Per-agent correctness fixes: the system prompt and candidate branching both
resolve the REQUEST's pinned agent, not a global slot."""

from __future__ import annotations

from runtime import agent_context


def test_system_prompt_resolves_the_pinned_agent(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    from techniques.prompt_strategies.impl import _load_system_prompt

    for aid, body in (("a", "PROMPT_A"), ("b", "PROMPT_B")):
        d = tmp_path / "agents" / aid
        (d / "prompts").mkdir(parents=True)
        (d / "pipeline").mkdir()
        (d / "agent.yaml").write_text("agent:\n  version: v0.0.1\n")
        (d / "prompts" / "system.md").write_text(body)

    # The configured prompt knob is relative to the agent's pipeline dir.
    agent_context.set_active("a")
    try:
        assert _load_system_prompt("../prompts/system.md") == "PROMPT_A"
        agent_context.set_active("b")
        # Even with a different agent pinned, the prompt follows the context —
        # not whichever agent the registry happens to call active.
        assert _load_system_prompt("../prompts/system.md") == "PROMPT_B"
    finally:
        agent_context.set_active(None)


def test_create_candidate_branches_the_active_agent(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    # The active agent's surface — distinct from any legacy agent/ slot.
    active = tmp_path / "agents" / "b"
    (active / "pipeline").mkdir(parents=True)
    (active / "agent.yaml").write_text("agent:\n  version: v9.9.9\n  pipeline: []\n")
    (active / "pipeline" / "retrieve.yaml").write_text("knobs:\n  k: 99\n")
    (active / "MARKER").write_text("B")

    monkeypatch.setattr("ledger.versioning.resolve_live_dir", lambda: active)

    from experiments.branching import candidate_agent_path, create_candidate
    from experiments.types import Mutation

    manifest = create_candidate(
        [Mutation(file="pipeline/retrieve.yaml", path="knobs.k", value=12)]
    )
    cand_agent = candidate_agent_path(manifest.id).parent

    # Candidate was branched from the active agent (MARKER + version), not a slot.
    assert (cand_agent / "MARKER").read_text() == "B"
    assert manifest.parent_version == "v9.9.9"
