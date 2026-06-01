"""Layered analysis writer — Experience Observability (AHE §3.2).

Per the paper, the Evolve Agent should not have to drill into raw
~10M-token traces to find a root cause; pre-built layered reports
turn each iteration's evidence into:

  - ``overview.md`` — cross-task rollup with root-cause clusters
    sorted by severity, partial-pass diagnoses called out, and links
    into the per-task detail files. Read FIRST by the Evolve Agent.
  - ``detail/{task_slug}.md`` — one file per failing/flaky task with
    each rollout's response or error, plus the k>1 divergence when
    runs disagreed.

Both live inside the workspace under
``.opentracy/analysis/{iteration_id}/`` so when the workspace is
tarred and uploaded to the Evolve sandbox the agent can read them
just like any other file. Older iterations' analysis dirs are GC'd
to keep the tar small.
"""

from __future__ import annotations

import logging
import re
from pathlib import Path
from typing import Any, Optional

from runtime.evolution.types import Evidence


logger = logging.getLogger("runtime.evolution.analysis")


ANALYSIS_DIR = ".opentracy/analysis"
_MAX_ITERATIONS_KEPT = 5
_TASK_SLUG_LIMIT = 80
_RESPONSE_SNIPPET = 800


def write_analysis_report(
    workspace: Any,
    *,
    iteration_id: str,
    evidence: Evidence,
) -> Optional[Path]:
    """Persist the layered analysis under the workspace.

    Returns the path of the iteration's ``overview.md`` (None on
    failure, since the caller treats analysis as best-effort).
    """
    rollout = evidence.rollout
    base = workspace.path / ANALYSIS_DIR / iteration_id
    detail_dir = base / "detail"
    try:
        detail_dir.mkdir(parents=True, exist_ok=True)
    except OSError as exc:  # pragma: no cover — defensive
        logger.warning("analysis: cannot create %s: %s", detail_dir, exc)
        return None

    # Tasks needing a detail page: every task with at least one fail
    # OR flaky. Pure passes don't get a file (nothing to diagnose).
    aggs = rollout.task_aggregates
    detail_tasks = sorted(
        t for t, a in aggs.items()
        if a["flaky"] or not a["majority_pass"]
    )
    slug_index: dict[str, str] = {}
    for task in detail_tasks:
        slug = _slug_for_task(task, used=set(slug_index.values()))
        slug_index[task] = slug
        try:
            _write_detail(detail_dir / f"{slug}.md", task=task, rollout=rollout)
        except OSError as exc:  # pragma: no cover
            logger.warning("analysis: detail write failed for %r: %s", task, exc)

    overview_path = base / "overview.md"
    try:
        overview_path.write_text(
            _render_overview(
                iteration_id=iteration_id,
                evidence=evidence,
                slug_index=slug_index,
            ),
            encoding="utf-8",
        )
    except OSError as exc:  # pragma: no cover
        logger.warning("analysis: overview write failed: %s", exc)
        return None

    _gc_old_iterations(workspace, keep=_MAX_ITERATIONS_KEPT)
    return overview_path


def _render_overview(
    *,
    iteration_id: str,
    evidence: Evidence,
    slug_index: dict[str, str],
) -> str:
    rollout = evidence.rollout
    aggs = rollout.task_aggregates
    flaky = rollout.flaky_tasks
    lines: list[str] = []
    lines.append(f"# Iteration {iteration_id} — Analysis Overview")
    lines.append("")
    lines.append(
        f"**Pass@1:** {rollout.passed}/{rollout.total_tasks} "
        f"(k={rollout.k} replays each, {len(flaky)} flaky)"
    )
    lines.append("")

    if evidence.clusters:
        lines.append("## Root-cause clusters")
        lines.append("")
        for c in sorted(evidence.clusters, key=lambda x: -x.severity):
            lines.append(
                f"### [severity {c.severity}] {c.root_cause} "
                f"— {len(c.tasks)} task(s)"
            )
            if c.notes:
                lines.append(f"> {c.notes}")
            lines.append("")
            for t in c.tasks:
                slug = slug_index.get(t)
                if slug:
                    lines.append(f"- `{t}` → see [detail/{slug}.md](detail/{slug}.md)")
                else:
                    lines.append(f"- `{t}`")
            lines.append("")
    else:
        lines.append("_(no clusters — either clean rollout or clusterer skipped)_")
        lines.append("")

    # Partial-pass section: tasks that flip-flopped across k>=2 runs.
    # Most valuable signal per the paper — winning rollout shows the
    # strategy that worked; failing rollout shows what doesn't.
    if flaky:
        lines.append("## Partial-pass diagnoses")
        lines.append("")
        lines.append(
            "These tasks passed only some rollouts. Compare runs to find "
            "the divergence point and make the winning strategy the "
            "reliable default."
        )
        lines.append("")
        for t in flaky:
            a = aggs[t]
            slug = slug_index.get(t)
            ref = f" → [detail/{slug}.md](detail/{slug}.md)" if slug else ""
            lines.append(
                f"- `{t}`: {a['passed_runs']}/{a['total_runs']} passed{ref}"
            )
        lines.append("")

    # Always end with the raw flat summary so the agent has a single
    # source for the per-(task, run) corpus even if it skips clusters.
    lines.append("## Raw rollout summary")
    lines.append("")
    lines.append("```")
    lines.append(evidence.summary)
    lines.append("```")
    lines.append("")
    return "\n".join(lines)


