# OpenTracy

An agent architecture built on **three core foundations**:

| Foundation | What it holds | Content lives in | Runtime lives in |
|---|---|---|---|
| **User Tools** | What the agent can *do* | [`tools/`](tools/) | [`src/opentracy/tools/`](src/opentracy/tools/) |
| **Skills** | How the agent knows *how* | [`skills/`](skills/) | [`src/opentracy/skills/`](src/opentracy/skills/) |
| **Memory** | What the agent *remembers* | [`memory/`](memory/) | [`src/opentracy/memory/`](src/opentracy/memory/) |

The runtime (`src/opentracy/`) is a thin loop that routes between the foundations. All domain
value — e.g. Sharpi match, perception, automated research — ships as content packs, never
runtime code. Everything is plain files on disk: diffable, reviewable, versionable.

**Design deep-dive:** [docs/DEVELOPMENT_PLAN.md](docs/DEVELOPMENT_PLAN.md) · decision records in [docs/adr/](docs/adr/)

## Install

Requires Python 3.12+.

```bash
git clone git@github.com:OpenTracy/OpenTracy.git
cd OpenTracy
python3 -m venv .venv && source .venv/bin/activate
pip install -e .                 # installs the `opentracy` command (and its `ot` shorthand)
export ANTHROPIC_API_KEY=sk-...  # without it, a local echo responder answers instead
```

`ot` and `opentracy` are the same command — use whichever you prefer.

## Quickstart

```bash
ot run "hello"        # one-shot turn: prints the reply and saves the session
ot chat               # interactive REPL (recommended starting point)
```

Inside `ot chat`:

```
/help                 all in-chat commands
/session  /name       inspect / name the current session
/new  /exit           finalize this session and start fresh / leave
/versions /rollback   agent version tree (see below)
/sessions /search     browse and search past conversations
/context  /ticks      inspect the context stack · run scheduled jobs now
!<command>            run a shell command; its output joins the conversation
```

Every command accepts `--root PATH` (default: current directory) — the workspace is
just a directory, so you can keep several isolated agents side by side.

### Sessions

```bash
ot run -c "continue that thought"   # -c continues the most recent session
ot run --name inbox "triage this"   # --name labels the session
ot run --no-session "throwaway"     # ephemeral: nothing saved
ot sessions                         # list all sessions in this workspace
ot search "deploy key"              # full-text search across every transcript
```

Sessions live in `sessions/` as JSONL transcripts, mirrored to SQLite for search.
When a session ends it is summarized into `sessions/past_sessions.md`, which future
sessions read — that's how the agent remembers past conversations.

## How it works — the context stack

Each turn, the [context layer](docs/adr/0001-context-layer.md) assembles what the model
sees, ordered most-static → most-dynamic for prompt-cache reuse:

```
soul.md → tools/descriptions.md → skills/descriptions.md
       → memory/user.md → memory/memory.md → sessions/past_sessions.md → live messages
```

Inspect it anytime with `ot context` — a per-source token bar chart of exactly what
the agent is carrying. When live messages outgrow their budget, older ones are
[compressed](docs/adr/0002-context-compression.md) into a summary automatically.

## Make it yours

### 1. Give it a soul

[`soul.md`](soul.md) is the highest-authority document in the context stack: who the
agent works for, tone, preferences, autonomy level. It is hand-edited only — the
runtime never writes it. Fill in the four sections and the agent adapts from the
next turn onward.

### 2. Add a tool (what the agent can *do*)

Drop a pack directory into `tools/` — no runtime changes needed:

```yaml
# tools/<pack>/<tool_name>/manifest.yaml
name: match_lookup
description: Look up candidate matches for a product in the catalog.
input_schema:  { ... JSON Schema ... }
output_schema: { ... JSON Schema ... }
handler: handler.py:run          # local python, or http: / mcp: for remote
permissions: [read]              # read | write | external
```

Input and output are schema-validated; validation errors go back to the model for
retry. MCP servers mount as tool packs under the same contract. See [tools/README.md](tools/README.md).

### 3. Add a skill (how the agent knows *how*)

