# ADR-0007: Agent versioning — a Git-backed version tree with rollback

**Status:** accepted · 2026-07-09

## Context

The agent's behavior is defined by files: `soul.md` (behavioral authority),
`skills/` (playbooks), `jobs.json` (scheduled behavior), and — new with this
ADR — `agent.json` (model/LLM configuration, previously hardcoded). Changing
any of them changes the agent. We need every version stored, every change
documented (what / why / expected impact), and CLI rollback when a change
regresses.

## Decision

### 1. Real Git, hidden and dedicated — versioning the CONFIG PLANE only

A dedicated repository at `.opentracy/versions.git` (bare, driven with explicit
`--git-dir`/`--work-tree`) tracks exactly the **config plane**:

    soul.md · agent.json · jobs.json · skills/

Explicitly NOT tracked: memory (`memory/`, state — rolling back the agent must
not lobotomize it), sessions/transcripts (history), generated indexes
(`tools/descriptions.md` — regenerated from code), and source code (that's the
project's own git, when the user creates one). Using real Git buys history,
diff, and content-addressing for free, with zero dependencies; the hidden
git-dir means it never collides with a repo the user may init in the
workspace.

### 2. Every version is a tagged commit with a structured changelog

Versions are sequential tags (`v1`, `v2`, …). The commit message IS the
documentation:

    <one-line summary>

    - **What:** which files/settings changed, concretely
    - **Why:** the reason the change was made
    - **Expected impact:** what should get better (or riskier)

    Trigger: session <id> | manual | rollback from <ref>

### 3. Documentation is automatic, with two capture paths

- **Agent-made changes** (the model edits `soul.md`/skills/jobs via tools):
  after a turn, the Gateway checks the config plane for changes; if dirty, it
  asks the model to write the changelog — the model has the conversation
  context, so "why" is real, not inferred. Committed as `Trigger: session <id>`.
- **Manual edits** (user edits `soul.md` in an editor): detected at the start
  of the next turn (or any versions CLI command) and committed with a
  deterministic changelog built from the diff (`Trigger: manual`). Better an
  honest "edited by hand, diff attached" than a hallucinated why.
- Echo responder / summarizer failure → deterministic fallback, same as
  session finalization.

### 4. Rollback is a new version, never history rewriting

`opentracy rollback v3` restores the config-plane files to `v3` in the working tree
(including deleting files created after v3) and commits the restoration as a
NEW version (`Trigger: rollback from v5`). git-revert semantics: the rejected
versions remain in history; a rollback can itself be rolled back. Nothing is
ever lost.

### 5. CLI surface

| Command | Does |
|---|---|
| `opentracy versions` | list the version tree (tag, date, one-liner) |
| `opentracy versions --show v3` | full changelog + file stat for a version |
| `opentracy versions --diff v2 v4` | unified diff of the config plane between versions |
| `opentracy rollback v3` | restore config plane to v3 as a new version |

### 6. `agent.json` — the LLM becomes configuration

`{"model", "max_tokens", "max_steps"}` at the workspace root, read by the
Gateway when building the default responder. Swapping the model is now an
edit to a versioned file — exactly the "LLM substituída" case the requirement
names — instead of a code change.

## Consequences

- Two cheap `git status` subprocess calls per turn (~20 ms); repo init is
  lazy (first use).
- The changelog call on agent-made changes costs one extra model call per
  config change — rare by nature.
- Commits use a fixed identity (`opentracy <opentracy@local>`), independent of the user's
  git config.
- Future: `opentracy versions --diff` output is the natural input for an eval gate
  ("did v5 actually improve match rate?") once Phase 5 lands.
