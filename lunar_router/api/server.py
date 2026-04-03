"""
API Server: FastAPI server for UniRoute.

Provides REST endpoints for routing prompts to LLMs.
"""

from contextlib import asynccontextmanager
from typing import Optional
import json
import logging
import os

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
import numpy as np

from .schemas import (
    RouteRequest,
    RouteResponse,
    BatchRouteRequest,
    BatchRouteResponse,
    ModelInfo,
    ModelListResponse,
    RegisterModelRequest,
    StatsResponse,
    HealthResponse,
    ErrorResponse,
)
from ..router.uniroute import UniRouteRouter
from ..models.llm_profile import LLMProfile
from ..models.llm_registry import LLMRegistry
from ..models.llm_client import LLMClient, create_client
from ..storage.state_manager import StateManager
from ..config.settings import Settings, get_settings

logger = logging.getLogger(__name__)

# Global state
router: Optional[UniRouteRouter] = None
llm_clients: dict[str, LLMClient] = {}
state_manager: Optional[StateManager] = None
settings: Optional[Settings] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    # Startup
    logger.info("UniRoute API starting up...")
    try:
        from ..storage.secrets import push_all_to_engine
        push_all_to_engine()
        logger.info("Pushed stored API keys to Go engine")
    except Exception as e:
        logger.debug(f"Could not push keys to engine on startup: {e}")

    # Run datasets ClickHouse migration
    try:
        _run_datasets_migration()
    except Exception as e:
        logger.warning(f"Datasets migration skipped: {e}")

    # Run evaluation tables migration
    try:
        _run_eval_migration()
    except Exception as e:
        logger.warning(f"Eval tables migration skipped: {e}")

    # Run distillation tables migration
    try:
        _run_distillation_migration()
    except Exception as e:
        logger.warning(f"Distillation migration skipped: {e}")

    # Seed built-in evaluation metrics
    try:
        from ..metrics.repository import seed_builtin_metrics
        seed_builtin_metrics()
        logger.info("Built-in evaluation metrics seeded")
    except Exception as e:
        logger.warning(f"Builtin metrics seeding skipped: {e}")

    yield
    # Shutdown
    logger.info("UniRoute API shutting down...")


def _run_eval_migration():
    """Execute the eval tables ClickHouse migration if not yet applied."""
    import pathlib
    from ..storage.clickhouse_client import get_client

    client = get_client()
    if client is None:
        return
    migration_file = pathlib.Path(__file__).resolve().parents[2] / "clickhouse" / "008_create_eval_tables.sql"
    if not migration_file.exists():
        logger.debug("Eval migration file not found: %s", migration_file)
        return
    sql = migration_file.read_text()
    for statement in sql.split(";"):
        stmt = statement.strip()
        if stmt:
            try:
                client.command(stmt)
            except Exception as e:
                if "already exists" not in str(e).lower():
                    logger.warning("Eval migration statement failed: %s — %s", stmt[:80], e)


def _run_distillation_migration():
    """Execute the distillation tables ClickHouse migration if not yet applied."""
    import pathlib
    from ..storage.clickhouse_client import get_client

    client = get_client()
    if client is None:
        return
    migration_file = pathlib.Path(__file__).resolve().parents[2] / "clickhouse" / "009_create_distillation_tables.sql"
    if not migration_file.exists():
        logger.debug("Distillation migration file not found: %s", migration_file)
        return
    sql = migration_file.read_text()
    for statement in sql.split(";"):
        stmt = statement.strip()
        if stmt:
            try:
                client.command(stmt)
            except Exception as e:
                if "already exists" not in str(e).lower():
                    logger.warning("Distillation migration statement failed: %s — %s", stmt[:80], e)


