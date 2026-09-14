# OpenTracy: Development Plan

**Status:** draft v0.1 · 2026-07-04
**Runtime language:** Python 3.12+ (assumed — matches the existing Sharpi service stack)

---

## 1. Vision

OpenTracy is an agent architecture organized around **three core foundations**. Everything the
agent can *do*, *know how to do*, and *remember* lives in one of them:

| Foundation | Question it answers | Nature |
|---|---|---|
| **User Tools** | What can the agent *do*? | Capabilities — typed, schema-validated actions |
| **Skills** | Does the agent know *how*? | Procedural knowledge — declarative, loaded on demand |
| **Memory** | What does the agent *remember*? | Persistent facts — file-based, indexed, recalled per session |

The core runtime (agent loop, context assembly, LLM adapters) is deliberately thin:
it exists only to route between these three foundations. All product/domain value
(Sharpi match, perception, automated research flows) ships as *content* — tool packs,
skill packs, and seed memory — never as changes to the runtime.

### Design principles

1. **Content over code.** Adding a capability, a procedure, or a fact must never require
   touching the runtime. Tools are manifests + handlers; skills are markdown; memory is files.
2. **Progressive disclosure.** Context is expensive. Skills load a one-line description at
   session start and their full body only when triggered. Memory loads an index
   (`MEMORY.md`) and recalls full entries only when relevant.
3. **Everything is inspectable.** All three foundations are plain files on disk —
   diffable, reviewable, versionable in git. No opaque state.
4. **Traced by default.** Every tool call, skill activation, and memory read/write emits
   a trace event, so offline evals and self-improvement loops come for free later.

---

## 2. The three foundations — contracts

### 2.1 User Tools (`tools/` + `src/opentracy/tools/`)

A tool is a **manifest** (what it is, when to use it, input/output JSON Schema) plus a
**handler** (the code that runs). The runtime owns the registry, validation, and dispatch;
the content plane owns the definitions.

```yaml
# tools/<pack>/<tool_name>/manifest.yaml
name: match_lookup
description: Look up candidate matches for a product in the Sharpi catalog.
input_schema: { ... JSON Schema ... }
output_schema: { ... JSON Schema ... }
handler: handler.py:run          # local python, or http: / mcp: for remote
permissions: [read]              # read | write | external
```

Key runtime behaviors:
- Schema validation on both input and output; validation errors go back to the model for retry.
- Tool packs are directories; dropping a new pack in `tools/` registers it — no code change.
- MCP servers mount as tool packs, so external integrations use the same contract.

### 2.2 Skills (`skills/` + `src/opentracy/skills/`)

A skill is a markdown file with frontmatter — a procedure the agent reads when the task
matches. Skills may bundle resources (templates, scripts, reference docs) in their folder.

```markdown
# skills/<pack>/<skill-name>/SKILL.md
---
name: match-correction-triage
description: Triage a batch of match corrections and route them to eval datasets.
triggers: ["correction", "mismatch", "triage"]
tools: [match_lookup, dataset_append]   # tools this skill expects to be available
---
<procedure body — only loaded into context when the skill activates>
```

Key runtime behaviors:
- At session start only `name` + `description` of every skill enter context.
- Activation is model-driven (the agent decides a skill matches) with trigger keywords as hints.
- Skills can reference each other; the loader resolves the chain.

### 2.3 Memory (`memory/` + `src/opentracy/memory/`)

One fact per file, with frontmatter, plus an index (`MEMORY.md`) that is the only thing
loaded into every session. Mirrors the proven Claude Code memory layout.

```markdown
# memory/<slug>.md
---
name: <kebab-slug>
description: <one-line summary used for recall relevance>
type: user | feedback | project | reference
---
<the fact; links to related memories as [[other-slug]]>
```

Key runtime behaviors:
- **Recall:** index always in context; full entries pulled in when description matches the task.
- **Write-back:** the agent writes/updates memories during work under explicit policies
  (dedupe against existing entries, update rather than duplicate, delete when wrong).
- **Scoping:** global memory + per-workspace memory, merged at session start.
- Later (Phase 6): optional pgvector-backed semantic recall over descriptions — the file
  store stays the source of truth; the vector index is a cache.

---

## 3. Repository layout