A skill is a markdown procedure with frontmatter, loaded only when it matches the task
(progressive disclosure: only name + description sit in context until activation):

```markdown
# skills/<pack>/<skill-name>/SKILL.md
---
name: match-correction-triage
description: Triage a batch of match corrections and route them to eval datasets.
triggers: ["correction", "mismatch", "triage"]
tools: [match_lookup, dataset_append]
---
<procedure body — loaded into context only when the skill activates>
```

See [skills/README.md](skills/README.md).

### 4. Memory (what the agent *remembers*)

Memory is auto-managed — you mostly just watch it work ([ADR-0003](docs/adr/0003-memory-planes.md)):

- `memory/user.md` — evolving profile of who you are
- `memory/memory.md` — durable working memory: workflows, preferences, facts
- `memory/archive/` — one-fact-per-file overflow; cold facts compact here on a schedule
- `sessions/transcripts.db` — verbatim record of everything, queried via `ot search`

Write policies: dedupe before write, update over duplicate, delete falsified facts.

### 5. Scheduled jobs

[`jobs.json`](jobs.json) defines cron-scheduled prompts — the agent's autonomous loop
([ADR-0004](docs/adr/0004-scheduled-jobs.md)). It is re-read on every tick, so edits apply live:

```json
{
  "id": "nightly-order-report",
  "description": "Send me the order report at 11pm",
  "schedule": "0 23 * * *",
  "enabled": true,
  "action": { "type": "prompt", "prompt": "Compile today's orders into a summary…" }
}
```

```bash
ot ticks              # run everything currently due, once
ot ticks --watch 60   # keep ticking every 60s (leave running in a terminal)
```

Run records land in `jobs/runs/<job_id>/<run_id>.md` — the files *are* the scheduler
state: delete one to make that slot re-run. Missed slots (laptop asleep) fire only the
most recent, unless the job sets `"catch_up": true`.

### 6. Versioning & rollback

The agent *is* its configuration (`soul.md`, `agent.json`, `jobs.json`, `skills/`).
Every config change — manual or agent-made — becomes a tagged version in a hidden
repo (`.opentracy/versions.git`), with a structured changelog ([ADR-0007](docs/adr/0007-agent-versioning.md)):

```bash
ot versions                  # newest-first version list
ot versions --show v4        # full changelog of one version
ot versions --diff v3 v4     # what changed between two versions
ot rollback v3               # restore v3 — recorded as a NEW version, nothing lost
```

State (`memory/`, `sessions/`) is deliberately not versioned: rolling back behavior
never erases what the agent has learned. Workspaces from before the OpenTracy rename
migrate their legacy `.sar/` version tree automatically on first use.

## Configuration

| File | What it controls |
|---|---|
| [`agent.json`](agent.json) | model id, `max_tokens`, `max_steps` per turn |
| [`soul.md`](soul.md) | personality, tone, behavioral profile (hand-edited only) |
| [`jobs.json`](jobs.json) | scheduled jobs (live-reloaded) |
| `ANTHROPIC_API_KEY` | credentials; unset → offline echo responder |

## Development

```bash
pip install -e ".[anthropic]"      # extras: anthropic · langchain
python -m pytest tests/ -q         # 121 unit tests, no network needed
```

```
soul.md         context #1: user personality, tone, behavioral profile (hand-edited)
src/opentracy/  runtime: core loop, context layer, providers, foundation engines
tools/          content: tool packs + descriptions.md (generated tools index)
skills/         content: skill packs + descriptions.md (generated skills index)
memory/         content: user.md + memory.md (auto-updated) + archive/ overflow
sessions/       content: past_sessions.md (auto-appended) + archive/
tests/          unit tests + offline eval harness
examples/       runnable end-to-end sessions
docs/           plan + architecture decision records
```

Architectural decisions are recorded one-per-file in [docs/adr/](docs/adr/) — start with
[ADR-0001 (context layer)](docs/adr/0001-context-layer.md) and
[ADR-0006 (gateway)](docs/adr/0006-gateway.md) to understand the shape of the runtime.
