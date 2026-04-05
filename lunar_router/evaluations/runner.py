"""
Evaluation Runner — orchestrates model invocation + metric execution.

Port of evaluations-api/services/evaluation_runner.py.
Runs sync with ThreadPoolExecutor (no SQS/ECS).
"""
from __future__ import annotations

import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any, Optional

from . import repository as evals_repo
from ..datasets import repository as datasets_repo
from ..evals_common.metric_executor import MetricExecutor
from ..evals_common.model_invoker import ModelInvoker

logger = logging.getLogger(__name__)


class EvaluationRunner:
    """Run a complete evaluation: invoke models → execute metrics → save results."""

    def __init__(self):
        self.invoker = ModelInvoker()
        self.executor = MetricExecutor(invoker=self.invoker)

    def run(
        self,
        tenant_id: str,
        evaluation_id: str,
        authorization: str | None = None,
    ) -> dict[str, Any]:
        """Execute an evaluation end-to-end."""
        try:
            evaluation = evals_repo.get(tenant_id, evaluation_id)
            if not evaluation:
                return {"success": False, "error": "Evaluation not found"}

            # Mark as running
            evals_repo.update_status(tenant_id, evaluation_id, status="running")

            dataset_id = evaluation.get("dataset_id", "")
            models = evaluation.get("models", [])
            metrics = evaluation.get("metrics", [])

            # Load samples
            samples = datasets_repo.get_samples(tenant_id, dataset_id)
            if not samples:
                evals_repo.update_status(
                    tenant_id, evaluation_id,
                    status="failed",
                    error_message="Dataset has no samples",
                )
                return {"success": False, "error": "No samples"}

            total = len(samples)
            result_samples = []

            # Load metric definitions
            from ..metrics import repository as metrics_repo
            metric_defs = []
            for m in metrics:
                if isinstance(m, dict):
                    mid = m.get("metric_id", "")
                else:
                    mid = m
                mdef = metrics_repo.get(tenant_id, mid)
                if mdef:
                    metric_defs.append(mdef)
                else:
                    # Use metric_id as type for builtins
                    metric_defs.append({"metric_id": mid, "type": mid, "config": {}})

            # Process each sample
            for idx, sample in enumerate(samples):
                sample_result = self._process_sample(
                    sample, models, metric_defs,
                    authorization=authorization,
                )
                result_samples.append(sample_result)

                # Update progress
                progress = int(((idx + 1) / total) * 100)
                evals_repo.update_status(
                    tenant_id, evaluation_id,
                    status="running",
                    progress=progress,
                    current_sample=idx + 1,
                )

            # Build summary
            summary = self._build_summary(result_samples, models, metric_defs)
            winner = self._determine_winner(summary, models, metric_defs)

            result_data = {
                "summary": summary,
                "samples": result_samples,
                "winner": winner,
            }

            evals_repo.save_result_and_complete(
                tenant_id, evaluation_id, result_data, total,
            )

            return {"success": True, "evaluation_id": evaluation_id}

        except Exception as e:
            logger.exception("Evaluation runner error: %s", e)
            evals_repo.update_status(
                tenant_id, evaluation_id,
                status="failed",
                error_message=str(e),
            )
            return {"success": False, "error": str(e)}

    def _process_sample(
        self,
        sample: dict[str, Any],
        models: list[str],
        metric_defs: list[dict[str, Any]],
        authorization: str | None = None,
    ) -> dict[str, Any]:
        """Invoke all models on a sample and evaluate with all metrics."""
        input_text = sample.get("input", "")
        expected_text = sample.get("expected_output", "")

        outputs: dict[str, dict[str, Any]] = {}

        # Parallel model invocation
        def invoke_model(model: str) -> tuple[str, dict[str, Any]]:
            try:
                result = self.invoker.invoke(
                    model, input_text,
                    authorization=authorization,
                )
                return model, result
            except Exception as e:
                logger.error("Model %s invocation failed: %s", model, e)
                return model, {
                    "output": "",
                    "latency": 0.0,
                    "cost": 0.0,
                    "error": str(e),
                }

        with ThreadPoolExecutor(max_workers=min(len(models), 5)) as pool:
            futures = {pool.submit(invoke_model, m): m for m in models}
            for future in as_completed(futures):
                model, result = future.result()
                outputs[model] = result

        # Execute metrics for each model
        scores: dict[str, dict[str, Any]] = {}
        for metric_def in metric_defs:
            mid = metric_def.get("metric_id", metric_def.get("type", ""))
            scores[mid] = {}
            for model in models:
                model_output = outputs.get(model, {})
                score_result = self.executor.execute(
                    metric_def,
                    input_text=input_text,
                    output_text=model_output.get("output", ""),
                    expected_text=expected_text,
                    latency=model_output.get("latency", 0.0),
                    cost=model_output.get("cost", 0.0),
                    authorization=authorization,
                )
                scores[mid][model] = score_result

        return {
            "sample_id": sample.get("sample_id", ""),
            "input": input_text,
            "expected": expected_text,
            "outputs": outputs,
            "scores": scores,
        }

    def _build_summary(
        self,
        samples: list[dict[str, Any]],
        models: list[str],
        metric_defs: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """Build per-model per-metric averages."""
        summary: dict[str, Any] = {}

        for metric_def in metric_defs:
            mid = metric_def.get("metric_id", metric_def.get("type", ""))
            metric_summary: dict[str, Any] = {}

            for model in models:
                scores = []
                for sample in samples:
                    s = sample.get("scores", {}).get(mid, {}).get(model, {})
                    if isinstance(s, dict) and "score" in s:
                        scores.append(s["score"])
                    elif isinstance(s, (int, float)):
                        scores.append(float(s))

                avg = sum(scores) / len(scores) if scores else 0.0
                metric_summary[model] = {
                    "average": round(avg, 4),
                    "count": len(scores),
                    "min": round(min(scores), 4) if scores else 0.0,
                    "max": round(max(scores), 4) if scores else 0.0,
                }

            summary[mid] = metric_summary

        return summary

    def _determine_winner(
        self,
        summary: dict[str, Any],
        models: list[str],
        metric_defs: list[dict[str, Any]],
    ) -> str:
        """Determine the winning model (quality=1.0 weight, latency/cost=0.5)."""
        if len(models) <= 1:
            return models[0] if models else ""

        scores: dict[str, float] = {m: 0.0 for m in models}
        total_weight = 0.0

        for metric_def in metric_defs:
            mid = metric_def.get("metric_id", metric_def.get("type", ""))
            mtype = metric_def.get("type", "")
            weight = 0.5 if mtype in ("latency", "cost") else 1.0

            metric_data = summary.get(mid, {})
            for model in models:
                avg = 0.0
                if isinstance(metric_data.get(model), dict):
                    avg = metric_data[model].get("average", 0.0)
                elif isinstance(metric_data.get(model), (int, float)):
                    avg = float(metric_data[model])
                scores[model] += avg * weight
            total_weight += weight

        if total_weight > 0:
            for m in scores:
                scores[m] /= total_weight

        return max(scores, key=lambda m: scores[m])
