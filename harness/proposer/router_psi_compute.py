"""Psi (per-cluster expected error) computation for router_config candidates.

Splits out of the reference's monolithic ``auto_trainer.py`` so the
proposer in ``router_proposer.py`` can stitch a candidate from three
signal sources without growing into a megafile:

  bench_psi[model] : LLMProfile.psi_vector from the existing registry
                     (computed offline against goldens or seed corpus)
  prod_psi[model]  : TraceToTraining.compute_psi_updates() → empirical
                     error rate per (cluster, model) from production
  pref_signal      : PreferenceDataset → A>B votes per cluster (used as
                     a tie-breaker; not currently a primary blend term)

The blend is straightforward (P15.3 default ``alpha=0.3``):

    psi_new[model][c] = (1 - alpha) * bench_psi[model][c]
                      +     alpha   * prod_psi[model][c]   (when present)

For models with no production data, bench_psi passes through unchanged.
For empty clusters (zero production traces), the production component
falls back to that model's overall production error rate
(matches TraceToTraining.compute_psi_updates()).
"""

from __future__ import annotations

import logging
from typing import Any

import numpy as np

from router.core.clustering import ClusterAssigner
from router.feedback.trace_to_training import (
    ProductionPsiUpdate,
    TraceRecord,
    TraceToTraining,
)
from router.models.llm_registry import LLMRegistry


logger = logging.getLogger("harness.proposer.router_psi_compute")


def compute_psi_from_cache(
    *,
    assigner: ClusterAssigner,
    cache: Any,
    samples: list[tuple[str, Any]],
    model_ids: list[str],
    default_loss: float = 0.5,
) -> dict[str, np.ndarray]:
    """Per-(cluster, model) expected error from a counterfactual response cache.

    This is the "cache-replay" Ψ source: the cache holds a per-prompt ``loss``
    (0=correct, 1=error) for each model run over the same eval prompts, so we
    can score each model *counterfactually* on the very prompts the agent sees
    — exactly what a router needs to know which model wins which cluster.

    Args:
        assigner: the newly-fitted cluster assigner (``num_clusters`` = K).
        cache: a ``ResponseCache`` (``hash_prompt`` + ``get_by_hash``).
        samples: ``(prompt, embedding)`` for the cache's source prompts. The
            embedding must come from the same embedder the clusters were fit
            with so ``assign`` lands in the right space.
        model_ids: the models to score (typically the registry's models).
        default_loss: fallback for a (cluster, model) with no cached entry and
            no overall signal for that model.

    Returns:
        ``{model_id: length-K np.ndarray}``. A cluster with no cached loss for a
        model falls back to that model's overall mean loss (or ``default_loss``).
    """
    import numpy as _np

    k = assigner.num_clusters
    if k <= 0:
        raise ValueError("compute_psi_from_cache requires assigner.num_clusters > 0")

    sums = {m: _np.zeros(k) for m in model_ids}
    counts = {m: _np.zeros(k) for m in model_ids}
    all_losses: dict[str, list[float]] = {m: [] for m in model_ids}

    for prompt, emb in samples:
        cid = int(assigner.assign(_np.asarray(emb, dtype=float)).cluster_id)
        if cid < 0 or cid >= k:
            continue
        phash = cache.hash_prompt(prompt)
        for m in model_ids:
            entry = cache.get_by_hash(phash, m)
            if entry is None:
                continue
            sums[m][cid] += entry.loss
            counts[m][cid] += 1
            all_losses[m].append(entry.loss)

    out: dict[str, _np.ndarray] = {}
    for m in model_ids:
        overall = float(_np.mean(all_losses[m])) if all_losses[m] else default_loss
        vec = _np.full(k, overall, dtype=float)
        seen = counts[m] > 0
        vec[seen] = sums[m][seen] / counts[m][seen]
        out[m] = vec
    return out