def _run_datasets_migration():
    """Execute the datasets ClickHouse migration if not yet applied."""
    import pathlib
    from ..storage.clickhouse_client import get_client

    client = get_client()
    if client is None:
        return
    migration_file = pathlib.Path(__file__).resolve().parents[2] / "clickhouse" / "007_create_eval_datasets.sql"
    if not migration_file.exists():
        logger.debug("Datasets migration file not found: %s", migration_file)
        return
    sql = migration_file.read_text()
    for statement in sql.split(";"):
        stmt = statement.strip()
        if stmt:
            try:
                client.command(stmt)
            except Exception as e:
                # Ignore "already exists" errors
                if "already exists" not in str(e).lower():
                    logger.warning("Migration statement failed: %s — %s", stmt[:80], e)


app = FastAPI(
    title="UniRoute API",
    description="Universal Model Routing for Efficient LLM Inference",
    version="0.1.0",
    lifespan=lifespan,
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount datasets sub-router
from ..datasets.router import router as datasets_router  # noqa: E402
app.include_router(datasets_router)

# Mount evaluation module routers
from ..evaluations.router import router as evaluations_router  # noqa: E402
from ..metrics.router import router as metrics_router  # noqa: E402
from ..experiments.router import router as experiments_router  # noqa: E402
from ..annotations.router import router as annotations_router  # noqa: E402
from ..auto_eval.router import router as auto_eval_router  # noqa: E402
from ..trace_issues.router import router as trace_issues_router  # noqa: E402
from ..proposals.router import router as proposals_router  # noqa: E402
from ..eval_agent.router import router as eval_agent_router  # noqa: E402
from ..settings.router import router as settings_router  # noqa: E402

app.include_router(evaluations_router)
app.include_router(metrics_router)
app.include_router(experiments_router)
app.include_router(annotations_router)
app.include_router(auto_eval_router)
app.include_router(trace_issues_router)
app.include_router(proposals_router)
app.include_router(eval_agent_router)
app.include_router(settings_router)

# Mount distillation module router
from ..distillation.router import router as distillation_router  # noqa: E402
app.include_router(distillation_router)


def get_router() -> UniRouteRouter:
    """Dependency to get the router instance."""
    if router is None:
        raise HTTPException(
            status_code=503,
            detail="Router not initialized. Call /init first.",
        )
    return router


# --- Health & Status ---


@app.get("/health", response_model=HealthResponse, tags=["status"])
async def health_check():
    """Check API health status."""
    return HealthResponse(
        status="healthy",
        router_initialized=router is not None,
        num_models=len(router.registry) if router else 0,
        num_clusters=router.cluster_assigner.num_clusters if router else 0,
    )


@app.get("/stats", response_model=StatsResponse, tags=["status"])
async def get_stats(r: UniRouteRouter = Depends(get_router)):
    """Get routing statistics."""
    stats = r.stats
    return StatsResponse(
        total_requests=stats.total_requests,
        model_selections=stats.model_selections,
        cluster_distributions={str(k): v for k, v in stats.cluster_distributions.items()},
        avg_expected_error=stats.avg_expected_error,
        avg_cost_score=stats.avg_cost_score,
    )


@app.post("/stats/reset", tags=["status"])
async def reset_stats(r: UniRouteRouter = Depends(get_router)):
    """Reset routing statistics."""
    r.reset_stats()
    return {"message": "Statistics reset"}


# --- Routing ---


@app.post("/route", response_model=RouteResponse, tags=["routing"])
async def route_prompt(request: RouteRequest, r: UniRouteRouter = Depends(get_router)):
    """
    Route a prompt to the best LLM.

    Optionally execute the prompt on the selected model.
    """
    try:
        decision = r.route(
            prompt=request.prompt,
            available_models=request.available_models,
            cost_weight_override=request.cost_weight,
        )

        response_text = None
        if request.execute:
            if decision.selected_model not in llm_clients:
                raise HTTPException(
                    status_code=400,
                    detail=f"No client configured for {decision.selected_model}",
                )
            client = llm_clients[decision.selected_model]
            llm_response = client.generate(
                request.prompt,
                max_tokens=request.max_tokens,
                temperature=request.temperature,
            )
            response_text = llm_response.text

        return RouteResponse(
            selected_model=decision.selected_model,
            expected_error=decision.expected_error,
            cost_adjusted_score=decision.cost_adjusted_score,
            cluster_id=decision.cluster_id,
            all_scores=decision.all_scores,
            response_text=response_text,
            reasoning=decision.reasoning,
        )

    except Exception as e:
        logger.exception("Routing error")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/route/batch", response_model=BatchRouteResponse, tags=["routing"])
async def route_batch(request: BatchRouteRequest, r: UniRouteRouter = Depends(get_router)):
    """Route multiple prompts."""
    try:
        decisions = r.route_batch(
            prompts=request.prompts,
            available_models=request.available_models,
            cost_weight_override=request.cost_weight,
        )

        # Calculate distribution
        model_counts: dict[str, int] = {}
        total_error = 0.0

        responses = []
        for d in decisions:
            model_counts[d.selected_model] = model_counts.get(d.selected_model, 0) + 1
            total_error += d.expected_error

            responses.append(RouteResponse(
                selected_model=d.selected_model,
                expected_error=d.expected_error,
                cost_adjusted_score=d.cost_adjusted_score,
                cluster_id=d.cluster_id,
                all_scores=d.all_scores,
            ))

        distribution = {k: v / len(decisions) for k, v in model_counts.items()}

        return BatchRouteResponse(
            decisions=responses,
            distribution=distribution,
            avg_expected_error=total_error / len(decisions) if decisions else 0,
        )

    except Exception as e:
        logger.exception("Batch routing error")
        raise HTTPException(status_code=500, detail=str(e))


# --- Models ---


@app.get("/models", response_model=ModelListResponse, tags=["models"])
async def list_models(r: UniRouteRouter = Depends(get_router)):
    """List all registered models."""
    profiles = r.registry.get_all()

    models = [
        ModelInfo(
            model_id=p.model_id,
            cost_per_1k_tokens=p.cost_per_1k_tokens,
            num_clusters=p.num_clusters,
            overall_accuracy=p.overall_accuracy,
            strongest_clusters=p.strongest_clusters(3),
        )
        for p in profiles
    ]

    return ModelListResponse(
        models=models,
        default_model=r.registry.default_model_id,
    )


@app.get("/models/{model_id}", response_model=ModelInfo, tags=["models"])
async def get_model(model_id: str, r: UniRouteRouter = Depends(get_router)):
    """Get info about a specific model."""
    profile = r.registry.get(model_id)
    if profile is None:
        raise HTTPException(status_code=404, detail=f"Model {model_id} not found")

    return ModelInfo(
        model_id=profile.model_id,
        cost_per_1k_tokens=profile.cost_per_1k_tokens,
        num_clusters=profile.num_clusters,
        overall_accuracy=profile.overall_accuracy,
        strongest_clusters=profile.strongest_clusters(5),
    )


@app.post("/models", tags=["models"])
async def register_model(request: RegisterModelRequest, r: UniRouteRouter = Depends(get_router)):
    """Register a new model profile."""
    profile = LLMProfile(
        model_id=request.model_id,
        psi_vector=np.array(request.psi_vector),
        cost_per_1k_tokens=request.cost_per_1k_tokens,
        num_validation_samples=request.num_validation_samples,
        cluster_sample_counts=np.array(request.cluster_sample_counts),
        metadata=request.metadata or {},
    )

    r.registry.register(profile)

    # Save to state manager if available
    if state_manager:
        state_manager.save_profile(profile)

    return {"message": f"Model {request.model_id} registered", "model_id": request.model_id}


@app.delete("/models/{model_id}", tags=["models"])
async def unregister_model(model_id: str, r: UniRouteRouter = Depends(get_router)):
    """Remove a model from the registry."""
    profile = r.registry.unregister(model_id)
    if profile is None:
        raise HTTPException(status_code=404, detail=f"Model {model_id} not found")

    return {"message": f"Model {model_id} unregistered"}


# --- Configuration ---


@app.get("/config", tags=["config"])
async def get_config():
    """Get current configuration."""
    if settings is None:
        return {"message": "No settings loaded"}
    return settings.to_dict()


@app.post("/config/cost_weight", tags=["config"])
async def set_cost_weight(cost_weight: float, r: UniRouteRouter = Depends(get_router)):
    """Update the default cost weight."""
    if cost_weight < 0:
        raise HTTPException(status_code=400, detail="cost_weight must be >= 0")
    r.cost_weight = cost_weight
    return {"message": f"Cost weight set to {cost_weight}"}


# --- Harness (Agent System) ---


@app.get("/v1/harness/agents", tags=["harness"])
async def list_harness_agents():
    """List all available harness agents."""
    from ..harness.registry import AgentRegistry
    registry = AgentRegistry()
    return {"agents": [a.to_dict() for a in registry.list_agents()]}


@app.get("/v1/harness/agents/{name}", tags=["harness"])
async def get_harness_agent(name: str):
    """Get a specific agent's config and prompt."""
    from ..harness.registry import AgentRegistry
    registry = AgentRegistry()
    config = registry.get(name)
    if config is None:
        raise HTTPException(status_code=404, detail=f"Agent '{name}' not found")
    return config.to_dict()


@app.post("/v1/harness/run/{name}", tags=["harness"])
async def run_harness_agent(name: str, body: dict):
    """Run a harness agent with user_input and optional context."""
    from ..harness.runner import AgentRunner
    runner = AgentRunner()
    user_input = body.get("input", body.get("user_input", ""))
    context = body.get("context", {})
    use_tools = body.get("use_tools", False)

    if not user_input:
        raise HTTPException(status_code=400, detail="input is required")

    if use_tools:
        result = await runner.run_with_tools(name, user_input)
    else:
        result = await runner.run(name, user_input, context)

    return {"agent": name, "result": result}


# --- Clustering (Domain Datasets) ---


@app.post("/v1/clustering/run", tags=["clustering"])
async def clustering_run(
    days: int = 30,
    min_traces: int = 50,
    strategy: str = "auto",
):
    """Trigger a clustering pipeline run."""
    from ..clustering.pipeline import ClusteringPipeline

    pipeline = ClusteringPipeline(strategy=strategy)
    result = await pipeline.run(days=days, min_traces=min_traces)
    return result.to_dict()


@app.get("/v1/clustering/runs", tags=["clustering"])
async def list_clustering_runs():
    """List past clustering runs."""
    from ..storage.clickhouse_client import get_client

    client = get_client()
    if client is None:
        return {"runs": []}

    r = client.query(
        "SELECT * FROM clustering_runs ORDER BY created_at DESC LIMIT 20"
    )
    columns = r.column_names
    return {"runs": [dict(zip(columns, row)) for row in r.result_rows]}


@app.get("/v1/clustering/runs/{run_id}", tags=["clustering"])
async def get_clustering_run(run_id: str):
    """Get a clustering run with all its datasets."""
    from ..storage.clickhouse_client import get_client
    import json

    client = get_client()
    if client is None:
        raise HTTPException(status_code=503, detail="ClickHouse not available")

    # Get run info
    r = client.query(
        "SELECT * FROM clustering_runs WHERE run_id = {rid:String}",
        parameters={"rid": run_id},
    )
    if not r.result_rows:
        raise HTTPException(status_code=404, detail="Run not found")

    run = dict(zip(r.column_names, r.result_rows[0]))

    # Get datasets
    r = client.query(
        "SELECT * FROM cluster_datasets WHERE run_id = {rid:String} ORDER BY cluster_id",
        parameters={"rid": run_id},
    )
    datasets = []
    for row in r.result_rows:
        d = dict(zip(r.column_names, row))
        for field in ("top_models", "top_providers", "sample_prompts"):
            if isinstance(d.get(field), str):
                try:
                    d[field] = json.loads(d[field])
                except Exception:
                    pass
        datasets.append(d)

    return {"run": run, "datasets": datasets}


@app.get("/v1/clustering/datasets", tags=["clustering"])
async def list_clustering_datasets(status: Optional[str] = None):
    """List domain datasets from the latest clustering run."""
    from ..storage.clickhouse_client import get_client
    import json

    client = get_client()
    if client is None:
        return {"datasets": []}

    # Get latest run_id
    r = client.query("SELECT run_id FROM clustering_runs ORDER BY created_at DESC LIMIT 1")
    if not r.result_rows:
        return {"datasets": [], "run_id": None}

    run_id = r.result_rows[0][0]

    conditions = ["run_id = {rid:String}"]
    params: dict = {"rid": run_id}
    if status:
        conditions.append("status = {status:String}")
        params["status"] = status

    where = " AND ".join(conditions)
    r = client.query(
        f"SELECT * FROM cluster_datasets WHERE {where} ORDER BY trace_count DESC",
        parameters=params,
    )
    datasets = []
    for row in r.result_rows:
        d = dict(zip(r.column_names, row))
        for field in ("top_models", "top_providers", "sample_prompts"):
            if isinstance(d.get(field), str):
                try:
                    d[field] = json.loads(d[field])
                except Exception:
                    pass
        datasets.append(d)

    return {"datasets": datasets, "run_id": run_id}


@app.get("/v1/clustering/datasets/{run_id}/{cluster_id}", tags=["clustering"])
async def get_clustering_dataset_traces(
    run_id: str,
    cluster_id: int,
    limit: int = 100,
    offset: int = 0,
):
    """Get traces belonging to a specific domain dataset."""
    from ..storage.clickhouse_client import get_client

    client = get_client()
    if client is None:
        raise HTTPException(status_code=503, detail="ClickHouse not available")

    r = client.query(
        "SELECT t.* FROM llm_traces t "
        "INNER JOIN trace_cluster_map m ON t.input_text = m.input_text "
        "WHERE m.run_id = {rid:String} AND m.cluster_id = {cid:UInt32} "
        "ORDER BY t.timestamp DESC LIMIT {lim:UInt32} OFFSET {off:UInt32}",
        parameters={"rid": run_id, "cid": cluster_id, "lim": limit, "off": offset},
    )
    columns = r.column_names
    traces = [dict(zip(columns, row)) for row in r.result_rows]

    # Get count
    r2 = client.query(
        "SELECT count() FROM trace_cluster_map WHERE run_id = {rid:String} AND cluster_id = {cid:UInt32}",
        parameters={"rid": run_id, "cid": cluster_id},
    )
    total = int(r2.result_rows[0][0]) if r2.result_rows else 0

    return {"traces": traces, "total": total, "run_id": run_id, "cluster_id": cluster_id}


@app.post("/v1/clustering/datasets/{run_id}/{cluster_id}/export", tags=["clustering"])
async def export_clustering_dataset(run_id: str, cluster_id: int):
    """Export a domain dataset as JSONL (prompt/response pairs)."""
    from ..storage.clickhouse_client import get_client
    from fastapi.responses import StreamingResponse
    import json

    client = get_client()
    if client is None:
        raise HTTPException(status_code=503, detail="ClickHouse not available")

    r = client.query(
        "SELECT t.input_text, t.output_text, t.selected_model, t.provider, "
        "t.tokens_in, t.tokens_out, t.total_cost_usd, t.is_error, t.input_messages, t.output_message "
        "FROM llm_traces t "
        "INNER JOIN trace_cluster_map m ON t.input_text = m.input_text "
        "WHERE m.run_id = {rid:String} AND m.cluster_id = {cid:UInt32} "
        "AND length(t.input_text) > 0 ORDER BY t.timestamp",
        parameters={"rid": run_id, "cid": cluster_id},
    )

    def generate():
        for row in r.result_rows:
            messages = []
            try:
                msgs = json.loads(row[8]) if row[8] else None
                if isinstance(msgs, list):
                    messages = msgs
            except Exception:
                messages = [{"role": "user", "content": row[0]}]

            if not messages:
                messages = [{"role": "user", "content": row[0]}]

            if row[1]:  # output_text
                messages.append({"role": "assistant", "content": row[1]})

            record = {
                "messages": messages,
                "metadata": {
                    "model": row[2],
                    "provider": row[3],
                    "tokens_in": int(row[4]),
                    "tokens_out": int(row[5]),
                    "cost_usd": float(row[6]),
                    "is_error": bool(row[7]),
                },
            }
            yield json.dumps(record) + "\n"

    return StreamingResponse(
        generate(),
        media_type="application/x-ndjson",
        headers={
            "Content-Disposition": f"attachment; filename=dataset_{run_id}_{cluster_id}.jsonl"
        },
    )


@app.post("/v1/clustering/datasets/{run_id}/{cluster_id}/qualify", tags=["clustering"])
async def qualify_clustering_dataset(run_id: str, cluster_id: int, status: str = "qualified"):
    """Manually qualify or reject a dataset."""
    from ..storage.clickhouse_client import get_client

    client = get_client()
    if client is None:
        raise HTTPException(status_code=503, detail="ClickHouse not available")

    if status not in ("qualified", "rejected", "candidate"):
        raise HTTPException(status_code=400, detail="status must be qualified, rejected, or candidate")

    client.command(
        f"ALTER TABLE cluster_datasets UPDATE status = '{status}' "
        f"WHERE run_id = '{run_id}' AND cluster_id = {cluster_id}"
    )
    return {"message": f"Dataset {cluster_id} status set to {status}"}


# --- Trace Ingestion ---


@app.post("/v1/traces", tags=["traces"])
async def ingest_traces(body: dict):
    """Ingest manual traces into ClickHouse.

    Accepts single trace or batch:
        {"messages": [...], "model": "gpt-4o-mini"}
        {"input": "Hello", "output": "Hi", "model": "gpt-4o-mini"}
        {"traces": [{...}, {...}]}

    Auto-enriches: token estimates, cost calculation, timestamps.
    """
    import httpx

    engine_url = os.environ.get("LUNAR_ENGINE_URL", "http://localhost:8080")
    try:
        resp = httpx.post(f"{engine_url}/v1/traces", json=body, timeout=30.0)
        resp.raise_for_status()
        return resp.json()
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=e.response.text)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Engine unavailable: {e}")


