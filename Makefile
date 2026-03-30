# ============================================================================
# Lunar Router — Developer Makefile
# ============================================================================
#
#   make start          ← fastest way to get running (build + launch gateway)
#   make start-full     ← full stack with ClickHouse analytics
#   make test           ← run all tests
#
# Prerequisites:
#   - Go 1.22+         (for engine build)
#   - Python 3.10+     (for SDK / API)
#   - Docker            (optional, for ClickHouse analytics)
# ============================================================================

.PHONY: help install build start start-full stop \
        dev dev-go dev-python dev-ui \
        test test-go test-python test-clickhouse \
        lint lint-go lint-python clean

help: ## Show this help
	@echo ""
	@echo "  \033[1mQuick start:\033[0m"
	@echo "    make start          Build + run engine (gateway mode, no weights needed)"
	@echo "    make start-full     Build + run full stack via Docker"
	@echo ""
	@echo "  \033[1mAll commands:\033[0m"
	@grep -E '^[a-zA-Z_-]+:.*##' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*## "}; {printf "    \033[36m%-20s\033[0m %s\n", $$1, $$2}'
	@echo ""

# ---------------------------------------------------------------------------
# One-command start
# ---------------------------------------------------------------------------

start: build ## Build + run engine in gateway mode (proxy to all providers, no weights needed)
	@echo ""
	@echo "  \033[32m✓ Engine ready at http://localhost:8080\033[0m"
	@echo "  \033[32m✓ Use provider/model syntax: openai/gpt-4o-mini, anthropic/claude-3-5-sonnet, etc.\033[0m"
	@echo ""
	@echo "  Python SDK:  import lunar_router as lr"
	@echo "               lr.completion(model='openai/gpt-4o-mini', messages=[...])"
	@echo ""
	@echo "  OpenAI SDK:  OpenAI(base_url='http://localhost:8080/v1', api_key='any')"
	@echo ""
	./go/bin/lunar-engine --gateway

start-full: build ## Build + run full stack with ClickHouse analytics via Docker
	docker compose up clickhouse -d
	@echo "Waiting for ClickHouse..."
	@until docker compose exec -T clickhouse clickhouse-client --password lunar -q "SELECT 1" > /dev/null 2>&1; do sleep 1; done
	@echo ""
	@echo "  \033[32m✓ ClickHouse ready at localhost:8123\033[0m"
	@echo "  \033[32m✓ Engine ready at http://localhost:8080\033[0m"
	@echo ""
	LUNAR_CH_ENABLED=true \
	LUNAR_CH_HOST=localhost \
	LUNAR_CH_PASSWORD=lunar \
	LUNAR_CH_DATABASE=lunar_router \
	./go/bin/lunar-engine --gateway

start-router: build ## Build + run engine with semantic routing (requires weights)
	@WEIGHTS_PATH="$$(lunar-router path weights-mmlu-v1 2>/dev/null || echo ./weights)"; \
	echo "Loading weights from: $$WEIGHTS_PATH"; \
	LUNAR_CH_ENABLED=true \
	LUNAR_CH_HOST=localhost \
	LUNAR_CH_PASSWORD=lunar \
	LUNAR_CH_DATABASE=lunar_router \
	./go/bin/lunar-engine --weights "$$WEIGHTS_PATH" --no-embedder

stop: ## Stop all running services
	-docker compose down 2>/dev/null
	@echo "Stopped."

# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------

install: ## Install Python SDK + Go deps
	pip install -e ".[openai,anthropic,api]"
	cd go && go mod download

install-all: ## Install everything (Python dev deps + Go + UI)
	pip install -e ".[dev]"
	cd go && go mod download
	@if [ -d ui ]; then cd ui && npm install; fi

download-weights: ## Download pre-trained routing weights from HuggingFace
	lunar-router download weights-mmlu-v1

# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------

build: ## Build the Go engine binary → go/bin/lunar-engine
	@cd go && go build -ldflags "-X main.version=$$(git describe --tags --always 2>/dev/null || echo dev)" \
		-o bin/lunar-engine ./cmd/lunar-engine
	@echo "  \033[32m✓ Built go/bin/lunar-engine\033[0m"

build-docker: ## Build all Docker images
	docker compose build

# ---------------------------------------------------------------------------
# Development (individual services)
# ---------------------------------------------------------------------------

dev: ## Start full stack via Docker Compose
	docker compose up --build

dev-go: build ## Run Go engine locally (with weights + ClickHouse)
	LUNAR_CH_ENABLED=true \
	LUNAR_CH_HOST=localhost \
	LUNAR_CH_PASSWORD=lunar \
	LUNAR_CH_DATABASE=lunar_router \
	./go/bin/lunar-engine \
		--weights "$$(lunar-router path weights-mmlu-v1 2>/dev/null || echo ./weights)" \
		--no-embedder

dev-python: ## Run Python API server locally
	uvicorn lunar_router.api.server:app --reload --host 0.0.0.0 --port 8000

dev-ui: ## Run UI dev server
	cd ui && npm run dev -- --port 3000

# ---------------------------------------------------------------------------
# Test
# ---------------------------------------------------------------------------

test: test-go test-python ## Run all tests

test-go: ## Run Go tests
	cd go && go test ./... -count=1

test-python: ## Run Python tests
	pytest tests/ -v

test-clickhouse: ## Run ClickHouse integration tests
	cd go && LUNAR_CH_ENABLED=true LUNAR_CH_PASSWORD=lunar \
		go test -v -run TestIntegration ./internal/clickhouse/

# ---------------------------------------------------------------------------
# Lint
# ---------------------------------------------------------------------------

lint: lint-go lint-python ## Lint all code

lint-go: ## Lint Go code
	cd go && go vet ./...

lint-python: ## Lint Python code
	ruff check lunar_router/ tests/

# ---------------------------------------------------------------------------
# ClickHouse
# ---------------------------------------------------------------------------

clickhouse-up: ## Start ClickHouse container
	docker compose up clickhouse -d

clickhouse-down: ## Stop ClickHouse container
	docker compose down clickhouse

clickhouse-shell: ## Open ClickHouse SQL shell
	docker compose exec clickhouse clickhouse-client --database lunar_router --password lunar

# ---------------------------------------------------------------------------
# Cleanup
# ---------------------------------------------------------------------------

clean: ## Remove build artifacts
	rm -rf go/bin/
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -name "*.egg-info" -exec rm -rf {} + 2>/dev/null || true

down: ## Stop all Docker services and remove volumes
	docker compose down -v

.DEFAULT_GOAL := help
