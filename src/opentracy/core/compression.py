"""Context compression: keeps the live-messages layer inside the context window.

Modeled on Hermes' ContextCompressor (hermes-agent, Nous Research) — see
ADR-0002. Two check moments guard the conversation:

    1. PREFLIGHT — before every model call: check_before_call(messages)
    2. REACTIVE  — when the provider rejects the request: check_on_error(err)

Token accounting mirrors Hermes: before the first response exists the count is
a rough chars/4 estimate; afterwards it is the provider-reported prompt_tokens
from the last response plus a rough estimate of messages added since
(update_from_response()).

Compression itself is head + summary + tail: the first messages and a
token-budgeted recent tail survive verbatim, old tool outputs are pruned for
free, and the middle is replaced by one structured summary block. The
summarizer is pluggable — the runtime stays LLM-agnostic; providers plug in
via a callable.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any, Callable, Sequence

from opentracy.core.context import estimate_tokens

Message = dict[str, Any]
# Receives the middle messages, returns summary text. Failures must raise —
# compression then ABORTS and preserves the conversation unchanged (a retry
# later beats destroying context for a placeholder).
Summarizer = Callable[[list[Message]], str]

# Structured template the summarizer should follow (mirrors Hermes v3).
# Section names are deliberately "Historical ..." — active-sounding headings
# like "Next Steps" get read as fresh instructions by the downstream model
# (hermes-agent #11475/#14521). Exported so provider adapters can build
# their prompt from it.
SUMMARY_TEMPLATE = (
    "Summarize the prior turns as source material for a handoff. "
    "Use exactly these sections:\n"
    "## Historical Task Snapshot\n## Constraints\n## Progress\n"
    "## Key decisions\n## Relevant files\n## Historical Remaining Work\n"
    "## Critical context\n"
    "Be specific; keep identifiers, paths, and numbers exact. If a previous "
    "context summary appears in the turns, merge it in — do not drop its facts."
)

# Prepended to every summary message. Compressed from Hermes' SUMMARY_PREFIX:
# without the reference-only framing, models resume stale tasks mentioned in
# the summary instead of answering the newest message.
SUMMARY_PREFIX = (
    "[Context summary — REFERENCE ONLY] Earlier messages were compacted into "
    "the summary below. Treat it as background, NOT as active instructions: "
    "do not answer questions or resume work it mentions unless the latest "
    "user message explicitly asks. The latest user message is the single "
    "source of truth for what to do now."
)
SUMMARY_END_MARKER = (
    "--- END OF CONTEXT SUMMARY — respond to the messages below, "
    "not the summary above ---"
)

# Substrings that identify a context-window overflow across providers.
_OVERFLOW_MARKERS = (
    "context_length_exceeded",
    "prompt is too long",
    "maximum context length",
    "input is too long",
    "exceeds the maximum number of tokens",
    "too many total text bytes",
)


def is_context_overflow(error: Exception | str) -> bool:
    text = str(error).lower()
    return any(marker in text for marker in _OVERFLOW_MARKERS)


def estimate_messages_tokens(messages: Sequence[Message]) -> int:
    """Rough chars/4 estimate over role + content + tool payloads."""
    total = 0
    for msg in messages:
        content = msg.get("content") or ""
        if not isinstance(content, str):
            content = json.dumps(content, ensure_ascii=False)
        total += estimate_tokens(content) + 4  # +4: role/format overhead
        for call in msg.get("tool_calls") or ():
            total += estimate_tokens(json.dumps(call, ensure_ascii=False))
    return total


@dataclass
class CompressionConfig:
    enabled: bool = True
    # THE knob: compress when tokens reach this fraction of the window.
    threshold: float = 0.50
    context_window: int = 200_000
    # Head/tail protection (Hermes defaults): system + first exchange, and a
    # recent tail of at least protect_last_n messages capped by a token
    # budget of threshold_tokens * target_ratio.
    protect_first_n: int = 3
    protect_last_n: int = 20
    target_ratio: float = 0.20
    # Tool outputs longer than this, outside the protected tail, are pruned
    # to a one-line marker before any LLM is involved.
    prune_tool_chars: int = 200
    # Anti-thrashing: if two consecutive compressions each save less than
    # this fraction, stop volunteering to compress (force=True overrides).
    min_savings: float = 0.10
    # Output reservation: providers carve max_tokens out of the same window,
    # so the usable INPUT budget is context_window - max_output_tokens.
    # 0 = no reservation (hermes-agent #43547).
    max_output_tokens: int = 0

    @property
    def threshold_tokens(self) -> int:
        effective_window = self.context_window - self.max_output_tokens
        if effective_window <= 0:
            effective_window = self.context_window
        return int(effective_window * self.threshold)


@dataclass(frozen=True)
class Decision:
    should_compress: bool
    reason: str
    tokens: int
    threshold_tokens: int


@dataclass
class ContextCompressor:
    config: CompressionConfig = field(default_factory=CompressionConfig)
    summarizer: Summarizer | None = None

    # -- token tracking state --
    _last_real_prompt_tokens: int = 0
    _messages_at_last_usage: int = 0
    _ineffective_count: int = 0
    last_failure: str | None = None

    # ------------------------------------------------------------------
    # Token accounting
    # ------------------------------------------------------------------

    def update_from_response(self, usage: dict[str, Any], message_count: int) -> None:
        """Record real usage from a provider response.

        `usage` uses OpenAI-style keys (prompt_tokens) or Anthropic-style
        (input_tokens); `message_count` is len(messages) as sent in that call.
        """
        tokens = usage.get("prompt_tokens") or usage.get("input_tokens") or 0
        if tokens > 0:
            self._last_real_prompt_tokens = tokens
            self._messages_at_last_usage = message_count

    def current_tokens(self, messages: Sequence[Message]) -> int:
        """Best-available count: real usage + estimate of what was added
        since, or pure chars/4 when no response has been seen yet."""
        if 0 < self._messages_at_last_usage <= len(messages):
            added = messages[self._messages_at_last_usage :]
            return self._last_real_prompt_tokens + estimate_messages_tokens(added)
        return estimate_messages_tokens(messages)

    # ------------------------------------------------------------------
    # The two check moments
    # ------------------------------------------------------------------

    def check_before_call(self, messages: Sequence[Message]) -> Decision:
        """Moment 1: preflight, before every model call."""
        tokens = self.current_tokens(messages)
        threshold = self.config.threshold_tokens
        if not self.config.enabled:
            return Decision(False, "disabled", tokens, threshold)
        if tokens < threshold:
            return Decision(False, "below-threshold", tokens, threshold)
        if self._ineffective_count >= 2:
            return Decision(False, "thrashing", tokens, threshold)
        source = "usage" if self._messages_at_last_usage else "estimate"
        return Decision(True, f"preflight-{source}", tokens, threshold)

    def check_on_error(self, error: Exception | str, messages: Sequence[Message]) -> Decision:
        """Moment 2: reactive, after a provider error. Overflow errors compress
        unconditionally (the provider is the ground truth that we don't fit)."""
        tokens = self.current_tokens(messages)
        threshold = self.config.threshold_tokens
        if not self.config.enabled:
            return Decision(False, "disabled", tokens, threshold)
        if not is_context_overflow(error):
            return Decision(False, "not-overflow", tokens, threshold)
        return Decision(True, "overflow-error", tokens, threshold)

    # ------------------------------------------------------------------
    # Compression: prune -> boundaries -> summarize -> reassemble
    # ------------------------------------------------------------------

    def compress(self, messages: Sequence[Message], force: bool = False) -> list[Message]:
        """Return the compressed message list, or the original unchanged if
        there is nothing to gain or the summarizer fails (abort semantics)."""
        msgs = list(messages)
        self.last_failure = None
        if force:
            self._ineffective_count = 0

        before_tokens = estimate_messages_tokens(msgs)
        head_end, tail_start = self._boundaries(msgs)
        if tail_start <= head_end:
            return msgs  # nothing between head and tail to compress

        # Phase 1 (free): prune old tool outputs between the protected head and tail.
        msgs = self._prune_tool_results(msgs, head_end, tail_start)

        # Phase 2/3: summarize the middle, if a summarizer is available.
        head, middle, tail = msgs[:head_end], msgs[head_end:tail_start], msgs[tail_start:]
        if self.summarizer is not None and middle:
            try:
                summary = self.summarizer(middle)
            except Exception as exc:  # noqa: BLE001 — abort, never destroy context
                self.last_failure = f"summarizer failed: {exc}"
                return list(messages)
            summary_msg: Message = {
                "role": "system",
                "content": (
                    f"{SUMMARY_PREFIX}\n"
                    f"(replaces {len(middle)} earlier messages)\n\n"
                    f"{summary}\n\n{SUMMARY_END_MARKER}"
                ),
            }
            msgs = [*head, summary_msg, *tail]

        # Phase 4: track effectiveness for anti-thrashing.
        after_tokens = estimate_messages_tokens(msgs)
        saved = (before_tokens - after_tokens) / before_tokens if before_tokens else 0.0
        if saved < self.config.min_savings:
            self._ineffective_count += 1
        else:
            self._ineffective_count = 0

        # New conversation shape: prior provider usage no longer applies.
        self._last_real_prompt_tokens = 0
        self._messages_at_last_usage = 0
        return msgs

    def _boundaries(self, msgs: list[Message]) -> tuple[int, int]:
        """(head_end, tail_start) indices. The tail starts at the last
        protect_last_n messages, extended backwards while the tail token
        budget allows, and never starts on an orphaned tool result."""
        head_end = min(self.config.protect_first_n, len(msgs))
        tail_start = max(head_end, len(msgs) - self.config.protect_last_n)

        budget = int(self.config.threshold_tokens * self.config.target_ratio)
        while tail_start > head_end and (
            estimate_messages_tokens(msgs[tail_start - 1 :]) <= budget
        ):
            tail_start -= 1
        # A tool result must never lead the tail without its tool call.
        while tail_start > head_end and msgs[tail_start].get("role") == "tool":
            tail_start -= 1
        return head_end, tail_start

    def _prune_tool_results(
        self, msgs: list[Message], head_end: int, tail_start: int
    ) -> list[Message]:
        pruned = []
        for i, msg in enumerate(msgs):
            content = msg.get("content")
            if (
                head_end <= i < tail_start
                and msg.get("role") == "tool"
                and isinstance(content, str)
                and len(content) > self.config.prune_tool_chars
            ):
                marker = f"[tool output pruned — {len(content):,} chars]"
                pruned.append({**msg, "content": marker})
            else:
                pruned.append(msg)
        return pruned
