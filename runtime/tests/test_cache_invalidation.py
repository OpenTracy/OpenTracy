"""Manual edits + promotions + rollbacks drop the active agent's compiled
pipeline from the per-agent cache, so the next request serves the new surface
without a re-activate."""

from __future__ import annotations

import pytest


@pytest.fixture
def client(tmp_path, monkeypatch):
    from fastapi.testclient import TestClient

    # Isolate the agents catalog; _default is bootstrapped from the template.
    monkeypatch.setattr("runtime.agents.registry._DEFAULT_ROOT", tmp_path / "agents")

    # Keep the lifespan boot off the real pipeline.
    class _StubCfg:
        version = "v0.0.1"
    monkeypatch.setattr("runtime.server.load_agent", lambda _p: _StubCfg())
    monkeypatch.setattr(
        "runtime.server.compile_agent", lambda _cfg: type("P", (), {"stages": []})()
    )
    monkeypatch.setattr("runtime.server.PipelineExecutor", lambda _p: object())
    monkeypatch.setattr("runtime.server._reload_live_pipeline", lambda agent_id=None: None)

    # Don't touch the real ledger — the manual-edit path is exercised via the
    # write callback, but the snapshot/lesson machinery is stubbed.
    class _Lesson:
        version = "v0.0.2"
        id = "L-test"
        parent_version = "v0.0.1"

    def _fake_manual_change(write_fn, **_kw):
        write_fn()
        return _Lesson()

    # harness.executor re-exports a ``promote`` function that shadows the
    # submodule attribute, so resolve the real module via sys.modules.
    import importlib
    promote_mod = importlib.import_module("harness.executor.promote")
    monkeypatch.setattr(promote_mod, "record_manual_change", _fake_manual_change)

    from runtime.server import app
    with TestClient(app) as c:
        yield c


def test_prompt_edit_invalidates_active_cache(client):
    from runtime.executor import cache

    cache._cache["_default"] = ("stale-cfg", "stale-exec")
    r = client.put("/agent/prompt", json={"content": "A brand new prompt."})
    assert r.status_code == 200, r.text
    assert "_default" not in cache._cache


def test_route_edit_invalidates_active_cache(client):
    from runtime.executor import cache

    cache._cache["_default"] = ("stale-cfg", "stale-exec")
    r = client.put("/agent/route", json={"small": "claude-opus-4-7"})
    assert r.status_code == 200, r.text
    assert "_default" not in cache._cache
