# OpenTracy — common dev tasks. Run `make` (or `make help`) to list targets.
#
# Run the three services in separate terminals:
#   make runtime    # http://localhost:8001
#   make backend    # http://localhost:8002   (WHATSAPP=1 to enable WhatsApp)
#   make ui         # http://localhost:5174

# WhatsApp (Baileys) is opt-in. `make backend WHATSAPP=1` enables it.
WHATSAPP ?= 0
ifeq ($(filter 1 true yes on,$(WHATSAPP)),)
  BAILEYS_ENV :=
else
  BAILEYS_ENV := OPENTRACY_ENABLE_BAILEYS=1
endif

.DEFAULT_GOAL := help
.PHONY: help install install-dev runtime backend ui test build

help:
	@echo "OpenTracy targets:"
	@echo "  make install       Install Python + backend + UI dependencies"
	@echo "  make install-dev   ... also pytest/ruff for development"
	@echo "  make runtime       Run the runtime         (http://localhost:8001)"
	@echo "  make backend       Run the gateway         (http://localhost:8002)"
	@echo "                     add WHATSAPP=1 to enable the WhatsApp channel"
	@echo "  make ui            Run the web UI          (http://localhost:5174)"
	@echo "  make test          Run the Python test suite"
	@echo "  make build         Typecheck/build backend + UI"
	@echo ""
	@echo "Run runtime, backend, and ui in three separate terminals."

install:
	uv sync --extra rag
	cd backend && npm install
	cd ui && npm install

install-dev:
	uv sync --extra rag --extra dev
	cd backend && npm install
	cd ui && npm install

runtime:
	uv run python -m runtime

backend:
	cd backend && $(BAILEYS_ENV) npm run dev

ui:
	cd ui && npm run dev

test:
	uv run --extra dev --extra rag pytest runtime techniques

build:
	cd backend && npm run typecheck
	cd ui && npm run build
