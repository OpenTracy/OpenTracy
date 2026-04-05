"""
Distillation Module — BOND (Best-of-N Distillation) Pipeline

Local-first model distillation: data generation → curation → training → export.
All state persisted to ClickHouse; artifacts stored on local filesystem.
"""
from .router import router  # noqa: F401

__all__ = ["router"]
