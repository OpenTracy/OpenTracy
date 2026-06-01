"""Best-of-N variants — parallel-exploration of evolve strategies.

Per AHE §3.4 (Best-of-N): instead of one evolve agent per iteration,
spawn N with opposing strategy constraints (structural vs guidance,
etc.), evaluate each candidate, and adopt the winner. The losers
inform the *next* iteration via cross-variant comparison.

v2 runs variants **concurrently** via :class:`ThreadPoolExecutor`.
Each variant gets its own scratch :class:`WorkspaceStore` rooted in a
private tmpdir + populated from the same baseline tar, so writes
don't race. The main workspace is only mutated after a winner has
been picked (single restore from winner's tar). Pass
``max_workers=1`` to fall back to sequential (useful for tests where
determinism matters).

Winner selection (no per-variant rollouts in v1):
  1. Reject variants whose post-evolve validator finds critical issues
     (they would be rolled back anyway).
  2. Prefer the variant with the most ``predicted_fixes`` across its
     changes (most ambitious; falsification on the next iter will
     punish over-promising).
  3. Tiebreak by lowest variant index (deterministic, matches the
     order strategy hints were declared).
"""

from __future__ import annotations

import logging
import tempfile
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

from runtime.evolution.types import EvolveOutcome
from runtime.evolution.validator import ValidationReport, validate_workspace


logger = logging.getLogger("runtime.evolution.variants")


# Strategy hints injected into the evolve agent's system prompt. The
# AHE paper's wording — repeated here as a "MANDATORY Strategy
# Constraint" so the agent treats it as non-negotiable.
STRATEGY_STRUCTURAL = (
    "You MUST focus on STRUCTURAL changes: middleware, tool "
    "implementations, or sub_agents. Do NOT modify system_prompt "
    "or skill content this iteration."
)
STRATEGY_GUIDANCE = (
    "You MUST focus on GUIDANCE changes: system_prompt rules, "
    "skill packages, tool descriptions, or long_term memory. Do "
    "NOT create middleware or tool implementation files this "
    "iteration."
)
STRATEGY_MEMORY_ONLY = (
    "You MUST focus ONLY on long_term_memory: append confirmed "
    "lessons to `.opentracy/memory/long_term.md`. Do NOT modify "
    "any other component this iteration."
)


def default_strategy_hints(n: int) -> list[str]:
    """Pick ``n`` strategy hints in declared order. Repeats with a
    numeric suffix once we run out of canonical strategies."""
    canonical = [STRATEGY_STRUCTURAL, STRATEGY_GUIDANCE, STRATEGY_MEMORY_ONLY]
    if n <= len(canonical):
        return canonical[:n]
    hints = list(canonical)
    for i in range(n - len(canonical)):
        hints.append(f"{canonical[i % len(canonical)]} (variant {i+2})")
    return hints


@dataclass
class VariantOutcome:
    """One variant's result. ``workspace_tar`` is the post-evolve
    workspace as a tar (used to restore the winner)."""

    index: int
    strategy_hint: str
    evolve: EvolveOutcome
    workspace_tar: bytes = b""
    validation: ValidationReport = field(default_factory=ValidationReport)

    @property
    def num_predicted_fixes(self) -> int:
        manifest = self.evolve.pending_manifest or {}
        changes = manifest.get("changes") or []
        n = 0
        for c in changes:
            if not isinstance(c, dict):
                continue
            n += len(c.get("predicted_fixes") or [])
        return n

    def summary(self) -> dict[str, Any]:
        """Compact dict for cross-variant reporting / history append."""
        return {
            "index": self.index,
            "strategy_hint": self.strategy_hint[:120] + (
                "…" if len(self.strategy_hint) > 120 else ""
            ),
            "predicted_fixes": self.num_predicted_fixes,
            "files_edited": list(self.evolve.files_edited or []),
            "validator_critical": len(self.validation.critical),
        }


