"""End-to-end agent isolation over the real HTTP surface.

Two agents (alpha, beta) driven through the actual FastAPI endpoints; the only
thing stubbed is the LLM generate seam (``_active_runtime``) so the test is free
and deterministic. Every subsystem is exercised on alpha and asserted absent on
beta — traces, model/route, versions+rollback, policy, MCP, datasets.

Agents are targeted per-request via the ``x-agent-id`` header (config endpoints)
or the path id (channels). No real Anthropic calls, no network.
"""

from __future__ import annotations

from types import SimpleNamespace
from pathlib import Path

import pytest


@pytest.fixture
def client(tmp_path, monkeypatch):
    from fastapi.testclient import TestClient

    # Isolate the whole on-disk surface under tmp (traces/ledger resolve off cwd).
    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr("runtime.agents.registry._DEFAULT_ROOT", tmp_path / "agents")
    monkeypatch.delenv("OPENTRACY_MULTI_TENANT", raising=False)

    class _Rec:
        response = "stub answer"
        duration_ms = 1.0
        success = True
        error = None
        stages: list = []
        agent_version = "v0.0.5"
        request = "hi"

    class _Exec:
        def run(self, request, history=None):
            return None, _Rec()

    monkeypatch.setattr("runtime.server._active_runtime", lambda: (object(), _Exec()))

    # Write a real trace line to the ACTIVE agent's raw dir (exercises the
    # per-agent resolver) without depending on ExecutionRecord serialization.
    def _write_trace(record, *a, **k):
        from runtime.agent_paths import raw_traces_dir
        d = raw_traces_dir()
        d.mkdir(parents=True, exist_ok=True)
        (d / "trace.jsonl").open("a").write('{"trace_id": "t"}\n')
        return "t"

    monkeypatch.setattr("runtime.executor.tracing.write_trace", _write_trace)

    from runtime.agents.registry import create_agent, ensure_bootstrapped
    from runtime.server import app

    with TestClient(app) as c:
        ensure_bootstrapped()
        create_agent({"name": "alpha", "prompt": "Alpha."})
        create_agent({"name": "beta", "prompt": "Beta."})
        yield c


def _h(agent: str) -> dict:
    return {"x-agent-id": agent}


def test_traces_are_per_agent(client, tmp_path):
    token = client.post("/agents/alpha/channels/api/connect").json()["token"]
    r = client.post(
        "/api/alpha/chat",
        headers={"authorization": f"Bearer {token}"},
        json={"request": "where is my order?"},
    )
    assert r.status_code == 200, r.text
    assert (tmp_path / "traces" / "alpha" / "raw").exists()
    assert not (tmp_path / "traces" / "beta").exists()


def test_model_change_is_per_agent(client, tmp_path):
    assert client.patch("/agents/alpha", json={"model": "claude-opus-4-7"}).status_code == 200
    alpha_route = (tmp_path / "agents" / "alpha" / "pipeline" / "route.yaml").read_text()
    beta_route = (tmp_path / "agents" / "beta" / "pipeline" / "route.yaml").read_text()
    assert "small: claude-opus-4-7" in alpha_route
    assert "claude-opus-4-7" not in beta_route


def test_versions_and_rollback_are_per_agent(client, tmp_path):
    edit = client.put("/agent/prompt", headers=_h("alpha"), json={"content": "Improved alpha."})
    assert edit.status_code == 200, edit.text
    assert client.get("/versions", headers=_h("alpha")).json()  # alpha has a snapshot
    assert client.get("/versions", headers=_h("beta")).json() == []  # beta untouched
    # Roll alpha back; beta still has no versions.
    ver = edit.json()["parent_version"]
    assert client.post(f"/versions/{ver}/rollback", headers=_h("alpha")).status_code == 200
    assert client.get("/versions", headers=_h("beta")).json() == []


def test_policy_is_per_agent(client):
    body = {
        "mode": "auto", "auto_min_lift": 0.5,
        "overrides": {}, "auto_rollback": {},
    }
    assert client.put("/policy", headers=_h("alpha"), json=body).status_code == 200
    assert client.get("/policy", headers=_h("alpha")).json()["mode"] == "auto"
    assert client.get("/policy", headers=_h("beta")).json()["mode"] == "review"


def test_mcp_servers_are_per_agent(client):
    add = client.post(
        "/agents/alpha/mcp",
        json={"name": "shop", "command": "true", "args": [], "description": "x"},
    )
    assert add.status_code == 201, add.text
    assert [s["name"] for s in client.get("/agents/alpha/mcp").json()["servers"]] == ["shop"]
    assert client.get("/agents/beta/mcp").json()["servers"] == []


def test_datasets_are_per_agent(client):
    # Every agent is seeded with the same starter datasets (goldens + rag-gaps),
    # but a dataset created for alpha must never appear for beta.
    assert client.post("/datasets", headers=_h("alpha"), json={"name": "custom-ds"}).status_code == 201
    alpha = {d["name"] for d in client.get("/datasets", headers=_h("alpha")).json()}
    beta = {d["name"] for d in client.get("/datasets", headers=_h("beta")).json()}
    assert "custom-ds" in alpha
    assert "custom-ds" not in beta
    # The seeded starter datasets are present and isolated per agent.
    assert {"goldens", "rag-gaps"} <= alpha
    assert {"goldens", "rag-gaps"} <= beta
