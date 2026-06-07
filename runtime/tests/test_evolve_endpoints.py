"""POST /agents/{id}/evolve + POST /agents/{id}/explore — Wave D REST surface."""

from __future__ import annotations

from pathlib import Path

import pytest


@pytest.fixture
def client(tmp_path, monkeypatch):
    from fastapi.testclient import TestClient

    # _default is bootstrapped from the committed template under this root.
    monkeypatch.setattr("runtime.agents.registry._DEFAULT_ROOT", tmp_path / "agents")

    monkeypatch.setattr("runtime.server._reload_live_pipeline", lambda agent_id=None: None)
    class _Stub: version = "v0.0.1"
    monkeypatch.setattr("runtime.server.load_agent", lambda _p: _Stub())
    monkeypatch.setattr("runtime.server.compile_agent", lambda _cfg: type("P", (), {"stages": []})())
    monkeypatch.setattr("runtime.server.PipelineExecutor", lambda _p: object())

    # BYOK is required by both endpoints; default to a fake key.
    monkeypatch.setattr(
        "runtime.agents.secrets.get_secret",
        lambda provider, agent_id=None: "sk-ant-fake",
    )

    from runtime.server import app
    with TestClient(app) as c:
        yield c


@pytest.fixture
def stub_run_one_iteration(monkeypatch):
    """Capture the kwargs passed to ``run_one_iteration`` instead of
    running the real loop. Background tasks fire synchronously when
    TestClient enters/exits the request context."""
    calls: list[dict] = []

    def _stub(**kwargs):
        calls.append(kwargs)

    import runtime.evolution as _evo
    monkeypatch.setattr(_evo, "run_one_iteration", _stub)
    return calls


@pytest.fixture
def stub_seed_explore(monkeypatch):
    calls: list[dict] = []

    def _stub(**kwargs):
        calls.append(kwargs)
        class _Out:
            error = None
            files_written = []
        return _Out()

    import runtime.evolution.explore as _ex
    monkeypatch.setattr(_ex, "seed_workspace_via_explore", _stub)
    return calls


# ---------------------------------------------------------------------------
# /evolve
# ---------------------------------------------------------------------------


def test_evolve_dispatches_and_returns_202(client, stub_run_one_iteration):
    r = client.post(
        "/agents/_default/evolve",
        json={"tasks": ["t1", "t2"], "k": 2, "n_variants": 1},
    )
    assert r.status_code == 202, r.text
    body = r.json()
    assert body["agent_id"] == "_default"
    assert body["status"] == "dispatched"
    assert body["iteration_id"].startswith("evo-")
    # Background task ran with our kwargs.
    assert len(stub_run_one_iteration) == 1
    call = stub_run_one_iteration[0]
    assert call["agent_id"] == "_default"
    assert call["tasks"] == ["t1", "t2"]
    assert call["k"] == 2
    assert call["n_variants"] == 1


def test_evolve_omits_unset_optional_fields(client, stub_run_one_iteration):
    """When k / n_variants are absent, the loop runs with its own
    defaults — endpoint should not force a value."""
    r = client.post("/agents/_default/evolve", json={"tasks": ["t1"]})
    assert r.status_code == 202
    call = stub_run_one_iteration[0]
    assert call["agent_id"] == "_default"
    assert call["tasks"] == ["t1"]
    assert "k" not in call
    assert "n_variants" not in call


def test_evolve_404_when_agent_missing(client, stub_run_one_iteration):
    from runtime.agents.registry import get_agent  # ensure module reachable
    # _default exists per fixture seed; ask for a different id.
    r = client.post(
        "/agents/not-there/evolve",
        json={"tasks": ["t1"]},
    )
    assert r.status_code == 404
    assert stub_run_one_iteration == []


def test_evolve_422_when_tasks_empty(client, stub_run_one_iteration):
    r = client.post("/agents/_default/evolve", json={"tasks": []})
    assert r.status_code == 422
    assert stub_run_one_iteration == []


def test_evolve_400_when_byok_missing(client, monkeypatch, stub_run_one_iteration):
    monkeypatch.setattr(
        "runtime.agents.secrets.get_secret",
        lambda provider, agent_id=None: None,
    )
    r = client.post("/agents/_default/evolve", json={"tasks": ["t1"]})
    assert r.status_code == 400
    assert "byok_missing" in r.json()["detail"]
    assert stub_run_one_iteration == []


