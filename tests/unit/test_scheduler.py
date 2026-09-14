import json
import tempfile
import unittest
from datetime import datetime, timedelta
from pathlib import Path

from opentracy.core.cron import CronExpr
from opentracy.core.scheduler import JobScheduler


class CronExprTest(unittest.TestCase):
    def test_daily_at_11pm(self) -> None:
        expr = CronExpr.parse("0 23 * * *")
        self.assertTrue(expr.matches(datetime(2026, 7, 6, 23, 0)))
        self.assertFalse(expr.matches(datetime(2026, 7, 6, 23, 1)))
        self.assertFalse(expr.matches(datetime(2026, 7, 6, 11, 0)))

    def test_steps_lists_ranges(self) -> None:
        self.assertTrue(CronExpr.parse("*/15 * * * *").matches(datetime(2026, 1, 1, 5, 45)))
        self.assertFalse(CronExpr.parse("*/15 * * * *").matches(datetime(2026, 1, 1, 5, 50)))
        self.assertTrue(CronExpr.parse("0,30 9-17 * * *").matches(datetime(2026, 1, 1, 12, 30)))
        self.assertFalse(CronExpr.parse("0,30 9-17 * * *").matches(datetime(2026, 1, 1, 8, 30)))

    def test_day_of_week_sunday_is_0_and_7(self) -> None:
        sunday = datetime(2026, 7, 5, 6, 0)  # 2026-07-05 is a Sunday
        self.assertTrue(CronExpr.parse("0 6 * * 0").matches(sunday))
        self.assertTrue(CronExpr.parse("0 6 * * 7").matches(sunday))
        self.assertFalse(CronExpr.parse("0 6 * * 1").matches(sunday))

    def test_dom_dow_or_semantics(self) -> None:
        expr = CronExpr.parse("0 0 15 * 1")  # 15th OR Monday (standard cron)
        self.assertTrue(expr.matches(datetime(2026, 7, 15, 0, 0)))  # Wednesday the 15th
        self.assertTrue(expr.matches(datetime(2026, 7, 6, 0, 0)))   # Monday the 6th
        self.assertFalse(expr.matches(datetime(2026, 7, 7, 0, 0)))  # Tuesday the 7th

    def test_invalid_expressions_raise(self) -> None:
        for bad in ("0 23 * *", "61 * * * *", "* 24 * * *", "*/0 * * * *"):
            with self.assertRaises(ValueError):
                CronExpr.parse(bad)


class JobSchedulerTest(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.root = Path(self._tmp.name)
        self.executed: list[str] = []

        def executor(job) -> str:
            self.executed.append(job.id)
            return f"output of {job.id}"

        self.scheduler = JobScheduler(self.root, executor)

    def write_jobs(self, *jobs: dict) -> None:
        (self.root / "jobs.json").write_text(json.dumps({"jobs": list(jobs)}))

    def test_runs_when_slot_is_due_and_only_once(self) -> None:
        self.write_jobs({"id": "order-report", "schedule": "0 23 * * *"})
        now = datetime(2026, 7, 6, 23, 0, 30)
        results = self.scheduler.ticks(now)
        self.assertEqual([r.job_id for r in results], ["order-report"])
        self.assertEqual(results[0].status, "success")
        # same tick again: the run file claims the slot — idempotent
        self.assertEqual(self.scheduler.ticks(now), [])
        self.assertEqual(self.executed, ["order-report"])

    def test_not_due_after_latest_slot_already_ran(self) -> None:
        self.write_jobs({"id": "order-report", "schedule": "0 23 * * *"})
        self.scheduler.ticks(datetime(2026, 7, 5, 23, 0))
        # next day, before the next 23:00 slot: nothing due, and yesterday's
        # older window slot must not re-fire
        self.assertEqual(self.scheduler.ticks(datetime(2026, 7, 6, 22, 0)), [])

    def test_new_job_fires_most_recent_missed_slot(self) -> None:
        # host was asleep at 23:00; the report still goes out on the next tick
        self.write_jobs({"id": "order-report", "schedule": "0 23 * * *"})
        results = self.scheduler.ticks(datetime(2026, 7, 6, 22, 0))
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0].scheduled_for, datetime(2026, 7, 5, 23, 0))

    def test_missed_slots_fire_latest_only_by_default(self) -> None:
        self.write_jobs({"id": "half-hourly", "schedule": "0,30 * * * *"})
        results = self.scheduler.ticks(datetime(2026, 7, 6, 12, 0))  # many slots in window
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0].scheduled_for, datetime(2026, 7, 6, 12, 0))

    def test_catch_up_fires_every_missed_slot(self) -> None:
        self.write_jobs(
            {"id": "hourly", "schedule": "0 * * * *", "catch_up": True}
        )
        self.scheduler.lookback = timedelta(hours=3)
        results = self.scheduler.ticks(datetime(2026, 7, 6, 12, 0))
        self.assertEqual(len(results), 3)  # 10:00, 11:00, 12:00

    def test_disabled_job_is_skipped(self) -> None:
        self.write_jobs({"id": "off", "schedule": "* * * * *", "enabled": False})
        self.assertEqual(self.scheduler.ticks(datetime(2026, 7, 6, 12, 0)), [])

    def test_jobs_json_is_reread_each_tick(self) -> None:
        self.write_jobs({"id": "a", "schedule": "* * * * *"})
        self.scheduler.ticks(datetime(2026, 7, 6, 12, 0))
        self.write_jobs({"id": "b", "schedule": "* * * * *"})  # live edit
        results = self.scheduler.ticks(datetime(2026, 7, 6, 12, 1))
        self.assertEqual([r.job_id for r in results], ["b"])

    def test_run_md_records_success_details(self) -> None:
        self.write_jobs(
            {"id": "order-report", "schedule": "0 23 * * *", "description": "send order"}
        )
        result = self.scheduler.ticks(datetime(2026, 7, 6, 23, 0))[0]
        self.assertEqual(
            result.run_file,
            self.root / "jobs" / "runs" / "order-report" / "20260706T2300.md",
        )
        text = result.run_file.read_text()
        self.assertIn("job_id: order-report", text)
        self.assertIn("run_id: 20260706T2300", text)
        self.assertIn("status: success", text)
        self.assertIn("output of order-report", text)
        self.assertIn("duration:", text)

    def test_failure_recorded_and_slot_claimed(self) -> None:
        def boom(job):
            raise RuntimeError("provider down")

        scheduler = JobScheduler(self.root, boom)
        self.write_jobs({"id": "fragile", "schedule": "0 23 * * *"})
        now = datetime(2026, 7, 6, 23, 0)
        result = scheduler.ticks(now)[0]
        self.assertEqual(result.status, "failure")
        text = result.run_file.read_text()
        self.assertIn("status: failure", text)
        self.assertIn("provider down", text)
        # failed slot is claimed: no retry storm on the next tick
        self.assertEqual(scheduler.ticks(now + timedelta(minutes=1)), [])

    def test_repo_jobs_json_is_valid(self) -> None:
        repo_jobs = Path(__file__).resolve().parents[2] / "jobs.json"
        scheduler = JobScheduler(repo_jobs.parent, lambda job: "")
        jobs = scheduler.load_jobs()
        self.assertGreaterEqual(len(jobs), 2)
        self.assertIn("nightly-order-report", [j.id for j in jobs])
        for job in jobs:
            job.cron  # every schedule parses


if __name__ == "__main__":
    unittest.main()
