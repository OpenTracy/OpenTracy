"""
Evaluations API Router

Mounts under /v1/evaluations.
"""
from __future__ import annotations

import csv
import logging
from datetime import datetime, timedelta
from io import StringIO
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Request

from . import repository as repo
from .runner import EvaluationRunner

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/evaluations", tags=["evaluations"])


def _tenant(request: Request) -> str:
    return request.headers.get("x-tenant-id", "default")


def _auth(request: Request) -> str | None:
    return (
        request.headers.get("authorization")
        or request.headers.get("x-api-key")
    )


_runner = EvaluationRunner()



@router.get("")
async def list_evaluations(request: Request, status: str | None = Query(None)):
    tenant = _tenant(request)
    evaluations = repo.list_all(tenant, status=status)

    # Auto-detect stale evaluations
    now = datetime.utcnow()
    for i, ev in enumerate(evaluations):
        st = ev.get("status")
        if st in ("running", "queued", "starting"):
            ts_field = "started_at" if st == "running" else "created_at"
            threshold = timedelta(hours=2) if st == "running" else timedelta(minutes=30)
            ts = ev.get(ts_field)
            if ts:
                try:
                    ts_str = ts if isinstance(ts, str) else ts.isoformat()
                    ts_dt = datetime.fromisoformat(ts_str.replace("Z", "+00:00").replace("+00:00", ""))
                    if now - ts_dt > threshold:
                        updated = repo.update_status(
                            tenant, ev["evaluation_id"],
                            status="failed",
                            error_message=f"Evaluation timed out ({st})",
                        )
                        if updated:
                            evaluations[i] = updated
                except (ValueError, TypeError):
                    pass

    return {"evaluations": evaluations, "count": len(evaluations)}


@router.post("")
async def create_evaluation(request: Request):
    tenant = _tenant(request)
    body = await request.json()

    required = ["name", "dataset_id", "models", "metrics"]
    missing = [f for f in required if f not in body]
    if missing:
        raise HTTPException(400, f"Missing required fields: {', '.join(missing)}")

    from ..datasets import repository as ds_repo
    dataset = ds_repo.get_dataset(tenant, body["dataset_id"])
    if not dataset:
        raise HTTPException(404, "Dataset not found")

    if not isinstance(body["models"], list) or len(body["models"]) == 0:
        raise HTTPException(400, "models must be a non-empty array")
    if not isinstance(body["metrics"], list) or len(body["metrics"]) == 0:
        raise HTTPException(400, "metrics must be a non-empty array")

    samples = ds_repo.get_samples(tenant, body["dataset_id"])

    evaluation_data = {
        "name": body["name"],
        "description": body.get("description", ""),
        "dataset_id": body["dataset_id"],
        "models": body["models"],
        "metrics": body["metrics"],
        "config": body.get("config", {}),
        "total_samples": len(samples),
    }

    evaluation = repo.create(tenant, evaluation_data)

    # Execute evaluation synchronously (in-process)
    try:
        authorization = _auth(request)
        result = _runner.run(tenant, evaluation["evaluation_id"], authorization=authorization)
        if result.get("success"):
            evaluation = repo.get(tenant, evaluation["evaluation_id"])
    except Exception as e:
        logger.exception("Error executing evaluation: %s", e)
        repo.update_status(tenant, evaluation["evaluation_id"], status="failed", error_message=str(e))
        evaluation = repo.get(tenant, evaluation["evaluation_id"])

    return evaluation



@router.get("/settings")
async def get_settings_redirect(request: Request):
    """Redirect /v1/evaluations/settings — handled by settings module."""
    from ..settings.router import get_settings
    return await get_settings(request)


@router.put("/settings")
async def put_settings_redirect(request: Request):
    """Redirect /v1/evaluations/settings — handled by settings module."""
    from ..settings.router import update_settings
    return await update_settings(request)


@router.get("/{evaluation_id}")
async def get_evaluation(evaluation_id: str, request: Request):
    tenant = _tenant(request)
    evaluation = repo.get(tenant, evaluation_id)
    if not evaluation:
        raise HTTPException(404, "Evaluation not found")
    return evaluation


