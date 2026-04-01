"""
Experiments Repository — ClickHouse

CRUD for eval_experiments + eval_experiment_comparisons tables.
"""
from __future__ import annotations

import json
import logging
import uuid
from typing import Any, Optional

from ..evals_common.db import (
    ch, insert_row, now_utc, parse_json_field, query_one, query_rows,
)

logger = logging.getLogger(__name__)

_EXP_JSON = ("evaluation_ids", "tags")
_COMP_JSON = ("evaluation_ids", "metric_summary", "samples")


def _deserialize_exp(row: dict[str, Any]) -> dict[str, Any]:
    for f in _EXP_JSON:
        row[f] = parse_json_field(row, f)
    return row


def _deserialize_comp(row: dict[str, Any]) -> dict[str, Any]:
    for f in _COMP_JSON:
        row[f] = parse_json_field(row, f)
    return row


# =========================================================================
# Experiment CRUD
# =========================================================================

def create(tenant_id: str, data: dict[str, Any]) -> dict[str, Any]:
    exp_id = str(uuid.uuid4())
    now = now_utc()
    row = {
        "experiment_id": exp_id,
        "tenant_id": tenant_id,
        "name": data.get("name", ""),
        "description": data.get("description", ""),
        "dataset_id": data.get("dataset_id", ""),
        "evaluation_ids": data.get("evaluation_ids", []),
        "tags": data.get("tags", []),
        "status": "draft",
        "created_at": now,
        "updated_at": now,
    }
    insert_row("eval_experiments", row)
    return _deserialize_exp({**row, "experiment_id": exp_id})


def get(tenant_id: str, experiment_id: str) -> dict[str, Any] | None:
    row = query_one(
        "SELECT * FROM eval_experiments FINAL WHERE tenant_id={t:String} AND experiment_id={e:String}",
        {"t": tenant_id, "e": experiment_id},
    )
    return _deserialize_exp(row) if row else None


def list_all(tenant_id: str, status: str | None = None) -> list[dict[str, Any]]:
    sql = "SELECT * FROM eval_experiments FINAL WHERE tenant_id={t:String}"
    params: dict[str, Any] = {"t": tenant_id}
    if status:
        sql += " AND status={s:String}"
        params["s"] = status
    sql += " ORDER BY created_at DESC"
    return [_deserialize_exp(r) for r in query_rows(sql, params)]


def update_status(tenant_id: str, experiment_id: str, status: str) -> None:
    current = get(tenant_id, experiment_id)
    if not current:
        return
    current["status"] = status
    now = now_utc()
    current["updated_at"] = now
    if status == "running":
        current["started_at"] = now
    elif status in ("completed", "failed"):
        current["completed_at"] = now
    insert_row("eval_experiments", current)


def delete(tenant_id: str, experiment_id: str) -> bool:
    ch().command(
        "ALTER TABLE eval_experiments DELETE WHERE tenant_id={t:String} AND experiment_id={e:String}",
        parameters={"t": tenant_id, "e": experiment_id},
    )
    ch().command(
        "ALTER TABLE eval_experiment_comparisons DELETE WHERE tenant_id={t:String} AND experiment_id={e:String}",
        parameters={"t": tenant_id, "e": experiment_id},
    )
    return True


# =========================================================================
# Comparison
# =========================================================================

def save_comparison(tenant_id: str, experiment_id: str, data: dict[str, Any]) -> dict[str, Any]:
    now = now_utc()
    row = {
        "experiment_id": experiment_id,
        "tenant_id": tenant_id,
        "baseline_id": data.get("baseline_id", ""),
        "evaluation_ids": data.get("evaluation_ids", []),
        "metric_summary": data.get("metric_summary", {}),
        "samples": data.get("samples", []),
        "created_at": now,
        "updated_at": now,
    }
    insert_row("eval_experiment_comparisons", row)
    return row


def get_comparison(tenant_id: str, experiment_id: str) -> dict[str, Any] | None:
    row = query_one(
        "SELECT * FROM eval_experiment_comparisons FINAL WHERE tenant_id={t:String} AND experiment_id={e:String}",
        {"t": tenant_id, "e": experiment_id},
    )
    return _deserialize_comp(row) if row else None
