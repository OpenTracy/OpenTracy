"""Operator Loop — autonomous dataset curation tick engine.

The OperatorLoop runs forever behind the ``AUTO_OPERATOR=true`` env flag,
evaluating trigger conditions every ~60s and picking ONE next action.
It never triggers training: the only artifact that reaches users is a
``pending_curation`` dataset for human review.

Usage
-----
    import asyncio
    from opentracy.harness.operator import OperatorLoop

    async def main():
        loop = OperatorLoop(tenant_id="default", interval_seconds=60)
        loop.start()
        try:
            await asyncio.sleep(3600)
        finally:
            loop.stop()

    asyncio.run(main())

Tick policy (rule-based):
    - unclustered_traces >= threshold AND no clustering in last 6h
        -> cluster_traces
    - fresh clusters with no dataset proposed AND pending < 5
        -> propose_dataset
    - else
        -> idle

Every decision (including ``idle``) is appended to ``operator_decisions``.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from .memory_store import MemoryEntry, MemoryStore, get_memory_store

logger = logging.getLogger(__name__)

OPERATOR_CATEGORY = "operator_state"
OPERATOR_STATE_ID = "operator_state"

DEFAULT_INTERVAL_SEC = int(os.getenv("OPERATOR_INTERVAL_SEC", "60"))
DEFAULT_UNCLUSTERED_THRESHOLD = int(os.getenv("OPERATOR_UNCLUSTERED_THRESHOLD", "500"))
DEFAULT_PENDING_LIMIT = int(os.getenv("OPERATOR_PENDING_LIMIT", "5"))
DEFAULT_CLUSTER_COOLDOWN_HOURS = int(os.getenv("OPERATOR_CLUSTER_COOLDOWN_HOURS", "6"))


@dataclass
class OperatorState:
    paused: bool = False
    last_tick_at: Optional[str] = None
    next_tick_at: Optional[str] = None
    total_ticks: int = 0

    def to_dict(self) -> dict[str, Any]:
        return {
            "paused": self.paused,
            "last_tick_at": self.last_tick_at,
            "next_tick_at": self.next_tick_at,
            "total_ticks": self.total_ticks,
        }


class OperatorLoop:
    """Autonomous tick loop that curates datasets behind AUTO_OPERATOR=true."""

    def __init__(
        self,
        tenant_id: str = "default",
        *,
        interval_seconds: int = DEFAULT_INTERVAL_SEC,
        memory_store: Optional[MemoryStore] = None,
        unclustered_threshold: int = DEFAULT_UNCLUSTERED_THRESHOLD,
        pending_limit: int = DEFAULT_PENDING_LIMIT,
        cluster_cooldown_hours: int = DEFAULT_CLUSTER_COOLDOWN_HOURS,
    ):
        self.tenant_id = tenant_id
        self.interval_seconds = max(10, int(interval_seconds))
        self.unclustered_threshold = unclustered_threshold
        self.pending_limit = pending_limit
        self.cluster_cooldown_hours = cluster_cooldown_hours
        self.memory_store = memory_store or get_memory_store()
        self._state = OperatorState()
        self._task: Optional[asyncio.Task] = None
        self._load_state()

    # ----- lifecycle -------------------------------------------------------

    def start(self) -> None:
        if self._task is not None and not self._task.done():
            return
        self._task = asyncio.create_task(self._run_loop())
        logger.info(
            "OperatorLoop started (interval=%ss, tenant=%s)",
            self.interval_seconds,
            self.tenant_id,
        )

    def stop(self) -> None:
        if self._task is not None:
            self._task.cancel()
            self._task = None
            logger.info("OperatorLoop stopped")

    @property
    def running(self) -> bool:
        return self._task is not None and not self._task.done()

    # ----- state persistence ----------------------------------------------

    def _load_state(self) -> None:
        entries = self.memory_store.query(
            agent="operator", category=OPERATOR_CATEGORY, tags=["state"], limit=1
        )
        if entries:
            ev = entries[0].evaluation or {}
            self._state = OperatorState(
                paused=bool(ev.get("paused", False)),
                last_tick_at=ev.get("last_tick_at"),
                next_tick_at=ev.get("next_tick_at"),
                total_ticks=int(ev.get("total_ticks", 0)),
            )

    def _save_state(self) -> None:
        existing = self.memory_store.get(OPERATOR_STATE_ID)
        if existing is not None:
            self.memory_store.delete(OPERATOR_STATE_ID)
        entry = MemoryEntry(
            id=OPERATOR_STATE_ID,
            agent="operator",
            category=OPERATOR_CATEGORY,
            created_at=datetime.now(timezone.utc).isoformat(),
            body=(
                "## Operator State\n\n"
                f"- paused: {self._state.paused}\n"
                f"- last_tick_at: {self._state.last_tick_at}\n"
                f"- total_ticks: {self._state.total_ticks}\n"
            ),
            tags=["state"],
            evaluation=self._state.to_dict(),
        )
        self.memory_store.save(entry)

    # ----- control surface -------------------------------------------------

    def pause(self) -> None:
        self._state.paused = True
        self._save_state()

    def resume(self) -> None:
        self._state.paused = False
        self._save_state()

    def get_status(self) -> dict[str, Any]:
        return {
            "running": self.running,
            **self._state.to_dict(),
            "interval_seconds": self.interval_seconds,
        }

    # ----- main loop -------------------------------------------------------

    async def _run_loop(self) -> None:
        while True:
            try:
                await self.tick()
            except asyncio.CancelledError:
                break
            except Exception as exc:  # pragma: no cover - defensive
                logger.exception("Operator tick failed: %s", exc)
            try:
                await asyncio.sleep(self.interval_seconds)
            except asyncio.CancelledError:
                break

    async def tick(self) -> dict[str, Any]:
        """Evaluate state, choose ONE action, execute, log the decision."""
        tick_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc)
        self._state.last_tick_at = now.isoformat()
        self._state.next_tick_at = (
            now + timedelta(seconds=self.interval_seconds)
        ).isoformat()
        self._state.total_ticks += 1
        self._save_state()

        if self._state.paused:
            return self._log_decision(
                tick_id,
                action="idle",
                rationale="operator paused by user",
                inputs={"paused": True},
                outcome="skipped",
                outcome_json={},
            )

        inputs = self._read_state()
        action, rationale = self._choose_action(inputs)

        if action == "cluster_traces":
            from . import operator_tools

            try:
                outcome_json = await operator_tools.cluster_traces(limit=1000)
                outcome = "ok"
            except Exception as exc:
                logger.exception("cluster_traces failed")
                outcome_json = {"error": str(exc)}
                outcome = "error"
        elif action == "propose_dataset":
            from . import operator_tools

            cluster_ref = inputs.get("fresh_cluster_ref") or {}
            try:
                outcome_json = await operator_tools.propose_dataset_from_cluster(
                    tenant_id=self.tenant_id,
                    run_id=cluster_ref.get("run_id", ""),
                    cluster_id=int(cluster_ref.get("cluster_id", -1)),
                )
                outcome = "ok"
            except Exception as exc:
                logger.exception("propose_dataset failed")
                outcome_json = {"error": str(exc)}
                outcome = "error"
        elif action == "propose_training_run":
            try:
                from ..training.runtime import get_training_manager

                tm = get_training_manager()
                outcome_json = await tm.run_once(
                    trigger="operator", tenant_id=self.tenant_id
                )
                outcome = "error" if outcome_json.get("error") else "ok"
            except Exception as exc:
                logger.exception("propose_training_run failed")
                outcome_json = {"error": str(exc)}
                outcome = "error"
        else:
            outcome = "idle"
            outcome_json = {}

        return self._log_decision(
            tick_id,
            action=action,
            rationale=rationale,
            inputs=inputs,
            outcome=outcome,
            outcome_json=outcome_json,
        )

    # ----- policy ----------------------------------------------------------

    def _read_state(self) -> dict[str, Any]:
        """Collect metrics used by the policy. Resilient to missing tables."""
        from ..storage.clickhouse_client import get_client
        from ..datasets import repository as ds_repo

        client = get_client()
        state: dict[str, Any] = {
            "unclustered_traces": 0,
            "pending_datasets": 0,
            "hours_since_last_clustering": None,
            "fresh_cluster_ref": None,
        }

        try:
            state["pending_datasets"] = len(
                ds_repo.list_pending_datasets(self.tenant_id)
            )
        except Exception as exc:
            logger.debug("list_pending_datasets failed: %s", exc)

        # Detect a training-ready dataset (active + >=50 samples) if no
        # training has run in the last 24h. The TrainingManager owns the
        # rate-limit + safety gates; we just signal readiness to the policy.
        try:
            from ..training.runtime import get_training_manager

            tm = get_training_manager()
            if not tm.is_paused() and tm.weights_ready and not tm.rate_limited():
                ok, ds = tm.has_active_dataset(tenant_id=self.tenant_id)
                if ok:
                    state["training_ready_dataset"] = ds
        except Exception as exc:
            logger.debug("training readiness check failed: %s", exc)

        if client is None:
            return state

        last_run_at: Optional[datetime] = None
        last_run_id: Optional[str] = None
        try:
            rr = client.query(
                "SELECT run_id, created_at FROM clustering_runs ORDER BY created_at DESC LIMIT 1"
            )
            if rr.result_rows:
                last_run_id = str(rr.result_rows[0][0])
                last_run_at = rr.result_rows[0][1]
                if isinstance(last_run_at, str):
                    try:
                        last_run_at = datetime.fromisoformat(
                            last_run_at.replace("Z", "+00:00")
                        )
                    except ValueError:
                        last_run_at = None
        except Exception as exc:
            logger.debug("clustering_runs read failed: %s", exc)

        if last_run_at is not None:
            if last_run_at.tzinfo is None:
                last_run_at = last_run_at.replace(tzinfo=timezone.utc)
            delta = datetime.now(timezone.utc) - last_run_at
            state["hours_since_last_clustering"] = round(
                delta.total_seconds() / 3600.0, 2
            )

        # count traces since last clustering window (or all-time if none)
        try:
            params: dict[str, Any] = {}
            if last_run_at is not None:
                sql = (
                    "SELECT count() FROM llm_traces "
                    "WHERE input_text != '' AND timestamp > {since:DateTime64(3)}"
                )
                params["since"] = last_run_at
            else:
                sql = "SELECT count() FROM llm_traces WHERE input_text != ''"
            r = client.query(sql, parameters=params)
            if r.result_rows:
                state["unclustered_traces"] = int(r.result_rows[0][0])
        except Exception as exc:
            logger.debug("unclustered count failed: %s", exc)

        # find a fresh cluster (latest run) that hasn't been proposed yet
        if last_run_id:
            try:
                cr = client.query(
                    "SELECT cluster_id FROM cluster_datasets "
                    "WHERE run_id = {rid:String} AND status IN ('qualified','candidate') "
                    "ORDER BY trace_count DESC LIMIT 8",
                    parameters={"rid": last_run_id},
                )
                proposed_clusters = self._already_proposed_clusters(last_run_id)
                for row in cr.result_rows:
                    cid = int(row[0])
                    if (last_run_id, cid) not in proposed_clusters:
                        state["fresh_cluster_ref"] = {
                            "run_id": last_run_id,
                            "cluster_id": cid,
                        }
                        break
            except Exception as exc:
                logger.debug("fresh cluster lookup failed: %s", exc)

        return state

    def _already_proposed_clusters(self, run_id: str) -> set[tuple[str, int]]:
        """Return set of (run_id, cluster_id) that already have auto datasets."""
        from ..storage.clickhouse_client import get_client

        client = get_client()
        if client is None:
            return set()
        try:
            rr = client.query(
                "SELECT rationale FROM eval_datasets FINAL "
                "WHERE tenant_id = {tid:String} AND source = 'auto'",
                parameters={"tid": self.tenant_id},
            )
            out: set[tuple[str, int]] = set()
            for row in rr.result_rows:
                raw = row[0]
                if not raw:
                    continue
                try:
                    meta = json.loads(raw) if isinstance(raw, str) else {}
                except (json.JSONDecodeError, TypeError):
                    meta = {}
                ref = meta.get("cluster_ref") or {}
                if ref.get("run_id") and "cluster_id" in ref:
                    out.add((str(ref["run_id"]), int(ref["cluster_id"])))
            return out
        except Exception:
            return set()

    def _choose_action(self, inputs: dict[str, Any]) -> tuple[str, str]:
        unclustered = int(inputs.get("unclustered_traces", 0))
        pending = int(inputs.get("pending_datasets", 0))
        hours = inputs.get("hours_since_last_clustering")
        fresh = inputs.get("fresh_cluster_ref")

        should_cluster = unclustered >= self.unclustered_threshold and (
            hours is None or hours >= self.cluster_cooldown_hours
        )
        if should_cluster:
            return (
                "cluster_traces",
                (
                    f"{unclustered} unclustered traces >= threshold "
                    f"{self.unclustered_threshold} and hours_since_last_clustering="
                    f"{hours} >= {self.cluster_cooldown_hours}h cooldown"
                ),
            )

        if fresh and pending < self.pending_limit:
            return (
                "propose_dataset",
                (
                    f"fresh cluster {fresh.get('cluster_id')} (run {fresh.get('run_id')}) "
                    f"has no proposed dataset; pending={pending} < {self.pending_limit}"
                ),
            )

        train_ref = inputs.get("training_ready_dataset")
        if train_ref:
            return (
                "propose_training_run",
                (
                    f"active dataset {train_ref.get('dataset_id')} "
                    f"({train_ref.get('samples_count')} samples) ready; "
                    f"no training run in last 24h"
                ),
            )

        return (
            "idle",
            (
                f"no triggers fired — unclustered={unclustered}/"
                f"{self.unclustered_threshold}, pending={pending}, "
                f"hours_since_clustering={hours}, fresh_cluster={bool(fresh)}"
            ),
        )

    # ----- decision log ----------------------------------------------------

    def _log_decision(
        self,
        tick_id: str,
        *,
        action: str,
        rationale: str,
        inputs: dict[str, Any],
        outcome: str,
        outcome_json: dict[str, Any],
    ) -> dict[str, Any]:
        row = {
            "id": str(uuid.uuid4()),
            "timestamp": datetime.now(timezone.utc),
            "tick_id": tick_id,
            "action": action,
            "rationale": rationale,
            "inputs": json.dumps(_json_safe(inputs), ensure_ascii=False),
            "outcome": outcome,
            "outcome_json": json.dumps(_json_safe(outcome_json), ensure_ascii=False),
        }
        try:
            from ..storage.clickhouse_client import get_client

            client = get_client()
            if client is not None:
                columns = list(row.keys())
                client.insert(
                    "operator_decisions",
                    [[row[c] for c in columns]],
                    column_names=columns,
                )
        except Exception as exc:
            logger.warning("Failed to persist operator decision: %s", exc)

        logger.info(
            "operator tick action=%s outcome=%s rationale=%s",
            action,
            outcome,
            rationale,
        )
        return {
            **row,
            "timestamp": row["timestamp"].isoformat(),
        }

    def list_decisions(self, limit: int = 50) -> list[dict[str, Any]]:
        from ..storage.clickhouse_client import get_client

        client = get_client()
        if client is None:
            return []
        try:
            rr = client.query(
                "SELECT id, timestamp, tick_id, action, rationale, inputs, outcome, outcome_json "
                "FROM operator_decisions ORDER BY timestamp DESC LIMIT {lim:UInt32}",
                parameters={"lim": int(limit)},
            )
            out: list[dict[str, Any]] = []
            for row in rr.result_rows:
                ts = row[1]
                if isinstance(ts, datetime):
                    ts = ts.isoformat()
                out.append(
                    {
                        "id": row[0],
                        "timestamp": ts,
                        "tick_id": row[2],
                        "action": row[3],
                        "rationale": row[4],
                        "inputs": _try_json(row[5]),
                        "outcome": row[6],
                        "outcome_json": _try_json(row[7]),
                    }
                )
            return out
        except Exception as exc:
            logger.warning("list_decisions failed: %s", exc)
            return []


def _json_safe(value: Any) -> Any:
    if isinstance(value, dict):
        return {k: _json_safe(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_json_safe(v) for v in value]
    if isinstance(value, datetime):
        return value.isoformat()
    return value


def _try_json(raw: Any) -> Any:
    if isinstance(raw, (dict, list)):
        return raw
    if not raw:
        return {}
    try:
        return json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return raw


# Singleton
_instance: Optional[OperatorLoop] = None


def get_operator(tenant_id: str = "default") -> OperatorLoop:
    global _instance
    if _instance is None:
        _instance = OperatorLoop(tenant_id=tenant_id)
    return _instance