@app.post("/v1/traces/import", tags=["traces"])
async def import_traces_file(body: dict):
    """Import traces from a JSONL string body.

    Body: {"data": "line1\\nline2\\n...", "source": "import", "model": "gpt-4o-mini"}
    """
    import httpx

    data_str = body.get("data", "")
    source = body.get("source", "file-import")
    default_model = body.get("model", "")
    default_provider = body.get("provider", "")

    if not data_str:
        raise HTTPException(status_code=400, detail="'data' field with JSONL content is required")

    traces = []
    for line in data_str.strip().split("\n"):
        line = line.strip()
        if not line:
            continue
        try:
            t = json.loads(line)
            if source and "source" not in t:
                t["source"] = source
            if default_model and "model" not in t:
                t["model"] = default_model
            if default_provider and "provider" not in t:
                t["provider"] = default_provider
            traces.append(t)
        except json.JSONDecodeError:
            continue

    if not traces:
        raise HTTPException(status_code=400, detail="No valid traces found in data")

    engine_url = os.environ.get("LUNAR_ENGINE_URL", "http://localhost:8080")
    try:
        resp = httpx.post(f"{engine_url}/v1/traces", json={"traces": traces}, timeout=30.0)
        resp.raise_for_status()
        return resp.json()
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=e.response.text)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Engine unavailable: {e}")


