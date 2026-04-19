"""
Annotations API Router

Mounts under /v1/annotations.
"""
from __future__ import annotations

import csv
import logging
import math
from collections import Counter
from io import StringIO
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Request

from . import repository as repo

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/annotations", tags=["annotations"])


def _tenant(request: Request) -> str:
    return request.headers.get("x-tenant-id", "default")


# ── Queues ──────────────────────────────────────────────────────

@router.get("/queues")
async def list_queues(request: Request):
    tenant = _tenant(request)
    queues = repo.list_queues(tenant)
    return {"queues": queues, "count": len(queues)}


@router.post("/queues", status_code=201)
async def create_queue(request: Request):
    tenant = _tenant(request)
    body = await request.json()
    if "name" not in body:
        raise HTTPException(400, "name is required")
    if "dataset_id" not in body:
        raise HTTPException(400, "dataset_id is required")

    queue = repo.create_queue(tenant, {
        "name": body["name"],
        "dataset_id": body["dataset_id"],
        "rubric": body.get("rubric", []),
    })

    # Load samples from dataset
    from ..datasets.repository import get_samples
    samples = get_samples(tenant, body["dataset_id"])
    if samples:
        repo.create_items_from_samples(tenant, queue["queue_id"], samples)
        queue["total_items"] = len(samples)

    return queue


@router.delete("/queues/{queue_id}")
async def delete_queue(queue_id: str, request: Request):
    tenant = _tenant(request)
    if not repo.get_queue(tenant, queue_id):
        raise HTTPException(404, "Queue not found")
    repo.delete_queue(tenant, queue_id)
    return {"message": "Queue deleted"}


# ── Items ───────────────────────────────────────────────────────

@router.get("/queues/{queue_id}/items")
async def list_items(queue_id: str, request: Request, status: str | None = Query(None)):
    tenant = _tenant(request)
    items = repo.list_items(tenant, queue_id, status=status)
    return {"items": items, "count": len(items)}


@router.get("/queues/{queue_id}/next")
async def get_next_item(queue_id: str, request: Request):
    tenant = _tenant(request)
    item = repo.get_next_pending(tenant, queue_id)
    if not item:
        raise HTTPException(404, "No pending items")
    return item


@router.post("/queues/{queue_id}/items/{item_id}/submit")
async def submit_item(queue_id: str, item_id: str, request: Request):
    tenant = _tenant(request)
    body = await request.json()
    if "scores" not in body:
        raise HTTPException(400, "scores is required")
    result = repo.submit_item(tenant, queue_id, item_id, scores=body["scores"], notes=body.get("notes", ""))
    if not result:
        raise HTTPException(404, "Pending item not found")
    return result


@router.post("/queues/{queue_id}/items/{item_id}/skip")
async def skip_item(queue_id: str, item_id: str, request: Request):
    tenant = _tenant(request)
    result = repo.skip_item(tenant, queue_id, item_id)
    if not result:
        raise HTTPException(404, "Pending item not found")
    return result


# ── Stats / Export / Analytics ──────────────────────────────────

@router.get("/queues/{queue_id}/stats")
async def get_stats(queue_id: str, request: Request):
    tenant = _tenant(request)
    stats = repo.get_stats(tenant, queue_id)
    if not stats:
        raise HTTPException(404, "Queue not found")
    return stats


@router.get("/queues/{queue_id}/export")
async def export_annotations(queue_id: str, request: Request, format: str = Query("json")):
    tenant = _tenant(request)
    if format not in ("json", "csv"):
        raise HTTPException(400, "format must be 'json' or 'csv'")

    queue = repo.get_queue(tenant, queue_id)
    if not queue:
        raise HTTPException(404, "Queue not found")

    items = repo.get_completed_items(tenant, queue_id)

    if format == "json":
        return {"queue": queue, "annotations": items, "count": len(items)}

    rubric = queue.get("rubric", [])
    criteria_names = [c["name"] for c in rubric]

    if not items:
        return {"csv": "", "filename": f"annotations_{queue_id}.csv"}

    output = StringIO()
    columns = ["sample_id", "input", "expected_output"] + criteria_names + ["notes", "annotated_at"]
    writer = csv.DictWriter(output, fieldnames=columns, extrasaction="ignore")
    writer.writeheader()

    for item in items:
        scores = item.get("scores", {})
        row: dict[str, Any] = {
            "sample_id": item.get("sample_id", ""),
            "input": item.get("input", ""),
            "expected_output": item.get("expected_output", ""),
            "notes": item.get("notes", ""),
            "annotated_at": item.get("annotated_at", ""),
        }
        for crit in criteria_names:
            row[crit] = scores.get(crit, "")
        writer.writerow(row)

    return {"csv": output.getvalue(), "filename": f"annotations_{queue_id}.csv"}


