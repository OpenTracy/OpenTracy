"""
Pydantic schemas for the Datasets API.

These models define the request/response shapes consumed by the frontend
(ui/src/features/evaluations/api/evaluationsService.ts).
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Dataset
# ---------------------------------------------------------------------------

class DatasetCreate(BaseModel):
    """POST /v1/datasets body."""
    name: str
    description: Optional[str] = ""
    source: Optional[str] = "manual"


class DatasetSampleIn(BaseModel):
    """A single sample inside an add-samples request."""
    input: str
    expected_output: Optional[str] = ""
    output: Optional[str] = ""
    metadata: Optional[dict[str, Any]] = None
    raw: Optional[str] = None


class AddSamplesRequest(BaseModel):
    """POST /v1/datasets/{id}/samples body."""
    samples: list[DatasetSampleIn]


class DatasetImportRequest(BaseModel):
    """POST /v1/datasets/import body."""
    name: str
    description: Optional[str] = ""
    format: str  # "json" | "csv"
    data: Any  # list[dict] for json, str for csv


class CreateFromTracesRequest(BaseModel):
    """POST /v1/datasets/from-traces body."""
    name: str
    description: Optional[str] = ""
    trace_ids: Optional[list[str]] = None
    model_id: Optional[str] = None
    limit: Optional[int] = 50


class CreateFromInstructionRequest(BaseModel):
    """POST /v1/datasets/from-instruction body."""
    name: str
    description: Optional[str] = ""
    instruction: str
    model_id: Optional[str] = None
    limit: Optional[int] = 200
    max_samples: Optional[int] = 100


# ---------------------------------------------------------------------------
# Auto-collect
# ---------------------------------------------------------------------------

class AutoCollectConfigIn(BaseModel):
    """PUT /v1/datasets/{id}/auto-collect body."""
    enabled: Optional[bool] = True
    source_model: Optional[str] = None
    instruction: Optional[str] = None
    max_samples: Optional[int] = 5000
    collection_interval_minutes: Optional[int] = 60
    curation_config: Optional[dict[str, Any]] = None


# ---------------------------------------------------------------------------
# Analyze / Import traces (smart-import)
# ---------------------------------------------------------------------------

class AnalyzeTracesRequest(BaseModel):
    """POST /v1/datasets/analyze-traces body."""
    data: list[dict[str, Any]]


class ImportTracesRequest(BaseModel):
    """POST /v1/datasets/import-traces body."""
    name: str
    data: list[dict[str, Any]]
    mapping: Optional[dict[str, Any]] = None
    description: Optional[str] = ""