# --- Add Traces to Existing Dataset ---


@app.post("/v1/clustering/datasets/{run_id}/{cluster_id}/traces", tags=["datasets"])
async def add_traces_to_dataset(run_id: str, cluster_id: int, body: dict):
    """Add manual traces to an existing cluster dataset.

    Inserts traces into ClickHouse AND maps them to the specified cluster.
    Accepts same format as /v1/traces: messages, input/output, or batch.
    """
    import httpx

    engine_url = os.environ.get("LUNAR_ENGINE_URL", "http://localhost:8080")
    try:
        resp = httpx.post(
            f"{engine_url}/v1/datasets/{run_id}/{cluster_id}/traces",
            json=body,
            timeout=30.0,
        )
        resp.raise_for_status()
        return resp.json()
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=e.response.text)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Engine unavailable: {e}")


@app.post("/v1/clustering/datasets/{run_id}/{cluster_id}/assign", tags=["datasets"])
async def assign_traces_to_dataset(run_id: str, cluster_id: int, body: dict):
    """Assign existing traces (by request_id) to a cluster dataset.

    Body: {"request_ids": ["id1", "id2", ...]}
    Maps existing traces from the Traces page into a specific dataset.
    """
    import httpx

    request_ids = body.get("request_ids", [])
    if not request_ids:
        raise HTTPException(status_code=400, detail="request_ids is required")

    engine_url = os.environ.get("LUNAR_ENGINE_URL", "http://localhost:8080")
    try:
        resp = httpx.post(
            f"{engine_url}/v1/datasets/{run_id}/{cluster_id}/assign",
            json={"request_ids": request_ids},
            timeout=30.0,
        )
        resp.raise_for_status()
        return resp.json()
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=e.response.text)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Engine unavailable: {e}")


