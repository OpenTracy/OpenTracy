# ADR-0002: Context compression

**Status:** accepted · 2026-07-06
**Reference:** Hermes ContextCompressor (Nous Research) — [docs](https://hermes-agent.nousresearch.com/docs/developer-guide/context-compression-and-caching), `agent/context_compressor.py` in NousResearch/hermes-agent.

## Context

The context stack (ADR-0001) keeps documents O(budget), but the **live messages
layer** (stack position 7) grows without bound during a session. Something must
keep the conversation inside the model's context window without losing the
thread of the work.

## Decision

Adopt Hermes' compression model, implemented in `src/opentracy/core/compression.py`,
simplified to OpenTracy's current scale.

### Two check moments

1. **Preflight** — `check_before_call(messages)` runs before every model call.
   Compresses when tokens ≥ `threshold × context_window`.
2. **Reactive** — `check_on_error(error, messages)` runs when a provider call
   fails. A context-overflow error (matched against known provider phrasings)
   compresses unconditionally — the provider is ground truth that we don't fit.
   Other errors never trigger compression.

### Token accounting

- **Before the first response:** rough `chars/4` estimate over the messages
  (reuses `estimate_tokens` from the context layer).
- **After any response:** `update_from_response(usage, message_count)` records
  the provider-reported `prompt_tokens` (or Anthropic `input_tokens`); the
  current count is then *real usage + rough estimate of messages added since*.
- **After a compression:** real-usage tracking resets — the conversation shape
  changed, so the next preflight falls back to the rough estimate until fresh
  usage arrives (mirrors Hermes' `awaiting_real_usage_after_compression` fix).

### Compression algorithm (head + summary + tail)

1. **Prune (free):** tool outputs > 200 chars between the protected head and
   tail become one-line markers — no LLM call.
2. **Boundaries:** protect the first `protect_first_n` (3) messages and a tail
   of at least `protect_last_n` (20), extended backwards while it fits the
   `threshold_tokens × target_ratio` (0.20) budget. The tail never starts on an
   orphaned tool result.
3. **Summarize:** a pluggable `Summarizer` callable condenses the middle using
   the structured `SUMMARY_TEMPLATE`. Three lessons adopted from Hermes v3:
   the summary is wrapped in a **reference-only preamble + end marker** (models
   otherwise resume stale tasks mentioned in the summary — hermes-agent
   #11475/#14521/#33256); section headings use **historical framing**
   ("Historical Remaining Work", not "Next Steps") for the same reason; and
   summaries are **iterative** — the summary message sits right after the head,
   so the next compaction re-summarizes it together with newer turns, carrying
   facts across compactions. If the summarizer raises, compression **aborts and
   returns the conversation unchanged** — retrying later beats destroying
   context for a placeholder.
4. **Reassemble:** head + one summary message + tail. If a pass saves < 10%
   twice in a row, the compressor stops volunteering (anti-thrashing);
   `force=True` overrides.

### Configuration (`CompressionConfig`)

| Parameter | Default | Hermes equivalent |
|---|---|---|
| `enabled` | `true` | `compression.enabled` |
| `threshold` | **`0.50`** (the customizable knob) | `compression.threshold` |
| `context_window` | `200_000` | model metadata |
| `protect_first_n` | `3` | hardcoded 3 |
| `protect_last_n` | `20` | `protect_last_n` |
| `target_ratio` | `0.20` | `target_ratio` |
| `prune_tool_chars` | `200` | 200-char rule |
| `min_savings` | `0.10` | anti-thrash <10% rule |
| `max_output_tokens` | `0` | output reservation subtracted from the window (#43547) |

### Deliberately deferred (Hermes has them; OpenTracy doesn't yet)

- Gateway-level 85% safety net (needs the session gateway to exist)
- Summary-failure cooldowns, auth-vs-network failure distinction, focused
  `/compress <topic>`, media stripping, tool-result deduplication
- Prompt-caching breakpoints (`system_and_3` strategy) — revisit with the
  provider adapter; the context stack's static-first ordering (ADR-0001)
  already aligns with it

## Consequences

- The session loop (Phase 1) must call `check_before_call` each turn,
  `update_from_response` after each response, and `check_on_error` in its
  error path — three integration points, no other coupling.
- The summarizer is injected, so compression is testable without an LLM and
  provider-agnostic by construction.
