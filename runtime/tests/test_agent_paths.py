"""Per-agent path resolvers resolve the active agent (or an explicit id)."""

from __future__ import annotations

from pathlib import Path

import pytest

from runtime import agent_context, agent_paths


@pytest.fixture(autouse=True)
def _oss_mode(monkeypatch):
    # Ensure OSS (single-tenant) resolution for deterministic relative paths.
    monkeypatch.delenv("OPENTRACY_MULTI_TENANT", raising=False)


def test_trace_artifacts_scope_to_active_agent():
    agent_context.set_active("acme")
    try:
        assert agent_paths.raw_traces_dir() == Path("traces") / "acme" / "raw"
        assert agent_paths.pinned_traces_dir() == Path("traces") / "acme" / "pinned"
        assert agent_paths.distilled_dir("epochs") == Path("traces") / "acme" / "distilled" / "epochs"
        assert agent_paths.distilled_dir() == Path("traces") / "acme" / "distilled"
    finally:
        agent_context.set_active(None)


def test_agent_owned_artifacts_under_catalog_dir():
    agent_context.set_active("acme")
    try:
        base = Path("agents") / "acme"
        assert agent_paths.agent_dir() == base
        assert agent_paths.router_versions_dir() == base / "router" / "versions"
        assert agent_paths.datasets_dir() == base / "datasets"
        assert agent_paths.corpus_indexed_dir() == base / "corpora" / "indexed"
        assert agent_paths.corpus_ingested_dir() == base / "corpora" / "ingested"
        assert agent_paths.evals_reports_dir() == base / "evals" / "reports"
        assert agent_paths.preference_pairs_dir() == base / "evals" / "preference_pairs"
        assert agent_paths.experiments_results_dir() == base / "experiments" / "results"
        assert agent_paths.candidates_dir() == base / "experiments" / "candidates"
        assert agent_paths.policy_path() == base / "policy.yaml"
    finally:
        agent_context.set_active(None)


def test_explicit_agent_id_overrides_active():
    agent_context.set_active("acme")
    try:
        assert agent_paths.raw_traces_dir("other") == Path("traces") / "other" / "raw"
        assert agent_paths.router_versions_dir("other") == Path("agents") / "other" / "router" / "versions"
        assert agent_paths.policy_path("other") == Path("agents") / "other" / "policy.yaml"
    finally:
        agent_context.set_active(None)


def test_env_fallback_when_no_active(monkeypatch):
    agent_context.set_active(None)
    monkeypatch.setenv("OPENTRACY_AGENT_ID", "from-env")
    assert agent_paths.raw_traces_dir() == Path("traces") / "from-env" / "raw"
    assert agent_paths.agent_dir() == Path("agents") / "from-env"
