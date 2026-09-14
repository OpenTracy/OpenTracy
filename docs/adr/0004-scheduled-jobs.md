# ADR-0004: Scheduled jobs — ticks(), jobs.json, run.md

**Status:** accepted · 2026-07-06

## Context

OpenTracy needs scheduled behavior: user-defined events ("send me the order report
at 11pm") and recurring self-improvement maintenance (memory compaction,
session archiving, index regeneration, eval runs). The mechanism must follow
the repo's rules: content over code, plain files, inspectable state.

## Decision

`src/opentracy/core/{cron,scheduler}.py`. The host calls `JobScheduler.ticks()` on
an interval (system cron, launchd, or the session loop's idle timer); each
tick re-reads `jobs.json` and executes whatever is due.

### jobs.json is the source of truth

Workspace root, re-read on **every** tick — edits apply live, no registration
or restart. Each job: `id`, `schedule` (5-field cron, zero-dependency parser),
`description`, `action` (opaque payload for the executor), `enabled`,
`catch_up`. Invalid schedules fail at load, not at fire time.

### The filesystem is the run state

Each execution writes `jobs/runs/<job_id>/<run_id>.md`, where
`run_id = the scheduled slot` (`20260706T2300`). The file is written twice:
**created** with `status: running` the moment the slot is claimed (a crash
mid-run cannot double-fire), then **updated** with final status, output, and
notes (duration, traceback on failure). Frontmatter carries job_id, run_id,
scheduled_for, started/finished, status.

Consequences of "file = state": idempotency is an existence check; re-running
a slot = deleting its file; no state DB to drift from what actually happened.

### Due-slot policy

- A slot is due if it matches the cron expression within the lookback window
  (default 25h — covers a daily job across DST) and has no run file.
- **No catch-up by default:** time only moves forward. Slots older than the
  job's latest claimed run are expired, and only the most recent unclaimed
  slot fires — a host asleep at 23:00 still sends the report on wake, but a
  weekend of downtime sends one report, not three.
- `"catch_up": true` opts into firing every unclaimed slot, oldest first.
- A failed run **claims its slot** — no automatic retry until the next slot
  (retry-on-failure would loop a deterministic failure; revisit with evals).

### Executors are injected

`JobExecutor = Callable[[Job], str]` — the scheduler owns *when*, the executor
owns *what*. The Phase 1 session loop provides the real executor (feeding
`action.prompt` to the agent); tests use lambdas. Exceptions → `status: failure`
with the traceback in Notes; other jobs in the same tick still run.

### Self-improvement jobs ship in jobs.json

`self-improve-memory-compaction` (daily 03:00) and `self-improve-session-archive`
(Sundays 03:30) are enabled — they implement the compaction duties defined in
ADR-0001. `self-improve-index-regen` and `self-improve-eval-run` are present
but disabled until Phases 2/3 (generators) and 5 (eval harness) land.

## Consequences

- The host needs a once-a-minute tick source; until the session loop exists,
  `JobScheduler(root, executor).ticks()` can be driven externally.
- Run records are runtime data: `jobs/runs/` is gitignored; `jobs.json` is
  versioned content.
- Timezone: naive local time, matching user expectations for "11pm".