```
opentracy-build/
├── README.md                     # what OpenTracy is, quickstart
├── pyproject.toml                # package: opentracy
├── docs/
│   ├── DEVELOPMENT_PLAN.md       # this file
│   └── adr/                      # architecture decision records (one per decision)
│
├── src/opentracy/                      # ── THE RUNTIME (thin, foundation-agnostic) ──
│   ├── core/                     # agent loop, session, context assembly, tracing
│   ├── tools/                    # foundation 1 runtime: registry, schema validation, dispatch
│   ├── skills/                   # foundation 2 runtime: loader, index, activation
│   ├── memory/                   # foundation 3 runtime: store, index, recall, write policies
│   └── providers/                # LLM adapters (Anthropic first), model config
│
├── tools/                        # ── CONTENT: user tool packs ──
│   ├── core/                     # built-ins: fs read, http fetch, etc.
│   └── sharpi/                   # domain pack: match, perception, dataset tools
│
├── skills/                       # ── CONTENT: skill packs ──
│   ├── core/                     # generic: research, summarize-and-cite, self-review
│   └── sharpi/                   # domain: match-correction-triage, automated research flows
│
├── memory/                       # ── CONTENT: memory store ──
│   ├── MEMORY.md                 # index — the only file always in context
│   └── seed/                     # curated starting facts shipped with the repo
│
├── tests/
│   ├── unit/                     # per-module runtime tests
│   └── evals/                    # offline eval harness: scenario → expected behavior
│
└── examples/                     # runnable end-to-end sessions (scripted transcripts)
```

The split is deliberate: `src/opentracy/{tools,skills,memory}` is *runtime* (how the foundation
works), top-level `{tools,skills,memory}` is *content* (what it holds). The three top-level
content dirs are the product surface users and domain engineers touch.

---

## 4. Phased plan

Each phase ends with something runnable and a green test suite. Phases 2–4 are
independent of each other once Phase 1 lands, and can be reordered or parallelized.

### Phase 0 — Contracts & scaffold *(this commit)*
- Repo scaffold, this plan, per-directory READMEs.
- Write the three contract specs as ADRs: tool manifest schema, SKILL.md format,
  memory entry format + index rules.
- **Exit:** contracts reviewed and frozen enough to build against.

### Phase 1 — Core loop
- ✅ Context layer landed 2026-07-04: `src/opentracy/core/context.py` + the seven-document
  context stack — see `docs/adr/0001-context-layer.md`. Note: it supersedes §2.3's
  `MEMORY.md` index (retired for a case-insensitivity collision with `memory/memory.md`;
  the index role moved to `memory/archive/index.md`).
- ✅ Context compression landed 2026-07-06: `src/opentracy/core/compression.py` — Hermes-style
  dual check moments (preflight + overflow error), chars/4 → real-usage token accounting,
  head+summary+tail compression with pluggable summarizer. See `docs/adr/0002-context-compression.md`.
- ✅ Scheduled jobs landed 2026-07-06: `src/opentracy/core/{cron,scheduler}.py` — ticks()
  reads `jobs.json` (source of truth), runs due jobs via an injected executor, and
  records every run as `jobs/runs/<job_id>/<run_id>.md`. Self-improvement jobs
  (memory compaction, session archiving) ship enabled. See `docs/adr/0004-scheduled-jobs.md`.
- ✅ Session trees landed 2026-07-06: `src/opentracy/core/session.py` — Pi-format v3 JSONL
  sessions with id/parentId branching, compaction-aware context building, fork/clone,
  resume, and automatic SQLite mirroring. See `docs/adr/0005-session-trees.md`.
- ✅ Gateway landed 2026-07-06: `src/opentracy/gateway/` — the `opentracy` CLI (run/chat/sessions/
  search/context/ticks) over a single Gateway wiring point; turn() flows through session
  tree + SQLite mirror + context stack + compression preflight, with the model behind a
  Responder seam (EchoResponder stub). Jobs execute through real turns. Phase 1 exit
  criterion met with the stub. See `docs/adr/0006-gateway.md`.
- ✅ Real Responder landed 2026-07-07: `src/opentracy/providers/anthropic_responder.py` —
  Claude (claude-opus-4-8, adaptive thinking) behind the Responder seam; CLI auto-selects
  it when credentials exist, echo otherwise; provider usage feeds the compressor.
  Pending live validation (needs ANTHROPIC_API_KEY) and tool use.
- ✅ Session finalization landed 2026-07-09: `Gateway.finalize_session()` — on chat
  /exit (and /new, EOF), the model summarizes the session, SQLite gets ended_at+summary,
  and the entry is prepended to `sessions/past_sessions.md` — the first Phase 4
  write-back: the next session's context includes what happened before.
- ✅ Tool use landed 2026-07-09: `src/opentracy/tools/` (registry + 7 builtins: read, bash,
  edit, write, grep, find, ls — workspace-confined paths, clipped outputs) and the
  agentic loop in AnthropicResponder (tool_use → execute → tool_result, step budget 24,
  full trace persisted to session tree + SQLite). tools/descriptions.md is regenerated
  from the registry; first skill (`manage-memory`) activates via the read tool.
