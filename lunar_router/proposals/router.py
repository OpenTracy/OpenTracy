"""
Proposals API Router

Mounts under /v1/proposals.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, Query, Request

from . import repository as repo
from .decision_engine import DecisionEngine

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/proposals", tags=["proposals"])
_engine = DecisionEngine()


def _tenant(request: Request) -> str:
    return request.headers.get("x-tenant-id", "default")


def _auth(request: Request) -> str | None:
    return request.headers.get("authorization") or request.headers.get("x-api-key")


@router.get("")
async def list_proposals(request: Request, status: str | None = Query(None)):
    tenant = _tenant(request)
    proposals = repo.list_all(tenant, status=status)
    return {"proposals": proposals, "count": len(proposals)}


@router.get("/{proposal_id}")
async def get_proposal(proposal_id: str, request: Request):
    tenant = _tenant(request)
    proposal = repo.get(tenant, proposal_id)
    if not proposal:
        raise HTTPException(404, "Proposal not found")
    return proposal


@router.post("/{proposal_id}/approve")
async def approve_proposal(proposal_id: str, request: Request):
    tenant = _tenant(request)
    proposal = repo.get(tenant, proposal_id)
    if not proposal:
        raise HTTPException(404, "Proposal not found")
    if proposal.get("status") != "pending":
        raise HTTPException(400, f"Cannot approve proposal with status: {proposal.get('status')}")

    repo.update_status(tenant, proposal_id, "approved")
    auth = _auth(request)

    try:
        result = _engine.execute_proposal(tenant, proposal, authorization=auth)
        if result.get("success"):
            repo.update_status(tenant, proposal_id, "executed", execution_result=result)
            return {"message": "Proposal approved and executed", "proposal_id": proposal_id, "execution_result": result}
        else:
            repo.update_status(tenant, proposal_id, "failed", execution_result=result)
            raise HTTPException(500, detail={"error": "Proposal execution failed", "execution_result": result})
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Proposal execution error")
        error_result = {"success": False, "error": str(e)}
        repo.update_status(tenant, proposal_id, "failed", execution_result=error_result)
        raise HTTPException(500, f"Proposal execution failed: {e}")


@router.post("/{proposal_id}/reject")
async def reject_proposal(proposal_id: str, request: Request):
    tenant = _tenant(request)
    proposal = repo.get(tenant, proposal_id)
    if not proposal:
        raise HTTPException(404, "Proposal not found")
    if proposal.get("status") != "pending":
        raise HTTPException(400, f"Cannot reject proposal with status: {proposal.get('status')}")

    body = await request.json() if request.headers.get("content-length", "0") != "0" else {}
    reason = body.get("reason")
    execution_result = {"reject_reason": reason} if reason else None

    repo.update_status(tenant, proposal_id, "rejected", execution_result=execution_result)
    return {"message": "Proposal rejected", "proposal_id": proposal_id}
