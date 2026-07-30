# ADR-0001: Context layer

**Status:** accepted · 2026-07-04

## Context

OpenTracy needs a context layer that puts the right knowledge in front of the model on
every turn: who the user is (soul), what the agent remembers (memory), what
happened before (sessions), what it can do (tools/skills indexes), and the live
conversation. It must scale cleanly: more skills, more memory, and longer
histories must not degrade cost, latency, or maintainability.

## Decision

### 1. The context stack — ordered markdown documents, most static first

| # | Source | File | Managed by | Default budget |
|---|---|---|---|---|
| 1 | soul | `soul.md` | human | 2,000 tok |
| 2 | tools | `tools/descriptions.md` | runtime (generated from manifests) | 4,000 tok |
| 3 | skills | `skills/descriptions.md` | runtime (generated from SKILL.md) | 4,000 tok |
| 4 | user | `memory/user.md` | runtime (auto-updated) | 2,000 tok |
| 5 | memory | `memory/memory.md` | runtime (auto-updated) | 6,000 tok |
| 6 | past_sessions | `sessions/past_sessions.md` | runtime (appended at session end) | 4,000 tok |
| 7 | messages | live conversation | session loop | remainder |

Ordering is static→dynamic **for prompt-cache economics**: provider caches
invalidate from the first changed byte, so the hand-edited soul and the
regenerated-rarely indexes sit ahead of the fast-changing memory and session
layers. Reordering the stack is a breaking change; new components append at
the position matching their volatility.

### 2. Read/write separation

`src/opentracy/core/context.py` is strictly read-only: load → strip frontmatter →
budget → order → render. Auto-updating documents 4–6 is the memory foundation's
job (Phase 4), executed at session end under its write policies (dedupe, update
over duplicate, delete falsified). This is the seam that lets recall and
write-back evolve independently.

### 3. Budgets + compaction, not unbounded growth

Every source declares a token budget; over-budget content truncates with a
visible marker and a `truncated` flag in the trace report. Sustained overflow
is handled by **compaction**, not bigger budgets:

- `memory/memory.md` → cold facts shard to `memory/archive/` (one fact per
  file) indexed by `memory/archive/index.md`; hot facts stay inline.
- `sessions/past_sessions.md` → old entries roll into `sessions/archive/YYYY-MM.md`.

So the always-loaded context is O(budget), never O(history). Archives are
reachable on demand via memory-recall tools (Phase 4).

### 4. Generated indexes are views, not sources of truth

`tools/descriptions.md` and `skills/descriptions.md` are regenerated from the
manifests / SKILL.md frontmatter (the packs remain canonical). Until the Phase
2/3 generators land they are maintained by hand in the same format.

### 5. Frontmatter is metadata, never model tokens

Every document opens with YAML frontmatter (`managed`, `position`, budget,
policies). The assembler strips it before rendering — self-documenting files at
zero context cost.

### 6. LangChain at the edge only

The core produces a plain system prompt + report with zero dependencies.
`src/opentracy/providers/langchain_adapter.py` converts to LangChain messages behind
the optional `opentracy[langchain]` extra. Rationale: the context layer is OpenTracy's most
durable contract, and framework APIs churn faster than markdown files; if
LangChain is dropped, exactly one file is deleted.

### 7. Rendering contract

Blocks render as `<context source="...">...</context>` sections — stable anchors
for the model and exact provenance for evals ("which block caused this
behavior?"). `AssembledContext.report()` returns per-source token accounting for
traces and budget tuning.

## Consequence: `memory/MEMORY.md` retired

The Phase-0 scaffold's `memory/MEMORY.md` index would collide with
`memory/memory.md` on macOS's case-insensitive filesystem. The index role moves
to `memory/archive/index.md`; `memory/memory.md` is the always-loaded working
memory. One-fact-per-file remains the archive/overflow layer, preserving the
Development Plan §2.3 scaling story.
