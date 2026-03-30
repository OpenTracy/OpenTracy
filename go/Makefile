BINARY := lunar-engine
VERSION := $(shell git describe --tags --always 2>/dev/null || echo "dev")
LDFLAGS := -ldflags "-X main.version=$(VERSION)"
GO := go

.PHONY: build test test-clickhouse lint clean run docker

build:
	$(GO) build $(LDFLAGS) -o bin/$(BINARY) ./cmd/lunar-engine

test:
	$(GO) test ./... -v -count=1

test-clickhouse: ## Run ClickHouse integration tests
	LUNAR_CH_ENABLED=true LUNAR_CH_PASSWORD=lunar \
		$(GO) test -v -run TestIntegration ./internal/clickhouse/

lint:
	$(GO) vet ./...

run: build ## Run engine locally with ClickHouse
	LUNAR_CH_ENABLED=true \
	LUNAR_CH_HOST=localhost \
	LUNAR_CH_PASSWORD=lunar \
	LUNAR_CH_DATABASE=lunar_router \
	./bin/$(BINARY) $(ARGS)

gateway: build ## Run as gateway only (no weights needed, proxy to providers)
	LUNAR_CH_ENABLED=true \
	LUNAR_CH_HOST=localhost \
	LUNAR_CH_PASSWORD=lunar \
	LUNAR_CH_DATABASE=lunar_router \
	./bin/$(BINARY) --gateway $(ARGS)

docker: ## Build Docker image
	docker build -t lunar-engine .

clean:
	rm -rf bin/

.DEFAULT_GOAL := build
