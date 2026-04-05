"""
Auto-Eval API Router

Mounts under /v1/auto-eval.
"""
from __future__ import annotations

import logging
from datetime import datetime

from fastapi import APIRouter, HTTPException, Request

from . import repository as repo

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/auto-eval", tags=["auto-eval"])


def _tenant(request: Request) -> str:
    return request.headers.get("x-tenant-id", "default")


def _auth(request: Request) -> str | None:
    return (
        request.headers.get("authorization")
        or request.headers.get("x-api-key")
    )


# ── Configs ─────────────────────────────────────────────────────

@router.get("/configs")
async def list_configs(request: Request):
    tenant = _tenant(request)
    configs = repo.list_configs(tenant)
    return {"configs": configs, "count": len(configs)}


@router.post("/configs", status_code=201)
async def create_config(request: Request):
    tenant = _tenant(request)
    body = await request.json()

    required = ["name", "dataset_id", "models", "metrics"]
    missing = [f for f in required if f not in body]
    if missing:
        raise HTTPException(400, f"Missing required fields: {', '.join(missing)}")

    if not isinstance(body["models"], list) or len(body["models"]) == 0:
        raise HTTPException(400, "models must be a non-empty array")
    if not isinstance(body["metrics"], list) or len(body["metrics"]) == 0:
        raise HTTPException(400, "metrics must be a non-empty array")

    config = repo.create_config(tenant, {
        "name": body["name"],
        "dataset_id": body["dataset_id"],
        "dataset_name": body.get("dataset_name", ""),
        "models": body["models"],
        "metrics": body["metrics"],
        "schedule": body.get("schedule", "daily"),
        "alert_on_regression": body.get("alert_on_regression", True),
        "regression_threshold": body.get("regression_threshold", 0.05),
        "topic_filter": body.get("topic_filter"),
    })
    return config


@router.put("/configs/{config_id}")
async def update_config(config_id: str, request: Request):
    tenant = _tenant(request)
    if not repo.get_config(tenant, config_id):
        raise HTTPException(404, "Config not found")

    body = await request.json()
    allowed = {"name", "dataset_id", "dataset_name", "models", "metrics",
               "schedule", "alert_on_regression", "regression_threshold",
               "topic_filter", "enabled"}
    updates = {k: v for k, v in body.items() if k in allowed}
    if not updates:
        raise HTTPException(400, "No valid fields to update")

    updated = repo.update_config(tenant, config_id, updates)
    return updated


@router.delete("/configs/{config_id}")
async def delete_config(config_id: str, request: Request):
    tenant = _tenant(request)
    if not repo.get_config(tenant, config_id):
        raise HTTPException(404, "Config not found")
    repo.delete_config(tenant, config_id)
    return {"message": "Config deleted"}


# ── Runs / Trigger ──────────────────────────────────────────────

@router.post("/configs/{config_id}/trigger", status_code=202)
async def trigger_run(config_id: str, request: Request):
    tenant = _tenant(request)
    config = repo.get_config(tenant, config_id)
    if not config:
        raise HTTPException(404, "Config not found")

    from ..datasets.repository import get_samples
    from ..evaluations import repository as eval_repo
    from ..evaluations.runner import EvaluationRunner

    samples = get_samples(tenant, config["dataset_id"])

    now = datetime.utcnow().isoformat()
    evaluation_data = {
        "name": f"[Auto] {config['name']} - {now[:16]}",
        "description": f"Auto-eval run for config {config_id}",
        "dataset_id": config["dataset_id"],
        "models": config["models"],
        "metrics": config["metrics"],
        "config": {},
        "total_samples": len(samples),
        "auto_eval_config_id": config_id,
    }

    evaluation = eval_repo.create(tenant, evaluation_data)
    eid = evaluation["evaluation_id"]

    auth = _auth(request)
    try:
        runner = EvaluationRunner()
        runner.run(tenant, eid, authorization=auth)
    except Exception as e:
        logger.exception("Error running auto-eval evaluation: %s", e)
        eval_repo.update_status(tenant, eid, status="failed", error_message=str(e))

    run = repo.create_run(tenant, config_id, {"evaluation_id": eid})
    return run


@router.get("/configs/{config_id}/runs")
async def list_runs(config_id: str, request: Request):
    tenant = _tenant(request)
    config = repo.get_config(tenant, config_id)
    if not config:
        raise HTTPException(404, "Config not found")

    from ..evaluations import repository as eval_repo

    runs = repo.list_runs(tenant, config_id)

    # Lazy hydration
    for run in runs:
        if run.get("status") != "running":
            continue
        eid = run.get("evaluation_id")
        if not eid:
            continue
        try:
            evaluation = eval_repo.get(tenant, eid)
            if not evaluation:
                continue
            es = evaluation.get("status")
            if es not in ("completed", "failed"):
                continue

            run_updates: dict = {"status": es}

            if es == "completed":
                run_updates["completed_at"] = evaluation.get("completed_at", datetime.utcnow().isoformat())
                result = eval_repo.get_result(tenant, eid)
                if result:
                    summary = result.get("summary", {})
                    scores = {}
                    for metric_id, metric_data in summary.items():
                        if isinstance(metric_data, dict) and "average" in metric_data:
                            scores[metric_id] = metric_data["average"]
                        elif isinstance(metric_data, (int, float)):
                            scores[metric_id] = metric_data
                    run_updates["scores"] = scores
                    run_updates["regression_detected"] = _detect_regression(config, scores)

                    avg_score = sum(scores.values()) / len(scores) if scores else 0
                    repo.update_config_last_run(tenant, config_id, avg_score, run_updates["completed_at"])
            elif es == "failed":
                run_updates["completed_at"] = evaluation.get("completed_at", datetime.utcnow().isoformat())
                run_updates["error_message"] = evaluation.get("error_message", "Evaluation failed")

            repo.update_run(tenant, config_id, run["run_id"], run_updates)
            run.update(run_updates)
        except Exception as e:
            logger.warning("Failed to hydrate run %s: %s", run.get("run_id"), e)

    return {"runs": runs, "count": len(runs)}


def _detect_regression(config: dict, scores: dict) -> bool:
    threshold = config.get("regression_threshold", 0.05)
    last_score = config.get("last_run_score")
    if not scores or not config.get("alert_on_regression"):
        return False
    avg_score = sum(scores.values()) / len(scores)
    if last_score is not None and last_score > 0:
        return (last_score - avg_score) > threshold
    return False


# ── Suggest metrics ─────────────────────────────────────────────

@router.post("/suggest-metrics")
async def suggest_metrics(request: Request):
    tenant = _tenant(request)
    body = await request.json()
    dataset_id = body.get("dataset_id")
    if not dataset_id:
        raise HTTPException(400, "dataset_id is required")

    from ..datasets.repository import get_dataset, get_samples
    dataset = get_dataset(tenant, dataset_id)
    if not dataset:
        raise HTTPException(404, "Dataset not found")

    samples = get_samples(tenant, dataset_id)
    if not samples:
        raise HTTPException(400, "Dataset has no samples")

    auth = _auth(request)
    from ..evals_common import MetricSuggester
    suggester = MetricSuggester()
    suggestions = suggester.suggest(samples[:10], authorization=auth)
    return {"suggestions": suggestions, "dataset_id": dataset_id}
