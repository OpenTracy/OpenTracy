"""Per-(tenant, agent) compiled-pipeline cache.

Each agent serves from its own catalog dir (``agents/<id>/``); this caches the
loaded config + compiled pipeline so concurrent requests for different agents
don't recompile or step on each other. The cache key is ``(tenant_id,
agent_id)`` — both read from the active ContextVars at call time — because the
live agent dir resolves under the active tenant. Keying on ``agent_id`` alone
would let two tenants that share an agent id (every tenant has a ``_default``)
collide and serve each other's compiled pipeline.
"""

from __future__ import annotations

import threading
from typing import TYPE_CHECKING, Optional

if TYPE_CHECKING:
    from runtime.compiler.loader import AgentConfig
    from runtime.executor.pipeline import PipelineExecutor

_lock = threading.Lock()
_cache: dict[tuple[str, str], tuple["AgentConfig", "PipelineExecutor"]] = {}


def get_active_executor() -> tuple["AgentConfig", "PipelineExecutor"]:
    """Resolve (config, executor) for the active (tenant, agent), compiling on miss."""
    from runtime.agent_context import get_active
    from runtime.tenant_context import get_active as get_active_tenant

    agent_id = get_active()
    if not agent_id:
        raise RuntimeError("no active agent in context")
    return _get(get_active_tenant(), agent_id)


def _get(tenant_id: str, agent_id: str) -> tuple["AgentConfig", "PipelineExecutor"]:
    key = (tenant_id, agent_id)
    with _lock:
        hit = _cache.get(key)
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
        _cache[key] = (cfg, executor)
    return cfg, executor


def invalidate(agent_id: Optional[str] = None) -> None:
    """Drop cached pipeline(s). With ``agent_id`` None, clear everything.
    Otherwise drop every tenant's entry for that agent id — invalidation is
    triggered by an edit/activate/promote and we'd rather over-invalidate
    (a spare recompile) than risk serving a stale pipeline."""
    with _lock:
        if agent_id is None:
            _cache.clear()
        else:
            for key in [k for k in _cache if k[1] == agent_id]:
                _cache.pop(key, None)
