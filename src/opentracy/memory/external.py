"""External memory: the seam for third-party memory providers (plane 3).

Deliberately just a protocol + a null implementation for now. Providers like
Mem0 or Supermemory will plug in behind ExternalMemory once the internal
planes (control documents + transcript store) are proven — evaluating and
integrating them is a final-stage task (ADR-0003).

The contract is intentionally minimal — ingest and semantic recall — so that
any provider (or a local pgvector index) can satisfy it without leaking
provider concepts into the runtime.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Protocol

Message = dict[str, Any]


@dataclass(frozen=True)
class MemoryHit:
    """One recalled memory from an external provider."""

    text: str
    score: float = 0.0
    metadata: dict[str, Any] = field(default_factory=dict)


class ExternalMemory(Protocol):
    """What OpenTracy needs from any external memory provider."""

    def ingest(self, session_id: str, messages: list[Message]) -> None:
        """Feed session messages to the provider (typically at session end)."""
        ...

    def recall(self, query: str, limit: int = 5) -> list[MemoryHit]:
        """Semantic recall relevant to the current task."""
        ...


class NullExternalMemory:
    """Default no-op provider: internal memory only."""

    def ingest(self, session_id: str, messages: list[Message]) -> None:
        return None

    def recall(self, query: str, limit: int = 5) -> list[MemoryHit]:
        return []
