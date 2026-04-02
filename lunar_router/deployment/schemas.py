"""Pydantic schemas for deployment API."""

from __future__ import annotations

from typing import Optional
from pydantic import BaseModel


class CreateDeploymentRequest(BaseModel):
    model_id: str
    model_path: str
    instance_type: str = "local-gpu"
    config: dict = {}


class DeploymentResponse(BaseModel):
    deployment_id: str
    model_id: str
    status: str
    endpoint_url: str = ""
    already_deployed: bool = False
