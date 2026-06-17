"""The live trace SSE bus fans out per agent (and per tenant): a subscriber
pinned to agent A must never receive agent B's trace events. Guards the
isolation fix that added agent/tenant scoping to TraceBus.
"""

from __future__ import annotations

import asyncio

from runtime.executor.tracing import TraceBus, _summary_event


def _drain(q: asyncio.Queue) -> list:
    out = []
    while not q.empty():
        out.append(q.get_nowait())
    return out


def test_fanout_delivers_only_to_matching_agent():
    bus = TraceBus()
    qa = bus.subscribe(tenant_id="_default", agent_id="alpha")
    qb = bus.subscribe(tenant_id="_default", agent_id="beta")
    q_all = bus.subscribe()  # unpinned admin subscriber → sees everything

    event_a = _summary_event({"trace_id": "a1"}, agent_id="alpha", tenant_id="_default")
    TraceBus._fanout(list(bus._subs), event_a)

    assert [e["trace_id"] for e in _drain(qa)] == ["a1"]
    assert _drain(qb) == []           # beta never sees alpha's trace
    assert [e["trace_id"] for e in _drain(q_all)] == ["a1"]


def test_fanout_isolates_across_tenants():
    bus = TraceBus()
    q1 = bus.subscribe(tenant_id="t1", agent_id="_default")
    q2 = bus.subscribe(tenant_id="t2", agent_id="_default")

    # Same agent id under a different tenant must not cross over.
    TraceBus._fanout(
        list(bus._subs),
        _summary_event({"trace_id": "x"}, agent_id="_default", tenant_id="t1"),
    )
    assert [e["trace_id"] for e in _drain(q1)] == ["x"]
    assert _drain(q2) == []


def test_summary_event_carries_scope():
    ev = _summary_event({"trace_id": "t", "request": "hi"}, agent_id="alpha", tenant_id="_default")
    assert ev["agent_id"] == "alpha"
    assert ev["tenant_id"] == "_default"
