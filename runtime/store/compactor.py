"""Compact a day's JSONL traces into Parquet partitioned by agent_version.

  traces/<agent>/raw/YYYY-MM-DD.jsonl
       │
       └──► traces/<agent>/parquet/dt=YYYY-MM-DD/agent_version=<v>/part-0.parquet

Traces are stored per agent (and, in infra mode, per tenant), so compaction
runs per agent: each agent's raw JSONL compacts into that agent's own parquet
tree — the exact partitions the read layer (``runtime.store.traces``) queries.

Snappy-compressed. Idempotent: writes to a tmp directory, then atomic
rename. Raw JSONL is **kept** in place — it's the audit trail and the
fallback if Parquet ever needs to be rebuilt (rm -rf parquet/ && replay).

Usage:
    python -m runtime.store.compactor                  # compacts yesterday, all agents
    python -m runtime.store.compactor 2026-05-07       # a given day, all agents
    python -m runtime.store.compactor --all            # every JSONL day, all agents
"""

from __future__ import annotations

import argparse
import shutil
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parent.parent.parent


def _traces_root() -> Path:
    """Tenant-aware traces root — mirrors ``runtime.store.traces._traces_root``.

    OSS mode → ``<project>/traces/``. Infra mode → ``tenants/<active>/traces/``.
    """
    from runtime.tenants.feature import is_multi_tenant_enabled
    if not is_multi_tenant_enabled():
        return ROOT / "traces"
    from runtime.tenant_context import get_active as _get_tenant
    from runtime.tenants.registry import get_tenant_dir
    return get_tenant_dir(_get_tenant()) / "traces"


def _raw_dir(agent_id: str) -> Path:
    return _traces_root() / agent_id / "raw"


def _parquet_dir(agent_id: str) -> Path:
    return _traces_root() / agent_id / "parquet"


def _agents_with_raw() -> list[str]:
    """Agent ids that have a raw-trace dir under the active traces root."""
    root = _traces_root()
    if not root.exists():
        return []
    return sorted(p.name for p in root.iterdir() if (p / "raw").is_dir())


def _is_iso_date(s: str) -> bool:
    try:
        date.fromisoformat(s)
        return True
    except ValueError:
        return False


def compact_day(day: str, *, agent_id: str, force: bool = False) -> Path | None:
    """Compact one agent's day. Returns the partition root if it wrote
    anything, None if there was nothing to compact."""
    if not _is_iso_date(day):
        raise ValueError(f"day must be YYYY-MM-DD, got {day!r}")

    parquet_dir = _parquet_dir(agent_id)
    src = _raw_dir(agent_id) / f"{day}.jsonl"
    if not src.exists() or src.stat().st_size == 0:
        return None

    dst_root = parquet_dir / f"dt={day}"
    if dst_root.exists() and not force:
        # Already compacted — skip. Caller can pass force=True to rebuild.
        return dst_root

    tmp_root = parquet_dir / f"dt={day}.tmp"
    if tmp_root.exists():
        shutil.rmtree(tmp_root)
    tmp_root.mkdir(parents=True, exist_ok=True)

    # DuckDB's COPY ... TO with PARTITION_BY writes one subdir per partition
    # value. We read the JSONL with union_by_name so older lines missing
    # session_id/history don't blow up.
    sql = f"""
    COPY (
      SELECT *,
             COALESCE(agent_version, 'unknown') AS _av
      FROM read_json_auto('{src.as_posix()}', union_by_name=true)
    ) TO '{tmp_root.as_posix()}'
    (FORMAT PARQUET, COMPRESSION SNAPPY,
     PARTITION_BY (_av), OVERWRITE_OR_IGNORE TRUE,
     FILENAME_PATTERN 'part-{{i}}')
    """
    con = duckdb.connect(":memory:")
    try:
        con.execute(sql)
    finally:
        con.close()

    # DuckDB writes partition_by subdirs as `_av=<value>/`. Rename to
    # `agent_version=<value>/` to keep the path human-friendly.
    for sub in tmp_root.glob("_av=*"):
        new_name = "agent_version=" + sub.name[len("_av=") :]
        sub.rename(sub.parent / new_name)

    if dst_root.exists():
        shutil.rmtree(dst_root)
    tmp_root.rename(dst_root)
    return dst_root


def compact_day_all_agents(day: str, *, force: bool = False) -> dict[str, Path | None]:
    """Compact ``day`` for every agent that has raw traces under the active
    traces root. Returns ``{agent_id: partition_root | None}``."""
    return {
        agent_id: compact_day(day, agent_id=agent_id, force=force)
        for agent_id in _agents_with_raw()
    }


def all_jsonl_days(agent_id: str) -> list[str]:
    raw = _raw_dir(agent_id)
    if not raw.exists():
        return []
    return sorted(p.stem for p in raw.glob("*.jsonl") if _is_iso_date(p.stem))


def all_jsonl_days_all_agents() -> list[str]:
    """Union of JSONL days across every agent with raw traces."""
    days: set[str] = set()
    for agent_id in _agents_with_raw():
        days.update(all_jsonl_days(agent_id))
    return sorted(days)


def yesterday_utc() -> str:
    return (datetime.now(timezone.utc).date() - timedelta(days=1)).isoformat()


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    p.add_argument("day", nargs="?", help="YYYY-MM-DD (default: yesterday UTC)")
    p.add_argument("--all", action="store_true", help="compact every JSONL day")
    p.add_argument("--force", action="store_true", help="rebuild even if dt= exists")
    args = p.parse_args(argv)

    if args.all and args.day:
        p.error("--all is mutually exclusive with a specific day")

    if args.all:
        days = all_jsonl_days_all_agents()
    else:
        days = [args.day or yesterday_utc()]

    if not days:
        print("nothing to compact (no JSONL files found)")
        return 0

    rc = 0
    for d in days:
        try:
            results = compact_day_all_agents(d, force=args.force)
        except Exception as e:
            print(f"  {d} FAILED: {e}", file=sys.stderr)
            rc = 1
            continue
        if not results:
            print(f"  {d} skipped (no agents with raw traces)")
            continue
        for agent_id, out in results.items():
            if out is None:
                print(f"  {d} [{agent_id}] skipped (no source or empty)")
            else:
                n_parts = sum(1 for _ in out.rglob("*.parquet"))
                print(f"  {d} [{agent_id}] -> {out.relative_to(ROOT)}  ({n_parts} part file(s))")
    return rc


if __name__ == "__main__":
    sys.exit(main())
