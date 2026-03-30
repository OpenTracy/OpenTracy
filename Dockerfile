# ============================================================================
# Lunar Router — Python API server
# ============================================================================
# Usage:
#   docker build -t lunar-api .
#   docker run -p 8000:8000 lunar-api
# ============================================================================

FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies first (cache layer)
COPY pyproject.toml ./
RUN pip install --no-cache-dir -e ".[api,clickhouse]" 2>/dev/null || \
    pip install --no-cache-dir fastapi uvicorn pydantic clickhouse-connect numpy tqdm

# Copy source
COPY lunar_router/ lunar_router/
COPY pyproject.toml ./
RUN pip install --no-cache-dir -e ".[api,clickhouse]"

EXPOSE 8000

CMD ["uvicorn", "lunar_router.api.server:app", "--host", "0.0.0.0", "--port", "8000"]
