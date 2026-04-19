"""Runtime glue for continuous training.

Holds a singleton ``TrainingManager`` that wraps ``ScheduledTrainer`` and
exposes safety rails (pause flag, 24h rate limit) plus a uniform
``operator_decisions`` logging hook so both scheduled runs and Operator-
initiated runs surface in the same timeline.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Optional

from ..harness.memory_store import MemoryEntry, MemoryStore, get_memory_store
from opentracy._env import env

logger = logging.getLogger(__name__)

TRAINING_CATEGORY = "training_state"
TRAINING_PAUSE_ID = "training_pause"
TRAINING_LAST_RUN_ID = "training_last_run"
MIN_RUN_INTERVAL_HOURS = 24


def _weights_ready(weights_path: str) -> bool:
    p = Path(weights_path)
    if not p.exists() or not p.is_dir():
        return False
    for entry in p.iterdir():
        if entry.is_file() and entry.stat().st_size > 0:
            return True
    return False


def _log_operator_decision(
    action: str, rationale: str, outcome: str, outcome_json: dict[str, Any]
) -> None:
    """Persist a training event to operator_decisions (best effort)."""
    try:
        from ..storage.clickhouse_client import get_client

        client = get_client()
        if client is None:
            return
        row = {
            "id": str(uuid.uuid4()),
            "timestamp": datetime.now(timezone.utc),
            "tick_id": str(uuid.uuid4()),
            "action": action,
            "rationale": rationale,
            "inputs": "{}",
            "outcome": outcome,
            "outcome_json": json.dumps(outcome_json, ensure_ascii=False, default=str),
        }
        columns = list(row.keys())
        client.insert(
            "operator_decisions",
            [[row[c] for c in columns]],
            column_names=columns,
        )
    except Exception as exc:
        logger.debug("operator_decisions insert failed: %s", exc)


class TrainingManager:
    """Singleton wrapper around ``ScheduledTrainer`` with safety rails."""

    def __init__(
        self,
        *,
        weights_path: str = "/app/weights",
        engine_url: str = "http://opentracy-engine:8080",
        memory_store: Optional[MemoryStore] = None,
    ):
        self.weights_path = weights_path
        self.engine_url = engine_url
        self.memory_store = memory_store or get_memory_store()
        self.weights_ready = _weights_ready(weights_path)
        self._scheduled_trainer = None
        self._bg_task: Optional[asyncio.Task] = None
        self._scheduled_enabled = False

    # ----- pause/resume -----------------------------------------------------

    def is_paused(self) -> bool:
        entry = self.memory_store.get(TRAINING_PAUSE_ID)
        return bool(entry and (entry.evaluation or {}).get("paused", False))

    def pause(self) -> None:
        self._write_state(TRAINING_PAUSE_ID, {"paused": True})

    def resume(self) -> None:
        self._write_state(TRAINING_PAUSE_ID, {"paused": False})

    # ----- rate limit -------------------------------------------------------

    def hours_since_last_run(self) -> Optional[float]:
        entry = self.memory_store.get(TRAINING_LAST_RUN_ID)
        if not entry:
            return None
        ts = (entry.evaluation or {}).get("ended_at")
        if not ts:
            return None
        try:
            dt = datetime.fromisoformat(str(ts).replace("Z", "+00:00"))
        except ValueError:
            return None
        delta = datetime.now(timezone.utc) - dt
        return delta.total_seconds() / 3600.0

    def rate_limited(self) -> bool:
        h = self.hours_since_last_run()
        return h is not None and h < MIN_RUN_INTERVAL_HOURS

    def last_run_result(self) -> dict[str, Any]:
        entry = self.memory_store.get(TRAINING_LAST_RUN_ID)
        if not entry:
            return {}
        return dict(entry.evaluation or {})

    # ----- curated-data gate ------------------------------------------------

    def has_active_dataset(self, tenant_id: str = "default", min_samples: int = 50) -> tuple[bool, dict[str, Any]]:
        """Return (ok, {dataset_id, samples_count}) for a qualifying dataset."""
        try:
            from ..datasets import repository as ds_repo

            for d in ds_repo.list_datasets(tenant_id):
                if d.get("status") == "active" and int(d.get("samples_count") or 0) >= min_samples:
                    return True, {
                        "dataset_id": d.get("dataset_id") or d.get("id"),
                        "samples_count": int(d.get("samples_count") or 0),
                        "name": d.get("name", ""),
                    }
        except Exception as exc:
            logger.debug("has_active_dataset failed: %s", exc)
        return False, {}

    # ----- scheduled trainer ------------------------------------------------

    def _get_scheduled_trainer(self):
        if self._scheduled_trainer is not None:
            return self._scheduled_trainer
        from ..feedback.scheduled_trainer import ScheduledTrainer, TrainingScheduleConfig

        cfg = TrainingScheduleConfig(
            enabled=True,
            check_interval_seconds=3600,
            weights_path=self.weights_path,
            engine_url=self.engine_url,
            auto_reload_engine=True,
        )
        self._scheduled_trainer = ScheduledTrainer(config=cfg)
        return self._scheduled_trainer

    def history(self, limit: int = 20) -> list[dict[str, Any]]:
        t = self._scheduled_trainer
        if t is None:
            return []
        out = []
        for log in list(t.history)[-limit:][::-1]:
            out.append(log.__dict__ if hasattr(log, "__dict__") else dict(log))
        return out

    # ----- one cycle --------------------------------------------------------

    async def run_once(self, *, trigger: str = "manual", tenant_id: str = "default") -> dict[str, Any]:
        """Run a single training cycle subject to safety rails."""
        if self.is_paused():
            outcome = {"skipped": True, "reason": "training paused"}
            _log_operator_decision("training_skip", "training paused", "skipped", outcome)
            return outcome
        if not self.weights_ready:
            outcome = {"skipped": True, "reason": "weights not ready — run bootstrap_weights"}
            _log_operator_decision("training_skip", outcome["reason"], "skipped", outcome)
            return outcome
        if self.rate_limited():
            hours = self.hours_since_last_run()
            outcome = {"skipped": True, "reason": f"rate limited ({hours:.1f}h < 24h)"}
            _log_operator_decision("training_skip", outcome["reason"], "skipped", outcome)
            return outcome
        ok, ds = self.has_active_dataset(tenant_id=tenant_id)
        if not ok:
            outcome = {"skipped": True, "reason": "no active dataset with >=50 samples"}
            _log_operator_decision("training_skip", outcome["reason"], "skipped", outcome)
            return outcome

        trainer = self._get_scheduled_trainer()
        _log_operator_decision(
            "training_start",
            f"trigger={trigger} dataset={ds.get('dataset_id')} samples={ds.get('samples_count')}",
            "ok",
            {"trigger": trigger, "dataset": ds},
        )
        log = await trainer.run_once()
        result = log.__dict__ if hasattr(log, "__dict__") else dict(log)

        action = "training_promote" if result.get("promoted") else "training_reject"
        outcome_tag = "ok" if result.get("promoted") else "rejected"
        if result.get("error"):
            action = "training_error"
            outcome_tag = "error"
        _log_operator_decision(action, str(result.get("reason", "")), outcome_tag, result)

        self._write_state(TRAINING_LAST_RUN_ID, {
            "ended_at": datetime.now(timezone.utc).isoformat(),
            "promoted": bool(result.get("promoted")),
            "reason": result.get("reason"),
            "error": result.get("error"),
            "trigger": trigger,
        })
        return result

    # ----- background scheduled loop ---------------------------------------

    async def _loop(self, interval: int) -> None:
        while True:
            try:
                await self.run_once(trigger="scheduled")
            except asyncio.CancelledError:
                break
            except Exception as exc:  # pragma: no cover
                logger.exception("scheduled training tick failed: %s", exc)
            try:
                await asyncio.sleep(interval)
            except asyncio.CancelledError:
                break

    def start_scheduled(self, interval_seconds: int = 3600) -> None:
        if self._bg_task is not None and not self._bg_task.done():
            return
        if not self.weights_ready:
            logger.warning("AUTO_TRAINER requested but weights not ready; not starting")
            return
        self._scheduled_enabled = True
        self._bg_task = asyncio.create_task(self._loop(interval_seconds))
        logger.info("ScheduledTrainer background loop started (interval=%ss)", interval_seconds)

    def stop_scheduled(self) -> None:
        if self._bg_task is not None:
            self._bg_task.cancel()
            self._bg_task = None
        self._scheduled_enabled = False

    @property
    def scheduled_enabled(self) -> bool:
        return self._scheduled_enabled and self._bg_task is not None and not self._bg_task.done()

    # ----- status -----------------------------------------------------------

    def status(self) -> dict[str, Any]:
        last = self.last_run_result()
        if last.get("error"):
            last_result = "error"
        elif last.get("promoted") is True:
            last_result = "promoted"
        elif last.get("promoted") is False:
            last_result = "rejected"
        else:
            last_result = None
        return {
            "running": self.scheduled_enabled,
            "weights_ready": self.weights_ready,
            "paused": self.is_paused(),
            "last_run_at": last.get("ended_at"),
            "last_run_result": last_result,
            "last_run_reason": last.get("reason"),
            "auto_trainer_enabled": os.getenv("AUTO_TRAINER", "false").lower() == "true",
            "weights_path": self.weights_path,
        }

    # ----- internal ---------------------------------------------------------

    def _write_state(self, entry_id: str, payload: dict[str, Any]) -> None:
        existing = self.memory_store.get(entry_id)
        if existing is not None:
            self.memory_store.delete(entry_id)
        entry = MemoryEntry(
            id=entry_id,
            agent="training",
            category=TRAINING_CATEGORY,
            created_at=datetime.now(timezone.utc).isoformat(),
            body=json.dumps(payload, indent=2, default=str),
            tags=["training"],
            evaluation=payload,
        )
        self.memory_store.save(entry)


_instance: Optional[TrainingManager] = None


def get_training_manager() -> TrainingManager:
    global _instance
    if _instance is None:
        _instance = TrainingManager(
            weights_path=env("WEIGHTS_PATH", "/app/weights"),
            engine_url=env("ENGINE_URL", "http://opentracy-engine:8080"),
        )
    return _instance
