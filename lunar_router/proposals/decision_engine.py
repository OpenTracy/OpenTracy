"""
Decision Engine

Rule-based event processor that creates proposals for user approval.
All event handlers are fire-and-forget safe.
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Optional

logger = logging.getLogger(__name__)

MIN_SAMPLES_FOR_EVAL = 10
MIN_SAMPLES_FOR_SETUP = 5
REGRESSION_THRESHOLD_DEFAULT = 0.05


class DecisionEngine:
    """Core rule engine that creates proposals based on system events."""

    # =========================================================================
    # Event Handlers (fire-and-forget safe)
    # =========================================================================

    def on_samples_added(self, tenant_id: str, dataset_id: str, count: int) -> None:
        try:
            self._check_rule_create_evaluation(tenant_id, dataset_id, count)
        except Exception as e:
            logger.warning("Rule 1 (create_evaluation) failed: %s", e)
        try:
            self._check_rule_setup_auto_eval(tenant_id, dataset_id)
        except Exception as e:
            logger.warning("Rule 2 (setup_auto_eval) failed: %s", e)

    def on_evaluation_completed(self, tenant_id: str, evaluation_id: str) -> None:
        try:
            self._check_rule_regression_experiment(tenant_id, evaluation_id)
        except Exception as e:
            logger.warning("Rule 3 (regression experiment) failed: %s", e)
        try:
            self._check_rule_cross_model_experiment(tenant_id, evaluation_id)
        except Exception as e:
            logger.warning("Rule 4 (cross-model experiment) failed: %s", e)

    # =========================================================================
    # Rule implementations
    # =========================================================================

    def _check_rule_create_evaluation(self, tenant_id: str, dataset_id: str, new_count: int) -> None:
        from ..auto_eval import repository as ae_repo
        from ..datasets.repository import get_samples
        from . import repository as prop_repo

        configs = ae_repo.list_configs(tenant_id)
        config = next((c for c in configs if c.get("dataset_id") == dataset_id and c.get("enabled", True)), None)
        if not config:
            return

        samples = get_samples(tenant_id, dataset_id)
        total = len(samples) if samples else 0
        last_run_at = config.get("last_run_at")
        new_since = self._count_samples_since(samples, last_run_at) if last_run_at else total
        if new_since < MIN_SAMPLES_FOR_EVAL:
            return

        dedup_key = f"create_evaluation:{dataset_id}:{config['config_id']}"
        if prop_repo.find_by_dedup_key(tenant_id, dedup_key):
            return

        prop_repo.create(tenant_id, {
            "proposal_type": "create_evaluation",
            "event_type": "samples_added",
            "priority": "medium",
            "title": f"Run evaluation on {config.get('name', dataset_id)}",
            "description": f"{new_since} new samples since last evaluation. Total: {total}.",
            "reason": "new_samples_threshold",
            "dataset_id": dataset_id,
            "config_id": config["config_id"],
            "dedup_key": dedup_key,
            "action_payload": {"config_id": config["config_id"], "dataset_id": dataset_id},
        })

    def _check_rule_setup_auto_eval(self, tenant_id: str, dataset_id: str) -> None:
        from ..auto_eval import repository as ae_repo
        from ..datasets.repository import get_dataset, get_samples
        from . import repository as prop_repo

        configs = ae_repo.list_configs(tenant_id)
        if any(c.get("dataset_id") == dataset_id for c in configs):
            return

        samples = get_samples(tenant_id, dataset_id)
        if not samples or len(samples) < MIN_SAMPLES_FOR_SETUP:
            return

        dataset = get_dataset(tenant_id, dataset_id)
        name = dataset.get("name", dataset_id) if dataset else dataset_id

        dedup_key = f"setup_auto_eval:{dataset_id}"
        if prop_repo.find_by_dedup_key(tenant_id, dedup_key):
            return

        prop_repo.create(tenant_id, {
            "proposal_type": "setup_auto_eval",
            "event_type": "samples_added",
            "priority": "high",
            "title": f"Set up auto-evaluation for {name}",
            "description": f"Dataset '{name}' has {len(samples)} samples but no auto-eval config.",
            "reason": "no_auto_eval_config",
            "dataset_id": dataset_id,
            "dedup_key": dedup_key,
            "action_payload": {"dataset_id": dataset_id},
        })

    def _check_rule_regression_experiment(self, tenant_id: str, evaluation_id: str) -> None:
        from ..evaluations import repository as eval_repo
        from ..auto_eval import repository as ae_repo
        from ..datasets.repository import get_dataset
        from . import repository as prop_repo

        evaluation = eval_repo.get(tenant_id, evaluation_id)
        if not evaluation or evaluation.get("status") != "completed":
            return
        dataset_id = evaluation.get("dataset_id")
        if not dataset_id:
            return

        result = eval_repo.get_result(tenant_id, evaluation_id)
        if not result:
            return
        current_avg = self._compute_avg_score(result)
        if current_avg is None:
            return

        all_evals = eval_repo.list_all(tenant_id)
        prev_evals = sorted(
            [e for e in all_evals if e.get("dataset_id") == dataset_id and e.get("status") == "completed" and e.get("evaluation_id") != evaluation_id],
            key=lambda e: e.get("created_at", ""), reverse=True,
        )
        if not prev_evals:
            return

        prev_result = eval_repo.get_result(tenant_id, prev_evals[0]["evaluation_id"])
        if not prev_result:
            return
        prev_avg = self._compute_avg_score(prev_result)
        if prev_avg is None:
            return

        config_id = evaluation.get("auto_eval_config_id")
        threshold = REGRESSION_THRESHOLD_DEFAULT
        if config_id:
            cfg = ae_repo.get_config(tenant_id, config_id)
            if cfg:
                threshold = cfg.get("regression_threshold", REGRESSION_THRESHOLD_DEFAULT)

        drop = prev_avg - current_avg
        if drop <= threshold:
            return

        eval_ids = sorted([evaluation_id, prev_evals[0]["evaluation_id"]])
        dedup_key = f"create_experiment:{dataset_id}:{':'.join(eval_ids)}"
        if prop_repo.find_by_dedup_key(tenant_id, dedup_key):
            return

        dataset = get_dataset(tenant_id, dataset_id)
        name = dataset.get("name", dataset_id) if dataset else dataset_id

        prop_repo.create(tenant_id, {
            "proposal_type": "create_experiment",
            "event_type": "evaluation_completed",
            "priority": "high",
            "title": f"Regression detected on {name}",
            "description": f"Score dropped from {prev_avg:.3f} to {current_avg:.3f} (delta: {drop:.3f}, threshold: {threshold}).",
            "reason": "regression_detected",
            "dataset_id": dataset_id,
            "config_id": config_id or "",
            "evaluation_id": evaluation_id,
            "dedup_key": dedup_key,
            "action_payload": {"dataset_id": dataset_id, "evaluation_ids": eval_ids, "name": f"Regression investigation - {name}"},
        })

    def _check_rule_cross_model_experiment(self, tenant_id: str, evaluation_id: str) -> None:
        from ..evaluations import repository as eval_repo
        from ..experiments import repository as exp_repo
        from ..datasets.repository import get_dataset
        from . import repository as prop_repo

        evaluation = eval_repo.get(tenant_id, evaluation_id)
        if not evaluation or evaluation.get("status") != "completed":
            return
        dataset_id = evaluation.get("dataset_id")
        if not dataset_id:
            return

        all_evals = eval_repo.list_all(tenant_id)
        dataset_evals = [e for e in all_evals if e.get("dataset_id") == dataset_id and e.get("status") == "completed"]
        if len(dataset_evals) < 2:
            return

        all_models: set[str] = set()
        for e in dataset_evals:
            for m in e.get("models", []):
                all_models.add(str(m) if not isinstance(m, str) else m)
        if len(all_models) < 2:
            return

        experiments = exp_repo.list_all(tenant_id)
        if any(exp.get("dataset_id") == dataset_id for exp in experiments):
            return

        eval_ids = sorted([e["evaluation_id"] for e in dataset_evals])
        dedup_key = f"create_experiment:{dataset_id}:{':'.join(eval_ids)}"
        if prop_repo.find_by_dedup_key(tenant_id, dedup_key):
            return

        dataset = get_dataset(tenant_id, dataset_id)
        name = dataset.get("name", dataset_id) if dataset else dataset_id

        prop_repo.create(tenant_id, {
            "proposal_type": "create_experiment",
            "event_type": "evaluation_completed",
            "priority": "medium",
            "title": f"Compare models on {name}",
            "description": f"{len(dataset_evals)} evals with {len(all_models)} models. Create experiment.",
            "reason": "multiple_evals_different_models",
            "dataset_id": dataset_id,
            "evaluation_id": evaluation_id,
            "dedup_key": dedup_key,
            "action_payload": {"dataset_id": dataset_id, "evaluation_ids": eval_ids, "name": f"Model comparison - {name}"},
        })

    # =========================================================================
    # Execution
    # =========================================================================

    def execute_proposal(self, tenant_id: str, proposal: dict[str, Any], authorization: str | None = None) -> dict[str, Any]:
        ptype = proposal.get("proposal_type")
        payload = proposal.get("action_payload", {})
        if ptype == "create_evaluation":
            return self._exec_create_evaluation(tenant_id, payload, authorization)
        elif ptype == "setup_auto_eval":
            return self._exec_setup_auto_eval(tenant_id, payload, authorization)
        elif ptype == "create_experiment":
            return self._exec_create_experiment(tenant_id, payload)
        return {"success": False, "error": f"Unknown proposal type: {ptype}"}

    def _exec_create_evaluation(self, tenant_id: str, payload: dict, authorization: str | None) -> dict[str, Any]:
        from ..auto_eval import repository as ae_repo
        from ..datasets.repository import get_samples
        from ..evaluations import repository as eval_repo
        from ..evaluations.runner import EvaluationRunner

        cid = payload.get("config_id")
        if not cid:
            return {"success": False, "error": "Missing config_id"}
        config = ae_repo.get_config(tenant_id, cid)
        if not config:
            return {"success": False, "error": f"Config {cid} not found"}

        samples = get_samples(tenant_id, config["dataset_id"])
        now = datetime.utcnow().isoformat()
        ev = eval_repo.create(tenant_id, {
            "name": f"[Auto] {config['name']} - {now[:16]}",
            "description": "Triggered by proposal approval",
            "dataset_id": config["dataset_id"],
            "models": config["models"],
            "metrics": config["metrics"],
            "config": {},
            "total_samples": len(samples) if samples else 0,
            "auto_eval_config_id": cid,
        })
        eid = ev["evaluation_id"]
        try:
            EvaluationRunner().run(tenant_id, eid, authorization=authorization)
        except Exception as e:
            logger.exception("Error running proposal-triggered evaluation")
            eval_repo.update_status(tenant_id, eid, status="failed", error_message=str(e))

        ae_repo.create_run(tenant_id, cid, {"evaluation_id": eid})
        return {"success": True, "created_id": eid}

    def _exec_setup_auto_eval(self, tenant_id: str, payload: dict, authorization: str | None) -> dict[str, Any]:
        from ..eval_agent.agent import EvalAgent
        agent = EvalAgent()
        result = agent.setup(tenant_id, payload.get("dataset_id", ""), authorization=authorization, auto_trigger=True)
        config = result.get("config", {})
        return {
            "success": True,
            "created_id": config.get("config_id"),
            "details": {
                "config_id": config.get("config_id"),
                "metrics_created": len(result.get("created_metrics", [])),
                "run_triggered": result.get("run") is not None,
            },
        }

    def _exec_create_experiment(self, tenant_id: str, payload: dict) -> dict[str, Any]:
        from ..experiments import repository as exp_repo
        ds_id = payload.get("dataset_id")
        eids = payload.get("evaluation_ids", [])
        name = payload.get("name", "Auto-created experiment")
        if not ds_id or not eids:
            return {"success": False, "error": "Missing dataset_id or evaluation_ids"}
        experiment = exp_repo.create(tenant_id, {"name": name, "description": "Created by Decision Engine", "dataset_id": ds_id, "evaluation_ids": eids})
        return {"success": True, "created_id": experiment.get("experiment_id")}

    # =========================================================================
    # Helpers
    # =========================================================================

    @staticmethod
    def _count_samples_since(samples: list, since_iso: str) -> int:
        try:
            since_dt = datetime.fromisoformat(since_iso.replace("Z", "").replace("+00:00", ""))
        except (ValueError, TypeError):
            return len(samples) if samples else 0
        count = 0
        for s in (samples or []):
            created = s.get("created_at", "")
            if not created:
                count += 1
                continue
            try:
                s_dt = datetime.fromisoformat(str(created).replace("Z", "").replace("+00:00", ""))
                if s_dt > since_dt:
                    count += 1
            except (ValueError, TypeError):
                count += 1
        return count

    @staticmethod
    def _compute_avg_score(result: dict[str, Any]) -> Optional[float]:
        summary = result.get("summary", {})
        if not summary:
            return None
        scores = []
        for md in summary.values():
            if isinstance(md, dict):
                avg = md.get("average")
                if avg is not None:
                    scores.append(float(avg))
            elif isinstance(md, (int, float)):
                scores.append(float(md))
        return sum(scores) / len(scores) if scores else None
