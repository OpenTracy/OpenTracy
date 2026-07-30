"""Context layer: assembles the agent's system context from workspace documents.

The context stack, in order (most static first, so provider prompt caches stay
warm as the dynamic tail changes):

    1. soul.md                    behavioral authority (hand-edited)
    2. tools/descriptions.md      tools index (generated)
    3. skills/descriptions.md     skills index (generated)
    4. memory/user.md             who the user is (auto-updated)
    5. memory/memory.md           working memory (auto-updated)
    6. sessions/past_sessions.md  prior-session summaries (auto-updated)
    7. <live messages>            owned by the session loop, never by this module

This module is strictly READ-ONLY: it loads, budgets, orders, and renders.
Writing the auto-updated documents is the memory foundation's job (Phase 4);
keeping that separation is what lets each side evolve independently.

Adding a context component = appending a source to the stack (or a new
ContextSource implementation for non-file backends). The assembler never
changes.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Literal, Protocol, Sequence


def estimate_tokens(text: str) -> int:
    """Cheap chars/4 heuristic. Good enough for budgeting; swap in the
    provider tokenizer via ContextLayer(token_counter=...) when accuracy
    starts to matter."""
    return (len(text) + 3) // 4


def strip_frontmatter(text: str) -> str:
    """Drop a leading YAML frontmatter block. Frontmatter is metadata for
    humans and the runtime; it never spends model tokens."""
    if text.startswith("---\n"):
        end = text.find("\n---", 4)
        if end != -1:
            return text[end + 4 :].lstrip("\n")
    return text


@dataclass(frozen=True)
class ContextBlock:
    """One loaded component of the context stack."""

    source: str
    content: str
    tokens: int
    truncated: bool = False


class ContextSource(Protocol):
    """Anything that can contribute a block to the stack. File-backed today;
    the same protocol covers DB- or service-backed sources later."""

    name: str

    def load(self) -> ContextBlock | None: ...


@dataclass
class MarkdownFileSource:
    """A context component backed by a markdown document on disk."""

    name: str
    path: Path
    budget_tokens: int
    required: bool = False
    # Which end survives truncation. "head" suits newest-first documents
    # (past_sessions); everything hand-ordered also keeps its head.
    keep: Literal["head", "tail"] = "head"

    def load(self) -> ContextBlock | None:
        if not self.path.exists():
            if self.required:
                raise FileNotFoundError(
                    f"required context document missing: {self.path} (source '{self.name}')"
                )
            return None
        text = strip_frontmatter(self.path.read_text(encoding="utf-8")).strip()
        if not text:
            return None

        truncated = False
        if estimate_tokens(text) > self.budget_tokens:
            limit = self.budget_tokens * 4
            marker = f"\n\n[... truncated to {self.budget_tokens} token budget ...]"
            text = text[:limit] if self.keep == "head" else text[-limit:]
            text = text.rstrip() + marker
            truncated = True

        return ContextBlock(self.name, text, estimate_tokens(text), truncated)


@dataclass(frozen=True)
class AssembledContext:
    """The rendered context stack for one session turn."""

    blocks: tuple[ContextBlock, ...]

    @property
    def total_tokens(self) -> int:
        return sum(b.tokens for b in self.blocks)

    @property
    def system_prompt(self) -> str:
        """Render blocks as tagged sections. Tags give the model stable
        anchors ("per your soul...") and give evals exact provenance."""
        parts = [
            f'<context source="{b.source}">\n{b.content}\n</context>' for b in self.blocks
        ]
        return "\n\n".join(parts)

    def report(self) -> dict[str, dict[str, int | bool]]:
        """Per-source token accounting, for traces and budget tuning."""
        return {b.source: {"tokens": b.tokens, "truncated": b.truncated} for b in self.blocks}


# Stack definition: (source name, workspace-relative path, default budget, required).
# Order is the contract — most static first. New components append here.
DEFAULT_STACK: tuple[tuple[str, str, int, bool], ...] = (
    ("soul", "soul.md", 2_000, True),
    ("tools", "tools/descriptions.md", 4_000, False),
    ("skills", "skills/descriptions.md", 4_000, False),
    ("user", "memory/user.md", 2_000, False),
    ("memory", "memory/memory.md", 6_000, False),
    ("past_sessions", "sessions/past_sessions.md", 4_000, False),
)


class ContextLayer:
    """Owns the ordered stack of context sources for a workspace."""

    def __init__(self, sources: Sequence[ContextSource]):
        self._sources = list(sources)

    @classmethod
    def from_workspace(
        cls, root: Path | str, budget_overrides: dict[str, int] | None = None
    ) -> "ContextLayer":
        root = Path(root)
        overrides = budget_overrides or {}
        sources = [
            MarkdownFileSource(
                name=name,
                path=root / rel,
                budget_tokens=overrides.get(name, budget),
                required=required,
            )
            for name, rel, budget, required in DEFAULT_STACK
        ]
        return cls(sources)

    def assemble(self) -> AssembledContext:
        blocks = tuple(b for src in self._sources if (b := src.load()) is not None)
        return AssembledContext(blocks=blocks)
