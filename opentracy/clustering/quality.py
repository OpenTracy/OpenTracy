"""Quality gates for promoting candidate datasets to qualified.

A cluster must pass ALL gates to be promoted to "qualified".
Otherwise it stays "candidate" (manual review) or becomes "rejected".
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Optional

import numpy as np

from .models import CandidateDataset

logger = logging.getLogger(__name__)


@dataclass
class QualityThresholds:
    """Configurable thresholds for quality gates."""

    min_size: int = 20  # minimum traces per cluster
    min_coherence: float = 0.6  # LLM-rated coherence (0-1)
    min_diversity: float = 0.3  # embedding variance within cluster
    max_noise_rate: float = 0.2  # max % outlier traces
    min_success_rate: float = 0.0  # optional: avg success rate of traces (0 = disabled)


DEFAULT_THRESHOLDS = QualityThresholds()


def compute_diversity_score(embeddings: np.ndarray) -> float:
    """Compute diversity as normalized standard deviation of embeddings.

    High diversity (close to 1.0) = varied prompts within the cluster.
    Low diversity (close to 0.0) = near-identical prompts (duplicates).
    """
    if len(embeddings) < 2:
        return 0.0

    # Per-dimension std, then mean across dimensions
    stds = np.std(embeddings, axis=0)
    raw = float(np.mean(stds))

    # Normalize to 0-1 range (empirical: typical MiniLM std is 0.05-0.3)
    return min(raw / 0.3, 1.0)


def compute_noise_rate(outlier_indices: list[int], total: int) -> float:
    """Fraction of traces flagged as outliers."""
    if total == 0:
        return 0.0
    return len(outlier_indices) / total


def apply_quality_gates(
    dataset: CandidateDataset,
    thresholds: QualityThresholds = DEFAULT_THRESHOLDS,
) -> str:
    """Evaluate a candidate dataset against quality gates.

    Returns:
        "qualified" if all gates pass
        "candidate" if some gates fail but recoverable
        "rejected" if fundamental issues (too small, incoherent)
    """
    reasons = []

    # Gate 1: Minimum size (hard reject if too small)
    if dataset.trace_count < thresholds.min_size:
        logger.debug(
            f"Cluster {dataset.cluster_id}: REJECTED — size {dataset.trace_count} < {thresholds.min_size}"
        )
        return "rejected"

    # Gate 2: Coherence
    if dataset.coherence_score < thresholds.min_coherence:
        reasons.append(f"coherence {dataset.coherence_score:.2f} < {thresholds.min_coherence}")

    # Gate 3: Diversity
    if dataset.diversity_score < thresholds.min_diversity:
        reasons.append(f"diversity {dataset.diversity_score:.2f} < {thresholds.min_diversity}")

    # Gate 4: Noise rate
    if dataset.noise_rate > thresholds.max_noise_rate:
        reasons.append(f"noise {dataset.noise_rate:.2f} > {thresholds.max_noise_rate}")

    # Gate 5: Success rate (optional)
    if thresholds.min_success_rate > 0 and dataset.avg_success_rate < thresholds.min_success_rate:
        reasons.append(
            f"success_rate {dataset.avg_success_rate:.2f} < {thresholds.min_success_rate}"
        )

    if reasons:
        logger.debug(f"Cluster {dataset.cluster_id}: CANDIDATE — {', '.join(reasons)}")
        return "candidate"

    logger.debug(f"Cluster {dataset.cluster_id}: QUALIFIED")
    return "qualified"