def compute_blended_psi(
    *,
    assigner: ClusterAssigner,
    registry: LLMRegistry,
    traces: list[TraceRecord],
    preference_dataset: Any = None,  # PreferenceDataset; reserved for future use
    cache: Any = None,                # ResponseCache; reserved for cache-replay path
    cache_psi: dict[str, Any] | None = None,  # precomputed cache-replay bench Ψ
    production_alpha: float = 0.3,
) -> dict[str, list[float]]:
    """Build ``{model_id: K-vector}`` blending bench + production Psi.

    Args:
        assigner: The (newly fitted) cluster assigner; ``num_clusters`` =
            target K of the candidate config.
        registry: Existing LLMRegistry — supplies bench Psi per model.
            Models in ``registry`` not seen in ``traces`` retain their
            bench Psi unchanged.
        traces: List of TraceRecord values (cluster_id already assigned
            against the new ``assigner`` by the proposer). cluster_id < 0
            entries are silently skipped by TraceToTraining.
        preference_dataset: Optional PreferenceDataset. Passed through
            for the future "preference data refines the loser more than
            the winner" pass; currently unused in the blend.
        cache: Optional ResponseCache. Kept for API symmetry with the
            reference; not used today.
        production_alpha: Blend weight for production Psi. Locked at 0.3
            in the P15.3 roadmap.

    Returns:
        dict mapping model_id → length-K list of floats. Length always
        equals ``assigner.num_clusters``. Existing models without
        production data still appear in the output with their bench Psi
        (pad/truncate to K if dimensions differ).
    """
    k = assigner.num_clusters
    if k <= 0:
        raise ValueError("compute_blended_psi requires assigner.num_clusters > 0")

    converter = TraceToTraining(num_clusters=k)
    converter.add_traces(traces)
    prod_updates: dict[str, ProductionPsiUpdate] = {
        u.model_id: u for u in converter.compute_psi_updates()
    }

    # Optional refinement signal — preference pairs that disagree with
    # current bench Psi can nudge the loser's Psi up. We log how many
    # pairs are available; the actual refinement pass is a follow-up.
    if preference_dataset is not None:
        try:
            pref_count = len(preference_dataset)
        except TypeError:
            pref_count = 0
        if pref_count:
            logger.info(
                "preference_dataset has %d pairs (refinement pass not yet wired)",
                pref_count,
            )

    out: dict[str, list[float]] = {}
    for profile in registry.get_all():
        # Prefer the cache-replay Ψ (counterfactual per-cluster loss measured
        # against the eval prompts) over the registry's static bench vector —
        # the static one is identical across models and can't drive routing.
        if cache_psi is not None and profile.model_id in cache_psi:
            bench_psi = _resize_to_k(np.asarray(cache_psi[profile.model_id], dtype=float), k)
        else:
            bench_psi = _resize_to_k(profile.psi_vector, k)
        update = prod_updates.get(profile.model_id)
        if update is None:
            out[profile.model_id] = bench_psi.tolist()
            continue

        prod_psi = _resize_to_k(update.psi_vector, k)
        blended = (1.0 - production_alpha) * bench_psi + production_alpha * prod_psi
        out[profile.model_id] = blended.tolist()

        logger.info(
            "blended psi for %s: bench_err=%.3f prod_err=%.3f alpha=%.2f traces=%d",
            profile.model_id,
            float(bench_psi.mean()),
            float(prod_psi.mean()),
            production_alpha,
            update.total_traces,
        )

    return out


def _resize_to_k(vec: np.ndarray, k: int) -> np.ndarray:
    """Pad with the vector's mean if too short, truncate if too long.

    This handles the K-changed-between-fits case: an old profile might
    have a 16-dim Psi while the new fit produced K=8. We squash to K
    using the mean (uninformative but non-zero); operators flag this
    case via the WARNING log so they can re-run a full Psi compute.
    """
    vec = np.asarray(vec, dtype=float)
    if vec.size == k:
        return vec
    fill = float(vec.mean()) if vec.size else 0.0
    out = np.full(k, fill, dtype=float)
    overlap = min(vec.size, k)
    out[:overlap] = vec[:overlap]
    if vec.size != k:
        logger.warning(
            "psi vector resized from %d to %d (dimension mismatch — re-run full Psi compute)",
            vec.size,
            k,
        )
    return out
