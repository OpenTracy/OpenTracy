"""Cumulative iteration log — ``.opentracy/evolution_history.md``.

The per-iteration ``change_evaluation/{iter}.json`` files give the next
Evolve Agent structured per-change decisions; this module gives it a
**narrative** read of the whole evolution timeline so it can spot
patterns like "tried plan-skipped at skill level twice already".

One markdown section appended per iteration, newest at the bottom
(chronological — humans usually skim from the top to see how things
started). The Evolve Agent gets the file inside its workspace tar.

Best-effort: a failure to append never tanks the iteration.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from runtime.evolution.types import IterationResult


logger = logging.getLogger("runtime.evolution.history")


HISTORY_FILE = ".opentracy/evolution_history.md"


def append_history_entry(workspace: Any, result: IterationResult) -> None:
    """Append one section describing ``result`` to the history file."""
    block = _render_entry(result)
    path = workspace.path / HISTORY_FILE
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        # Open in append mode so concurrent iterations (shouldn't
        # happen, but be safe) don't truncate each other.
        with path.open("a", encoding="utf-8") as f:
            f.write(block)
    except OSError as exc:  # pragma: no cover — defensive
        logger.warning("history: append failed: %s", exc)


def _render_entry(result: IterationResult) -> str:
    rollout = result.rollout
    ver = result.verification
    evolve = result.evolve
    pending = evolve.pending_manifest or {}

    when = (
        datetime.now(timezone.utc)
        .isoformat(timespec="seconds")
        .replace("+00:00", "Z")
    )
    lines: list[str] = []
    lines.append(f"## {result.iteration_id} ({when})")
    lines.append("")
    lines.append(
        f"- **rollout:** {rollout.passed}/{rollout.total_tasks} passed "
        f"(k={rollout.k}, {len(rollout.flaky_tasks)} flaky)"
    )
    lines.append(f"- **prior-round verdict:** {ver.verdict}")

    if ver.change_evaluations:
        lines.append("- **prior-round per-change decisions:**")
        for ev in ver.change_evaluations:
            fp = ev.failure_pattern or "(no pattern)"
            lines.append(
                f"    - `{ev.change_id}` (level={ev.constraint_level}, "
                f"pattern={fp!r}): **{ev.decision}** — {ev.reason}"
            )

    rolled_back = ver.delta.get("rolled_back_changes") or []
    if rolled_back:
        lines.append(f"- **scoped rollback:** {', '.join(rolled_back)}")

    if pending.get("changes"):
        lines.append("- **new pending changes (this iter):**")
        for raw in pending["changes"]:
            if not isinstance(raw, dict):
                continue
            cid = raw.get("id", "?")
            level = raw.get("constraint_level", "?")
            desc = (raw.get("description") or "").strip()
            preds = raw.get("predicted_fixes") or []
            risks = raw.get("risk_tasks") or []
            lines.append(
                f"    - `{cid}` (level={level}): {desc} — "
                f"predicts {len(preds)} fix(es), {len(risks)} risk(s)"
            )
    elif evolve.files_edited:
        # Legacy flat manifest — surface at least the file list.
        lines.append("- **edits (no changes[] array):**")
        for f in evolve.files_edited[:10]:
            lines.append(f"    - {f}")

    if ver.unexpected_flips_to_pass:
        lines.append(
            f"- **unexpected fixes:** {', '.join(ver.unexpected_flips_to_pass)}"
        )
    if ver.unexpected_flips_to_fail:
        lines.append(
            f"- **unexpected regressions:** {', '.join(ver.unexpected_flips_to_fail)}"
        )

    if evolve.variant_summaries:
        chosen = evolve.chosen_variant_index
        lines.append(
            f"- **best-of-{len(evolve.variant_summaries)}:** variant "
            f"#{chosen} won. losers stay available below for "
            f"cross-variant learning next iter."
        )
        for vs in evolve.variant_summaries:
            mark = "👑" if vs.get("index") == chosen else "·"
            lines.append(
                f"    - {mark} variant #{vs.get('index')} "
                f"predicted_fixes={vs.get('predicted_fixes')} "
                f"crit={vs.get('validator_critical')} "
                f"hint={vs.get('strategy_hint')!r}"
            )

    voice = (evolve.raw_response or "").strip()
    if voice:
        first_line = next((ln for ln in voice.splitlines() if ln.strip()), "")
        if first_line:
            lines.append(f"- **agent note:** {first_line.strip()[:240]}")

    lines.append("")
    lines.append("")  # trailing blank line as separator
    return "\n".join(lines)
