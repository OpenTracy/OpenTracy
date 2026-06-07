"""The brain CLI subprocesses must carry the active agent/tenant so the child
(and its MCP server) resolve the SAME agent, not _default."""

from __future__ import annotations

from types import SimpleNamespace

import pytest

from runtime import agent_context


def test_subprocess_env_carries_active_agent_and_tenant(monkeypatch):
    agent_context.set_active("acme")
    monkeypatch.setenv("OPENTRACY_TENANT_ID", "tnt")  # tenant_context env fallback
    try:
        env = agent_context.subprocess_env()
        assert env["OPENTRACY_AGENT_ID"] == "acme"
        assert env["OPENTRACY_TENANT_ID"] == "tnt"
        # Inherits the rest of the environment too.
        assert "PATH" in env
    finally:
        agent_context.set_active(None)


def test_get_active_recovers_from_env_in_a_fresh_context(monkeypatch):
    # Simulates the child process: no ContextVar binding, only the env var.
    agent_context.set_active(None)
    monkeypatch.setenv("OPENTRACY_AGENT_ID", "from-parent")
    assert agent_context.get_active() == "from-parent"


def _capture_run(captured):
    def _fake(args, **kwargs):
        captured["env"] = kwargs.get("env")
        return SimpleNamespace(returncode=0, stdout="ok", stderr="")
    return _fake


def test_complete_via_cli_passes_active_agent_env(monkeypatch):
    import harness.brain.transport as transport

    captured: dict = {}
    monkeypatch.setattr(transport.subprocess, "run", _capture_run(captured))
    agent_context.set_active("acme")
    try:
        transport._complete_via_cli("hi", system_prompt=None, timeout_s=5)
    finally:
        agent_context.set_active(None)
    assert captured["env"] is not None
    assert captured["env"]["OPENTRACY_AGENT_ID"] == "acme"


def test_introspect_cli_passes_active_agent_env(monkeypatch):
    import harness.introspection.agent as agent

    captured: dict = {}
    monkeypatch.setattr(agent.subprocess, "run", _capture_run(captured))
    agent_context.set_active("acme")
    try:
        agent._call_claude_code_cli("hi")
    finally:
        agent_context.set_active(None)
    assert captured["env"] is not None
    assert captured["env"]["OPENTRACY_AGENT_ID"] == "acme"