# --- Dataset Trace Import (Smart Import for UI) ---


# --- Secrets (API Key Management) ---


@app.get("/v1/secrets", tags=["secrets"])
async def list_secrets():
    """List configured providers."""
    from ..storage.secrets import list_configured_providers
    return {"configured_providers": list_configured_providers()}


@app.post("/v1/secrets/{provider}", tags=["secrets"])
async def save_secret(provider: str, body: dict):
    """Save an API key for a provider."""
    from ..storage.secrets import set_secret
    api_key = body.get("api_key", "")
    if not api_key:
        raise HTTPException(status_code=400, detail="api_key is required")
    set_secret(provider, api_key)
    return {"message": f"Key saved for {provider}"}


@app.delete("/v1/secrets/{provider}", tags=["secrets"])
async def remove_secret(provider: str):
    """Remove an API key."""
    from ..storage.secrets import delete_secret
    if not delete_secret(provider):
        raise HTTPException(status_code=404, detail=f"No key found for {provider}")
    return {"message": f"Key removed for {provider}"}


# --- Analytics (ClickHouse) ---


@app.get("/v1/stats/{tenant_id}/analytics", tags=["analytics"])
async def analytics_full(
    tenant_id: str,
    days: int = 30,
    trace_limit: int = 100,
    trace_offset: int = 0,
    model_id: Optional[str] = None,
    backend: Optional[str] = None,
    is_success: Optional[bool] = None,
    search: Optional[str] = None,
):
    """Full analytics response matching the UI's AnalyticsMetricsResponse shape."""
    from ..storage.clickhouse_client import query_analytics

    return query_analytics(
        days=days,
        trace_limit=trace_limit,
        trace_offset=trace_offset,
        model_id=model_id,
        backend=backend,
        is_success=is_success,
        search=search,
    )