def run_variants(
    *,
    workspace: Any,
    anthropic_key: str,
    agent_id: str,
    evidence_summary: str,
    strategy_hints: list[str],
    sandbox_factory: Optional[Any] = None,
    timeout_s: int = 300,
    model: Optional[str] = None,
    max_workers: Optional[int] = None,
) -> list[VariantOutcome]:
    """Run ``len(strategy_hints)`` evolve sandboxes (concurrently by
    default) and return one :class:`VariantOutcome` per attempt.

    Each variant gets a *scratch* workspace — a private tmpdir holding
    a fresh extraction of the baseline tar — so concurrent writes
    never collide on the live workspace. The live workspace is not
    mutated by this function; the caller applies the winner's tar via
    :func:`apply_winner_to_workspace`.

    ``max_workers``: cap on concurrent sandboxes. Defaults to the
    number of strategy hints (one thread per variant). Pass ``1`` to
    force sequential execution — useful when the surrounding test
    needs deterministic ordering or when running against a sandbox
    backend with low concurrency budget.
    """
    if not strategy_hints:
        raise ValueError("run_variants: strategy_hints must be non-empty")

    # Local import: evolve module imports validator/variants paths so
    # putting it at module top would risk a cycle.
    from runtime.evolution.evolve import run_evolve
    from runtime.workspaces.store import WorkspaceStore

    baseline_tar = workspace.to_tar_bytes()
    workers = max_workers if max_workers and max_workers > 0 else len(strategy_hints)

    def _one_variant(index: int, hint: str) -> VariantOutcome:
        # Each variant operates on a private workspace rooted in a
        # tmpdir. Cleanup happens automatically when the context exits
        # — we read everything we need (tar + validation) before that.
        with tempfile.TemporaryDirectory(prefix=f"otrcy-variant-{index}-") as scratch_root:
            scratch_workspace = WorkspaceStore(
                f"variant_{index}", root=Path(scratch_root),
            )
            scratch_workspace.from_tar_bytes(baseline_tar)
            try:
                evolve_outcome = run_evolve(
                    workspace=scratch_workspace,
                    anthropic_key=anthropic_key,
                    agent_id=agent_id,
                    evidence_summary=evidence_summary,
                    sandbox_factory=sandbox_factory,
                    timeout_s=timeout_s,
                    model=model,
                    strategy_hint=hint,
                )
            except Exception as exc:
                logger.warning(
                    "variants: variant #%d crashed: %s", index, exc, exc_info=True,
                )
                evolve_outcome = EvolveOutcome(
                    files_edited=[],
                    pending_manifest=None,
                    raw_response=f"[error] {type(exc).__name__}: {exc}",
                )
            try:
                result_tar = scratch_workspace.to_tar_bytes()
            except Exception as exc:  # pragma: no cover — defensive
                logger.warning("variants: snapshot tar failed for #%d: %s", index, exc)
                result_tar = b""
            validation = validate_workspace(
                scratch_workspace, pending_manifest=evolve_outcome.pending_manifest,
            )
            return VariantOutcome(
                index=index,
                strategy_hint=hint,
                evolve=evolve_outcome,
                workspace_tar=result_tar,
                validation=validation,
            )

    outcomes: list[Optional[VariantOutcome]] = [None] * len(strategy_hints)
    if workers <= 1:
        for index, hint in enumerate(strategy_hints):
            outcomes[index] = _one_variant(index, hint)
    else:
        with ThreadPoolExecutor(max_workers=workers) as pool:
            futures = {
                pool.submit(_one_variant, index, hint): index
                for index, hint in enumerate(strategy_hints)
            }
            for fut in as_completed(futures):
                outcomes[futures[fut]] = fut.result()
    return [o for o in outcomes if o is not None]


def pick_winner(outcomes: list[VariantOutcome]) -> Optional[VariantOutcome]:
    """Choose the winning variant per the v1 heuristic.

    Returns ``None`` only when the input is empty — even when every
    variant has critical validation issues we still pick one (it'll
    get rolled back by the main loop's own validator pass, but we
    need a deterministic winner so the iteration can complete).
    """
    if not outcomes:
        return None
    clean = [o for o in outcomes if not o.validation.has_critical]
    pool = clean or outcomes
    # max(...) with stable comparator: higher num_predicted_fixes wins;
    # tiebreak by lower index (declaration order).
    return max(pool, key=lambda o: (o.num_predicted_fixes, -o.index))


def apply_winner_to_workspace(
    workspace: Any, winner: VariantOutcome,
) -> None:
    """Restore the workspace to the winner's post-evolve state."""
    if winner.workspace_tar:
        workspace.from_tar_bytes(winner.workspace_tar)
