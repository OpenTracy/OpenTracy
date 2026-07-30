"""Scheduled jobs: ticks() reads jobs.json and runs whatever is due.

Design (ADR-0004):

- ``jobs.json`` (workspace root) is the SOURCE OF TRUTH. It is re-read on
  every tick, so edits apply live — no registration step, no restart.
- The FILESYSTEM IS THE RUN STATE. Each execution writes
  ``jobs/runs/<job_id>/<run_id>.md``; the file's existence is the record
  that its slot ran. run.md is created with status=running and updated on
  completion with status, output, and notes — inspectable, diffable, no
  hidden state to drift from reality.
- Catch-up policy: when ticks were down across scheduled slots, only the
  MOST RECENT missed slot runs by default ("send the order at 11pm" must
  not fire three times after a weekend off). Jobs opt into full catch-up
  with ``"catch_up": true``.
- Executors are injected (like the compression Summarizer): the scheduler
  owns WHEN, the executor owns WHAT. The session loop will provide an
  executor that feeds the job's action to the agent.

ticks() is host-driven: call it every minute (system cron, launchd, or the
session loop's idle timer). It is idempotent within a minute slot.
"""

from __future__ import annotations

import json
import traceback
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Callable

from opentracy.core.cron import CronExpr, iter_matching_minutes

# Receives the due job, returns its output text. Exceptions mark the run failed.
JobExecutor = Callable[["Job"], str]


@dataclass(frozen=True)
class Job:
    id: str
    schedule: str
    description: str = ""
    action: dict[str, Any] = field(default_factory=dict)
    enabled: bool = True
    catch_up: bool = False

    @property
    def cron(self) -> CronExpr:
        return CronExpr.parse(self.schedule)


@dataclass(frozen=True)
class RunResult:
    job_id: str
    run_id: str
    scheduled_for: datetime
    status: str  # "success" | "failure"
    output: str
    run_file: Path


class JobScheduler:
    def __init__(
        self,
        root: Path | str,
        executor: JobExecutor,
        lookback: timedelta = timedelta(hours=25),
    ):
        self.root = Path(root)
        self.jobs_file = self.root / "jobs.json"
        self.runs_dir = self.root / "jobs" / "runs"
        self.executor = executor
        # How far back a tick searches for missed slots. 25h covers a daily
        # job across a DST shift; older slots are considered expired.
        self.lookback = lookback

    # ------------------------------------------------------------------
    # jobs.json — source of truth, re-read every tick
    # ------------------------------------------------------------------

    def load_jobs(self) -> list[Job]:
        if not self.jobs_file.exists():
            return []
        data = json.loads(self.jobs_file.read_text(encoding="utf-8"))
        jobs = []
        for raw in data.get("jobs", ()):
            job = Job(
                id=raw["id"],
                schedule=raw["schedule"],
                description=raw.get("description", ""),
                action=raw.get("action", {}),
                enabled=raw.get("enabled", True),
                catch_up=raw.get("catch_up", False),
            )
            job.cron  # validate the expression at load time, not at fire time
            jobs.append(job)
        return jobs

    # ------------------------------------------------------------------
    # ticks()
    # ------------------------------------------------------------------

    def ticks(self, now: datetime | None = None) -> list[RunResult]:
        """Check jobs.json and execute everything that is due. Returns the
        results of this tick's runs (empty when nothing was due)."""
        now = now or datetime.now()
        results = []
        for job in self.load_jobs():
            if not job.enabled:
                continue
            for slot in self._due_slots(job, now):
                results.append(self._execute(job, slot))
        return results

    def _due_slots(self, job: Job, now: datetime) -> list[datetime]:
        """Scheduled slots in the lookback window that have no run file yet.

        Without catch_up: time only moves forward — slots older than the
        job's latest claimed run are expired (yesterday's 23:00 report must
        never fire after today's already ran), and of what remains only the
        most recent slot counts. With catch_up: every unclaimed slot in the
        window fires, oldest first."""
        window_start = now - self.lookback
        slots = [
            slot
            for slot in iter_matching_minutes(job.cron, window_start, now)
            if not self._run_file(job.id, slot).exists()
        ]
        if not job.catch_up:
            latest_claimed = self._latest_claimed_slot(job.id)
            if latest_claimed is not None:
                slots = [s for s in slots if s > latest_claimed]
            slots = slots[-1:]
        return slots

    def _latest_claimed_slot(self, job_id: str) -> datetime | None:
        job_dir = self.runs_dir / job_id
        if not job_dir.exists():
            return None
        slots = []
        for run_file in job_dir.glob("*.md"):
            try:
                slots.append(datetime.strptime(run_file.stem, "%Y%m%dT%H%M"))
            except ValueError:
                continue  # foreign file in the runs dir; not a claimed slot
        return max(slots, default=None)

    # ------------------------------------------------------------------
    # Execution + run.md
    # ------------------------------------------------------------------

    def _run_file(self, job_id: str, slot: datetime) -> Path:
        return self.runs_dir / job_id / f"{_run_id(slot)}.md"

    def _execute(self, job: Job, slot: datetime) -> RunResult:
        run_id = _run_id(slot)
        run_file = self._run_file(job.id, slot)
        run_file.parent.mkdir(parents=True, exist_ok=True)
        started = datetime.now()

        # Create: claims the slot immediately, so a crash mid-run cannot
        # double-fire it, and a reader sees status: running while it runs.
        run_file.write_text(
            _render_run_md(job, run_id, slot, started, status="running"),
            encoding="utf-8",
        )

        try:
            output = self.executor(job)
            status, notes = "success", []
        except Exception:
            output = ""
            status = "failure"
            notes = ["executor raised:", "```", traceback.format_exc().strip(), "```"]

        finished = datetime.now()
        duration = (finished - started).total_seconds()
        notes.append(f"duration: {duration:.2f}s")

        # Update: same file, final details.
        run_file.write_text(
            _render_run_md(
                job, run_id, slot, started,
                status=status, finished=finished, output=output, notes=notes,
            ),
            encoding="utf-8",
        )
        return RunResult(job.id, run_id, slot, status, output, run_file)


def _run_id(slot: datetime) -> str:
    return slot.strftime("%Y%m%dT%H%M")


def _render_run_md(
    job: Job,
    run_id: str,
    slot: datetime,
    started: datetime,
    status: str,
    finished: datetime | None = None,
    output: str = "",
    notes: list[str] | None = None,
) -> str:
    lines = [
        "---",
        f"job_id: {job.id}",
        f"run_id: {run_id}",
        f"scheduled_for: {slot.isoformat()}",
        f"started_at: {started.isoformat()}",
        f"finished_at: {finished.isoformat() if finished else ''}",
        f"status: {status}",
        "---",
        "",
        f"# {job.id} — {slot:%Y-%m-%d %H:%M}",
        "",
        f"> {job.description}" if job.description else "",
        "",
        "## Output",
        "",
        output if output else "_(none)_",
        "",
        "## Notes",
        "",
    ]
    lines.extend(f"- {n}" if not n.startswith("```") and "\n" not in n else n
                 for n in (notes or ["(running)"]))
    return "\n".join(line for line in lines if line is not None) + "\n"
