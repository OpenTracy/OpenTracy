# OpenTracy

Self-improving AI agent harness. You ship a default agent; it learns from real
usage, proposes its own improvements, and routes them through evals + human
approval before they go live.

> **Status:** experimental. APIs and the agent DSL move week-to-week. Don't pin
> to a tag yet.

## What it gives you

- A trainable agent surface at `agent/` — one YAML + a handful of Python files.
  Mutated by Claude Code (driven by the harness) in response to evidence from
  real traces.
- An **autonomous engineering loop** modeled on Lin et al.'s AHE algorithm
  (arxiv 2604.25850). The harness proposes candidate edits, critiques them,
  runs evals, and applies the winners as file-level patches with cheap rollback.
  Each edit is a falsifiable change with a per-change KEEP / IMPROVE /
  ROLLBACK_AND_PIVOT verdict, inline semantic verification of rollout responses,
  optional best-of-N exploration, and a long-term memory tier.
- A typed runtime that compiles `agent/` into an executable pipeline and serves
  requests over HTTP, MCP, **Slack** (Socket Mode — no public URL needed), an
  **opt-in WhatsApp** channel (see [docs/channels/whatsapp.md](docs/channels/whatsapp.md)),
  and an embeddable web widget. Every trace records the channel it came from.
- A guided onboarding that names the agent with a short, stable id, and a trace
  view that renders agent messages as Markdown.
- An eval suite with goldens, regression detection, and per-trace attribution
  so you can see *why* a proposed change is better (or worse).

## Quick start

### Requirements

- **Python 3.11+** and [**uv**](https://docs.astral.sh/uv/)
- **Node 20+** (ships `npm`)
- An **Anthropic API key**

### Setup

```bash
git clone https://github.com/OpenTracy/OpenTracy
cd OpenTracy
cp .env.example .env     # then set ANTHROPIC_API_KEY
make install             # Python (uv) + backend + UI dependencies
```

`make install` runs `uv sync --extra rag` (the default agent's retrieval stage
needs it) and `npm install` in `backend/` and `ui/`. For tests/linting use
`make install-dev`.

### Run

Start everything in the background:

```bash
make up      # runtime :8001, backend :8002, ui :5174 — logs in .run/
make down    # stop all three
```

…or run each in its own terminal:

```bash
make runtime    # runtime API   → http://localhost:8001
make backend    # gateway       → http://localhost:8002
make ui         # web UI        → http://localhost:5174
```

Then open <http://localhost:5174>. The shell boots straight to Evolution — no
login, no signup. OSS runs single-tenant on localhost by design.

> Prefer raw commands? `make help` lists every target; each just wraps the
> obvious `uv run` / `npm run` invocation.

### Configuration

- **`ANTHROPIC_API_KEY`** is the only required variable. See
  [`.env.example`](.env.example) for the rest.
- **Ports** default to `8001` (runtime), `8002` (backend), `5174` (UI). Override
  them in `.env` with `OPENTRACY_RUNTIME_PORT` / `OPENTRACY_BACKEND_PORT` /
  `OPENTRACY_UI_PORT`; `make` wires the services together accordingly.
- **WhatsApp** is **off by default**. To enable it, install the optional
  dependency (`cd backend && npm install baileys`) and run the gateway with the
  flag:

  ```bash
  make backend WHATSAPP=1      # sets OPENTRACY_ENABLE_BAILEYS=1
  ```

  Baileys is GPLv3 and an unofficial WhatsApp Web client — read
  [docs/channels/whatsapp.md](docs/channels/whatsapp.md) before enabling.
- **ClickHouse** is optional. The `.env.example` enables it; set
  `OPENTRACY_CH_ENABLED=false` to use the local store instead.

## Architecture

| Directory | Role |
|---|---|
| `agent/` | The trainable surface. YAML + Python. Mutated by the harness. |
| `techniques/` | Catalog of layer types (RAG, reranking, routing). Read-only. |
| `runtime/` | Compiles `agent/` into a pipeline and serves requests. |
| `evals/` | The loss function. Goldens, suites, runners, attribution. |
| `experiments/` | Candidate configs + results. The training workspace. |
| `harness/` | The optimizer: proposer, critics, approver, executor, rollback. |
| `ml/` | Models trained on accumulated data. |
| `ledger/` | Append-only audit trail. |
| `traces/` | Runtime accumulator (conversations, labels, pins). |
| `corpora/` | Knowledge accumulator (RAG content with usage stats). |
| `policies/` | Human-set rules for the harness. |
| `backend/` | Request-serving layer (API, channels). |
| `connectors/` | Outbound integrations. |
| `ui/` | Frontend (React + Vite + TS). |

The loop:

```
traces/  →  evals/  →  harness/proposer/  →  harness/critics/
                              ↓
                     harness/synthesizer/  ↔  experiments/candidates/
                              ↓                     (iterate)
                     harness/approver/   →   agent/ (live)   →   traces/
```

The harness mutates `agent/`, appends to `traces/` and `ledger/` via API, and
ingests into `corpora/`. Everything else is framework. See
`config/claude_code.yaml` for the authoritative allowlist.

Languages: Python (`harness/`, `runtime/`, `evals/`, `ml/`, `techniques/`),
TypeScript (`backend/`, `ui/`).

## Distribution modes

| Mode | When | What's different |
|---|---|---|
| **OSS local** *(default)* | Clone, run for yourself or a single team. | Single-tenant. No login. Everything at the project root. |
| **Hosted/multi-tenant** | A managed deploy serving multiple orgs. Enable via `OPENTRACY_MULTI_TENANT=1`. | Per-tenant namespacing under `tenants/<id>/…`, Firebase-backed login, per-tenant Bearer tokens, KMS-encrypted BYOK keys. Requires the private `opentracy-infra` sibling repo. |

Hosted-only code is gated behind the env flag and adds zero overhead when off.

## Configuration

See [`.env.example`](.env.example) for the full list. The minimum to get
running is `ANTHROPIC_API_KEY`.

## Contributing

PRs welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT — see [LICENSE](LICENSE).
