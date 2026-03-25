BINARY := lunar-engine
VERSION := $(shell git describe --tags --always 2>/dev/null || echo "dev")
LDFLAGS := -ldflags "-X main.version=$(VERSION)"
GO := go

.PHONY: build test lint clean

build:
	$(GO) build $(LDFLAGS) -o bin/$(BINARY) ./cmd/lunar-engine

test:
	$(GO) test ./... -v -count=1

lint:
	$(GO) vet ./...

clean:
	rm -rf bin/

.DEFAULT_GOAL := build
