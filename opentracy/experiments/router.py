"""
Experiments API Router

Mounts under /v1/experiments.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, Query, Request

from . import repository as repo
from .runner import ExperimentRunner

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/experiments", tags=["experiments"])

_runner = ExperimentRunner()


def _tenant(request: Request) -> str:
    return request.headers.get("x-tenant-id", "default")


@router.get("")
async def list_experiments(request: Request, status: str | None = Query(None)):
    tenant = _tenant(request)
    experiments = repo.list_all(tenant, status=status)
    return {"experiments": experiments, "count": len(experiments)}


@router.post("", status_code=201)
async def create_experiment(request: Request):
    tenant = _tenant(request)
    body = await request.json()

    required = ["name", "dataset_id", "evaluation_ids"]
    missing = [f for f in required if f not in body]
    if missing:
        raise HTTPException(400, f"Missing required fields: {', '.join(missing)}")

    evaluation_ids = body["evaluation_ids"]
    if not isinstance(evaluation_ids, list) or len(evaluation_ids) < 2:
        raise HTTPException(400, "evaluation_ids must be a list with at least 2 evaluations")

    # Validate each evaluation exists
    from ..evaluations import repository as eval_repo
    for eid in evaluation_ids:
        if not eval_repo.get(tenant, eid):
            raise HTTPException(404, f"Evaluation not found: {eid}")

    experiment = repo.create(tenant, {
        "name": body["name"],
        "description": body.get("description", ""),
        "dataset_id": body["dataset_id"],
        "evaluation_ids": evaluation_ids,
        "tags": body.get("tags", []),
    })
    return experiment


@router.get("/{experiment_id}")
async def get_experiment(experiment_id: str, request: Request):
    tenant = _tenant(request)
    experiment = repo.get(tenant, experiment_id)
    if not experiment:
        raise HTTPException(404, "Experiment not found")
    return experiment


@router.delete("/{experiment_id}")
async def delete_experiment(experiment_id: str, request: Request):
    tenant = _tenant(request)
    experiment = repo.get(tenant, experiment_id)
    if not experiment:
        raise HTTPException(404, "Experiment not found")
    if experiment.get("status") == "running":
        raise HTTPException(400, "Cannot delete a running experiment")
    repo.delete(tenant, experiment_id)
    return {"message": "Experiment deleted"}


@router.get("/{experiment_id}/comparison")
async def get_comparison(experiment_id: str, request: Request, force: str | None = Query(None)):
    tenant = _tenant(request)
    experiment = repo.get(tenant, experiment_id)
    if not experiment:
        raise HTTPException(404, "Experiment not found")

    if force != "true":
        comparison = repo.get_comparison(tenant, experiment_id)
        if comparison:
            return comparison

    if experiment.get("status") in ("draft", "completed"):
        try:
            return _runner.build_comparison(tenant, experiment_id)
        except ValueError as e:
            raise HTTPException(400, str(e))
        except Exception:
            logger.exception("Failed to build comparison")
            raise HTTPException(500, "Failed to build comparison")

    if experiment.get("status") != "completed":
        raise HTTPException(400, f"Experiment is not completed. Status: {experiment.get('status')}")
    raise HTTPException(404, "Comparison not found")