- ✅ Agent versioning landed 2026-07-12: `src/opentracy/core/versioning.py` — Git-backed
  version tree (.opentracy/versions.git) over the config plane (soul.md, agent.json,
  jobs.json, skills/); every change auto-committed as a tagged version with a
  what/why/impact changelog (model-written for agent-made changes, deterministic for
  manual edits); `opentracy versions [--show|--diff]` + `opentracy rollback` (rollback = new
  version, never history rewrite). agent.json makes the LLM itself versionable config.
  See `docs/adr/0007-agent-versioning.md`.
- Remaining Phase 1: applying compression to the session tree (`append_compaction`).
- `src/opentracy/providers`: Anthropic adapter (tool use, streaming), model/config plumbing.
- Trace events emitted for every step (JSONL to disk first; OpenTracy exporter later).
- **Exit:** `opentracy run "hello"` completes a turn with a stub echo tool.

### Phase 2 — Tools foundation
- Registry that discovers packs under `tools/`, validates manifests, builds the model-facing
  tool list; input/output schema validation with model-visible retry on failure.
- Handler runners: local Python first; `http:`/`mcp:` handlers stubbed with a clear interface.
- Ship `tools/core` pack (read file, write file, http fetch) as the reference implementation.
- **Exit:** dropping a new tool pack directory makes it callable with zero code changes.

### Phase 3 — Skills foundation
- Loader: scan `skills/`, parse frontmatter, build the lightweight index for context.
- Activation: model requests a skill by name → full body injected; trigger keywords
  surfaced as hints in the index.
- Skill-declared tool requirements checked against the registry at activation.
- Ship 2–3 `skills/core` skills as references.
- **Exit:** a session where the agent activates a skill and follows its procedure end-to-end.

### Phase 4 — Memory foundation
- ✅ Transcript store landed 2026-07-06: `src/opentracy/memory/transcript.py` — every
  interactive message persisted to SQLite (`sessions/transcripts.db`), append-only,
  lossless; plus the `ExternalMemory` protocol seam (Mem0/Supermemory deferred to the
  final stage). See `docs/adr/0003-memory-planes.md`.
- Store: CRUD over entry files, index maintenance (`MEMORY.md` regenerated, never hand-drifted).
- Recall: index in every session; description-match pulls full entries.
- Write policies: dedupe-before-write, update-over-duplicate, deletion of falsified facts —
  implemented as guardrails in the memory tools the agent calls.
- **Exit:** a two-session demo — facts saved in session 1 are recalled and used in session 2.

### Phase 5 — Eval harness & tracing
- `tests/evals`: scenario files (task + fixture tools + expected behavior), a runner that
  scores tool-choice, skill-activation, and memory-recall correctness.
- Wire trace output to OpenTracy for clustering/analysis (reuses existing platform).
- **Exit:** eval suite runs in CI; baseline scores recorded.

### Phase 6 — Sharpi domain packs
- `tools/sharpi`: match lookup, perception queries, dataset/correction tools against the
  existing services (AKS dev endpoints).
- `skills/sharpi`: match-correction triage, automated research investigation flow.
- Optional: pgvector semantic recall for memory, reusing the per-alias embedding
  infrastructure from sharpi-autoresearch-v2.
- **Exit:** one real Sharpi workflow (correction triage) runs end-to-end through OpenTracy.

---

## 5. Open decisions (to resolve in Phase 0 ADRs)

1. **Agent runtime base:** build the loop directly on the Anthropic SDK vs. on the Claude
   Agent SDK. Direct SDK = full control of the three foundations; Agent SDK = loop,
   tool-use plumbing and MCP for free. Leaning **Claude Agent SDK** unless a contract
   can't be expressed in it.
2. **Skill activation authority:** purely model-driven vs. keyword pre-filter that
   auto-suggests. Start model-driven (simpler, matches principle 2).
3. **Memory write autonomy:** agent writes freely vs. proposes-then-confirms. Start free
   writes with dedupe guardrails; revisit after eval data exists.
4. **Multi-agent:** out of scope until Phase 5 evals justify it. The foundations are
   per-agent; sub-agents would inherit tools/skills and share memory read-only.
5. **External memory provider** (final stage): Mem0 vs. Supermemory vs. local pgvector,
   behind the `ExternalMemory` protocol (ADR-0003). Decide only after the Phase 5 eval
   harness can measure recall quality/latency/cost; transcripts make backfill possible
   whenever the decision lands.
