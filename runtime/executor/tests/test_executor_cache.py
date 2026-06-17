"""Per-agent executor cache: compile once per agent, isolate, invalidate."""

from __future__ import annotations

from pathlib import Path

from runtime import agent_context
from runtime.executor import cache


def _wire_fakes(monkeypatch):
    """Replace the compile chain with cheap fakes that count compilations."""
    calls = {"compile": 0}

    monkeypatch.setattr(
        "runtime.agents.registry.live_agent_dir",
        lambda agent_id=None: Path(f"/fake/{agent_id}"),
    )
    monkeypatch.setattr("runtime.compiler.loader.load_agent", lambda p: {"path": p})

    def _compile(cfg):
        calls["compile"] += 1
        return cfg

    monkeypatch.setattr("runtime.compiler.builder.compile_agent", _compile)
    monkeypatch.setattr(
        "runtime.executor.pipeline.PipelineExecutor", lambda pipeline: ("exec", pipeline)
    )
    cache.invalidate()  # clean slate
    return calls


def test_compiles_once_per_agent_then_caches(monkeypatch):
    calls = _wire_fakes(monkeypatch)
    agent_context.set_active("agent-a")

    cfg1, ex1 = cache.get_active_executor()
    cfg2, ex2 = cache.get_active_executor()

    assert calls["compile"] == 1          # second call served from cache
    assert cfg1 is cfg2 and ex1 is ex2
    assert cfg1["path"] == "/fake/agent-a/agent.yaml"
    agent_context.set_active(None)


def test_distinct_agents_get_distinct_executors(monkeypatch):
    calls = _wire_fakes(monkeypatch)

    agent_context.set_active("agent-a")
    a_cfg, _ = cache.get_active_executor()
    agent_context.set_active("agent-b")
    b_cfg, _ = cache.get_active_executor()

    assert calls["compile"] == 2
    assert a_cfg["path"] != b_cfg["path"]
    agent_context.set_active(None)


def test_invalidate_forces_recompile(monkeypatch):
    calls = _wire_fakes(monkeypatch)
    agent_context.set_active("agent-a")

    cache.get_active_executor()
    cache.invalidate("agent-a")
    cache.get_active_executor()
    assert calls["compile"] == 2

    cache.get_active_executor()            # cached again
    assert calls["compile"] == 2
    agent_context.set_active(None)
