# Agents: the template + catalog model

OpenTracy serves each agent from its own directory. There is **one committed
template** that seeds **every** agent, and a runtime catalog that holds the live
agents. There is no global `agent/` slot — `agents/<id>/` is the sole live
surface.

## The committed template — `templates/agent/`

`templates/agent/` is the single, version-controlled source of truth for an
agent's structure. It is clean (no secrets, no operator state) and is the only
agent directory tracked in git.

| File | What it is |
|---|---|
| `agent.yaml` | Agent metadata + version. The root the runtime compiles. |
| `pipeline/route.yaml` | Model routing knobs (`small`, `big`, `confidence_threshold`). |
| `pipeline/retrieve.yaml` | RAG retrieval stage config. |
| `pipeline/rerank.yaml` | Rerank stage config. |
| `pipeline/generate.yaml` | Generation stage — points at `prompts/system.md`. |
| `pipeline/memory.yaml` | Conversation-memory stage config. |
| `prompts/system.md` | The system prompt — part of the trainable surface. |
| `mcp.json` | MCP server config. Clean default (`{"servers": []}`). |
| `improvement.yaml` | Self-improvement brain config (enabled, transport, model, cadence). |
| `README.md` | Per-agent notes. |

## Fresh checkout → `agents/_default`

On first boot the runtime calls `ensure_bootstrapped()`, which (when
`agents/registry.json` is missing) copies `templates/agent/` into
`agents/_default/`, writes `agents/registry.json` with `_default` as the active
agent, and partitions any pre-existing flat `ledger/` and `traces/` storage
under `_default/`. It is idempotent — once the registry exists, boot is a no-op.

The `agents/` catalog is operator state and is **gitignored**.

## Creating an agent — `create_agent`

`create_agent(payload, seed_from=None)`:

1. **Seed.** With no `seed_from`, the new dir is copied from `templates/agent/`.
   `seed_from=<id>` is an explicit opt-in to branch another agent's tuning.
2. **Strip inherited state.** `_strip_inherited_state` removes anything a seed
   source may carry that a new agent must not inherit — `secrets.env`,
   `secrets.enc.json`, `onboarding_session.json`, `integrations/`, `workspace/` —
   and resets `mcp.json` / `improvement.yaml` to the template defaults. So a new
   agent always starts isolated.
3. **Apply the payload.** The operator's prompt is written to
   `prompts/system.md` and the chosen model is propagated into
   `pipeline/route.yaml` (`knobs.small`). The onboarding payload is saved to
   `onboarding.json`.

## Predefined presets (frontend)

The "starter templates" in the New Agent modal (Customer support, SDR / sales,
Research, Internal helpdesk, Blank) are **frontend presets** defined in
`ui/src/components/NewAgentModal.tsx` (`TEMPLATES`). Each preset is just a
prompt + model + default channels + label. The backend has no per-preset
directory: `create_agent` seeds the shared structure from `templates/agent/`,
then applies the preset's prompt + model from the payload. The chosen preset id
is recorded on the agent's metadata (`template`).

## Per-agent live layout — `agents/<id>/`

A live agent dir holds the template structure plus per-agent runtime state:

```
agents/<id>/
  agent.yaml  pipeline/*.yaml  prompts/system.md  README.md
  mcp.json  improvement.yaml
  secrets.env | secrets.enc.json      # provider keys (operator state)
  integrations/                       # connected channels (Slack/web/API)
  onboarding.json  onboarding_session.json
  workspace/.opentracy/               # per-agent scratch
```

`agents/<id>/` is the **sole live surface**. Activation (`activate(id)`) only
flips the registry's `active` pointer — nothing is copied. Reads and writes
(prompt/route edits, promotions, rollbacks, traces, lessons, versions) resolve
the active agent at call time via `live_agent_dir()` /
`ledger.versioning.resolve_live_dir()` and partition under that agent. The
compiled pipeline is cached per agent (`runtime/executor/cache.py`) and
invalidated on every catalog mutation so the next request serves the new
surface without a re-activate.

## Multi-tenant

Under `OPENTRACY_MULTI_TENANT=1`, the catalog routes through
`tenants/<tenant>/agents/`; the template still seeds new agents. OSS (single
tenant) uses the top-level `agents/` path.
