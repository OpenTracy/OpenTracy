"""
Distillation Repository — ClickHouse

CRUD for distillation_jobs, distillation_candidates, distillation_metrics tables.
"""
from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime
from typing import Any, Optional

from ..evals_common.db import (
    ch, insert_row, insert_rows, now_utc, parse_json_field, query_one, query_rows,
)

logger = logging.getLogger(__name__)

_JOB_JSON_FIELDS = ("config", "progress", "results", "artifacts", "pipeline_logs")


def _deserialize_job(row: dict[str, Any]) -> dict[str, Any]:
    for f in _JOB_JSON_FIELDS:
        row[f] = parse_json_field(row, f)
    return row


def _deserialize_candidate(row: dict[str, Any]) -> dict[str, Any]:
    row["usage"] = parse_json_field(row, "usage")
    return row



def create_job(tenant_id: str, data: dict[str, Any]) -> dict[str, Any]:
    job_id = str(uuid.uuid4())
    now = now_utc()

    config = data.get("config", {})
    if isinstance(config, dict):
        config = json.dumps(config, ensure_ascii=False)

    # Build initial 4-phase progress
    progress = {
        "data_generation": {"status": "pending", "progress": 0},
        "curation":        {"status": "pending", "progress": 0},
        "training":        {"status": "pending", "progress": 0},
        "export":          {"status": "pending", "progress": 0},
    }

    row = {
        "job_id": job_id,
        "tenant_id": tenant_id,
        "name": data.get("name", ""),
        "description": data.get("description", ""),
        "status": "pending",
        "phase": "initializing",
        "config": config if isinstance(config, str) else json.dumps(config),
        "progress": json.dumps(progress),
        "results": "{}",
        "artifacts": "{}",
        "error": "",
        "cost_accrued": 0.0,
        "pipeline_logs": "[]",
        "started_at": None,
        "completed_at": None,
        "created_at": now,
        "updated_at": now,
    }
    insert_row("distillation_jobs", row)

    # Return deserialized
    row["progress"] = progress
    row["results"] = {}
    row["artifacts"] = {}
    row["pipeline_logs"] = []
    row["created_at"] = now.isoformat()
    row["updated_at"] = now.isoformat()
    return row


def get_job(tenant_id: str, job_id: str) -> dict[str, Any] | None:
    row = query_one(
        """
        SELECT * FROM distillation_jobs FINAL
        WHERE tenant_id = {tenant_id:String}
          AND job_id = {job_id:String}
        """,
        {"tenant_id": tenant_id, "job_id": job_id},
    )
    return _deserialize_job(row) if row else None


def list_jobs(
    tenant_id: str,
    status: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[dict[str, Any]], int]:
    params: dict[str, Any] = {"tenant_id": tenant_id, "limit": limit, "offset": offset}
    status_filter = ""
    if status:
        status_filter = "AND status = {status:String}"
        params["status"] = status

    rows = query_rows(
        f"""
        SELECT * FROM distillation_jobs FINAL
        WHERE tenant_id = {{tenant_id:String}}
          {status_filter}
        ORDER BY created_at DESC
        LIMIT {{limit:UInt32}} OFFSET {{offset:UInt32}}
        """,
        params,
    )
    count_row = query_one(
        f"""
        SELECT count() AS cnt FROM distillation_jobs FINAL
        WHERE tenant_id = {{tenant_id:String}}
          {status_filter}
        """,
        params,
    )
    total = int(count_row["cnt"]) if count_row else len(rows)
    return [_deserialize_job(r) for r in rows], total


def update_job(tenant_id: str, job_id: str, updates: dict[str, Any]) -> dict[str, Any] | None:
    """Update a job by re-inserting with new values (ReplacingMergeTree)."""
    existing = get_job(tenant_id, job_id)
    if not existing:
        return None

    now = now_utc()
    for k, v in updates.items():
        existing[k] = v
    existing["updated_at"] = now

    # Serialize JSON fields
    row = dict(existing)
    for f in _JOB_JSON_FIELDS:
        if isinstance(row.get(f), (dict, list)):
            row[f] = json.dumps(row[f], ensure_ascii=False)

    # Convert datetime strings back
    for f in ("created_at", "updated_at", "started_at", "completed_at"):
        val = row.get(f)
        if isinstance(val, str):
            try:
                row[f] = datetime.fromisoformat(val.replace("Z", "+00:00"))
            except (ValueError, TypeError):
                pass

    insert_row("distillation_jobs", row)
    return get_job(tenant_id, job_id)