@app.get("/traces", tags=["analytics"])
async def list_traces(
    model: Optional[str] = None,
    hours: int = 24,
    limit: int = 100,
    offset: int = 0,
):
    """List recent traces from ClickHouse."""
    from ..storage.clickhouse_client import query_traces, query_trace_count, get_client
    from datetime import datetime, timedelta, timezone

    if get_client() is None:
        raise HTTPException(status_code=503, detail="ClickHouse not enabled")

    start = datetime.now(timezone.utc) - timedelta(hours=hours)
    traces = query_traces(model=model, start=start, limit=limit, offset=offset)
    total = query_trace_count(model=model, start=start)
    return {"traces": traces, "total": total, "limit": limit, "offset": offset}


@app.get("/v1/traces", tags=["traces"])
async def list_traces_v1(
    limit: int = 100,
    offset: int = 0,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    source: Optional[str] = None,
    model_id: Optional[str] = None,
):
    """List traces for evaluations UI (v1 API)."""
    from ..storage.clickhouse_client import query_traces, query_trace_count, get_client
    from datetime import datetime, timedelta, timezone

    if get_client() is None:
        raise HTTPException(status_code=503, detail="ClickHouse not enabled")

    start = None
    end = None
    if start_date:
        try:
            start = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
        except ValueError:
            start = datetime.now(timezone.utc) - timedelta(hours=24)
    else:
        start = datetime.now(timezone.utc) - timedelta(hours=24)
    if end_date:
        try:
            end = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
        except ValueError:
            pass

    traces = query_traces(model=model_id, start=start, end=end, limit=limit, offset=offset)
    total = query_trace_count(model=model_id, start=start, end=end)
    return {"traces": traces, "total": total, "has_more": (offset + limit) < total}


