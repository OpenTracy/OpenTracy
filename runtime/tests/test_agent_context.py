"""agent_context is ContextVar-backed: per-context isolation + resolution order."""

from __future__ import annotations

import concurrent.futures

from runtime import agent_context


def test_resolution_order_context_env_default(monkeypatch):
    agent_context.set_active(None)
    monkeypatch.delenv("OPENTRACY_AGENT_ID", raising=False)
    assert agent_context.get_active() == "_default"

    monkeypatch.setenv("OPENTRACY_AGENT_ID", "from-env")
    assert agent_context.get_active() == "from-env"

    agent_context.set_active("from-context")
    assert agent_context.get_active() == "from-context"  # context wins over env

    agent_context.set_active(None)  # cleanup


def test_active_read_shim_reflects_contextvar():
    agent_context.set_active("agent-x")
    assert agent_context._active == "agent-x"
    agent_context.set_active(None)
    assert agent_context._active is None


def test_concurrent_contexts_do_not_leak(monkeypatch):
    monkeypatch.delenv("OPENTRACY_AGENT_ID", raising=False)
    agent_context.set_active(None)

    def work(agent_id: str) -> str:
        # Each worker runs in its own context copy; its set_active must not be
        # observed by siblings.
        ctx = __import__("contextvars").copy_context()

        def _run():
            agent_context.set_active(agent_id)
            return agent_context.get_active()

        return ctx.run(_run)

    ids = [f"agent-{i}" for i in range(8)]
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:
        results = list(ex.map(work, ids))

    assert results == ids                       # each saw only its own pin
    assert agent_context.get_active() == "_default"  # parent context untouched
