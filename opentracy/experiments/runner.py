"""
Experiment Runner

Builds comparison data from completed evaluation results.
"""
from __future__ import annotations

import logging
from typing import Any, Optional

from ..evaluations import repository as eval_repo
from . import repository as repo

logger = logging.getLogger(__name__)


class ExperimentRunner:
    """Builds comparison data from evaluation results."""

    def build_comparison(self, tenant_id: str, experiment_id: str) -> dict[str, Any]:
        experiment = repo.get(tenant_id, experiment_id)
        if not experiment:
            raise ValueError("Experiment not found")

        evaluation_ids = experiment.get("evaluation_ids", [])
        if len(evaluation_ids) < 2:
            raise ValueError("Experiment must have at least 2 evaluations")

        repo.update_status(tenant_id, experiment_id, "running")

        try:
            evaluations: dict[str, dict] = {}
            results: dict[str, dict] = {}

            for eid in evaluation_ids:
                evaluation = eval_repo.get(tenant_id, eid)
                if not evaluation:
                    raise ValueError(f"Evaluation not found: {eid}")
                if evaluation.get("status") != "completed":
                    raise ValueError(f"Evaluation {eid} not completed (status: {evaluation.get('status')})")
                result = eval_repo.get_result(tenant_id, eid)
                if not result:
                    raise ValueError(f"Results not found for evaluation: {eid}")
                evaluations[eid] = evaluation
                results[eid] = result

            # Build metric summary
            metric_summary = {}
            for eid, result in results.items():
                summary = result.get("summary", {})
                metric_averages: dict[str, list] = {}
                models_data = summary.get("models", {})
                for model_info in models_data.values():
                    for metric_id, score in model_info.get("avg_scores", {}).items():
                        if score is not None:
                            metric_averages.setdefault(metric_id, []).append(score)

                flat_metrics = {}
                for mid, slist in metric_averages.items():
                    flat_metrics[mid] = sum(slist) / len(slist) if slist else None

                metric_summary[eid] = {
                    "evaluation_name": evaluations[eid].get("name", eid),
                    "models": evaluations[eid].get("models", []),
                    "metrics": flat_metrics,
                }

            baseline_id = evaluation_ids[0]
            samples = self._align_samples(baseline_id, evaluation_ids, results)

            comparison = {
                "experiment_id": experiment_id,
                "evaluation_ids": evaluation_ids,
                "baseline_id": baseline_id,
                "metric_summary": metric_summary,
                "samples": samples,
            }

            repo.save_comparison(tenant_id, experiment_id, comparison)
            repo.update_status(tenant_id, experiment_id, "completed")
            return comparison

        except Exception:
            logger.exception("Failed to build comparison for experiment %s", experiment_id)
            repo.update_status(tenant_id, experiment_id, "failed")
            raise

    def _align_samples(
        self,
        baseline_id: str,
        evaluation_ids: list[str],
        results: dict[str, dict[str, Any]],
    ) -> list[dict[str, Any]]:
        eval_samples: dict[str, dict] = {}
        for eid in evaluation_ids:
            samples_list = results[eid].get("samples", [])
            eval_samples[eid] = {s.get("sample_id"): s for s in samples_list if s.get("sample_id")}

        all_sample_ids: list[str] = []
        seen: set[str] = set()
        for eid in evaluation_ids:
            for sid in eval_samples.get(eid, {}):
                if sid not in seen:
                    all_sample_ids.append(sid)
                    seen.add(sid)

        aligned = []
        for sid in all_sample_ids:
            entry: dict[str, Any] = {"sample_id": sid, "evaluations": {}}
            baseline_sample = eval_samples.get(baseline_id, {}).get(sid, {})
            baseline_flat = self._flatten_scores(baseline_sample.get("scores", {}))

            for eid in evaluation_ids:
                sample = eval_samples.get(eid, {}).get(sid)
                if not sample:
                    entry["evaluations"][eid] = {"missing": True}
                    continue
                flat_scores = self._flatten_scores(sample.get("scores", {}))
                eval_data: dict[str, Any] = {
                    "input": sample.get("input", ""),
                    "output": sample.get("output", ""),
                    "expected": sample.get("expected", ""),
                    "scores": flat_scores,
                }
                if eid != baseline_id:
                    deltas = {}
                    for mn, cv in flat_scores.items():
                        bv = baseline_flat.get(mn)
                        if cv is not None and bv is not None:
                            deltas[mn] = cv - bv
                    eval_data["deltas"] = deltas
                entry["evaluations"][eid] = eval_data
            aligned.append(entry)
        return aligned

    @staticmethod
    def _flatten_scores(scores: dict[str, Any]) -> dict[str, float]:
        flat: dict[str, float] = {}
        for mid, md in scores.items():
            if isinstance(md, dict):
                values = []
                for v in md.values():
                    ex = ExperimentRunner._extract_score(v)
                    if ex is not None:
                        values.append(ex)
                if values:
                    flat[mid] = sum(values) / len(values)
            else:
                ex = ExperimentRunner._extract_score(md)
                if ex is not None:
                    flat[mid] = ex
        return flat

    @staticmethod
    def _extract_score(data: Any) -> Optional[float]:
        if data is None:
            return None
        if isinstance(data, (int, float)):
            return float(data)
        if isinstance(data, dict):
            s = data.get("score")
            return float(s) if s is not None else None
        return None
