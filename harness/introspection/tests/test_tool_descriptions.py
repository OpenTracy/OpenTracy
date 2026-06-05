"""Guard: tool descriptions must not reference tools that don't exist."""

from __future__ import annotations

import re

from harness.introspection import agent as agent_mod
from harness.introspection import tools as tools_mod

_TOOL_REF = re.compile(r"\b(?:get|list|propose)_[a-z_]+|\b[a-z_]+_health_check")


def _referenced(desc: str) -> set[str]:
    return set(_TOOL_REF.findall(desc or ""))


def test_mcp_tool_descriptions_reference_only_real_tools():
    registry = {t.name for t in tools_mod.TOOLS}
    for t in tools_mod.TOOLS:
        for ref in _referenced(t.description):
            assert ref in registry, f"{t.name} references missing tool {ref!r}"


def test_sdk_tool_descriptions_reference_only_real_tools():
    registry = {t["name"] for t in agent_mod.TOOLS}
    for t in agent_mod.TOOLS:
        for ref in _referenced(t["description"]):
            assert ref in registry, f"{t['name']} (sdk) references missing tool {ref!r}"


def test_harness_model_defaults_are_unified():
    from harness.brain.transport import DEFAULT_API_MODEL
    from harness.introspection.agent import DEFAULT_MODEL

    assert DEFAULT_MODEL == DEFAULT_API_MODEL
