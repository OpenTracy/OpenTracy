"""Versioning resolves the live agent + versions dir per active agent.

The catalog entry ``agents/<id>/`` is the sole live surface — there is no
legacy ``agent/`` slot and no global ``ledger/versions`` fallback."""

from __future__ import annotations

from pathlib import Path

from ledger import versioning


def test_resolves_per_active_agent(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    from runtime.agents.registry import ensure_bootstrapped

    ensure_bootstrapped()  # seeds agents/_default from the template, active=_default

    # Pin a known version on the catalog dir so the assertion doesn't ride
    # on whatever version the template currently ships.
    versioning.set_version(Path("agents") / "_default", "v0.0.9")

    live = versioning.resolve_live_dir()
    assert live.name == "_default" and live.is_dir()
    assert versioning._versions_dir() == Path("ledger") / "_default" / "versions"
    assert versioning.read_version() == "v0.0.9"  # read from agents/_default


def test_list_snapshots_is_per_agent_only(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    from runtime.agents.registry import ensure_bootstrapped

    ensure_bootstrapped()

    # A per-agent snapshot is listed; a global ledger/versions snapshot is NOT
    # (the legacy fallback is gone).
    per_agent = Path("ledger") / "_default" / "versions" / "v0.0.2" / "agent"
    per_agent.mkdir(parents=True)
    (per_agent / "agent.yaml").write_text("agent:\n  version: v0.0.2\n")

    legacy = Path("ledger") / "versions" / "v0.0.1" / "agent"
    legacy.mkdir(parents=True)
    (legacy / "agent.yaml").write_text("agent:\n  version: v0.0.1\n")

    assert versioning.list_snapshots() == ["v0.0.2"]
