# ============================================================================
# OpenTracy Engine — multi-stage Docker build
# ============================================================================
# Usage:
#   docker build -t opentracy-engine ./go
#   docker run -p 8080:8080 opentracy-engine --weights /weights --no-embedder
# ============================================================================

# --- Stage 1: Build ---
# Debian-based so the built binary is glibc — matches the debian-slim runtime
# stage below. An alpine (musl) binary fails with "no such file or directory"
# when exec'd on glibc at runtime.
FROM golang:1-bookworm AS builder

RUN apt-get update && apt-get install -y --no-install-recommends git gcc \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=1 GOOS=linux go build \
    -ldflags "-s -w -X main.version=$(git describe --tags --always 2>/dev/null || echo docker)" \
    -o /opentracy-engine ./cmd/opentracy-engine

# --- Stage 2: Bootstrap weights ---
# Downloads and assembles /weights/bootstrap so `docker compose up` works
# out-of-the-box without a pre-populated host volume. Requires network at
# build time (docker build --network=host or default bridge).
#
# Assets fetched here:
#   • clusters/ + profiles/  — diogovieira/lunar-router-weights (HuggingFace)
#   • onnx/model.onnx        — sentence-transformers/all-MiniLM-L6-v2 (HuggingFace)
#   • onnx/vocab.txt         — sentence-transformers/all-MiniLM-L6-v2 (HuggingFace)
#   • libonnxruntime.so.1.24.1 — microsoft/onnxruntime v1.24.1 (GitHub Releases)
#     (version must match yalue/onnxruntime_go wrapper used by this module)
#     URL varies by CPU architecture (amd64 → x64, arm64 → aarch64).
FROM debian:bookworm-slim AS bootstrap-weights

# TARGETARCH is injected automatically by `docker build` / `docker buildx`.
# Values: amd64 | arm64 | arm/v7 | ...
ARG TARGETARCH

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates wget unzip \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /bootstrap

# 1. Cluster centroids + model profiles from HuggingFace
RUN wget -q "https://huggingface.co/diogovieira/lunar-router-weights/resolve/main/weights-mmlu-v1.zip" \
    -O weights.zip \
    && unzip -q weights.zip \
    && rm weights.zip \
    && SUBDIR=$(find . -maxdepth 1 -mindepth 1 -type d | head -1) \
    && if [ -n "$SUBDIR" ]; then mv "$SUBDIR"/* . && rmdir "$SUBDIR"; fi

# 2. MiniLM-L6-v2 ONNX model + vocabulary
RUN mkdir -p onnx \
    && wget -q "https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2/resolve/main/vocab.txt" \
    -O onnx/vocab.txt \
    && wget -q "https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2/resolve/main/onnx/model.onnx" \
    -O onnx/model.onnx

# 3. ONNX Runtime shared library (v1.24.1 — must match yalue/onnxruntime_go)
#    Map Docker's TARGETARCH to the ONNX Runtime release naming convention:
#      amd64  → x64
#      arm64  → aarch64
RUN ARCH=$([ "$TARGETARCH" = "arm64" ] && echo "aarch64" || echo "x64") \
    && wget -q "https://github.com/microsoft/onnxruntime/releases/download/v1.24.1/onnxruntime-linux-${ARCH}-1.24.1.tgz" \
    -O ort.tgz \
    && tar xf ort.tgz \
    && rm ort.tgz \
    && cp onnxruntime-linux-${ARCH}-1.24.1/lib/libonnxruntime.so.1.24.1 . \
    && rm -rf onnxruntime-linux-${ARCH}-1.24.1

# --- Stage 3: Runtime ---
# glibc-based so we can dlopen the official onnxruntime binary (needed for
# MiniLM embeddings / semantic routing). Alpine/musl is incompatible with
# upstream libonnxruntime.so — _chk symbols aren't exported even via gcompat.
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates libstdc++6 wget \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /opentracy-engine /usr/local/bin/opentracy-engine

# Bootstrap weights baked into the image at build time.
# Contains: clusters/, profiles/, onnx/model.onnx, onnx/vocab.txt,
#           libonnxruntime.so.1.24.1
COPY --from=bootstrap-weights /bootstrap /weights/bootstrap

EXPOSE 8080

ENTRYPOINT ["opentracy-engine"]
# Default: gateway mode (no weights needed). Override with --weights /weights for semantic routing.
CMD ["--gateway", "--host", "0.0.0.0", "--port", "8080"]
