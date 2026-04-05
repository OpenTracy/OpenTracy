"""
Evaluations Repository — ClickHouse

CRUD for eval_evaluations and eval_evaluation_results tables.
"""
from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timedelta
from typing import Any, Optional

from ..evals_common.db import (
    ch, insert_row, now_utc, parse_json_field, query_one, query_rows,
)

logger = logging.getLogger(__name__)

_JSON_FIELDS = ("models", "metrics", "config")
_RESULT_JSON_FIELDS = ("summary", "samples")


def _deserialize(row: dict[str, Any]) -> dict[str, Any]:
    for f in _JSON_FIELDS:
        row[f] = parse_json_field(row, f)
    return row


def _deserialize_result(row: dict[str, Any]) -> dict[str, Any]:
    for f in _RESULT_JSON_FIELDS:
        row[f] = parse_json_field(row, f)
    return row



def create(tenant_id: str, data: dict[str, Any]) -> dict[str, Any]:
    evaluation_id = str(uuid.uuid4())
    return create_with_id(tenant_id, evaluation_id, data)


def create_with_id(tenant_id: str, evaluation_id: str, data: dict[str, Any]) -> dict[str, Any]:
    now = now_utc()
    row = {
        "evaluation_id": evaluation_id,
        "tenant_id": tenant_id,
        "name": data.get("name", ""),
        "description": data.get("description", ""),
        "dataset_id": data.get("dataset_id", ""),
        "models": data.get("models", []),
        "metrics": data.get("metrics", []),
        "config": data.get("config", {}),
        "status": data.get("status", "pending"),
        "progress": data.get("progress", 0),
        "current_sample": data.get("current_sample", 0),
        "total_samples": data.get("total_samples", 0),
        "execution_type": data.get("execution_type", "platform"),
        "auto_eval_config_id": data.get("auto_eval_config_id", ""),
        "original_evaluation_id": data.get("original_evaluation_id", ""),
        "error_message": "",
        "started_at": None,
        "completed_at": None,
        "created_at": data.get("created_at") or now,
        "updated_at": now,
    }
    insert_row("eval_evaluations", row)
    # Return a dict suitable for JSON
    row["created_at"] = row["created_at"].isoformat() if isinstance(row["created_at"], datetime) else str(row["created_at"])
    row["updated_at"] = now.isoformat()
    return row


def get(tenant_id: str, evaluation_id: str) -> dict[str, Any] | None:
    row = query_one(
        """
        SELECT * FROM eval_evaluations FINAL
        WHERE tenant_id = {tenant_id:String}
          AND evaluation_id = {evaluation_id:String}
        """,
        {"tenant_id": tenant_id, "evaluation_id": evaluation_id},
    )
    return _deserialize(row) if row else None


def list_all(tenant_id: str, status: str | None = None) -> list[dict[str, Any]]:
    params: dict[str, Any] = {"tenant_id": tenant_id}
    status_filter = ""
    if status:
        status_filter = "AND status = {status:String}"
        params["status"] = status
    rows = query_rows(
        f"""
        SELECT * FROM eval_evaluations FINAL
        WHERE tenant_id = {{tenant_id:String}}
          {status_filter}
        ORDER BY created_at DESC
        """,
        params,
    )
    return [_deserialize(r) for r in rows]


def update_status(
    tenant_id: str,
    evaluation_id: str,
    status: str,
    progress: int | None = None,
    current_sample: int | None = None,
    error_message: str | None = None,
) -> dict[str, Any] | None:
    """Update by re-inserting (ReplacingMergeTree)."""
    current = get(tenant_id, evaluation_id)
    if not current:
        return None
    now = now_utc()
    current["status"] = status
    current["updated_at"] = now
    if status == "running" and not current.get("started_at"):
        current["started_at"] = now
    if status in ("completed", "failed", "cancelled"):
        current["completed_at"] = now
    if progress is not None:
        current["progress"] = progress
    if current_sample is not None:
        current["current_sample"] = current_sample
    if error_message is not None:
        current["error_message"] = error_message
    insert_row("eval_evaluations", current)
    return current


def delete(tenant_id: str, evaluation_id: str) -> bool:
    for table in ("eval_evaluations", "eval_evaluation_results"):
        ch().command(
            f"ALTER TABLE {table} DELETE WHERE tenant_id = {{tenant_id:String}} AND evaluation_id = {{evaluation_id:String}}",
            parameters={"tenant_id": tenant_id, "evaluation_id": evaluation_id},
        )
    return True



def save_result(tenant_id: str, evaluation_id: str, result_data: dict[str, Any]) -> dict[str, Any]:
    now = now_utc()
    row = {
        "evaluation_id": evaluation_id,
        "tenant_id": tenant_id,
        "summary": result_data.get("summary", {}),
        "samples": result_data.get("samples", []),
        "winner": result_data.get("winner", ""),
        "created_at": now,
        "updated_at": now,
    }
    insert_row("eval_evaluation_results", row)
    return row


def get_result(tenant_id: str, evaluation_id: str) -> dict[str, Any] | None:
    row = query_one(
        """
        SELECT * FROM eval_evaluation_results FINAL
        WHERE tenant_id = {tenant_id:String}
          AND evaluation_id = {evaluation_id:String}
        """,
        {"tenant_id": tenant_id, "evaluation_id": evaluation_id},
    )
    return _deserialize_result(row) if row else None


def save_result_and_complete(
    tenant_id: str,
    evaluation_id: str,
    result_data: dict[str, Any],
    total_samples: int,
) -> None:
    """Save results and mark evaluation as completed (best-effort atomic)."""
    save_result(tenant_id, evaluation_id, result_data)
    update_status(
        tenant_id, evaluation_id,
        status="completed",
        progress=100,
        current_sample=total_samples,
    )



def find_stale_evaluations(tenant_id: str, stale_threshold_hours: float = 1.0) -> list[dict[str, Any]]:
    running_cutoff = now_utc() - timedelta(hours=stale_threshold_hours)
    queued_cutoff = now_utc() - timedelta(minutes=30)
    stale = []
    for s in ("running", "queued", "starting"):
        evals = list_all(tenant_id, status=s)
        for ev in evals:
            if s == "running":
                ts = ev.get("started_at")
                cutoff = running_cutoff
            else:
                ts = ev.get("created_at")
                cutoff = queued_cutoff
            if not ts:
                stale.append(ev)
                continue
            try:
                if isinstance(ts, str):
                    ts_dt = datetime.fromisoformat(ts.replace("Z", "+00:00").replace("+00:00", ""))
                else:
                    ts_dt = ts.replace(tzinfo=None)
                if ts_dt < cutoff.replace(tzinfo=None):
                    stale.append(ev)
            except (ValueError, TypeError):
                stale.append(ev)
    return stale


def mark_stale_as_failed(
    tenant_id: str,
    stale_threshold_hours: float = 1.0,
    error_message: str = "Evaluation timed out",
) -> list[dict[str, Any]]:
    stale = find_stale_evaluations(tenant_id, stale_threshold_hours)
    marked = []
    for ev in stale:
        eid = ev.get("evaluation_id")
        if eid:
            updated = update_status(tenant_id, eid, status="failed", error_message=error_message)
            if updated:
                marked.append(updated)
    return marked
