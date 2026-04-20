"""
Datasets Module

Provides dataset management (CRUD, samples, from-traces, auto-collect) as a
feature module within opentracy. Endpoints are registered directly on the
FastAPI app in `opentracy.api.server`; this package only exposes the data
layer (`repository`, `schemas`).
"""
