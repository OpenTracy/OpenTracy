"""Atomicity + validation guards for the promote swap."""

from __future__ import annotations

import pytest

from harness.executor.promote import _atomic_swap_agent, _validate_candidate_agent


def _tree(root, name, version, content):
    d = root / name
    (d / "pipeline").mkdir(parents=True)
    (d / "agent.yaml").write_text(f"agent:\n  version: {version}\n")
    (d / "pipeline" / "x.yaml").write_text(content)
    return d


def test_atomic_swap_replaces_and_bumps(tmp_path):
    cand = _tree(tmp_path, "cand", "v1.0.0", "k: new\n")
    live = _tree(tmp_path, "agent", "v0.0.1", "k: old\n")

    _atomic_swap_agent(cand, live, "v0.0.2")

    assert (live / "pipeline" / "x.yaml").read_text() == "k: new\n"
    assert "version: v0.0.2" in (live / "agent.yaml").read_text()
    leftovers = [p.name for p in tmp_path.iterdir() if p.name.startswith(".agent.")]
    assert leftovers == []


def test_atomic_swap_leaves_live_intact_on_copy_failure(tmp_path, monkeypatch):
    cand = _tree(tmp_path, "cand", "v1.0.0", "k: new\n")
    live = _tree(tmp_path, "agent", "v0.0.1", "k: old\n")

    def boom(*a, **k):
        raise OSError("disk gone")

    monkeypatch.setattr("shutil.copytree", boom)

    with pytest.raises(OSError):
        _atomic_swap_agent(cand, live, "v0.0.2")

    # The live tree must survive a mid-copy failure untouched.
    assert (live / "pipeline" / "x.yaml").read_text() == "k: old\n"
    assert "version: v0.0.1" in (live / "agent.yaml").read_text()
    leftovers = [p.name for p in tmp_path.iterdir() if p.name.startswith(".agent.")]
    assert leftovers == []


def test_validate_candidate_agent_rejects_malformed(tmp_path):
    bad = tmp_path / "cand"
    bad.mkdir()
    (bad / "agent.yaml").write_text("just a string\n")
    with pytest.raises(ValueError):
        _validate_candidate_agent(bad)


def test_validate_candidate_agent_rejects_missing(tmp_path):
    empty = tmp_path / "cand"
    empty.mkdir()
    with pytest.raises(ValueError):
        _validate_candidate_agent(empty)
