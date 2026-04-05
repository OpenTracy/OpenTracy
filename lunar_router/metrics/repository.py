"""
Metrics Repository — ClickHouse

CRUD for eval_metrics table. Supports builtin and custom tenant metrics.
"""
from __future__ import annotations

import json
import logging
import uuid
from typing import Any, Optional

from ..evals_common.db import (
    ch, insert_row, insert_rows, now_utc, parse_json_field, query_one, query_rows,
)

logger = logging.getLogger(__name__)

_JSON_FIELDS = ("config", "requirements")

# Tenant ID for builtin metrics
BUILTIN_TENANT = "__builtin__"


def _deserialize(row: dict[str, Any]) -> dict[str, Any]:
    for f in _JSON_FIELDS:
        row[f] = parse_json_field(row, f)
    row["is_builtin"] = bool(row.get("is_builtin", 0))
    return row



def create(tenant_id: str, data: dict[str, Any]) -> dict[str, Any]:
    metric_id = str(uuid.uuid4())
    now = now_utc()
    row = {
        "metric_id": metric_id,
        "tenant_id": tenant_id,
        "name": data.get("name", ""),
        "type": data.get("type", "exact_match"),
        "description": data.get("description", ""),
        "is_builtin": 0,
        "config": data.get("config", {}),
        "python_script": data.get("python_script", ""),
        "requirements": data.get("requirements", []),
        "source": data.get("source", ""),
        "created_at": now,
        "updated_at": now,
    }
    insert_row("eval_metrics", row)
    row["metric_id"] = metric_id
    row["created_at"] = now.isoformat()
    row["updated_at"] = now.isoformat()
    row["is_builtin"] = False
    return row


def get(tenant_id: str, metric_id: str) -> dict[str, Any] | None:
    """Get metric by ID — checks tenant metrics first, then builtins."""
    row = query_one(
        """
        SELECT * FROM eval_metrics FINAL
        WHERE tenant_id = {tenant_id:String}
          AND metric_id = {metric_id:String}
        """,
        {"tenant_id": tenant_id, "metric_id": metric_id},
    )
    if row:
        return _deserialize(row)
    # Try builtin
    row = query_one(
        """
        SELECT * FROM eval_metrics FINAL
        WHERE tenant_id = {tenant_id:String}
          AND metric_id = {metric_id:String}
        """,
        {"tenant_id": BUILTIN_TENANT, "metric_id": metric_id},
    )
    return _deserialize(row) if row else None


def list_all(tenant_id: str) -> list[dict[str, Any]]:
    rows = query_rows(
        """
        SELECT * FROM eval_metrics FINAL
        WHERE tenant_id IN ({tenant_id:String}, {builtin:String})
        ORDER BY is_builtin DESC, created_at DESC
        """,
        {"tenant_id": tenant_id, "builtin": BUILTIN_TENANT},
    )
    return [_deserialize(r) for r in rows]


def list_builtin() -> list[dict[str, Any]]:
    rows = query_rows(
        """
        SELECT * FROM eval_metrics FINAL
        WHERE tenant_id = {t:String}
        ORDER BY created_at
        """,
        {"t": BUILTIN_TENANT},
    )
    return [_deserialize(r) for r in rows]


def list_custom(tenant_id: str) -> list[dict[str, Any]]:
    rows = query_rows(
        """
        SELECT * FROM eval_metrics FINAL
        WHERE tenant_id = {tenant_id:String}
          AND is_builtin = 0
        ORDER BY created_at DESC
        """,
        {"tenant_id": tenant_id},
    )
    return [_deserialize(r) for r in rows]


def update(tenant_id: str, metric_id: str, updates: dict[str, Any]) -> dict[str, Any] | None:
    current = query_one(
        """
        SELECT * FROM eval_metrics FINAL
        WHERE tenant_id = {tenant_id:String}
          AND metric_id = {metric_id:String}
        """,
        {"tenant_id": tenant_id, "metric_id": metric_id},
    )
    if not current:
        return None
    current = _deserialize(current)
    current.update(updates)
    current["updated_at"] = now_utc()
    insert_row("eval_metrics", current)
    return current


def delete(tenant_id: str, metric_id: str) -> bool:
    ch().command(
        "ALTER TABLE eval_metrics DELETE WHERE tenant_id = {tenant_id:String} AND metric_id = {metric_id:String}",
        parameters={"tenant_id": tenant_id, "metric_id": metric_id},
    )
    return True



BUILTIN_METRICS = [
    {"metric_id": "exact_match", "name": "Exact Match", "type": "exact_match", "description": "Compares output exactly with expected output"},
    {"metric_id": "contains", "name": "Contains", "type": "contains", "description": "Checks if output contains expected text"},
    {"metric_id": "semantic_sim", "name": "Semantic Similarity", "type": "semantic_sim", "description": "Calculates semantic similarity using TF-IDF cosine", "config": {}},
    {"metric_id": "llm_judge", "name": "LLM-as-Judge", "type": "llm_judge", "description": "Uses an LLM to evaluate response quality", "config": {"judge_model": "gpt-4", "scale": {"min": 1, "max": 10}}},
    {"metric_id": "latency", "name": "Latency", "type": "latency", "description": "Measures response time in seconds"},
    {"metric_id": "cost", "name": "Cost", "type": "cost", "description": "Measures cost in USD"},
]


def seed_builtin_metrics() -> int:
    """Seed builtin metrics if they don't exist. Returns count of metrics added."""
    existing = {m["metric_id"] for m in list_builtin()}
    to_add = []
    now = now_utc()
    for m in BUILTIN_METRICS:
        if m["metric_id"] not in existing:
            to_add.append({
                "metric_id": m["metric_id"],
                "tenant_id": BUILTIN_TENANT,
                "name": m["name"],
                "type": m["type"],
                "description": m.get("description", ""),
                "is_builtin": 1,
                "config": m.get("config", {}),
                "python_script": "",
                "requirements": [],
                "source": "",
                "created_at": now,
                "updated_at": now,
            })
    if to_add:
        insert_rows("eval_metrics", to_add)
    return len(to_add)
