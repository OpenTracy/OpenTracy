"""Central per-agent path resolvers.

Every per-agent artifact resolves the ACTIVE agent at call time (or an explicit
``agent_id``). Two anchors:

  - **Trace artifacts** (raw / pinned / distilled) live under the tenant-aware
    traces root: ``<traces_root>/<agent>/...``.
  - **Agent-owned artifacts** (router model, training datasets, RAG corpus,
    eval/experiment outputs, approval policy) live under the agent's own catalog
    dir: ``agents_root()/<agent>/...`` — which is already tenant-aware, so each
    agent's full surface stays together and isolated.

Intentionally NOT here (shared by decision): ``evals/golden`` + ``evals/suites``
(tenant test library), response caches, and stateless ML model pools.

This is the single home the formerly-global path constants delegate to. Resolve
at CALL TIME — never cache these at import.
"""

from __future__ import annotations

from pathlib import Path
from typing import Optional


def _active(agent_id: Optional[str]) -> str:
    from runtime.agent_context import get_active

    return agent_id or get_active()


def _traces_root() -> Path:
    """Tenant-aware traces root: ``traces/`` (OSS) or ``tenants/<t>/traces/``."""
    from runtime.tenants.feature import is_multi_tenant_enabled

    if not is_multi_tenant_enabled():
        return Path("traces")
    from runtime.tenant_context import get_active as _get_tenant
    from runtime.tenants.registry import get_tenant_dir

    return get_tenant_dir(_get_tenant()) / "traces"


def agent_dir(agent_id: Optional[str] = None) -> Path:
    """The agent's catalog dir (tenant-aware): ``agents_root()/<agent>``."""
    from runtime.agents.registry import agents_root

    return agents_root() / _active(agent_id)


# --- trace artifacts (under the traces root) -------------------------------


def raw_traces_dir(agent_id: Optional[str] = None) -> Path:
    return _traces_root() / _active(agent_id) / "raw"


def pinned_traces_dir(agent_id: Optional[str] = None) -> Path:
    return _traces_root() / _active(agent_id) / "pinned"


def distilled_dir(kind: str = "", agent_id: Optional[str] = None) -> Path:
    """``<traces_root>/<agent>/distilled[/<kind>]`` — kind in {sessions, epochs}."""
    base = _traces_root() / _active(agent_id) / "distilled"
    return base / kind if kind else base


# --- agent-owned artifacts (under the agent catalog dir) -------------------


def router_versions_dir(agent_id: Optional[str] = None) -> Path:
    return agent_dir(agent_id) / "router" / "versions"


def datasets_dir(agent_id: Optional[str] = None) -> Path:
    return agent_dir(agent_id) / "datasets"


def corpus_indexed_dir(agent_id: Optional[str] = None) -> Path:
    return agent_dir(agent_id) / "corpora" / "indexed"


def corpus_ingested_dir(agent_id: Optional[str] = None) -> Path:
    return agent_dir(agent_id) / "corpora" / "ingested"


def evals_reports_dir(agent_id: Optional[str] = None) -> Path:
    return agent_dir(agent_id) / "evals" / "reports"


def preference_pairs_dir(agent_id: Optional[str] = None) -> Path:
    return agent_dir(agent_id) / "evals" / "preference_pairs"


def experiments_results_dir(agent_id: Optional[str] = None) -> Path:
    return agent_dir(agent_id) / "experiments" / "results"


def candidates_dir(agent_id: Optional[str] = None) -> Path:
    return agent_dir(agent_id) / "experiments" / "candidates"


def policy_path(agent_id: Optional[str] = None) -> Path:
    return agent_dir(agent_id) / "policy.yaml"