@router.get("/{evaluation_id}/status")
async def get_status(evaluation_id: str, request: Request):
    tenant = _tenant(request)
    evaluation = repo.get(tenant, evaluation_id)
    if not evaluation:
        raise HTTPException(404, "Evaluation not found")
    return {
        "evaluation_id": evaluation_id,
        "status": evaluation.get("status"),
        "progress": evaluation.get("progress", 0),
        "current_sample": evaluation.get("current_sample", 0),
        "total_samples": evaluation.get("total_samples", 0),
        "error_message": evaluation.get("error_message"),
    }


@router.get("/{evaluation_id}/results")
async def get_results(evaluation_id: str, request: Request):
    tenant = _tenant(request)
    evaluation = repo.get(tenant, evaluation_id)
    if not evaluation:
        raise HTTPException(404, "Evaluation not found")
    result = repo.get_result(tenant, evaluation_id)
    if not result:
        if evaluation.get("status") == "completed":
            raise HTTPException(404, "Results not found")
        raise HTTPException(400, f"Evaluation not complete. Status: {evaluation.get('status')}")
    return result


@router.get("/{evaluation_id}/export")
async def export_results(
    evaluation_id: str,
    request: Request,
    format: str = Query("json"),
):
    tenant = _tenant(request)
    evaluation = repo.get(tenant, evaluation_id)
    if not evaluation:
        raise HTTPException(404, "Evaluation not found")
    result = repo.get_result(tenant, evaluation_id)
    if not result:
        raise HTTPException(400, "No results to export")

    if format == "json":
        return {"evaluation": evaluation, "results": result}

    # CSV
    samples = result.get("samples", [])
    if not samples:
        return {"csv": "", "message": "No samples"}

    models = evaluation.get("models", [])
    metrics = evaluation.get("metrics", [])

    columns = ["sample_id", "input"]
    for model in models:
        columns.extend([f"{model}_output", f"{model}_latency", f"{model}_cost"])
    for metric in metrics:
        mid = metric.get("metric_id", metric) if isinstance(metric, dict) else metric
        for model in models:
            columns.append(f"{model}_{mid}")

    output = StringIO()
    writer = csv.DictWriter(output, fieldnames=columns, extrasaction="ignore")
    writer.writeheader()

    for sample in samples:
        row: dict[str, Any] = {
            "sample_id": sample.get("sample_id", ""),
            "input": sample.get("input", ""),
        }
        outputs = sample.get("outputs", {})
        for model in models:
            mo = outputs.get(model, {})
            row[f"{model}_output"] = mo.get("output", "")
            row[f"{model}_latency"] = mo.get("latency", "")
            row[f"{model}_cost"] = mo.get("cost", "")
        scores = sample.get("scores", {})
        for metric in metrics:
            mid = metric.get("metric_id", metric) if isinstance(metric, dict) else metric
            ms = scores.get(mid, {})
            for model in models:
                val = ms.get(model, "")
                if isinstance(val, dict):
                    val = val.get("score", "")
                row[f"{model}_{mid}"] = val
        writer.writerow(row)

    return {"csv": output.getvalue(), "filename": f"evaluation_{evaluation_id}.csv"}


@router.delete("/{evaluation_id}")
async def delete_evaluation(evaluation_id: str, request: Request):
    tenant = _tenant(request)
    evaluation = repo.get(tenant, evaluation_id)
    if not evaluation:
        raise HTTPException(404, "Evaluation not found")
    if evaluation.get("status") == "running":
        raise HTTPException(400, "Cannot delete a running evaluation. Cancel it first.")
    repo.delete(tenant, evaluation_id)
    return {"message": "Evaluation deleted"}



@router.post("/{evaluation_id}/cancel")
async def cancel_evaluation(evaluation_id: str, request: Request):
    tenant = _tenant(request)
    evaluation = repo.get(tenant, evaluation_id)
    if not evaluation:
        raise HTTPException(404, "Evaluation not found")
    st = evaluation.get("status")
    if st not in ("pending", "queued", "starting", "running"):
        raise HTTPException(400, f"Cannot cancel evaluation with status: {st}")
    updated = repo.update_status(tenant, evaluation_id, status="cancelled")
    return {"message": "Evaluation cancelled", "evaluation": updated}


