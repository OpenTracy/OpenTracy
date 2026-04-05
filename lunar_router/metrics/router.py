"""
Metrics API Router

Mounts under /v1/metrics.
"""
from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Request

from . import repository as repo

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/metrics", tags=["metrics"])


def _tenant(request: Request) -> str:
    return request.headers.get("x-tenant-id", "default")


@router.get("")
async def list_metrics(request: Request, type: str | None = Query(None)):
    tenant = _tenant(request)
    if type == "builtin":
        metrics = repo.list_builtin()
    elif type == "custom":
        metrics = repo.list_custom(tenant)
    else:
        metrics = repo.list_all(tenant)
    return {"metrics": metrics, "count": len(metrics)}


@router.post("")
async def create_metric(request: Request):
    tenant = _tenant(request)
    body = await request.json()

    required = ["name", "type"]
    missing = [f for f in required if f not in body]
    if missing:
        raise HTTPException(400, f"Missing required fields: {', '.join(missing)}")

    valid_types = ["exact_match", "contains", "semantic_sim", "llm_judge", "latency", "cost", "python"]
    if body["type"] not in valid_types:
        raise HTTPException(400, f"Invalid type. Must be one of: {', '.join(valid_types)}")

    if body["type"] == "python" and "python_script" not in body:
        raise HTTPException(400, "python_script is required for python type metrics")

    metric_data: dict[str, Any] = {
        "name": body["name"],
        "type": body["type"],
        "description": body.get("description", ""),
        "config": body.get("config", {}),
    }
    if "python_script" in body:
        metric_data["python_script"] = body["python_script"]
    if "requirements" in body:
        metric_data["requirements"] = body["requirements"]

    metric = repo.create(tenant, metric_data)
    return metric


@router.get("/{metric_id}")
async def get_metric(metric_id: str, request: Request):
    tenant = _tenant(request)
    metric = repo.get(tenant, metric_id)
    if not metric:
        raise HTTPException(404, "Metric not found")
    return metric


@router.put("/{metric_id}")
async def update_metric(metric_id: str, request: Request):
    tenant = _tenant(request)
    existing = repo.get(tenant, metric_id)
    if not existing:
        raise HTTPException(404, "Metric not found")
    if existing.get("is_builtin"):
        raise HTTPException(403, "Cannot modify builtin metrics")

    body = await request.json()
    allowed = ["name", "description", "config", "python_script", "requirements"]
    updates = {k: v for k, v in body.items() if k in allowed}
    if not updates:
        raise HTTPException(400, "No valid fields to update")

    metric = repo.update(tenant, metric_id, updates)
    return metric


@router.delete("/{metric_id}")
async def delete_metric(metric_id: str, request: Request):
    tenant = _tenant(request)
    existing = repo.get(tenant, metric_id)
    if not existing:
        raise HTTPException(404, "Metric not found")
    if existing.get("is_builtin"):
        raise HTTPException(403, "Cannot delete builtin metrics")
    repo.delete(tenant, metric_id)
    return {"message": "Metric deleted"}


@router.post("/validate-script")
async def validate_script(request: Request):
    body = await request.json()
    if "python_script" not in body:
        raise HTTPException(400, "python_script is required")

    script = body["python_script"]
    errors = []
    warnings = []

    if "def evaluate(" not in script:
        errors.append("Script must define an 'evaluate' function")

    dangerous = ["os", "subprocess", "sys", "shutil", "socket"]
    for imp in dangerous:
        if f"import {imp}" in script or f"from {imp}" in script:
            errors.append(f"Import of '{imp}' is not allowed")

    try:
        compile(script, "<string>", "exec")
    except SyntaxError as e:
        errors.append(f"Syntax error: {e}")

    test_result = None
    if not errors and all(k in body for k in ["test_input", "test_output"]):
        try:
            sandbox = {"__builtins__": {
                "len": len, "str": str, "int": int, "float": float,
                "bool": bool, "list": list, "dict": dict, "min": min,
                "max": max, "sum": sum, "abs": abs, "round": round,
                "range": range, "enumerate": enumerate, "zip": zip,
                "True": True, "False": False, "None": None,
            }}
            exec(script, sandbox)
            if "evaluate" in sandbox:
                result = sandbox["evaluate"](
                    output=body["test_output"],
                    expected=body.get("test_expected", ""),
                    input_text=body["test_input"],
                )
                test_result = {"success": True, "result": result}
        except Exception as e:
            test_result = {"success": False, "error": str(e)}

    response = {"valid": len(errors) == 0, "errors": errors, "warnings": warnings}
    if test_result:
        response["test_result"] = test_result
    return response
