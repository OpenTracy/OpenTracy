"""Cache-replay Ψ: per-(cluster, model) loss is read from the response cache so
the router learns which model wins which cluster. Without this, every model
inherits an identical static bench Ψ and the candidate can never beat baseline.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from harness.proposer.router_psi_compute import compute_psi_from_cache


@dataclass
class _Assigned:
    cluster_id: int


class _FakeAssigner:
    """Assign by the first embedding coordinate → its cluster index."""

    def __init__(self, num_clusters: int):
        self.num_clusters = num_clusters

    def assign(self, emb):
        return _Assigned(cluster_id=int(emb[0]))


@dataclass
class _Entry:
    loss: float


class _FakeCache:
    """Maps (prompt, model) → loss. hash_prompt is identity for the test."""

    def __init__(self, table):
        self._table = table  # {(prompt, model): loss}

    @staticmethod
    def hash_prompt(prompt):
        return prompt

    def get_by_hash(self, prompt_hash, model_id):
        loss = self._table.get((prompt_hash, model_id))
        return _Entry(loss) if loss is not None else None


def test_cache_psi_is_differentiated_per_cluster():
    assigner = _FakeAssigner(num_clusters=2)
    # cluster 0: haiku correct (0), sonnet wrong (1). cluster 1: reversed.
    table = {
        ("p0", "haiku"): 0.0, ("p0", "sonnet"): 1.0,
        ("p1", "haiku"): 1.0, ("p1", "sonnet"): 0.0,
    }
    cache = _FakeCache(table)
    samples = [("p0", np.array([0.0])), ("p1", np.array([1.0]))]

    psi = compute_psi_from_cache(
        assigner=assigner, cache=cache, samples=samples, model_ids=["haiku", "sonnet"]
    )

    # Each model's Ψ reflects its real per-cluster error — and they differ,
    # which is exactly the signal the router needs.
    assert psi["haiku"].tolist() == [0.0, 1.0]
    assert psi["sonnet"].tolist() == [1.0, 0.0]


def test_cluster_without_cached_loss_falls_back_to_model_mean():
    assigner = _FakeAssigner(num_clusters=2)
    # Only cluster 0 has data for haiku; cluster 1 has none → falls back to
    # haiku's overall mean (0.0 here).
    table = {("p0", "haiku"): 0.0}
    cache = _FakeCache(table)
    samples = [("p0", np.array([0.0])), ("p1", np.array([1.0]))]

    psi = compute_psi_from_cache(
        assigner=assigner, cache=cache, samples=samples,
        model_ids=["haiku", "sonnet"], default_loss=0.5,
    )

    assert psi["haiku"].tolist() == [0.0, 0.0]      # mean of seen losses
    assert psi["sonnet"].tolist() == [0.5, 0.5]     # no data → default_loss