@router.post("/{evaluation_id}/rerun")
async def rerun_evaluation(evaluation_id: str, request: Request):
    tenant = _tenant(request)
    evaluation = repo.get(tenant, evaluation_id)
    if not evaluation:
        raise HTTPException(404, "Evaluation not found")
    st = evaluation.get("status")
    if st not in ("completed", "failed", "cancelled"):
        raise HTTPException(400, f"Cannot rerun evaluation with status: {st}")

    new_data = {
        "name": f"{evaluation.get('name')} (rerun)",
        "description": evaluation.get("description", ""),
        "dataset_id": evaluation.get("dataset_id"),
        "models": evaluation.get("models"),
        "metrics": evaluation.get("metrics"),
        "config": evaluation.get("config", {}),
        "total_samples": evaluation.get("total_samples", 0),
        "original_evaluation_id": evaluation_id,
    }
    new_eval = repo.create(tenant, new_data)

    try:
        authorization = _auth(request)
        result = _runner.run(tenant, new_eval["evaluation_id"], authorization=authorization)
        if result.get("success"):
            new_eval = repo.get(tenant, new_eval["evaluation_id"])
    except Exception as e:
        logger.exception("Error rerunning evaluation: %s", e)
        repo.update_status(tenant, new_eval["evaluation_id"], status="failed", error_message=str(e))
        new_eval = repo.get(tenant, new_eval["evaluation_id"])

    return {"message": "Evaluation rerun started", "evaluation": new_eval}


@router.post("/log")
async def log_evaluation(request: Request):
    """Log a locally-executed evaluation from SDK."""
    tenant = _tenant(request)
    body = await request.json()

    required = ["id", "name", "status"]
    missing = [f for f in required if f not in body]
    if missing:
        raise HTTPException(400, f"Missing required fields: {', '.join(missing)}")

    metrics = body.get("metrics", body.get("scorer_names", []))

    evaluation_data = {
        "name": body["name"],
        "description": body.get("description", "SDK local execution"),
        "status": body["status"],
        "execution_type": "local",
        "metrics": metrics,
        "models": body.get("models", []),
        "config": body.get("config", {}),
        "progress": body.get("progress", {}).get("completed", 0),
        "total_samples": body.get("progress", {}).get("total", 0),
        "created_at": body.get("created_at"),
    }

    sdk_eval_id = body["id"]
    evaluation = repo.create_with_id(tenant, sdk_eval_id, evaluation_data)

    # Store results
    results = body.get("results", {})
    if results:
        repo.save_result(tenant, evaluation["evaluation_id"], results)
    else:
        rows = body.get("rows", [])
        if rows:
            result_data = {
                "samples": [
                    {
                        "sample_id": row.get("datapoint_id", ""),
                        "input": row.get("input", ""),
                        "output": row.get("output", ""),
                        "expected": row.get("expected", ""),
                        "scores": {
                            score.get("name"): {
                                "score": score.get("score", 0),
                                "raw_value": score.get("raw_value"),
                                "explanation": score.get("explanation"),
                            }
                            for score in row.get("scores", [])
                        },
                    }
                    for row in rows
                ],
                "summary": body.get("summary", {}),
            }
            repo.save_result(tenant, evaluation["evaluation_id"], result_data)

    return {
        "message": "Evaluation logged successfully",
        "evaluation_id": evaluation["evaluation_id"],
        "sdk_evaluation_id": sdk_eval_id,
    }


@router.post("/cleanup")
async def cleanup_stale(request: Request):
    tenant = _tenant(request)
    body = await request.json() if request.headers.get("content-type", "").startswith("application/json") else {}
    threshold = float(body.get("stale_threshold_hours", 1.0))

    stale = repo.find_stale_evaluations(tenant, threshold)
    if not stale:
        return {"message": "No stale evaluations found", "cleaned_up": 0, "evaluations": []}

    marked = repo.mark_stale_as_failed(tenant, threshold)
    return {
        "message": f"Cleaned up {len(marked)} stale evaluation(s)",
        "cleaned_up": len(marked),
        "evaluations": [
            {
                "evaluation_id": e.get("evaluation_id"),
                "name": e.get("name"),
                "error_message": e.get("error_message"),
            }
            for e in marked
        ],
    }
