#
# OpenTracy Makefile
#
# Run `make` or `make help` to see available targets.
#
# Ports are loaded from .env when available:
#   OPENTRACY_RUNTIME_PORT   (default 8001)
#   OPENTRACY_BACKEND_PORT   (default 8002)
#   OPENTRACY_UI_PORT        (default 5174)
#
# Enable WhatsApp support:
#   make backend WHATSAPP=1
#   make up WHATSAPP=1

.DEFAULT_GOAL := help

.PHONY: \
    help \
    install install-dev \
    runtime backend ui \
    up down \
    test typecheck build

RUNTIME_PORT := $(or $(shell sed -nE 's/^OPENTRACY_RUNTIME_PORT=([0-9]+).*/\1/p' .env 2>/dev/null | tail -1),8001)
BACKEND_PORT := $(or $(shell sed -nE 's/^OPENTRACY_BACKEND_PORT=([0-9]+).*/\1/p' .env 2>/dev/null | tail -1),8002)
UI_PORT      := $(or $(shell sed -nE 's/^OPENTRACY_UI_PORT=([0-9]+).*/\1/p' .env 2>/dev/null | tail -1),5174)

RUNTIME_URL := http://127.0.0.1:$(RUNTIME_PORT)

BACKEND_DIR := backend
UI_DIR      := ui
RUN_DIR     := .run

WHATSAPP ?= 0

ifeq ($(filter 1 true yes on,$(WHATSAPP)),)
    BAILEYS_ENV :=
else
    BAILEYS_ENV := OPENTRACY_ENABLE_BAILEYS=1
endif

RUNTIME_ENV := OPENTRACY_RUNTIME_PORT=$(RUNTIME_PORT)

BACKEND_ENV := \
    PORT=$(BACKEND_PORT) \
    RUNTIME_URL=$(RUNTIME_URL) \
    $(BAILEYS_ENV)

UI_ENV := \
    OPENTRACY_UI_PORT=$(UI_PORT) \
    OPENTRACY_BACKEND_PORT=$(BACKEND_PORT)


help:
	@echo "OpenTracy targets:"
	@echo ""
	@echo "  install       Install runtime, backend and UI dependencies"
	@echo "  install-dev   Install dependencies + dev tooling (pytest/ruff)"
	@echo ""
	@echo "  runtime       Start runtime   (http://localhost:$(RUNTIME_PORT))"
	@echo "  backend       Start backend   (http://localhost:$(BACKEND_PORT))"
	@echo "  ui            Start UI        (http://localhost:$(UI_PORT))"
	@echo ""
	@echo "  up            Start all services in the background (logs in $(RUN_DIR)/)"
	@echo "  down          Stop all services"
	@echo ""
	@echo "  test          Run the Python test suite"
	@echo "  typecheck     Type-check the harness with mypy"
	@echo "  build         Typecheck and build backend + UI"
	@echo ""
	@echo "Optional:"
	@echo "  WHATSAPP=1    Enable the WhatsApp channel"

install:
	uv sync --extra rag
	cd $(BACKEND_DIR) && npm install
	cd $(UI_DIR) && npm install

install-dev:
	uv sync --extra rag --extra dev
	cd $(BACKEND_DIR) && npm install
	cd $(UI_DIR) && npm install

runtime:
	$(RUNTIME_ENV) uv run python -m runtime.server

backend:
	cd $(BACKEND_DIR) && $(BACKEND_ENV) npm run dev

ui:
	cd $(UI_DIR) && $(UI_ENV) npm run dev


up:
	@mkdir -p $(RUN_DIR)
	@echo "Starting services..."
	@$(RUNTIME_ENV) nohup uv run python -m runtime.server > $(RUN_DIR)/runtime.log 2>&1 &
	@(cd $(BACKEND_DIR) && $(BACKEND_ENV) nohup npm run dev > ../$(RUN_DIR)/backend.log 2>&1 &)
	@(cd $(UI_DIR) && $(UI_ENV) nohup npm run dev > ../$(RUN_DIR)/ui.log 2>&1 &)
	@echo ""
	@echo "  Runtime : http://localhost:$(RUNTIME_PORT)"
	@echo "  Backend : http://localhost:$(BACKEND_PORT)"
	@echo "  UI      : http://localhost:$(UI_PORT)"

down:
	@echo "Stopping services..."
	@-for sp in "Runtime:$(RUNTIME_PORT)" "Backend:$(BACKEND_PORT)" "UI:$(UI_PORT)"; do \
	    svc=$${sp%%:*}; port=$${sp##*:}; \
	    pids="$$(lsof -ti tcp:$$port 2>/dev/null)"; \
	    if [ -z "$$pids" ]; then pids="$$(fuser $$port/tcp 2>/dev/null)"; fi; \
	    if [ -n "$$pids" ]; then kill $$pids 2>/dev/null; state=stopped; else state="not running"; fi; \
	    printf "  %-8s http://localhost:%s  (%s)\n" "$$svc" "$$port" "$$state"; \
	done
	@rm -rf $(RUN_DIR)


test:
	uv run --extra dev --extra rag pytest runtime techniques

typecheck:
	uv run --extra dev --extra rag mypy harness experiments evals

build:
	cd $(BACKEND_DIR) && npm run typecheck
	cd $(UI_DIR) && npm run build
