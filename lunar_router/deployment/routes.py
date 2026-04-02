"""Deployment API routes — /v1/deployments/* endpoints.

Matches the contract expected by ui/src/features/production/api/deploymentService.ts
and ui/src/services/DeploymentService.ts.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse

from . import storage
from .manager import (
    deploy_model,
    pause_deployment,
    resume_deployment,
    stop_deployment,
)

logger = logging.getLogger(__name__)

deployment_router = APIRouter()


# ---------------------------------------------------------------------------
# Create
# ---------------------------------------------------------------------------


@deployment_router.post("")
async def create_deployment(body: dict):
    """Create a new vLLM deployment.

    Request body:
    {
        model_id: str,
        instance_type: str,
        scaling?: {min: int, max: int},
        config: {vllm_args: str}
    }
    """
    model_id = body.get("model_id")
    if not model_id:
        raise HTTPException(400, "model_id is required")

    model_path = body.get("model_path", model_id)
    instance_type = body.get("instance_type", "local-gpu")
    config = body.get("config", {})
    config["instance_type"] = instance_type

    if body.get("scaling"):
        config["scaling"] = body["scaling"]

    result = await deploy_model(
        model_id=model_id,
        model_path=model_path,
        config=config,
    )

    # Return in the shape the UI expects
    dep = storage.get_deployment(result["deployment_id"])
    if dep:
        return JSONResponse(content=_format_deployment(dep))
    return JSONResponse(content=result)


# ---------------------------------------------------------------------------
# List
# ---------------------------------------------------------------------------


@deployment_router.get("")
async def list_deployments(statuses: str = Query("")):
    """List deployments, optionally filtered by status.

    GET /v1/deployments?statuses=in_service,starting,creating,failed,stopped
    """
    status_list = [s.strip() for s in statuses.split(",") if s.strip()] if statuses else None
    deps = storage.list_deployments(statuses=status_list)
    return {"deployments": [_format_deployment(d) for d in deps]}


# ---------------------------------------------------------------------------
# Status
# ---------------------------------------------------------------------------


@deployment_router.get("/{deployment_id}/status")
async def get_deployment_status(deployment_id: str):
    """Get deployment status for polling."""
    dep = storage.get_deployment(deployment_id)
    if dep is None:
        raise HTTPException(404, f"Deployment {deployment_id} not found")
    return JSONResponse(content=_format_deployment(dep))


# ---------------------------------------------------------------------------
# Metrics
# ---------------------------------------------------------------------------


@deployment_router.get("/{deployment_id}/metrics")
async def get_deployment_metrics(
    deployment_id: str,
    type: str = Query(""),
    minutes: int = Query(60),
    period: int = Query(60),
):
    """Get deployment metrics (basic local implementation)."""
    dep = storage.get_deployment(deployment_id)
    if dep is None:
        raise HTTPException(404, f"Deployment {deployment_id} not found")

    # For local deployments, return minimal metrics structure
    # A full implementation would query vLLM's /metrics prometheus endpoint
    now = datetime.now(timezone.utc).isoformat()
    return {
        "deployment_id": deployment_id,
        "latest": {
            "cpu_utilization": 0,
            "memory_utilization": 0,
            "gpu_utilization": 0,
            "gpu_memory_utilization": 0,
            "model_latency_ms": 0,
            "invocations": 0,
            "timestamp": now,
        },
        "inference_stats": {
            "total_inferences": 0,
            "successful": 0,
            "failed": 0,
            "success_rate": 100,
            "avg_latency_ms": 0,
            "total_tokens": 0,
            "total_cost_usd": 0,
        },
        "time_series": {
            "cpu_utilization": [],
            "memory_utilization": [],
            "gpu_utilization": [],
            "gpu_memory_utilization": [],
            "model_latency": [],
            "invocations": [],
        },
    }


# ---------------------------------------------------------------------------
# Delete
# ---------------------------------------------------------------------------


@deployment_router.delete("/{deployment_id}")
async def delete_deployment(deployment_id: str):
    """Stop and delete a deployment."""
    dep = storage.get_deployment(deployment_id)
    if dep is None:
        raise HTTPException(404, f"Deployment {deployment_id} not found")

    await stop_deployment(deployment_id)
    storage.update_deployment(deployment_id, status="deleting")
    storage.delete_deployment(deployment_id)
    return JSONResponse(content={}, status_code=204)


# ---------------------------------------------------------------------------
# Pause / Resume
# ---------------------------------------------------------------------------


@deployment_router.patch("/{deployment_id}/pause")
async def pause_deployment_route(deployment_id: str):
    """Pause a running deployment (SIGSTOP)."""
    dep = storage.get_deployment(deployment_id)
    if dep is None:
        raise HTTPException(404, f"Deployment {deployment_id} not found")
    if dep.get("status") not in ("in_service", "active"):
        raise HTTPException(400, "Can only pause an active deployment")

    await pause_deployment(deployment_id)
    dep = storage.get_deployment(deployment_id)
    return JSONResponse(content=_format_deployment(dep))


@deployment_router.patch("/{deployment_id}/resume")
async def resume_deployment_route(deployment_id: str):
    """Resume a paused deployment (SIGCONT)."""
    dep = storage.get_deployment(deployment_id)
    if dep is None:
        raise HTTPException(404, f"Deployment {deployment_id} not found")
    if dep.get("status") != "paused":
        raise HTTPException(400, "Can only resume a paused deployment")

    await resume_deployment(deployment_id)
    dep = storage.get_deployment(deployment_id)
    return JSONResponse(content=_format_deployment(dep))


# ---------------------------------------------------------------------------
# Response formatting
# ---------------------------------------------------------------------------


def _format_deployment(dep: dict) -> dict:
    """Format deployment dict to match the UI's expected DeploymentResponse shape."""
    return {
        "deployment_id": dep.get("id", ""),
        "endpoint_name": dep.get("endpoint_name", dep.get("model_id", "")),
        "status": dep.get("status", ""),
        "model_id": dep.get("model_id", ""),
        "instance_type": dep.get("instance_type", "local-gpu"),
        "updated_at": dep.get("updated_at", ""),
        "tenant_id": dep.get("tenant_id", "local"),
        "scaling": dep.get("scaling", {}),
        "error_message": dep.get("error_message", ""),
        "error_code": dep.get("error_code", ""),
        "endpoint_url": dep.get("endpoint_url", ""),
    }
