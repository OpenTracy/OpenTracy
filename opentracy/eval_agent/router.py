"""
Eval Agent API Router

Mounts under /v1/eval-agent.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, Request

from .agent import EvalAgent

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/eval-agent", tags=["eval-agent"])

_agent = EvalAgent()


def _tenant(request: Request) -> str:
    return request.headers.get("x-tenant-id", "default")


def _auth(request: Request) -> str | None:
    return request.headers.get("authorization") or request.headers.get("x-api-key")


@router.post("/analyze")
async def analyze_dataset(request: Request):
    tenant = _tenant(request)
    body = await request.json()
    dataset_id = body.get("dataset_id")
    if not dataset_id:
        raise HTTPException(400, "dataset_id is required")

    auth = _auth(request)
    try:
        result = _agent.analyze(tenant, dataset_id, authorization=auth)
        return result
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        logger.exception("Eval agent analyze failed")
        raise HTTPException(500, f"Analysis failed: {e}")


@router.post("/setup", status_code=201)
async def setup_dataset(request: Request):
    tenant = _tenant(request)
    body = await request.json()
    dataset_id = body.get("dataset_id")
    if not dataset_id:
        raise HTTPException(400, "dataset_id is required")

    auto_trigger = body.get("auto_trigger", True)
    auth = _auth(request)

    try:
        result = _agent.setup(tenant, dataset_id, authorization=auth, auto_trigger=auto_trigger)
        return result
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        logger.exception("Eval agent setup failed")
        raise HTTPException(500, f"Setup failed: {e}")


@router.post("/scan")
async def scan_all(request: Request):
    tenant = _tenant(request)
    auth = _auth(request)
    try:
        result = _agent.scan_all(tenant, authorization=auth)
        return result
    except Exception as e:
        logger.exception("Eval agent scan failed")
        raise HTTPException(500, f"Scan failed: {e}")
