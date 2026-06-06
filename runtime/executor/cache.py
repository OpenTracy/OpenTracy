"""Per-agent compiled-pipeline cache.

Each agent serves from its own catalog dir (``agents/<id>/``); this caches the
loaded config + compiled pipeline per agent so concurrent requests for
different agents don't recompile or step on each other. The active agent is
read from :mod:`runtime.agent_context` at call time, so the cache key always
matches whatever partition the rest of the request resolves to.
"""

from __future__ import annotations

import threading
from typing import TYPE_CHECKING, Optional

if TYPE_CHECKING:
    from runtime.compiler.loader import AgentConfig
    from runtime.executor.pipeline import PipelineExecutor

_lock = threading.Lock()
_cache: dict[str, tuple["AgentConfig", "PipelineExecutor"]] = {}


def get_active_executor() -> tuple["AgentConfig", "PipelineExecutor"]:
    """Resolve (config, executor) for the active agent, compiling on miss."""
    from runtime.agent_context import get_active

    agent_id = get_active()
    if not agent_id:
        raise RuntimeError("no active agent in context")
    return _get(agent_id)


def _get(agent_id: str) -> tuple["AgentConfig", "PipelineExecutor"]:
    with _lock:
        hit = _cache.get(agent_id)
    if hit is not None:
        return hit

    # Compile OUTSIDE the lock so a slow build for one agent doesn't block
    # requests for others. Last write wins on a concurrent miss — harmless,
    # the result is equivalent.
    from runtime.agents.registry import live_agent_dir
    from runtime.compiler.builder import compile_agent
    from runtime.compiler.loader import load_agent
    from runtime.executor.pipeline import PipelineExecutor

    agent_dir = live_agent_dir(agent_id)
    if agent_dir is None:
        raise FileNotFoundError(f"no live agent dir for {agent_id!r}")
    cfg = load_agent(str(agent_dir / "agent.yaml"))
    executor = PipelineExecutor(compile_agent(cfg))
    with _lock:
        _cache[agent_id] = (cfg, executor)
    return cfg, executor


def invalidate(agent_id: Optional[str] = None) -> None:
    """Drop one agent's cached pipeline, or all of them when ``agent_id`` is
    ``None``. Called after an edit/activate/promote so the next request
    recompiles from the updated surface."""
    with _lock:
        if agent_id is None:
            _cache.clear()
        else:
            _cache.pop(agent_id, None)
