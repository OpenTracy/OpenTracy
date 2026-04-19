"""
Shared ClickHouse helpers for all eval modules.

Re-uses the singleton client from opentracy.storage.clickhouse_client
exactly like the datasets module.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any

from ..storage.clickhouse_client import get_client

logger = logging.getLogger(__name__)


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def ch():
    """Return the ClickHouse client; raise if disabled."""
    client = get_client()
    if client is None:
        raise RuntimeError(
            "ClickHouse is not enabled. Set LUNAR_CH_ENABLED=true "
            "and check connection settings."
        )
    return client


def query_rows(sql: str, params: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    result = ch().query(sql, parameters=params or {})
    columns = result.column_names
    rows: list[dict[str, Any]] = []
    for row in result.result_rows:
        d = dict(zip(columns, row))
        for k, v in d.items():
            if isinstance(v, datetime):
                d[k] = v.isoformat()
        rows.append(d)
    return rows


def query_one(sql: str, params: dict[str, Any] | None = None) -> dict[str, Any] | None:
    rows = query_rows(sql, params)
    return rows[0] if rows else None


def insert_row(table: str, data: dict[str, Any]) -> None:
    cleaned: dict[str, Any] = {}
    for k, v in data.items():
        if isinstance(v, (dict, list)):
            cleaned[k] = json.dumps(v, ensure_ascii=False)
        else:
            cleaned[k] = v
    columns = list(cleaned.keys())
    col_data = [[cleaned[c]] for c in columns]
    ch().insert(table, list(zip(*col_data)), column_names=columns)


def insert_rows(table: str, rows: list[dict[str, Any]]) -> None:
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
    ch().insert(table, list(zip(*data)), column_names=columns)


def parse_json_field(row: dict[str, Any], field: str) -> Any:
    """Parse a JSON-encoded string field back into Python object."""
    val = row.get(field)
    if val is None:
        return {} if field.endswith("config") or field.endswith("result") else []
    if isinstance(val, str):
        try:
            return json.loads(val)
        except (json.JSONDecodeError, TypeError):
            return val
    return val
