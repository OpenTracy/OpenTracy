"""
Datasets Repository — ClickHouse

CRUD for eval_datasets, eval_samples, eval_auto_collect, eval_collect_runs.
Reads traces from the llm_traces table (written by the Go engine).

Re-uses the singleton ClickHouse client from lunar_router.storage.clickhouse_client.
"""
from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from ..storage.clickhouse_client import get_client

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _now() -> datetime:
    return datetime.now(timezone.utc)


def _ch():
    """Return the ClickHouse client; raise if disabled."""
    client = get_client()
    if client is None:
        raise RuntimeError(
            "ClickHouse is not enabled. Set LUNAR_CH_ENABLED=true "
            "and check connection settings."
        )
    return client


def _query_rows(sql: str, params: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    result = _ch().query(sql, parameters=params or {})
    columns = result.column_names
    rows: list[dict[str, Any]] = []
    for row in result.result_rows:
        d = dict(zip(columns, row))
        # datetime → ISO string for JSON serialization
        for k, v in d.items():
            if isinstance(v, datetime):
                d[k] = v.isoformat()
        rows.append(d)
    return rows


def _query_one(sql: str, params: dict[str, Any] | None = None) -> dict[str, Any] | None:
    rows = _query_rows(sql, params)
    return rows[0] if rows else None


def _insert_row(table: str, data: dict[str, Any]) -> None:
    cleaned: dict[str, Any] = {}
    for k, v in data.items():
        if isinstance(v, (dict, list)):
            cleaned[k] = json.dumps(v, ensure_ascii=False)
        else:
            cleaned[k] = v
    columns = list(cleaned.keys())
    col_data = [[cleaned[c]] for c in columns]
    _ch().insert(table, list(zip(*col_data)), column_names=columns)


def _insert_rows(table: str, rows: list[dict[str, Any]]) -> None:
    if not rows:
        return
    cleaned_rows = []
    for row in rows:
        cleaned: dict[str, Any] = {}
        for k, v in row.items():
            if isinstance(v, (dict, list)):
                cleaned[k] = json.dumps(v, ensure_ascii=False)
            else:
                cleaned[k] = v
        cleaned_rows.append(cleaned)
    columns = list(cleaned_rows[0].keys())
    data = [[r.get(c) for r in cleaned_rows] for c in columns]
    _ch().insert(table, list(zip(*data)), column_names=columns)



def create_dataset(
    tenant_id: str,
    *,
    name: str,
    description: str = "",
    source: str = "manual",
    status: str = "active",
    rationale: str = "",
) -> dict[str, Any]:
    dataset_id = str(uuid.uuid4())
    now = _now()
    row = {
        "dataset_id": dataset_id,
        "tenant_id": tenant_id,
        "name": name,
        "description": description,
        "source": source,
        "samples_count": 0,
        "created_at": now,
        "updated_at": now,
        "status": status,
        "rationale": rationale,
    }
    _insert_row("eval_datasets", row)
    row["created_at"] = now.isoformat()
    row["updated_at"] = now.isoformat()
    return row


def list_pending_datasets(tenant_id: str) -> list[dict[str, Any]]:
    """Return datasets with status='pending_curation' for the given tenant."""
    return _query_rows(
        """
        SELECT *
        FROM eval_datasets FINAL
        WHERE tenant_id = {tenant_id:String}
          AND status = 'pending_curation'
        ORDER BY created_at DESC
        """,
        {"tenant_id": tenant_id},
    )


def _set_dataset_status(tenant_id: str, dataset_id: str, status: str) -> dict[str, Any] | None:
    current = get_dataset(tenant_id, dataset_id)
    if not current:
        return None
    current["status"] = status
    current["updated_at"] = _now()
    _insert_row("eval_datasets", current)
    return current


def approve_dataset(tenant_id: str, dataset_id: str) -> dict[str, Any] | None:
    return _set_dataset_status(tenant_id, dataset_id, "active")


def reject_dataset(tenant_id: str, dataset_id: str) -> dict[str, Any] | None:
    return _set_dataset_status(tenant_id, dataset_id, "rejected")


def _set_sample_status(
    tenant_id: str, dataset_id: str, sample_id: str, status: str
) -> dict[str, Any] | None:
    current = get_sample(tenant_id, dataset_id, sample_id)
    if not current:
        return None
    current["status"] = status
    # ReplacingMergeTree order-key is (tenant_id, dataset_id, sample_id) so
    # re-inserting with a newer created_at will supersede.
    current["created_at"] = _now()
    _insert_row("eval_samples", current)
    return current


def approve_sample(tenant_id: str, dataset_id: str, sample_id: str) -> dict[str, Any] | None:
    return _set_sample_status(tenant_id, dataset_id, sample_id, "curated")


def reject_sample(tenant_id: str, dataset_id: str, sample_id: str) -> dict[str, Any] | None:
    return _set_sample_status(tenant_id, dataset_id, sample_id, "rejected")


def get_dataset(tenant_id: str, dataset_id: str) -> dict[str, Any] | None:
    return _query_one(
        """
        SELECT *
        FROM eval_datasets FINAL
        WHERE tenant_id = {tenant_id:String}
          AND dataset_id = {dataset_id:String}
        """,
        {"tenant_id": tenant_id, "dataset_id": dataset_id},
    )


def list_datasets(tenant_id: str) -> list[dict[str, Any]]:
    return _query_rows(
        """
        SELECT *
        FROM eval_datasets FINAL
        WHERE tenant_id = {tenant_id:String}
        ORDER BY created_at DESC
        """,
        {"tenant_id": tenant_id},
    )


def update_dataset(tenant_id: str, dataset_id: str, updates: dict[str, Any]) -> dict[str, Any] | None:
    """Update by re-inserting (ReplacingMergeTree keeps latest by updated_at)."""
    current = get_dataset(tenant_id, dataset_id)
    if not current:
        return None
    current.update(updates)
    current["updated_at"] = _now()
    _insert_row("eval_datasets", current)
    return current


def delete_dataset(tenant_id: str, dataset_id: str) -> bool:
    ch = _ch()
    for table in ("eval_datasets", "eval_samples", "eval_auto_collect"):
        ch.command(
            f"ALTER TABLE {table} DELETE WHERE tenant_id = {{tenant_id:String}} AND dataset_id = {{dataset_id:String}}",
            parameters={"tenant_id": tenant_id, "dataset_id": dataset_id},
        )
    return True



def add_samples(tenant_id: str, dataset_id: str, samples: list[dict[str, Any]]) -> int:
    """Add samples and update the dataset counter."""
    if not samples:
        return 0
    now = _now()
    rows = []
    for s in samples:
        rows.append({
            "sample_id": str(uuid.uuid4()),
            "dataset_id": dataset_id,
            "tenant_id": tenant_id,
            "input": s.get("input", ""),
            "expected_output": s.get("expected_output", s.get("output", "")),
            "metadata": s.get("metadata") or {},
            "trace_id": s.get("trace_id", ""),
            "created_at": now,
            "status": s.get("status", "curated"),
        })
    _insert_rows("eval_samples", rows)
    _update_samples_count(tenant_id, dataset_id, len(rows))
    return len(rows)


def get_samples(
    tenant_id: str,
    dataset_id: str,
    limit: int = 1000,
    offset: int = 0,
) -> list[dict[str, Any]]:
    rows = _query_rows(
        """
        SELECT *
        FROM eval_samples FINAL
        WHERE tenant_id = {tenant_id:String}
          AND dataset_id = {dataset_id:String}
        ORDER BY created_at ASC
        LIMIT {limit:UInt32} OFFSET {offset:UInt32}
        """,
        {"tenant_id": tenant_id, "dataset_id": dataset_id, "limit": limit, "offset": offset},
    )
    for r in rows:
        if isinstance(r.get("metadata"), str):
            try:
                r["metadata"] = json.loads(r["metadata"])
            except (json.JSONDecodeError, TypeError):
                r["metadata"] = {}
    return rows


def get_samples_count(tenant_id: str, dataset_id: str) -> int:
    row = _query_one(
        """
        SELECT count() AS cnt
        FROM eval_samples FINAL
        WHERE tenant_id = {tenant_id:String}
          AND dataset_id = {dataset_id:String}
        """,
        {"tenant_id": tenant_id, "dataset_id": dataset_id},
    )
    return int(row["cnt"]) if row else 0


def get_sample(tenant_id: str, dataset_id: str, sample_id: str) -> dict[str, Any] | None:
    return _query_one(
        """
        SELECT *
        FROM eval_samples FINAL
        WHERE tenant_id = {tenant_id:String}
          AND dataset_id = {dataset_id:String}
          AND sample_id = {sample_id:String}
        """,
        {"tenant_id": tenant_id, "dataset_id": dataset_id, "sample_id": sample_id},
    )


def delete_sample(tenant_id: str, dataset_id: str, sample_id: str) -> bool:
    _ch().command(
        "ALTER TABLE eval_samples DELETE WHERE tenant_id = {tenant_id:String} AND dataset_id = {dataset_id:String} AND sample_id = {sample_id:String}",
        parameters={"tenant_id": tenant_id, "dataset_id": dataset_id, "sample_id": sample_id},
    )
    _update_samples_count(tenant_id, dataset_id, -1)
    return True


def _update_samples_count(tenant_id: str, dataset_id: str, delta: int) -> None:
    current = get_dataset(tenant_id, dataset_id)
    if not current:
        return
    new_count = max(0, int(current.get("samples_count", 0) or 0) + delta)
    current["samples_count"] = new_count
    current["updated_at"] = _now()
    _insert_row("eval_datasets", current)



def get_auto_collect_config(tenant_id: str, dataset_id: str) -> dict[str, Any] | None:
    row = _query_one(
        """
        SELECT *
        FROM eval_auto_collect FINAL
        WHERE tenant_id = {tenant_id:String}
          AND dataset_id = {dataset_id:String}
        """,
        {"tenant_id": tenant_id, "dataset_id": dataset_id},
    )
    if row and isinstance(row.get("curation_config"), str):
        try:
            row["curation_config"] = json.loads(row["curation_config"])
        except (json.JSONDecodeError, TypeError):
            row["curation_config"] = {}
    return row


def put_auto_collect_config(tenant_id: str, dataset_id: str, config: dict[str, Any]) -> dict[str, Any]:
    now = _now()
    existing = get_auto_collect_config(tenant_id, dataset_id)
    row = {
        "dataset_id": dataset_id,
        "tenant_id": tenant_id,
        "enabled": 1 if config.get("enabled", True) else 0,
        "source_model": config.get("source_model", ""),
        "instruction": config.get("instruction", ""),
        "max_samples": config.get("max_samples", 5000),
        "collection_interval_minutes": config.get("collection_interval_minutes", 60),
        "curation_config": config.get("curation_config", {
            "quality_threshold": 0.5,
            "selection_rate": 0.3,
            "agent_weights": {"quality": 0.4, "diversity": 0.3, "difficulty": 0.3},
        }),
        "last_collected_at": existing.get("last_collected_at") if existing else None,
        "total_collected": existing.get("total_collected", 0) if existing else 0,
        "created_at": existing.get("created_at", now) if existing else now,
        "updated_at": now,
    }
    _insert_row("eval_auto_collect", row)
    return row


def delete_auto_collect_config(tenant_id: str, dataset_id: str) -> bool:
    _ch().command(
        "ALTER TABLE eval_auto_collect DELETE WHERE tenant_id = {tenant_id:String} AND dataset_id = {dataset_id:String}",
        parameters={"tenant_id": tenant_id, "dataset_id": dataset_id},
    )
    return True


def list_collect_runs(tenant_id: str, dataset_id: str, limit: int = 20) -> list[dict[str, Any]]:
    return _query_rows(
        """
        SELECT *
        FROM eval_collect_runs
        WHERE tenant_id = {tenant_id:String}
          AND dataset_id = {dataset_id:String}
        ORDER BY created_at DESC
        LIMIT {limit:UInt32}
        """,
        {"tenant_id": tenant_id, "dataset_id": dataset_id, "limit": limit},
    )


def save_collect_run(tenant_id: str, dataset_id: str, run_data: dict[str, Any]) -> dict[str, Any]:
    now = _now()
    run_id = str(uuid.uuid4())
    row = {
        "run_id": run_id,
        "dataset_id": dataset_id,
        "tenant_id": tenant_id,
        "created_at": now,
        **run_data,
    }
    _insert_row("eval_collect_runs", row)
    return row


def get_collected_trace_ids(tenant_id: str, dataset_id: str) -> set[str]:
    rows = _query_rows(
        """
        SELECT trace_id
        FROM eval_samples FINAL
        WHERE tenant_id = {tenant_id:String}
          AND dataset_id = {dataset_id:String}
          AND trace_id != ''
        """,
        {"tenant_id": tenant_id, "dataset_id": dataset_id},
    )
    return {r["trace_id"] for r in rows}



def list_traces(
    *,
    limit: int = 50,
    offset: int = 0,
    model_id: str | None = None,
    days: int = 30,
    start_date: str | None = None,
    end_date: str | None = None,
) -> tuple[list[dict[str, Any]], int]:
    """Return traces from llm_traces, newest first. Also returns total count."""
    start = datetime.now(timezone.utc) - timedelta(days=days)
    if start_date:
        try:
            start = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
        except ValueError:
            pass

    conditions = ["timestamp >= {start:DateTime64(3)}"]
    params: dict[str, Any] = {"start": start, "limit": limit, "offset": offset}

    if end_date:
        try:
            end = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
            conditions.append("timestamp <= {end:DateTime64(3)}")
            params["end"] = end
        except ValueError:
            pass

    if model_id:
        conditions.append("selected_model = {model_id:String}")
        params["model_id"] = model_id

    where = " AND ".join(conditions)

    rows = _query_rows(
        f"""
        SELECT *
        FROM llm_traces
        WHERE {where}
        ORDER BY timestamp DESC
        LIMIT {{limit:UInt32}} OFFSET {{offset:UInt32}}
        """,
        params,
    )

    # Count
    count_row = _query_one(
        f"SELECT count() AS cnt FROM llm_traces WHERE {where}",
        params,
    )
    total = int(count_row["cnt"]) if count_row else len(rows)

    traces = [_trace_from_row(r) for r in rows]
    return traces, total


def get_trace(trace_id: str) -> dict[str, Any] | None:
    row = _query_one(
        "SELECT * FROM llm_traces WHERE request_id = {rid:String} LIMIT 1",
        {"rid": trace_id},
    )
    return _trace_from_row(row) if row else None


def _trace_from_row(row: dict[str, Any]) -> dict[str, Any]:
    ts = row.get("timestamp", "")
    if isinstance(ts, datetime):
        ts = ts.isoformat()
    return {
        "trace_id": row.get("request_id", ""),
        "id": row.get("request_id", ""),
        "created_at": ts,
        "input": row.get("input_text", ""),
        "output": row.get("output_text", ""),
        "model_id": row.get("selected_model", ""),
        "provider": row.get("provider", ""),
        "latency_ms": int(float(row.get("latency_ms", 0))),
        "cost_usd": float(row.get("total_cost_usd", 0)),
        "total_tokens": int(row.get("total_tokens", 0)),
        "success": not bool(row.get("is_error", 0)),
        "source": "router",
    }
