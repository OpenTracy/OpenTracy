BINARY := opentracy-engine
VERSION := $(shell git describe --tags --always 2>/dev/null || echo "dev")
LDFLAGS := -ldflags "-X main.version=$(VERSION)"
GO := go

.PHONY: build test test-clickhouse lint clean run docker

build:
	$(GO) build $(LDFLAGS) -o bin/$(BINARY) ./cmd/opentracy-engine

test:
	$(GO) test ./... -v -count=1

test-clickhouse: ## Run ClickHouse integration tests
	OPENTRACY_CH_ENABLED=true OPENTRACY_CH_PASSWORD=opentracy \
		$(GO) test -v -run TestIntegration ./internal/clickhouse/

lint:
	$(GO) vet ./...

run: build ## Run engine locally with ClickHouse
	OPENTRACY_CH_ENABLED=true \
	OPENTRACY_CH_HOST=localhost \
	OPENTRACY_CH_PASSWORD=opentracy \
	OPENTRACY_CH_DATABASE=opentracy \
	./bin/$(BINARY) $(ARGS)

gateway: build ## Run as gateway only (no weights needed, proxy to providers)
	OPENTRACY_CH_ENABLED=true \
	OPENTRACY_CH_HOST=localhost \
	OPENTRACY_CH_PASSWORD=opentracy \
	OPENTRACY_CH_DATABASE=opentracy \
	./bin/$(BINARY) --gateway $(ARGS)

docker: ## Build Docker image
	docker build -t opentracy-engine .

clean:
	rm -rf bin/

.DEFAULT_GOAL := build
