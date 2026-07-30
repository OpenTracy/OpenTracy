# ADR-0003: Memory planes — transcripts in SQLite, external providers deferred

**Status:** accepted · 2026-07-06 · **amended by ADR-0005** (the JSONL session
tree is the per-session source of truth; the SQLite store is the cross-session
mirror/index, fed automatically via `SessionManager(mirror=...)` and
rebuildable from the session files)

## Context

The context stack (ADR-0001) defines *what the model sees each turn*, but the
`.md` documents are curated views with token budgets — they can never hold
everything that happened. OpenTracy needs a complete record of previous
conversations, and eventually semantic recall over them, without bloating the
always-loaded context.

## Decision

Memory is split into **three planes**, each with a different fidelity/cost
trade-off:

| Plane | Storage | Fidelity | When loaded |
|---|---|---|---|
| 1. Control documents | `.md` files (soul, user, memory, past_sessions) | curated, lossy | always (budgeted, ADR-0001) |
| 2. Transcript store | SQLite — `sessions/transcripts.db` | verbatim, lossless | on demand (queries) |
| 3. External providers | Mem0 / Supermemory / pgvector / … | semantic index | deferred |

### Plane 2: the transcript store (`opentracy.memory.transcript.TranscriptStore`)

Every interactive message — user, assistant, tool — is persisted to SQLite as
it happens. Schema: `sessions` (id, started/ended, summary, metadata) and
`messages` (session_id, per-session `seq`, role, JSON content, JSON extras,
timestamp), WAL mode, indexed by `(session_id, seq)`.

Invariants:

1. **Append-only.** Context compression (ADR-0002) rewrites the *working*
   message list the model sees; it never touches this record. The transcript
   is what actually happened.
2. **Lossless round-trip.** Content of any JSON shape and every extra key
   (`tool_calls`, `tool_call_id`, …) are stored as JSON and reconstructed
   exactly.
3. **Derived views flow one way.** `sessions/past_sessions.md` (context stack
   position 6) is *generated from* transcripts at session end via
   `end_session(summary=...)`; the store is also the input for offline evals
   (Phase 5) and any future recall index. Nothing is ever reconstructed from
   the .md files back into the store.

Why SQLite: zero dependencies (stdlib), single file per workspace, WAL gives
safe concurrent reads, and it is queryable — `list_sessions`,
`search_messages` (substring recall) work today without any index
infrastructure. Also the same choice Hermes made for session state.

### Plane 3: external memory — seam now, integration later

`opentracy.memory.external.ExternalMemory` is a two-method protocol:
`ingest(session_id, messages)` and `recall(query, limit) -> [MemoryHit]`.
`NullExternalMemory` is the default. Rationale for deferring:

- Providers differ (Mem0, Supermemory, local pgvector) but all fit
  ingest/recall; committing to one now would be premature.
- The transcript store is the ingestion source either way — building plane 2
  first means any provider can be backfilled from day one.
- Evaluation criteria (recall quality, latency, cost, privacy) need the
  Phase 5 eval harness to exist before a comparison means anything.

**Final-stage task:** evaluate providers against the eval harness, pick, and
wire `ingest` at session end + `recall` into context assembly (likely as a new
budgeted source in the context stack).

## Consequences

- The session loop gains two duties: `append()` every message as it is
  exchanged, and `end_session(summary)` at close (the same summary that
  appends to `past_sessions.md`).
- `sessions/` now holds runtime state (`transcripts.db`, gitignored) alongside
  the curated `past_sessions.md` — same lifecycle, different fidelity.
- Substring search is the only recall over transcripts until plane 3; that is
  deliberate scope control, not an oversight.