@app.get("/analytics/models", tags=["analytics"])
async def analytics_models(
    model: Optional[str] = None,
    hours: int = 24,
):
    """Hourly model-level analytics from ClickHouse materialized view."""
    from ..storage.clickhouse_client import query_model_hourly, get_client
    from datetime import datetime, timedelta, timezone

    if get_client() is None:
        raise HTTPException(status_code=503, detail="ClickHouse not enabled")

    start = datetime.now(timezone.utc) - timedelta(hours=hours)
    return query_model_hourly(model=model, start=start)


@app.get("/analytics/clusters", tags=["analytics"])
async def analytics_clusters(
    cluster_id: Optional[int] = None,
    days: int = 30,
):
    """Daily cluster-level analytics from ClickHouse materialized view."""
    from ..storage.clickhouse_client import query_cluster_daily, get_client
    from datetime import datetime, timedelta, timezone

    if get_client() is None:
        raise HTTPException(status_code=503, detail="ClickHouse not enabled")

    start = datetime.now(timezone.utc) - timedelta(days=days)
    return query_cluster_daily(cluster_id=cluster_id, start=start)


@app.get("/analytics/summary", tags=["analytics"])
async def analytics_summary(hours: int = 24):
    """Overall summary statistics from ClickHouse."""
    from ..storage.clickhouse_client import query_summary, get_client
    from datetime import datetime, timedelta, timezone

    if get_client() is None:
        raise HTTPException(status_code=503, detail="ClickHouse not enabled")

    start = datetime.now(timezone.utc) - timedelta(hours=hours)
    return query_summary(start=start)


