"""
Trace Issues Repository — ClickHouse

CRUD for eval_trace_issues + eval_trace_scans tables.
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


def _deser_issue(r: dict[str, Any]) -> dict[str, Any]:
    r["resolved"] = bool(r.get("resolved", 0))
    return r


# =========================================================================
# Issue CRUD
# =========================================================================

def create_issue(tenant_id: str, data: dict[str, Any]) -> dict[str, Any]:
    iid = str(uuid.uuid4())
    now = now_utc()
    row = {
        "issue_id": iid,
        "tenant_id": tenant_id,
        "trace_id": data.get("trace_id", ""),
        "type": data.get("type", ""),
        "severity": data.get("severity", "medium"),
        "title": data.get("title", ""),
        "description": data.get("description", ""),
        "ai_confidence": data.get("ai_confidence", 0.0),
        "model_id": data.get("model_id", ""),
        "trace_input": data.get("trace_input", ""),
        "trace_output": data.get("trace_output", ""),
        "suggested_action": data.get("suggested_action", ""),
        "resolved": 0,
        "resolved_at": None,
        "detected_at": data.get("detected_at", now),
        "created_at": now,
        "updated_at": now,
    }
    insert_row("eval_trace_issues", row)
    return _deser_issue({**row, "issue_id": iid})


def list_issues(
    tenant_id: str,
    severity: str | None = None,
    issue_type: str | None = None,
    resolved: bool | None = None,
) -> list[dict[str, Any]]:
    sql = "SELECT * FROM eval_trace_issues FINAL WHERE tenant_id={t:String}"
    params: dict[str, Any] = {"t": tenant_id}
    if severity:
        sql += " AND severity={sev:String}"
        params["sev"] = severity
    if issue_type:
        sql += " AND type={typ:String}"
        params["typ"] = issue_type
    if resolved is not None:
        sql += " AND resolved={res:UInt8}"
        params["res"] = 1 if resolved else 0
    sql += " ORDER BY detected_at DESC"
    return [_deser_issue(r) for r in query_rows(sql, params)]


def get_issue(tenant_id: str, issue_id: str) -> dict[str, Any] | None:
    row = query_one(
        "SELECT * FROM eval_trace_issues FINAL WHERE tenant_id={t:String} AND issue_id={i:String}",
        {"t": tenant_id, "i": issue_id},
    )
    return _deser_issue(row) if row else None


def update_resolved(tenant_id: str, issue_id: str, resolved: bool) -> dict[str, Any] | None:
    row = get_issue(tenant_id, issue_id)
    if not row:
        return None
    now = now_utc()
    row["resolved"] = 1 if resolved else 0
    row["resolved_at"] = now if resolved else None
    row["updated_at"] = now
    insert_row("eval_trace_issues", row)
    row["resolved"] = resolved
    return row


def batch_create_issues(tenant_id: str, issues: list[dict[str, Any]]) -> int:
    now = now_utc()
    rows = []
    for data in issues:
        rows.append({
            "issue_id": str(uuid.uuid4()),
            "tenant_id": tenant_id,
            "trace_id": data.get("trace_id", ""),
            "type": data.get("type", ""),
            "severity": data.get("severity", "medium"),
            "title": data.get("title", ""),
            "description": data.get("description", ""),
            "ai_confidence": data.get("ai_confidence", 0.0),
            "model_id": data.get("model_id", ""),
            "trace_input": data.get("trace_input", ""),
            "trace_output": data.get("trace_output", ""),
            "suggested_action": data.get("suggested_action", ""),
            "resolved": 0,
            "resolved_at": None,
            "detected_at": data.get("detected_at", now),
            "created_at": now,
            "updated_at": now,
        })
    if rows:
        insert_rows("eval_trace_issues", rows)
    return len(rows)


def delete_unresolved_issues(tenant_id: str) -> int:
    issues = list_issues(tenant_id, resolved=False)
    if not issues:
        return 0
    ch().command(
        "ALTER TABLE eval_trace_issues DELETE WHERE tenant_id={t:String} AND resolved=0",
        parameters={"t": tenant_id},
    )
    return len(issues)


# =========================================================================
# Scan CRUD
# =========================================================================

def create_scan(tenant_id: str) -> dict[str, Any]:
    sid = str(uuid.uuid4())
    now = now_utc()
    row = {
        "scan_id": sid,
        "tenant_id": tenant_id,
        "status": "running",
        "traces_scanned": 0,
        "issues_found": 0,
        "error": "",
        "started_at": now,
        "completed_at": None,
        "created_at": now,
        "updated_at": now,
    }
    insert_row("eval_trace_scans", row)
    return {"scan_id": sid, "status": "running", "started_at": str(now)}


def update_scan(tenant_id: str, scan_id: str, updates: dict[str, Any]) -> None:
    row = query_one(
        "SELECT * FROM eval_trace_scans FINAL WHERE tenant_id={t:String} AND scan_id={s:String}",
        {"t": tenant_id, "s": scan_id},
    )
    if not row:
        return
    row.update(updates)
    row["updated_at"] = now_utc()
    insert_row("eval_trace_scans", row)


def get_scan(tenant_id: str, scan_id: str) -> dict[str, Any] | None:
    return query_one(
        "SELECT * FROM eval_trace_scans FINAL WHERE tenant_id={t:String} AND scan_id={s:String}",
        {"t": tenant_id, "s": scan_id},
    )
