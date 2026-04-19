"""
Trace Issues API Router

Mounts under /v1/trace-issues.
"""
from __future__ import annotations

import logging
from datetime import datetime

from fastapi import APIRouter, HTTPException, Query, Request

from . import repository as repo
from .scanner import IssueScanner

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/trace-issues", tags=["trace-issues"])
_scanner = IssueScanner()


def _tenant(request: Request) -> str:
    return request.headers.get("x-tenant-id", "default")


def _auth(request: Request) -> str | None:
    return request.headers.get("authorization") or request.headers.get("x-api-key")


@router.get("")
async def list_issues(
    request: Request,
    severity: str | None = Query(None),
    type: str | None = Query(None),
    resolved: str | None = Query(None),
):
    tenant = _tenant(request)
    resolved_bool = None
    if resolved is not None:
        resolved_bool = resolved.lower() == "true"

    issues = repo.list_issues(tenant, severity=severity, issue_type=type, resolved=resolved_bool)
    return {"issues": issues, "count": len(issues)}


@router.post("/scan", status_code=202)
async def trigger_scan(request: Request):
    tenant = _tenant(request)
    scan = repo.create_scan(tenant)
    scan_id = scan["scan_id"]
    status = "failed"

    try:
        deleted = repo.delete_unresolved_issues(tenant)
        logger.info("Cleared %d old unresolved issues before scan", deleted)

        # Fetch recent traces from ClickHouse
        from ..evals_common.db import query_rows
        traces = query_rows(
            "SELECT trace_id, model_id, input, output, latency_ms, cost_usd FROM traces WHERE tenant_id={t:String} ORDER BY created_at DESC LIMIT 500",
            {"t": tenant},
        )

        detected = _scanner.scan_traces(traces)

        llm_issues: list = []
        try:
            auth = _auth(request)
            llm_issues = _scanner.scan_traces_with_llm(traces, authorization=auth)
        except Exception as e:
            logger.warning("LLM scan failed, continuing with heuristic results: %s", e)

        all_issues = detected + llm_issues
        if all_issues:
            repo.batch_create_issues(tenant, all_issues)

        status = "completed"
        repo.update_scan(tenant, scan_id, {
            "status": "completed",
            "traces_scanned": len(traces),
            "issues_found": len(all_issues),
            "completed_at": datetime.utcnow().isoformat(),
        })
    except Exception as e:
        logger.exception("Scan failed: %s", e)
        repo.update_scan(tenant, scan_id, {
            "status": "failed",
            "error": str(e),
            "completed_at": datetime.utcnow().isoformat(),
        })

    return {"scan_id": scan_id, "status": status}


@router.get("/scan/{scan_id}")
async def get_scan_status(scan_id: str, request: Request):
    tenant = _tenant(request)
    scan = repo.get_scan(tenant, scan_id)
    if not scan:
        raise HTTPException(404, "Scan not found")
    return scan


@router.put("/{issue_id}/resolve")
async def resolve_issue(issue_id: str, request: Request):
    tenant = _tenant(request)
    issue = repo.get_issue(tenant, issue_id)
    if not issue:
        raise HTTPException(404, "Issue not found")
    updated = repo.update_resolved(tenant, issue_id, resolved=True)
    return updated
