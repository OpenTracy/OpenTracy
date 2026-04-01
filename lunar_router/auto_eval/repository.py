"""
Auto-Eval Repository — ClickHouse

CRUD for eval_auto_eval_configs + eval_auto_eval_runs tables.
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

_CFG_JSON = ("models", "metrics")
_RUN_JSON = ("scores",)


def _deser_cfg(r: dict[str, Any]) -> dict[str, Any]:
    for f in _CFG_JSON:
        r[f] = parse_json_field(r, f)
    r["enabled"] = bool(r.get("enabled", 1))
    r["alert_on_regression"] = bool(r.get("alert_on_regression", 1))
    return r


def _deser_run(r: dict[str, Any]) -> dict[str, Any]:
    for f in _RUN_JSON:
        r[f] = parse_json_field(r, f)
    r["regression_detected"] = bool(r.get("regression_detected", 0))
    return r


# =========================================================================
# Config CRUD
# =========================================================================

def list_configs(tenant_id: str) -> list[dict[str, Any]]:
    rows = query_rows(
        "SELECT * FROM eval_auto_eval_configs FINAL WHERE tenant_id={t:String} ORDER BY created_at DESC",
        {"t": tenant_id},
    )
    return [_deser_cfg(r) for r in rows]


def create_config(tenant_id: str, data: dict[str, Any]) -> dict[str, Any]:
    cid = str(uuid.uuid4())
    now = now_utc()
    row = {
        "config_id": cid,
        "tenant_id": tenant_id,
        "name": data.get("name", ""),
        "dataset_id": data.get("dataset_id", ""),
        "dataset_name": data.get("dataset_name", ""),
        "models": data.get("models", []),
        "metrics": data.get("metrics", []),
        "schedule": data.get("schedule", "daily"),
        "enabled": 1 if data.get("enabled", True) else 0,
        "alert_on_regression": 1 if data.get("alert_on_regression", True) else 0,
        "regression_threshold": data.get("regression_threshold", 0.05),
        "topic_filter": data.get("topic_filter", ""),
        "last_run_at": "",
        "last_run_score": 0.0,
        "source": data.get("source", ""),
        "created_at": now,
        "updated_at": now,
    }
    insert_row("eval_auto_eval_configs", row)
    return _deser_cfg({**row, "config_id": cid})


def get_config(tenant_id: str, config_id: str) -> dict[str, Any] | None:
    row = query_one(
        "SELECT * FROM eval_auto_eval_configs FINAL WHERE tenant_id={t:String} AND config_id={c:String}",
        {"t": tenant_id, "c": config_id},
    )
    return _deser_cfg(row) if row else None


def update_config(tenant_id: str, config_id: str, updates: dict[str, Any]) -> dict[str, Any] | None:
    current = get_config(tenant_id, config_id)
    if not current:
        return None
    # Map booleans to ints
    for bool_field in ("enabled", "alert_on_regression"):
        if bool_field in updates:
            updates[bool_field] = 1 if updates[bool_field] else 0
    current.update(updates)
    current["updated_at"] = now_utc()
    insert_row("eval_auto_eval_configs", current)
    return current


def delete_config(tenant_id: str, config_id: str) -> bool:
    ch().command(
        "ALTER TABLE eval_auto_eval_runs DELETE WHERE tenant_id={t:String} AND config_id={c:String}",
        parameters={"t": tenant_id, "c": config_id},
    )
    ch().command(
        "ALTER TABLE eval_auto_eval_configs DELETE WHERE tenant_id={t:String} AND config_id={c:String}",
        parameters={"t": tenant_id, "c": config_id},
    )
    return True


def update_config_last_run(tenant_id: str, config_id: str, score: float, timestamp: str) -> None:
    current = get_config(tenant_id, config_id)
    if not current:
        return
    current["last_run_at"] = timestamp
    current["last_run_score"] = score
    current["updated_at"] = now_utc()
    insert_row("eval_auto_eval_configs", current)


# =========================================================================
# Run CRUD
# =========================================================================

def create_run(tenant_id: str, config_id: str, data: dict[str, Any]) -> dict[str, Any]:
    rid = str(uuid.uuid4())
    now = now_utc()
    row = {
        "run_id": rid,
        "tenant_id": tenant_id,
        "config_id": config_id,
        "evaluation_id": data.get("evaluation_id", ""),
        "status": "running",
        "scores": {},
        "regression_detected": 0,
        "error_message": "",
        "started_at": now,
        "completed_at": None,
        "created_at": now,
        "updated_at": now,
    }
    insert_row("eval_auto_eval_runs", row)
    return _deser_run({**row, "run_id": rid})


def list_runs(tenant_id: str, config_id: str) -> list[dict[str, Any]]:
    rows = query_rows(
        "SELECT * FROM eval_auto_eval_runs FINAL WHERE tenant_id={t:String} AND config_id={c:String} ORDER BY started_at DESC",
        {"t": tenant_id, "c": config_id},
    )
    return [_deser_run(r) for r in rows]


def update_run(tenant_id: str, config_id: str, run_id: str, updates: dict[str, Any]) -> None:
    row = query_one(
        "SELECT * FROM eval_auto_eval_runs FINAL WHERE tenant_id={t:String} AND config_id={c:String} AND run_id={r:String}",
        {"t": tenant_id, "c": config_id, "r": run_id},
    )
    if not row:
        return
    row = _deser_run(row)
    if "regression_detected" in updates:
        updates["regression_detected"] = 1 if updates["regression_detected"] else 0
    row.update(updates)
    row["updated_at"] = now_utc()
    insert_row("eval_auto_eval_runs", row)
