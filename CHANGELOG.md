# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased] — Rebrand: `lunar_router` → `opentracy`

### Changed

- **Package renamed** from `lunar-router` to `opentracy` on PyPI. Python
  import root is now `opentracy` (`import opentracy as ot`).
- **CLI entrypoint** renamed from `lunar-router` to `opentracy`.
- **Go binary** renamed from `lunar-engine` to `opentracy-engine`. Module path
  moved to `github.com/OpenTracy/opentracy/go`.
- **Environment variables** migrated to the `OPENTRACY_*` prefix (e.g.
  `OPENTRACY_ENGINE_URL`, `OPENTRACY_CH_DATABASE`). Legacy `LUNAR_*` vars are
  still read with a one-time `DeprecationWarning` — existing `.env` files keep
  working without changes.
- **ClickHouse database** default renamed from `lunar_router` to `opentracy`.
- **Secrets directory** moved from `~/.lunar/` to `~/.opentracy/`. The CLI
  auto-copies the directory on first run if the new path does not yet exist.
- **Docker services** renamed: `lunar-engine` → `opentracy-engine`,
  `lunar-api` → `opentracy-api`, `lunar-ui` → `opentracy-ui`.
- **HTTP headers** on the engine: `X-Lunar-*` → `X-OpenTracy-*` (the Python
  SDK and Go engine are shipped together in the wheel, so clients never see
  mixed versions).
- **MCP tool names**: `lunar_route` / `lunar_generate` / `lunar_smart_generate`
  / `lunar_list_models` / `lunar_compare` → `opentracy_*` equivalents.

### Added

- **Backwards-compat shim**: installing `opentracy` also installs a tiny
  `lunar_router` package whose `__init__.py` emits a `DeprecationWarning`
  and transparently redirects all `lunar_router.*` imports to `opentracy.*`
  via a `MetaPathFinder`. User code still doing `import lunar_router` keeps
  working unchanged.
- `opentracy._env.env()` helper: reads `OPENTRACY_<NAME>` first, falls back
  to `LUNAR_<NAME>` with a deprecation warning. Go equivalent lives at
  `internal/envfallback.Get()`.

### Migration notes

- **ClickHouse data**: existing deployments have live data in a `lunar_router`
  database. The included `clickhouse/init.sql` now creates *both* `opentracy`
  and `lunar_router` on first start so old data is not lost. Rename tables
  explicitly when ready: `RENAME TABLE lunar_router.<tbl> TO opentracy.<tbl>`.
- **PyPI name**: first release under the new name must reserve `opentracy` on
  PyPI. Publishing a final `lunar-router` version that re-exports from
  `opentracy` is recommended to ease the transition for downstream pinning.

## [0.1.0] - 2025-01-29

### Added

- **Core routing engine** based on the UniRoute algorithm from
  [Universal Model Routing for Efficient LLM Inference](https://arxiv.org/abs/2502.08773)
- **7 LLM provider clients**: OpenAI, Anthropic, Google Gemini, Groq, Mistral, vLLM, and Mock
- **44+ pre-configured models** with pricing information
- **K-Means semantic routing**: cluster-based prompt embedding with SentenceTransformers
- **Cost-quality trade-off**: adjustable `cost_weight` parameter (0 = quality, 1 = cost)
- **Hub system**: download and manage pre-trained weights (inspired by NLTK/spaCy/HuggingFace)
  - CLI: `opentracy download`, `list`, `info`, `remove`, `path`, `verify`
  - Python API: `opentracy.download()`, `list_packages()`, `package_info()`
- **Pre-trained weights** on MMLU benchmark (`weights-mmlu-v1`) hosted on HuggingFace Hub
- **Training pipeline**: train custom routers with `KMeansTrainer` and `full_training_pipeline()`
- **OpenAI-compatible API server** with health-first routing and fallback support
- **Weights management module** (`opentracy.weights`) for downloading from HuggingFace, URL, and S3
- **State management** for persisting router configurations and profiles

### Fixed

- **Cache eviction bug**: `PromptEmbedder` cache eviction failed silently when `cache_max_size < 10`
  because `max_size // 10` evaluated to 0, causing unbounded cache growth. Now evicts at least 1 entry.

### Changed

- **Unified branding**: standardized references from "PureAI" to "OpenTracy" in documentation,
  docstrings, API titles, and comments across the codebase

[0.1.0]: https://github.com/pureai-ecosystem/opentracy/releases/tag/v0.1.0