def _write_detail(path: Path, *, task: str, rollout: Any) -> None:
    runs = [o for o in rollout.outcomes if o.task == task]
    lines: list[str] = []
    lines.append(f"# Task `{task}`")
    lines.append("")
    agg = rollout.task_aggregates.get(task, {})
    lines.append(
        f"**Status:** {agg.get('passed_runs', 0)}/{agg.get('total_runs', 0)} runs "
        f"passed (flaky={agg.get('flaky', False)})"
    )
    lines.append("")

    if len(runs) > 1 and agg.get("flaky"):
        passing = [r for r in runs if r.success and not r.error]
        failing = [r for r in runs if not r.success or r.error]
        if passing and failing:
            lines.append("## Divergence (k>1 partial pass)")
            lines.append("")
            lines.append(
                "Winning rollout's strategy must become the reliable "
                "default. Common cause: tool order / retry / a missing "
                "guard that one rollout happened to skip."
            )
            lines.append("")
            lines.append("### Passing run(s)")
            for r in passing:
                lines.append(_format_run_block(r))
            lines.append("### Failing run(s)")
            for r in failing:
                lines.append(_format_run_block(r))
            lines.append("")

    lines.append("## All runs")
    lines.append("")
    for r in runs:
        lines.append(_format_run_block(r))
    path.write_text("\n".join(lines), encoding="utf-8")


def _format_run_block(o: Any) -> str:
    verdict = "PASS" if (o.success and not o.error) else "FAIL"
    body = (o.error or o.response or "").strip()
    if len(body) > _RESPONSE_SNIPPET:
        body = body[:_RESPONSE_SNIPPET] + "…"
    if not body:
        body = "(empty)"
    trace = f" trace_id=`{o.trace_id}`" if o.trace_id else ""
    return (
        f"- **run {o.run_index}** — {verdict}{trace}\n"
        f"  ```\n  {body}\n  ```\n"
    )


def _slug_for_task(task: str, *, used: set[str]) -> str:
    """File-system safe slug for a task identifier.

    Collisions (truncation, identical sanitized output) get a numeric
    suffix so two distinct tasks never overwrite each other's detail.
    """
    base = re.sub(r"[^a-zA-Z0-9._-]+", "-", task.strip()) or "task"
    base = base.strip("-_") or "task"
    if len(base) > _TASK_SLUG_LIMIT:
        base = base[:_TASK_SLUG_LIMIT].rstrip("-_")
    candidate = base
    n = 1
    while candidate in used:
        n += 1
        candidate = f"{base}-{n}"
    return candidate


def _gc_old_iterations(workspace: Any, *, keep: int) -> None:
    """Drop analysis directories older than the most recent ``keep``.

    Iteration ids embed a timestamp (``evo-YYYYMMDDTHHMMSS-XXXXXX``),
    so lexicographic descending sort is chronological-descending. We
    keep the top N and remove the rest.
    """
    root = workspace.path / ANALYSIS_DIR
    if not root.exists():
        return
    iterations = sorted(
        (p for p in root.iterdir() if p.is_dir()),
        reverse=True,
    )
    for stale in iterations[keep:]:
        import shutil
        try:
            shutil.rmtree(stale)
        except OSError as exc:  # pragma: no cover
            logger.warning(
                "analysis: GC failed on %s: %s", stale.name, exc,
            )
