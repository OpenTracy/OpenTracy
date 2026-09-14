# tools/ — foundation 1: User Tools (content plane)

Each tool is a directory holding a `manifest.yaml` (name, description, input/output
JSON Schema, handler ref, permissions) and its handler code. Packs group related tools:

- `core/` — built-ins: file read/write, http fetch (reference implementations)
- `sharpi/` — domain pack: match lookup, perception queries, dataset/correction tools

Dropping a new pack directory here registers its tools — no runtime changes.
Contract spec: `docs/adr/` (Phase 0).
