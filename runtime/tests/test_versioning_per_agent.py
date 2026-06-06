"""Versioning resolves the live agent + versions dir per active agent, with
a fallback to the legacy global snapshots dir for reads."""

from __future__ import annotations

from pathlib import Path

from ledger import versioning


def _seed_legacy_agent(tmp_path):
    a = tmp_path / "agent"
    (a / "pipeline").mkdir(parents=True)
    (a / "agent.yaml").write_text("agent:\n  version: v0.0.9\n")
    return a


def test_falls_back_to_legacy_agent_when_no_registry(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    _seed_legacy_agent(tmp_path)
    # No agents/registry.json → resolver falls back to the legacy agent/ slot.
    assert versioning.resolve_live_dir() == Path("agent")
    assert versioning.read_version() == "v0.0.9"


def test_resolves_per_active_agent(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    _seed_legacy_agent(tmp_path)
    from runtime.agents.registry import ensure_bootstrapped

    ensure_bootstrapped()  # migrates agent/ → agents/_default, active=_default

    live = versioning.resolve_live_dir()
    assert live.name == "_default" and live.is_dir()
    assert versioning._versions_dir() == Path("ledger") / "_default" / "versions"
    assert versioning.read_version() == "v0.0.9"  # read from agents/_default


def test_list_snapshots_unions_per_agent_and_legacy(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    _seed_legacy_agent(tmp_path)
    from runtime.agents.registry import ensure_bootstrapped

    ensure_bootstrapped()

    # A legacy global snapshot and a per-agent one.
    for base, ver in (
        (Path("ledger") / "versions", "v0.0.1"),
        (Path("ledger") / "_default" / "versions", "v0.0.2"),
    ):
        snap = base / ver / "agent"
        snap.mkdir(parents=True)
        (snap / "agent.yaml").write_text(f"agent:\n  version: {ver}\n")

    assert set(versioning.list_snapshots()) == {"v0.0.1", "v0.0.2"}
