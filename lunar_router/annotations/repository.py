"""
Annotations Repository — ClickHouse

CRUD for eval_annotation_queues + eval_annotation_items tables.
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


def _deser_queue(r: dict[str, Any]) -> dict[str, Any]:
    r["rubric"] = parse_json_field(r, "rubric")
    return r


def _deser_item(r: dict[str, Any]) -> dict[str, Any]:
    r["scores"] = parse_json_field(r, "scores")
    r["metadata"] = parse_json_field(r, "metadata")
    return r


# =========================================================================
# Queue CRUD
# =========================================================================

def create_queue(tenant_id: str, data: dict[str, Any]) -> dict[str, Any]:
    qid = str(uuid.uuid4())
    now = now_utc()
    row = {
        "queue_id": qid,
        "tenant_id": tenant_id,
        "name": data["name"],
        "dataset_id": data["dataset_id"],
        "rubric": data.get("rubric", []),
        "total_items": 0,
        "completed_items": 0,
        "skipped_items": 0,
        "created_at": now,
        "updated_at": now,
    }
    insert_row("eval_annotation_queues", row)
    return _deser_queue({**row, "queue_id": qid})


def get_queue(tenant_id: str, queue_id: str) -> dict[str, Any] | None:
    row = query_one(
        "SELECT * FROM eval_annotation_queues FINAL WHERE tenant_id={t:String} AND queue_id={q:String}",
        {"t": tenant_id, "q": queue_id},
    )
    return _deser_queue(row) if row else None


def list_queues(tenant_id: str) -> list[dict[str, Any]]:
    rows = query_rows(
        "SELECT * FROM eval_annotation_queues FINAL WHERE tenant_id={t:String} ORDER BY created_at DESC",
        {"t": tenant_id},
    )
    return [_deser_queue(r) for r in rows]


def delete_queue(tenant_id: str, queue_id: str) -> bool:
    ch().command(
        "ALTER TABLE eval_annotation_items DELETE WHERE tenant_id={t:String} AND queue_id={q:String}",
        parameters={"t": tenant_id, "q": queue_id},
    )
    ch().command(
        "ALTER TABLE eval_annotation_queues DELETE WHERE tenant_id={t:String} AND queue_id={q:String}",
        parameters={"t": tenant_id, "q": queue_id},
    )
    return True


def _update_queue_counter(tenant_id: str, queue_id: str, field: str, increment: int = 1) -> None:
    """Increment a counter field on the queue by re-inserting with updated value."""
    q = get_queue(tenant_id, queue_id)
    if not q:
        return
    q[field] = q.get(field, 0) + increment
    q["updated_at"] = now_utc()
    insert_row("eval_annotation_queues", q)


# =========================================================================
# Item operations
# =========================================================================

def create_items_from_samples(tenant_id: str, queue_id: str, samples: list[dict[str, Any]]) -> int:
    now = now_utc()
    rows = []
    for s in samples:
        rows.append({
            "item_id": str(uuid.uuid4()),
            "tenant_id": tenant_id,
            "queue_id": queue_id,
            "sample_id": s.get("sample_id", ""),
            "input": s.get("input", ""),
            "expected_output": s.get("expected_output", ""),
            "metadata": s.get("metadata", {}),
            "status": "pending",
            "scores": {},
            "notes": "",
            "annotated_at": None,
            "created_at": now,
            "updated_at": now,
        })
    if rows:
        insert_rows("eval_annotation_items", rows)
        _update_queue_counter(tenant_id, queue_id, "total_items", len(rows))
    return len(rows)


def list_items(tenant_id: str, queue_id: str, status: str | None = None) -> list[dict[str, Any]]:
    sql = "SELECT * FROM eval_annotation_items FINAL WHERE tenant_id={t:String} AND queue_id={q:String}"
    params: dict[str, Any] = {"t": tenant_id, "q": queue_id}
    if status:
        sql += " AND status={s:String}"
        params["s"] = status
    sql += " ORDER BY created_at"
    return [_deser_item(r) for r in query_rows(sql, params)]


def get_next_pending(tenant_id: str, queue_id: str) -> dict[str, Any] | None:
    row = query_one(
        "SELECT * FROM eval_annotation_items FINAL WHERE tenant_id={t:String} AND queue_id={q:String} AND status='pending' ORDER BY created_at LIMIT 1",
        {"t": tenant_id, "q": queue_id},
    )
    return _deser_item(row) if row else None


def submit_item(tenant_id: str, queue_id: str, item_id: str, scores: dict, notes: str = "") -> dict[str, Any] | None:
    row = query_one(
        "SELECT * FROM eval_annotation_items FINAL WHERE tenant_id={t:String} AND queue_id={q:String} AND item_id={i:String} AND status='pending'",
        {"t": tenant_id, "q": queue_id, "i": item_id},
    )
    if not row:
        return None
    row = _deser_item(row)
    now = now_utc()
    row["status"] = "completed"
    row["scores"] = scores
    row["notes"] = notes
    row["annotated_at"] = now
    row["updated_at"] = now
    insert_row("eval_annotation_items", row)
    _update_queue_counter(tenant_id, queue_id, "completed_items")
    return row


def skip_item(tenant_id: str, queue_id: str, item_id: str) -> dict[str, Any] | None:
    row = query_one(
        "SELECT * FROM eval_annotation_items FINAL WHERE tenant_id={t:String} AND queue_id={q:String} AND item_id={i:String} AND status='pending'",
        {"t": tenant_id, "q": queue_id, "i": item_id},
    )
    if not row:
        return None
    row = _deser_item(row)
    now = now_utc()
    row["status"] = "skipped"
    row["annotated_at"] = now
    row["updated_at"] = now
    insert_row("eval_annotation_items", row)
    _update_queue_counter(tenant_id, queue_id, "skipped_items")
    return row


def get_completed_items(tenant_id: str, queue_id: str) -> list[dict[str, Any]]:
    return list_items(tenant_id, queue_id, status="completed")


def get_completed_items_by_dataset(tenant_id: str, dataset_id: str) -> dict[str, list[dict[str, Any]]]:
    queues = list_queues(tenant_id)
    matching = [q for q in queues if q.get("dataset_id") == dataset_id]
    result: dict[str, list[dict[str, Any]]] = {}
    for q in matching:
        items = get_completed_items(tenant_id, q["queue_id"])
        if items:
            result[q["queue_id"]] = items
    return result


def get_stats(tenant_id: str, queue_id: str) -> dict[str, Any] | None:
    q = get_queue(tenant_id, queue_id)
    if not q:
        return None
    total = q.get("total_items", 0)
    completed = q.get("completed_items", 0)
    skipped = q.get("skipped_items", 0)
    return {
        "queue_id": queue_id,
        "name": q.get("name", ""),
        "total_items": total,
        "completed_items": completed,
        "skipped_items": skipped,
        "pending_items": total - completed - skipped,
    }
