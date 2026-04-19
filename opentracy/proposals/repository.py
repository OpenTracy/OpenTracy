"""
Proposals Repository — ClickHouse

CRUD for eval_proposals table. Supports lazy expiry.
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

PROPOSAL_EXPIRY_DAYS = 7

_JSON_FIELDS = ("action_payload", "execution_result")


def _deser(r: dict[str, Any]) -> dict[str, Any]:
    for f in _JSON_FIELDS:
        r[f] = parse_json_field(r, f)
    return r


def _is_expired(item: dict[str, Any]) -> bool:
    expires_at = item.get("expires_at")
    if not expires_at:
        return False
    try:
        if isinstance(expires_at, datetime):
            return datetime.utcnow() > expires_at
        expires_dt = datetime.fromisoformat(str(expires_at).replace("Z", "").replace("+00:00", ""))
        return datetime.utcnow() > expires_dt
    except (ValueError, TypeError):
        return False



def create(tenant_id: str, data: dict[str, Any]) -> dict[str, Any]:
    pid = str(uuid.uuid4())
    now = now_utc()
    expires = now + timedelta(days=PROPOSAL_EXPIRY_DAYS)
    row = {
        "proposal_id": pid,
        "tenant_id": tenant_id,
        "proposal_type": data.get("proposal_type", ""),
        "event_type": data.get("event_type", ""),
        "priority": data.get("priority", "medium"),
        "status": "pending",
        "title": data.get("title", ""),
        "description": data.get("description", ""),
        "reason": data.get("reason", ""),
        "dataset_id": data.get("dataset_id", ""),
        "config_id": data.get("config_id", ""),
        "evaluation_id": data.get("evaluation_id", ""),
        "dedup_key": data.get("dedup_key", ""),
        "action_payload": data.get("action_payload", {}),
        "execution_result": {},
        "expires_at": expires,
        "resolved_at": None,
        "created_at": now,
        "updated_at": now,
    }
    insert_row("eval_proposals", row)
    return _deser({**row, "proposal_id": pid})


def get(tenant_id: str, proposal_id: str) -> dict[str, Any] | None:
    row = query_one(
        "SELECT * FROM eval_proposals FINAL WHERE tenant_id={t:String} AND proposal_id={p:String}",
        {"t": tenant_id, "p": proposal_id},
    )
    if not row:
        return None
    row = _deser(row)
    if row.get("status") == "pending" and _is_expired(row):
        update_status(tenant_id, proposal_id, "expired")
        row["status"] = "expired"
    return row


def list_all(tenant_id: str, status: str | None = None) -> list[dict[str, Any]]:
    sql = "SELECT * FROM eval_proposals FINAL WHERE tenant_id={t:String}"
    params: dict[str, Any] = {"t": tenant_id}
    if status:
        sql += " AND status={s:String}"
        params["s"] = status
    sql += " ORDER BY created_at DESC"
    rows = query_rows(sql, params)
    result = []
    for r in rows:
        r = _deser(r)
        if r.get("status") == "pending" and _is_expired(r):
            try:
                update_status(tenant_id, r["proposal_id"], "expired")
            except Exception:
                pass
            r["status"] = "expired"
            if status == "pending":
                continue
        result.append(r)
    return result


def find_by_dedup_key(tenant_id: str, dedup_key: str) -> dict[str, Any] | None:
    rows = query_rows(
        "SELECT * FROM eval_proposals FINAL WHERE tenant_id={t:String} AND dedup_key={d:String} AND status='pending'",
        {"t": tenant_id, "d": dedup_key},
    )
    for r in rows:
        r = _deser(r)
        if not _is_expired(r):
            return r
    return None


def update_status(
    tenant_id: str,
    proposal_id: str,
    status: str,
    execution_result: dict[str, Any] | None = None,
) -> dict[str, Any] | None:
    row = query_one(
        "SELECT * FROM eval_proposals FINAL WHERE tenant_id={t:String} AND proposal_id={p:String}",
        {"t": tenant_id, "p": proposal_id},
    )
    if not row:
        return None
    row = _deser(row)
    now = now_utc()
    row["status"] = status
    row["updated_at"] = now
    if status in ("approved", "rejected", "executed", "failed", "expired"):
        row["resolved_at"] = now
    if execution_result is not None:
        row["execution_result"] = execution_result
    insert_row("eval_proposals", row)
    return row
