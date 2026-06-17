"""Compaction is per-agent: each agent's raw JSONL compacts into that agent's
own parquet tree, never a shared global one. Guards the isolation fix that
moved the compactor off the global ``traces/raw`` + ``traces/parquet`` paths.
"""

from __future__ import annotations

import json

import pytest

from runtime.store import compactor


def _write_raw(traces_root, agent_id, day, rows):
    raw = traces_root / agent_id / "raw"
    raw.mkdir(parents=True, exist_ok=True)
    with (raw / f"{day}.jsonl").open("w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r) + "\n")


@pytest.fixture
def traces_root(tmp_path, monkeypatch):
    # OSS mode → traces root is ``<ROOT>/traces``; point ROOT at tmp.
    monkeypatch.setattr(compactor, "ROOT", tmp_path)
    monkeypatch.setattr(
        "runtime.tenants.feature.is_multi_tenant_enabled", lambda: False
    )
    return tmp_path / "traces"


def test_compacts_into_per_agent_parquet(traces_root):
    _write_raw(traces_root, "agent-a", "2026-01-01",
               [{"trace_id": "a1", "agent_version": "v1", "request": "hi"}])
    _write_raw(traces_root, "agent-b", "2026-01-01",
               [{"trace_id": "b1", "agent_version": "v2", "request": "yo"}])

    results = compactor.compact_day_all_agents("2026-01-01")

    assert set(results) == {"agent-a", "agent-b"}
    a_out = results["agent-a"]
    b_out = results["agent-b"]
    # Each agent's partition lives under its own tree — never a shared global one.
    assert a_out == traces_root / "agent-a" / "parquet" / "dt=2026-01-01"
    assert b_out == traces_root / "agent-b" / "parquet" / "dt=2026-01-01"
    assert list(a_out.rglob("*.parquet"))
    assert list(b_out.rglob("*.parquet"))
    # No global (agent-less) parquet dir is ever created.
    assert not (traces_root / "parquet").exists()


def test_single_agent_scope_is_required(traces_root):
    _write_raw(traces_root, "agent-a", "2026-01-02",
               [{"trace_id": "a2", "agent_version": "v1", "request": "x"}])
    # agent-b has no raw traces → not enumerated, not compacted.
    assert compactor._agents_with_raw() == ["agent-a"]
    assert compactor.compact_day("2026-01-02", agent_id="agent-b") is None
    out = compactor.compact_day("2026-01-02", agent_id="agent-a")
    assert out is not None and list(out.rglob("*.parquet"))
