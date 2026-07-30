# OpenTracy

An agent architecture built on **three core foundations**:

| Foundation | What it holds | Content lives in | Runtime lives in |
|---|---|---|---|
| **User Tools** | What the agent can *do* | [`tools/`](tools/) | [`src/opentracy/tools/`](src/opentracy/tools/) |
| **Skills** | How the agent knows *how* | [`skills/`](skills/) | [`src/opentracy/skills/`](src/opentracy/skills/) |
| **Memory** | What the agent *remembers* | [`memory/`](memory/) | [`src/opentracy/memory/`](src/opentracy/memory/) |

The runtime (`src/opentracy/`) is a thin loop that routes between the foundations. All domain
value — e.g. Sharpi match, perception, automated research — ships as content packs, never
runtime code.

**Start here:** [docs/DEVELOPMENT_PLAN.md](docs/DEVELOPMENT_PLAN.md)

## CLI

```
pip install -e .          # installs the `opentracy` command (and its `ot` shorthand)
ot run "hello"            # one-shot turn (-c continue · --name · --no-session · -v)
ot chat                   # interactive REPL — /help lists in-chat commands:
                          #   /versions /rollback /sessions /search /context /ticks
                          #   /new /name /session /exit · !cmd runs shell directly
ot sessions               # list sessions
ot search "text"          # search all transcripts
ot context                # show the assembled context stack
ot ticks [--watch 60]     # run scheduled jobs from jobs.json
```

`ot` and `opentracy` are the same command — use whichever you prefer.

The **context layer** ([ADR-0001](docs/adr/0001-context-layer.md)) assembles what the
model sees each turn, ordered most-static → most-dynamic for prompt-cache reuse:

```
soul.md → tools/descriptions.md → skills/descriptions.md
       → memory/user.md → memory/memory.md → sessions/past_sessions.md → live messages
```

## Layout

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
