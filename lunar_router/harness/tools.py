"""ToolKit — all tools available to harness agents.

Each tool is an async callable that returns a dict.
Agents can request tool calls; the runner executes them and feeds results back.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

logger = logging.getLogger(__name__)


class ToolKit:
    """Full tool stack available to harness agents."""

    def __init__(self):
        self.tools: dict[str, Any] = {
            "query_traces": self.query_traces,
            "query_summary": self.query_summary,
            "embed_texts": self.embed_texts,
            "cluster_texts": self.cluster_texts,
            "read_secrets": self.read_secrets,
            "list_datasets": self.list_datasets,
            "list_models": self.list_models,
        }

    def get(self, name: str):
        return self.tools.get(name)

    def available(self) -> list[dict[str, str]]:
        """Return tool descriptions for the LLM."""
        descriptions = {
            "query_traces": "Query recent LLM traces from ClickHouse. Args: days (int), model (str), limit (int)",
            "query_summary": "Get aggregated stats from ClickHouse. Args: days (int)",
            "embed_texts": "Generate MiniLM embeddings for a list of texts. Args: texts (list[str])",
            "cluster_texts": "KMeans cluster a list of texts. Args: texts (list[str]), k (int)",
            "read_secrets": "List configured API key providers. No args.",
            "list_datasets": "List domain datasets from clustering. Args: status (str, optional)",
            "list_models": "List available LLM models from the Go engine. No args.",
        }
        return [{"name": k, "description": v} for k, v in descriptions.items()]

    async def query_traces(self, days: int = 7, model: str = "", limit: int = 50) -> dict:
        from ..storage.clickhouse_client import query_traces, get_client
        if get_client() is None:
            return {"error": "ClickHouse not available", "traces": []}
        start = datetime.now(timezone.utc) - timedelta(days=days)
        traces = query_traces(model=model or None, start=start, limit=limit)
        return {"traces": traces, "count": len(traces)}

    async def query_summary(self, days: int = 7) -> dict:
        from ..storage.clickhouse_client import query_summary, get_client
        if get_client() is None:
            return {"error": "ClickHouse not available"}
        start = datetime.now(timezone.utc) - timedelta(days=days)
        return query_summary(start=start)

    async def embed_texts(self, texts: list[str]) -> dict:
        from ..core.embeddings import PromptEmbedder, SentenceTransformerProvider
        provider = SentenceTransformerProvider(model_name="all-MiniLM-L6-v2")
        embedder = PromptEmbedder(provider, cache_enabled=True)
        embeddings = embedder.embed_batch(texts)
        return {"count": len(texts), "dimension": embeddings.shape[1] if len(embeddings) > 0 else 0}

    async def cluster_texts(self, texts: list[str], k: int = 5) -> dict:
        from ..core.embeddings import PromptEmbedder, SentenceTransformerProvider
        from sklearn.cluster import KMeans
        import numpy as np

        provider = SentenceTransformerProvider(model_name="all-MiniLM-L6-v2")
        embedder = PromptEmbedder(provider, cache_enabled=True)
        embeddings = embedder.embed_batch(texts)

        k = min(k, len(texts))
        km = KMeans(n_clusters=k, n_init=10, random_state=42)
        labels = km.fit_predict(embeddings)

        clusters: dict[int, list[str]] = {}
        for i, label in enumerate(labels):
            clusters.setdefault(int(label), []).append(texts[i][:100])

        return {"k": k, "clusters": {str(k): v for k, v in clusters.items()}}

    async def read_secrets(self) -> dict:
        from ..storage.secrets import list_configured_providers
        return {"configured_providers": list_configured_providers()}

    async def list_datasets(self, status: str = "") -> dict:
        from ..storage.clickhouse_client import get_client
        client = get_client()
        if client is None:
            return {"datasets": []}
        r = client.query("SELECT run_id, cluster_id, status, domain_label, trace_count FROM cluster_datasets ORDER BY trace_count DESC LIMIT 50")
        return {"datasets": [dict(zip(r.column_names, row)) for row in r.result_rows]}

    async def list_models(self) -> dict:
        import httpx
        try:
            r = httpx.get("http://localhost:8080/v1/models", timeout=5.0)
            return r.json()
        except Exception:
            return {"models": []}
