# src/opentracy — the runtime

Thin, foundation-agnostic engine. Domain value never lands here — it goes in the
top-level content dirs (`tools/`, `skills/`, `memory/`).

- `core/` — session lifecycle, context assembly, the agentic loop, trace events
- `tools/` — foundation 1 engine: pack discovery, manifest validation, schema-checked dispatch
- `skills/` — foundation 2 engine: SKILL.md loader, lightweight index, activation
- `memory/` — foundation 3 engine: entry store, MEMORY.md index, recall, write policies
- `providers/` — LLM adapters (Anthropic first) and model configuration