def _compute_cohens_kappa(ratings_a: list[int], ratings_b: list[int], scale_min: int, scale_max: int) -> float:
    n = len(ratings_a)
    if n == 0:
        return 0.0
    categories = list(range(scale_min, scale_max + 1))
    agree = sum(1 for a, b in zip(ratings_a, ratings_b) if a == b)
    p_observed = agree / n
    count_a = Counter(ratings_a)
    count_b = Counter(ratings_b)
    p_expected = sum((count_a[c] / n) * (count_b[c] / n) for c in categories)
    if p_expected == 1.0:
        return 1.0
    return (p_observed - p_expected) / (1 - p_expected)


@router.get("/queues/{queue_id}/analytics")
async def get_analytics(queue_id: str, request: Request):
    tenant = _tenant(request)
    queue = repo.get_queue(tenant, queue_id)
    if not queue:
        raise HTTPException(404, "Queue not found")

    items = repo.get_completed_items(tenant, queue_id)
    rubric = queue.get("rubric", [])

    criteria_stats: dict[str, Any] = {}
    for criterion in rubric:
        crit_name = criterion["name"]
        scale_min = criterion.get("scale_min", 1)
        scale_max = criterion.get("scale_max", 5)

        values = [item["scores"][crit_name] for item in items if crit_name in item.get("scores", {})]
        if not values:
            criteria_stats[crit_name] = {"mean": None, "median": None, "std_dev": None, "min": None, "max": None, "distribution": {}}
            continue

        n = len(values)
        mean = sum(values) / n
        sorted_vals = sorted(values)
        median = sorted_vals[n // 2] if n % 2 == 1 else (sorted_vals[n // 2 - 1] + sorted_vals[n // 2]) / 2
        variance = sum((v - mean) ** 2 for v in values) / n
        std_dev = math.sqrt(variance)
        distribution = {str(s): values.count(s) for s in range(scale_min, scale_max + 1)}

        criteria_stats[crit_name] = {
            "mean": round(mean, 2),
            "median": round(median, 2),
            "std_dev": round(std_dev, 2),
            "min": min(values),
            "max": max(values),
            "distribution": distribution,
        }

    # Inter-annotator agreement
    agreement = None
    dataset_id = queue.get("dataset_id")
    if dataset_id:
        all_queue_items = repo.get_completed_items_by_dataset(tenant, dataset_id)
        other_queue_ids = [qid for qid in all_queue_items if qid != queue_id]

        if other_queue_ids:
            current_by_sample = {item["sample_id"]: item.get("scores", {}) for item in items if item.get("sample_id")}
            other_by_sample: dict[str, dict[str, Any]] = {}
            for qid in other_queue_ids:
                for item in all_queue_items[qid]:
                    sid = item.get("sample_id")
                    if sid and sid not in other_by_sample:
                        other_by_sample[sid] = item.get("scores", {})

            overlapping = set(current_by_sample.keys()) & set(other_by_sample.keys())
            if overlapping:
                cohens_kappa: dict[str, float] = {}
                percent_agreement: dict[str, float] = {}

                for criterion in rubric:
                    crit_name = criterion["name"]
                    scale_min = criterion.get("scale_min", 1)
                    scale_max = criterion.get("scale_max", 5)
                    ratings_a, ratings_b = [], []

                    for sid in overlapping:
                        a = current_by_sample[sid].get(crit_name)
                        b = other_by_sample[sid].get(crit_name)
                        if a is not None and b is not None:
                            ratings_a.append(a)
                            ratings_b.append(b)

                    if ratings_a:
                        kappa = _compute_cohens_kappa(ratings_a, ratings_b, scale_min, scale_max)
                        cohens_kappa[crit_name] = round(kappa, 2)
                        pct = sum(1 for a, b in zip(ratings_a, ratings_b) if a == b) / len(ratings_a)
                        percent_agreement[crit_name] = round(pct, 2)

                agreement = {
                    "compared_queues": other_queue_ids,
                    "overlapping_samples": len(overlapping),
                    "cohens_kappa": cohens_kappa,
                    "percent_agreement": percent_agreement,
                }

    return {
        "queue_id": queue_id,
        "total_annotated": len(items),
        "criteria": criteria_stats,
        "agreement": agreement,
    }