# --- Initialization (for programmatic setup) ---


def init_router(
    embedder,
    cluster_assigner,
    registry: LLMRegistry,
    clients: Optional[dict[str, LLMClient]] = None,
    cost_weight: float = 0.0,
    use_soft_assignment: bool = True,
    state_path: Optional[str] = None,
    app_settings: Optional[Settings] = None,
) -> UniRouteRouter:
    """
    Initialize the router programmatically.

    This should be called before starting the server.

    Args:
        embedder: PromptEmbedder instance.
        cluster_assigner: ClusterAssigner instance.
        registry: LLMRegistry with model profiles.
        clients: Optional dict of LLM clients for execution.
        cost_weight: Default cost weight (λ).
        use_soft_assignment: Use soft vs hard cluster assignment.
        state_path: Path for state persistence.
        app_settings: Application settings.

    Returns:
        Initialized UniRouteRouter.
    """
    global router, llm_clients, state_manager, settings

    router = UniRouteRouter(
        embedder=embedder,
        cluster_assigner=cluster_assigner,
        registry=registry,
        cost_weight=cost_weight,
        use_soft_assignment=use_soft_assignment,
    )

    if clients:
        llm_clients.update(clients)

    if state_path:
        state_manager = StateManager(state_path)

    if app_settings:
        settings = app_settings

    logger.info(
        f"Router initialized with {len(registry)} models, "
        f"{cluster_assigner.num_clusters} clusters"
    )

    return router


def run_server(host: str = "0.0.0.0", port: int = 8000):
    """Run the API server."""
    import uvicorn

    uvicorn.run(app, host=host, port=port)
