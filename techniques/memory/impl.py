"""Memory technique — placeholder no-op variant.

Hand-rolled minimal implementation so the compiler's
``importlib.import_module("techniques.memory.impl")`` succeeds and
the pipeline stage doesn't get warned-and-skipped. When per-stage
memory becomes useful (vector retrieval of past lessons, summary
injection, etc.) it replaces this stub.
"""

from __future__ import annotations

import logging
from typing import Any

from runtime.protocols import BaseTechnique, Context, Stage


logger = logging.getLogger("techniques.memory")


class _NoopMemory:
    """Pass-through stage. The per-turn agent reads memory via the
    workspace ``memory/`` dir directly; this stage exists so the
    pipeline compile contract is satisfied."""

    def __init__(self, knobs: dict[str, Any]) -> None:
        # Kept so future stages can take config without breaking the
        # constructor signature (compile passes knobs unconditionally).
        self.knobs = dict(knobs or {})

    def execute(self, context: Context) -> Context:
        return context


class MemoryTechnique(BaseTechnique):
    name = "memory"
    # ``noop`` is the canonical placeholder; ``episodic`` is what the
    # default agent's pipeline declares (window + summarize_after knobs).
    # Both compile to the same pass-through stage for now — the per-turn
    # agent reads memory from the workspace ``memory/`` dir directly.
    variants = ("noop", "episodic")

    def compile(self, variant: str, knobs: dict[str, Any]) -> Stage:
        if variant not in self.variants:
            raise ValueError(
                f"memory: unknown variant {variant!r}; expected one of {self.variants}"
            )
        return _NoopMemory(knobs)
