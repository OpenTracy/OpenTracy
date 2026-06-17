"""Each agent has its own approval policy — no cross-agent leakage."""

from __future__ import annotations

import pytest

from runtime import agent_context
from harness.approver.policy import Policy


@pytest.fixture(autouse=True)
def _isolated_agents(tmp_path, monkeypatch):
    monkeypatch.setattr("runtime.agents.registry._DEFAULT_ROOT", tmp_path / "agents")
    monkeypatch.delenv("OPENTRACY_MULTI_TENANT", raising=False)
    yield
    agent_context.set_active(None)


def test_policy_is_per_agent():
    agent_context.set_active("a")
    Policy(mode="auto", auto_min_lift=0.5).write_yaml()

    # b has no policy of its own → conservative default, NOT a's.
    agent_context.set_active("b")
    assert Policy.from_yaml().mode == "review"
    Policy(mode="off").write_yaml()

    # a is unchanged by b's write.
    agent_context.set_active("a")
    pa = Policy.from_yaml()
    assert pa.mode == "auto" and pa.auto_min_lift == 0.5