def update_job_status(
    tenant_id: str,
    job_id: str,
    *,
    status: str | None = None,
    phase: str | None = None,
    error: str | None = None,
    progress: dict | None = None,
) -> dict[str, Any] | None:
    updates: dict[str, Any] = {}
    if status is not None:
        updates["status"] = status
    if phase is not None:
        updates["phase"] = phase
    if error is not None:
        updates["error"] = error
    if progress is not None:
        updates["progress"] = progress
    if status == "running" and "started_at" not in updates:
        updates["started_at"] = now_utc()
    if status in ("completed", "failed", "cancelled"):
        updates["completed_at"] = now_utc()
    return update_job(tenant_id, job_id, updates)


def delete_job(tenant_id: str, job_id: str) -> bool:
    existing = get_job(tenant_id, job_id)
    if not existing:
        return False
    # In ReplacingMergeTree we can't truly delete; mark as deleted
    update_job(tenant_id, job_id, {"status": "deleted"})
    return True


def append_log(tenant_id: str, job_id: str, message: str) -> None:
    """Append a log entry to the job's pipeline_logs."""
    job = get_job(tenant_id, job_id)
    if not job:
        return
    logs = job.get("pipeline_logs", [])
    if not isinstance(logs, list):
        logs = []
    ts = now_utc().strftime("%H:%M:%S")
    logs.append(f"[{ts}] {message}")
    update_job(tenant_id, job_id, {"pipeline_logs": logs})



def insert_candidate(data: dict[str, Any]) -> None:
    data.setdefault("candidate_id", str(uuid.uuid4()))
    data.setdefault("created_at", now_utc())
    insert_row("distillation_candidates", data)


def insert_candidates(rows: list[dict[str, Any]]) -> None:
    for r in rows:
        r.setdefault("candidate_id", str(uuid.uuid4()))
        r.setdefault("created_at", now_utc())
    insert_rows("distillation_candidates", rows)


def get_candidates(job_id: str, prompt_id: str | None = None, limit: int = 1000) -> list[dict[str, Any]]:
    params: dict[str, Any] = {"job_id": job_id, "limit": limit}
    prompt_filter = ""
    if prompt_id:
        prompt_filter = "AND prompt_id = {prompt_id:String}"
        params["prompt_id"] = prompt_id

    rows = query_rows(
        f"""
        SELECT * FROM distillation_candidates FINAL
        WHERE job_id = {{job_id:String}}
          {prompt_filter}
        ORDER BY prompt_id, candidate_idx
        LIMIT {{limit:UInt32}}
        """,
        params,
    )
    return [_deserialize_candidate(r) for r in rows]


def get_selected_candidates(job_id: str) -> list[dict[str, Any]]:
    rows = query_rows(
        """
        SELECT * FROM distillation_candidates FINAL
        WHERE job_id = {job_id:String} AND selected = 1
        ORDER BY prompt_id
        """,
        {"job_id": job_id},
    )
    return [_deserialize_candidate(r) for r in rows]



def insert_metric(data: dict[str, Any]) -> None:
    data.setdefault("created_at", now_utc())
    insert_row("distillation_metrics", data)


def get_metrics(job_id: str, limit: int = 5000) -> list[dict[str, Any]]:
    return query_rows(
        """
        SELECT * FROM distillation_metrics
        WHERE job_id = {job_id:String}
        ORDER BY step ASC
        LIMIT {limit:UInt32}
        """,
        {"job_id": job_id, "limit": limit},
    )


def get_latest_metric(job_id: str) -> dict[str, Any] | None:
    return query_one(
        """
        SELECT * FROM distillation_metrics
        WHERE job_id = {job_id:String}
        ORDER BY step DESC
        LIMIT 1
        """,
        {"job_id": job_id},
    )