# ---------------------------------------------------------------------------
# /explore
# ---------------------------------------------------------------------------


def test_explore_dispatches_and_returns_202(client, stub_seed_explore):
    r = client.post(
        "/agents/_default/explore",
        json={"sources": [
            {"type": "url", "url": "https://example.com", "focus": "patterns"},
            {"type": "git", "url": "https://github.com/x/y.git", "focus": "tools"},
        ]},
    )
    assert r.status_code == 202, r.text
    body = r.json()
    assert body["agent_id"] == "_default"
    assert body["source_count"] == 2
    assert len(stub_seed_explore) == 1
    sources = stub_seed_explore[0]["sources"]
    assert [s.url for s in sources] == [
        "https://example.com",
        "https://github.com/x/y.git",
    ]


def test_explore_422_when_sources_empty(client, stub_seed_explore):
    r = client.post("/agents/_default/explore", json={"sources": []})
    assert r.status_code == 422
    assert stub_seed_explore == []


def test_explore_400_when_byok_missing(client, monkeypatch, stub_seed_explore):
    monkeypatch.setattr(
        "runtime.agents.secrets.get_secret",
        lambda provider, agent_id=None: None,
    )
    r = client.post(
        "/agents/_default/explore",
        json={"sources": [{"type": "url", "url": "https://x.com"}]},
    )
    assert r.status_code == 400
    assert stub_seed_explore == []


def test_explore_404_when_agent_missing(client, stub_seed_explore):
    r = client.post(
        "/agents/not-there/explore",
        json={"sources": [{"type": "url", "url": "https://x.com"}]},
    )
    assert r.status_code == 404
    assert stub_seed_explore == []


# ---------------------------------------------------------------------------
# Wave E — bearer auth gate
# ---------------------------------------------------------------------------


@pytest.fixture
def client_multi_tenant(tmp_path, monkeypatch):
    """Variant fixture with multi-tenant mode ON, so the auth gate
    actually enforces."""
    from fastapi.testclient import TestClient

    # _default is bootstrapped from the committed template under this root.
    monkeypatch.setattr("runtime.agents.registry._DEFAULT_ROOT", tmp_path / "agents")

    monkeypatch.setattr("runtime.server._reload_live_pipeline", lambda agent_id=None: None)
    class _Stub: version = "v0.0.1"
    monkeypatch.setattr("runtime.server.load_agent", lambda _p: _Stub())
    monkeypatch.setattr("runtime.server.compile_agent", lambda _cfg: type("P", (), {"stages": []})())
    monkeypatch.setattr("runtime.server.PipelineExecutor", lambda _p: object())
    monkeypatch.setattr(
        "runtime.agents.secrets.get_secret",
        lambda provider, agent_id=None: "sk-ant-fake",
    )
    monkeypatch.setattr(
        "runtime.tenants.feature.is_multi_tenant_enabled", lambda: True,
    )

    from runtime.server import app
    with TestClient(app) as c:
        yield c


def test_evolve_401_when_multi_tenant_and_no_auth(client_multi_tenant):
    """Wave E: in multi-tenant mode, /evolve must reject requests
    without either an Authorization Bearer or an upstream x-tenant-id."""
    r = client_multi_tenant.post(
        "/agents/_default/evolve",
        json={"tasks": ["t1"]},
    )
    assert r.status_code == 401
    assert "missing_auth" in r.json()["detail"]


def test_evolve_401_when_bad_bearer_format(client_multi_tenant):
    r = client_multi_tenant.post(
        "/agents/_default/evolve",
        json={"tasks": ["t1"]},
        headers={"Authorization": "not-a-bearer xyz"},
    )
    assert r.status_code == 401
    assert "bad_authorization" in r.json()["detail"]


def test_evolve_accepts_xtenant_header_when_multi_tenant(
    client_multi_tenant, stub_run_one_iteration,
):
    """Backend-trusted path: x-tenant-id alone is enough (the gateway
    already validated). No Authorization header needed."""
    r = client_multi_tenant.post(
        "/agents/_default/evolve",
        json={"tasks": ["t1"]},
        headers={"x-tenant-id": "acme"},
    )
    # Should NOT be 401 — auth path succeeded via x-tenant-id fallback.
    assert r.status_code in (202, 404), r.text  # 404 if agent unknown in stubbed registry, fine
