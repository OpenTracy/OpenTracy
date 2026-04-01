"""
Settings Repository — ClickHouse

Per-tenant evaluation settings stored in eval_settings table.
"""
from __future__ import annotations

import logging
from typing import Any

from ..evals_common.db import insert_row, now_utc, parse_json_field, query_one

logger = logging.getLogger(__name__)


_DEFAULTS = {
    "default_judge_model": "gpt-4",
    "default_temperature": 0.7,
    "max_parallel_requests": 5,
    "python_script_timeout": 30,
    "config": {},
}


def get(tenant_id: str) -> dict[str, Any]:
    row = query_one(
        "SELECT * FROM eval_settings FINAL WHERE tenant_id={t:String}",
        {"t": tenant_id},
    )
    if row:
        row["config"] = parse_json_field(row, "config")
        return row
    return {"tenant_id": tenant_id, **_DEFAULTS}


def update(tenant_id: str, updates: dict[str, Any]) -> dict[str, Any]:
    current = get(tenant_id)
    current.update(updates)
    now = now_utc()
    row = {
        "tenant_id": tenant_id,
        "default_judge_model": current.get("default_judge_model", _DEFAULTS["default_judge_model"]),
        "default_temperature": current.get("default_temperature", _DEFAULTS["default_temperature"]),
        "max_parallel_requests": current.get("max_parallel_requests", _DEFAULTS["max_parallel_requests"]),
        "python_script_timeout": current.get("python_script_timeout", _DEFAULTS["python_script_timeout"]),
        "config": current.get("config", {}),
        "updated_at": now,
    }
    insert_row("eval_settings", row)
    return row
