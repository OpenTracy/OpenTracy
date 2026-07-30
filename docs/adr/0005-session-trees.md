# ADR-0005: Session trees — JSONL sessions with in-place branching

**Status:** accepted · 2026-07-06
**Reference:** Pi's session format v3 (pi-mono: `packages/coding-agent/src/core/session-manager.ts`).

## Context

Sessions need more than a flat log: continue the most recent conversation,
branch from an earlier turn without losing the original path, fork/clone into
new sessions, and rebuild the model-facing context from any point — including
across compactions.

## Decision

Adopt Pi's session format, implemented in `src/opentracy/core/session.py`
(`SessionManager`). One JSONL file per session at
`sessions/agent/<timestamp>_<uuid>.jsonl`: a header line, then entries forming
a **tree** via `id`/`parentId` (8-char hex ids). The current position is the
**leaf**; every append chains from it; `branch(entry_id)` moves the leaf so
the next append starts a sibling path in the same file.

### Entry types (Pi-compatible)

`session` (header: version 3, uuid, cwd, optional `parentSession`) ·
`message` · `compaction` (summary, `firstKeptEntryId`, `tokensBefore`) ·
`branch_summary` (summary of an abandoned path, `fromId`) · `label` ·
`session_info` (display name) · `model_change` · `thinking_level_change` ·
`custom` (extension state — never enters LLM context) · `custom_message`
(extension-injected — does enter context).

### Context building

`build_context_entries()` walks leaf → root and honors the most recent
compaction on the path: the compaction entry leads, then entries from
`firstKeptEntryId` to the compaction, then everything after — earlier turns
are dropped in favor of the summary. `build_session_context()` maps entries to
provider-ready messages (compaction/branch summaries become system messages —
a pragmatic divergence from Pi's dedicated roles, which providers don't
accept) and extracts the active model/provider/thinking level from the path.

### Operations mapping (Pi commands → API)

| Pi | OpenTracy |
|---|---|
| `pi -c` / continue | `SessionManager.continue_recent(root)` |
| `pi -r` / `/resume` picker | `SessionManager.list(root)` |
| `/tree` jump | `branch(entry_id)` / `branch_with_summary(entry_id, summary)` |
| `/fork`, `/clone` | `create_branched_session(leaf_id)` → new file with `parentSession` |
| `/name` | `append_session_info(name)` |
| `/compact` | `append_compaction(...)` fed by the ContextCompressor (ADR-0002) |
| `--no-session` | `SessionManager.in_memory()` |

### Relation to the transcript store (amends ADR-0003)

The JSONL session file is the **per-session source of truth** (it holds tree
structure the flat store cannot). The SQLite `TranscriptStore` becomes the
**cross-session mirror/index**: pass it as `mirror` and every message entry is
also written to SQLite automatically — preserving the "every interactive
message in SQLite" guarantee, powering cross-session search/listing, and
remaining rebuildable from the JSONL files at any time. Mirror writes are
message entries only; tree metadata lives only in the JSONL.

## Consequences

- Session files are runtime data: `sessions/agent/` is gitignored.
- The compressor (ADR-0002) gains a durable home for its output: record the
  summary via `append_compaction` and the tree replays it correctly forever.
- Branch summaries reuse the same reference-only framing lesson (ADR-0002)
  when rendered into context.
- Not ported yet: the interactive picker/tree UI, `/export`/`/share`, session
  deletion helpers, v1→v3 migration (OpenTracy has no legacy files).
