# memory/ — foundation 3: Memory (content plane)

Memory spans three planes (ADR-0003): **control documents** (this directory —
curated, always in context), the **transcript store** (`sessions/transcripts.db`
— verbatim SQLite record of every message, queried on demand), and **external
providers** (Mem0/Supermemory — deferred, behind the `ExternalMemory` protocol).

This directory is plane 1: two always-loaded documents plus a sharded archive
(see ADR-0001):

- `user.md` — auto-updated profile of who the user is (role, background, extracted facts)
- `memory.md` — auto-updated working memory: platform usage, recurring workflows,
  preferences, arbitrary durable facts
- `archive/` — overflow layer: one fact per file, indexed by `archive/index.md`;
  cold facts compact here when `memory.md` exceeds its token budget
- `seed/` — curated starting facts shipped with the repo

Only `user.md` and `memory.md` enter every session (positions 4–5 in the context
stack). Archive entries are recalled on demand via memory tools (Phase 4).
Write policies: dedupe before write, update over duplicate, delete falsified facts.
Link related entries with `[[slug]]`.

Note: the former `MEMORY.md` index was retired — it collides with `memory.md`
on case-insensitive filesystems (ADR-0001).
