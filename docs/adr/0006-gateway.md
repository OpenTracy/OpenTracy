# ADR-0006: The gateway — where CLI communication lives

**Status:** accepted · 2026-07-06

## Context

Five subsystems existed with no front door: context stack (ADR-0001),
compression (ADR-0002), transcripts (ADR-0003), scheduler (ADR-0004), and
session trees (ADR-0005). Each frontend wiring them independently would
duplicate orchestration and drift.

## Decision

`src/opentracy/gateway/` — two layers:

1. **`Gateway`** (gateway.py): the single wiring point. One instance per
   workspace owns the ContextLayer, ContextCompressor, TranscriptStore
   (lazy), JobScheduler, and session opening. Its core operation is
   `turn(text, session)`: append user message → assemble context stack →
   build session messages → compression preflight → responder → append
   reply. Every future frontend (desktop, HTTP, tests) calls this class;
   nothing else instantiates the subsystems.
2. **The `opentracy` CLI** (cli.py, argparse, zero dependencies): a thin frontend
   over Gateway, installed as `[project.scripts] opentracy`.

### The Responder seam

The model sits behind `Responder(system_prompt, messages) -> message`.
`EchoResponder` ships as the default stub — the gateway is about CLI
communication and orchestration, not intelligence. The Anthropic provider
drops into this seam without touching the CLI (Phase 1 remainder). This
fulfills the plan's Phase 1 exit criterion: `opentracy run "hello"` completes a
full turn (session tree + SQLite mirror + context stack) with a stub.

### CLI surface

| Command | Does |
|---|---|
| `opentracy run "prompt"` | one-shot turn; `-v` prints context/compression diagnostics |
| `opentracy chat` | interactive REPL (`/exit`, `/new`, `/name`, `/session`) |
| `opentracy sessions` | session picker data: id, date, count, name/first message |
| `opentracy search "text"` | substring search across all transcripts (SQLite) |
| `opentracy context` | assembled context stack with per-source token bars |
| `opentracy ticks [--watch N]` | one scheduler tick (or a loop) over jobs.json |

Session flags mirror Pi: `-c` continue recent · `--session PATH` ·
`--name NAME` · `--no-session` (ephemeral, `SessionManager.in_memory`).

### Scheduler executor

The gateway provides the JobScheduler's executor: a due job's
`action.prompt` runs through a real `turn()` in its own named session
(`job:<id>`), so job executions are sessions like any other — visible in
`opentracy sessions`, mirrored to SQLite, and summarized in run.md.

### Known gap (deliberate)

The compression preflight decision is surfaced (`-v`) but not yet *applied*
to the session tree — applying it needs the summarizer-backed loop and the
message↔entry mapping for `append_compaction(firstKeptEntryId=...)`. That is
the last Phase 1 work item, together with the real Responder.

## Consequences

- `opentracy` is now a real installed command; the REPL and one-shot paths share
  the exact same turn code.
- Chat I/O is injectable (`input_fn`/`print_fn`), so the REPL is unit-tested
  without a TTY.
- Job runs create sessions; heavy schedules will accumulate session files —
  revisit retention when the eval harness lands.
