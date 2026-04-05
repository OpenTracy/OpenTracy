"""
Eval Agent Service

Orchestrates automatic evaluation setup: analyze datasets, create metrics,
set up auto-eval configs, trigger first runs.
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Optional

from ..evals_common import MetricSuggester

logger = logging.getLogger(__name__)

MIN_SAMPLES_FOR_SETUP = 5


class EvalAgent:
    """Central agent that orchestrates automatic evaluation setup."""

    def __init__(self):
        self.suggester = MetricSuggester()

    @staticmethod
    def _get_authorization(request: dict[str, Any]) -> str | None:
        headers = request.get("headers", {})
        return (
            headers.get("Authorization")
            or headers.get("authorization")
            or headers.get("x-api-key")
            or headers.get("X-Api-Key")
        )

    def _select_models(self, tenant_id: str, max_models: int = 3) -> list[str]:
        """Select models by querying Go engine pricing endpoint."""
        try:
            from ..evals_common.model_invoker import ModelInvoker
            import httpx
            invoker = ModelInvoker()
            url = f"{invoker.base_url}/v1/pricing/models"
            resp = httpx.get(url, timeout=10)
            if resp.status_code != 200:
                return []
            data = resp.json()
            models = data.get("models", [])
            if not models:
                return []

            by_provider: dict[str, list[dict]] = {}
            for m in models:
                provider = m.get("provider", "unknown")
                by_provider.setdefault(provider, []).append(m)

            priority = ["anthropic", "openai", "bedrock", "pureai", "deepseek", "gemini", "google", "mistral"]
            selected: list[str] = []
            seen: set[str] = set()

            for p in priority:
                if p in by_provider and p not in seen:
                    selected.append(by_provider[p][0].get("id", by_provider[p][0].get("model_id", "")))
                    seen.add(p)
                    if len(selected) >= max_models:
                        break

            if len(selected) < max_models:
                for p, mlist in by_provider.items():
                    if p not in seen:
                        selected.append(mlist[0].get("id", mlist[0].get("model_id", "")))
                        seen.add(p)
                        if len(selected) >= max_models:
                            break

            return selected
        except Exception as e:
            logger.warning("Failed to select models: %s", e)
            return []

    @staticmethod
    def _suggest_schedule(samples_count: int) -> str:
        return "weekly" if samples_count < 50 else "daily"

    def analyze(self, tenant_id: str, dataset_id: str, authorization: str | None = None) -> dict[str, Any]:
        from ..datasets.repository import get_dataset, get_samples
        from ..auto_eval import repository as ae_repo

        dataset = get_dataset(tenant_id, dataset_id)
        if not dataset:
            raise ValueError("Dataset not found")
        samples = get_samples(tenant_id, dataset_id)
        if not samples:
            raise ValueError("Dataset has no samples")

        analysis = self.suggester.analyze(samples[:10], authorization=authorization)
        suggested_models = self._select_models(tenant_id)
        schedule = self._suggest_schedule(len(samples))

        existing_configs = ae_repo.list_configs(tenant_id)
        has_existing = any(c.get("dataset_id") == dataset_id for c in existing_configs)

        return {
            "dataset": {"id": dataset_id, "name": dataset.get("name", ""), "samples_count": len(samples)},
            "analysis": {
                "domain": analysis.get("domain", "general"),
                "task_type": analysis.get("task_type", "generation"),
                "complexity": analysis.get("complexity", "medium"),
            },
            "suggested_metrics": analysis.get("metrics", []),
            "suggested_models": suggested_models,
            "suggested_config": {"schedule": schedule, "regression_threshold": 0.05, "alert_on_regression": True},
            "has_existing_config": has_existing,
        }

    def setup(
        self,
        tenant_id: str,
        dataset_id: str,
        authorization: str | None = None,
        auto_trigger: bool = True,
    ) -> dict[str, Any]:
        from ..metrics import repository as metrics_repo
        from ..auto_eval import repository as ae_repo

        analysis_result = self.analyze(tenant_id, dataset_id, authorization=authorization)

        created_metrics: list[dict] = []
        metric_ids: list[str] = []

        for suggestion in analysis_result["suggested_metrics"]:
            if suggestion.get("type") == "builtin":
                metric_ids.append(suggestion["metric_id"])
            elif suggestion.get("type") == "custom_judge":
                metric = metrics_repo.create(tenant_id, {
                    "name": suggestion.get("name", "custom_metric"),
                    "type": "llm_judge",
                    "description": suggestion.get("description", ""),
                    "config": {
                        "judge_prompt": suggestion.get("judge_prompt", ""),
                        "judge_model": suggestion.get("judge_model", "claude-sonnet-4"),
                    },
                    "source": "eval_agent",
                })
                created_metrics.append(metric)
                metric_ids.append(metric["metric_id"])

        if not metric_ids:
            metric_ids = ["llm_judge"]

        dataset_info = analysis_result["dataset"]
        suggested_config = analysis_result["suggested_config"]

        config = ae_repo.create_config(tenant_id, {
            "name": f"[Agent] {dataset_info['name']}",
            "dataset_id": dataset_id,
            "dataset_name": dataset_info["name"],
            "models": analysis_result["suggested_models"],
            "metrics": metric_ids,
            "schedule": suggested_config["schedule"],
            "alert_on_regression": suggested_config["alert_on_regression"],
            "regression_threshold": suggested_config["regression_threshold"],
            "source": "eval_agent",
        })

        run = None
        if auto_trigger and analysis_result["suggested_models"]:
            try:
                run = self._trigger_run(tenant_id, config, authorization=authorization)
            except Exception as e:
                logger.warning("Failed to trigger first run: %s", e)

        return {"analysis": analysis_result, "created_metrics": created_metrics, "config": config, "run": run}

    def _trigger_run(self, tenant_id: str, config: dict, authorization: str | None = None) -> dict[str, Any]:
        from ..datasets.repository import get_samples
        from ..evaluations import repository as eval_repo
        from ..evaluations.runner import EvaluationRunner
        from ..auto_eval import repository as ae_repo

        samples = get_samples(tenant_id, config["dataset_id"])
        now = datetime.utcnow().isoformat()
        ev = eval_repo.create(tenant_id, {
            "name": f"[Auto] {config['name']} - {now[:16]}",
            "description": f"Auto-eval run for config {config['config_id']}",
            "dataset_id": config["dataset_id"],
            "models": config["models"],
            "metrics": config["metrics"],
            "config": {},
            "total_samples": len(samples),
            "auto_eval_config_id": config["config_id"],
        })
        eid = ev["evaluation_id"]
        try:
            EvaluationRunner().run(tenant_id, eid, authorization=authorization)
        except Exception as e:
            logger.exception("Error running eval-agent evaluation")
            eval_repo.update_status(tenant_id, eid, status="failed", error_message=str(e))

        return ae_repo.create_run(tenant_id, config["config_id"], {"evaluation_id": eid})

    def scan_all(self, tenant_id: str, authorization: str | None = None) -> dict[str, Any]:
        from ..datasets.repository import list_datasets
        from ..auto_eval import repository as ae_repo

        datasets = list_datasets(tenant_id)
        configs = ae_repo.list_configs(tenant_id)
        configured_ids = {c.get("dataset_id") for c in configs}

        processed, skipped, errors = [], [], []

        for ds in datasets:
            ds_id = ds.get("dataset_id")
            if not ds_id:
                continue
            if ds_id in configured_ids:
                skipped.append({"dataset_id": ds_id, "reason": "already_configured"})
                continue
            sc = ds.get("samples_count", 0)
            if sc < MIN_SAMPLES_FOR_SETUP:
                skipped.append({"dataset_id": ds_id, "reason": f"insufficient_samples ({sc} < {MIN_SAMPLES_FOR_SETUP})"})
                continue
            try:
                result = self.setup(tenant_id, ds_id, authorization=authorization, auto_trigger=False)
                processed.append({"dataset_id": ds_id, "config_id": result["config"]["config_id"], "status": "created"})
            except Exception as e:
                logger.warning("Failed to setup dataset %s: %s", ds_id, e)
                errors.append({"dataset_id": ds_id, "error": str(e)})

        return {"processed": processed, "skipped": skipped, "errors": errors}
