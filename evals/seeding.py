"""Starter-dataset builders — shared by the one-shot goldens migration tool
and by ``create_agent`` (which seeds every new agent so the mining→projection
→eval loop works out of the box).

Two payloads:
  - ``build_goldens_payload`` — projects the shared ``evals/golden/*.yaml`` test
    library into a ``goldens`` Eval dataset (manual, not growing).
  - ``build_empty_growing_payload`` — an empty *growing* dataset wired to a
    mining adapter (e.g. ``rag-gaps`` ← "failed lookups"), ready to auto-curate
    once the agent has traffic.

The payload shape matches ``router.data.dataset_io`` (validated on save).
"""

from __future__ import annotations

import hashlib
import logging
from pathlib import Path
from typing import Optional

import yaml

from router.data.dataset import DatasetSample


logger = logging.getLogger("evals.seeding")

# A fixed timestamp keeps the goldens migration output deterministic across
# runs (sample IDs hash from prompt+tag only; added_at must not vary).
_EPOCH = "1970-01-01T00:00:00Z"
DEFAULT_EMBEDDER_MODEL = "sentence-transformers/all-MiniLM-L6-v2"


def sample_id(prompt: str, tag: Optional[str]) -> str:
    """Stable short hash of prompt+tag. Determines idempotency of seeding."""
    key = f"{prompt}\0{tag or ''}".encode("utf-8")
    return f"smp_{hashlib.sha256(key).hexdigest()[:12]}"


def _ground_truth_from_expected(expected: dict) -> str:
    """Best-effort: prefer 'exact', then first 'contains' token, else empty."""
    if not expected:
        return ""
    if "exact" in expected:
        return str(expected["exact"])
    contains = expected.get("contains") or []
    if isinstance(contains, list) and contains:
        return str(contains[0])
    return ""


def load_goldens(goldens_dir: Path) -> list[dict]:
    """Read all *.yaml goldens, skipping malformed ones, sorted by id."""
    if not goldens_dir.exists():
        raise FileNotFoundError(f"goldens dir not found: {goldens_dir}")
    files = sorted(goldens_dir.glob("*.yaml"))
    if not files:
        raise RuntimeError(f"no *.yaml files in {goldens_dir}")
    out: list[dict] = []
    for path in files:
        with open(path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f) or {}
        if "input" not in data or "request" not in data["input"]:
            logger.warning("skipping %s — missing input.request", path)
            continue
        out.append(data)
    out.sort(key=lambda d: d.get("id", ""))
    return out


def _embedding_list(embedder, text: str) -> list[float]:
    emb = embedder.embed(text)
    try:
        return emb.tolist()  # numpy ndarray
    except AttributeError:
        return list(emb)


def build_samples(goldens: list[dict], embedder) -> list[DatasetSample]:
    samples: list[DatasetSample] = []
    for g in goldens:
        prompt = str(g["input"]["request"])
        expected = g.get("expected") or {}
        tag = expected.get("category")
        samples.append(
            DatasetSample(
                id=sample_id(prompt, tag),
                prompt=prompt,
                ground_truth=_ground_truth_from_expected(expected),
                tag=tag,
                trace_id=None,
                added_at=_EPOCH,
                source="manual",
                embedding=_embedding_list(embedder, prompt),
            )
        )
    return samples


def _embedder_model_name(embedder) -> str:
    return getattr(embedder, "model_id", None) or DEFAULT_EMBEDDER_MODEL


def _embedder_dim(embedder) -> int:
    """``dimension`` is a property on the runtime embedder but a method on some
    providers — tolerate both."""
    d = getattr(embedder, "dimension")
    return int(d() if callable(d) else d)


def build_goldens_payload(
    goldens_dir: Path,
    embedder,
    *,
    name: str = "goldens",
    version: int = 1,
) -> dict:
    """Project the shared goldens test library into a dataset payload."""
    goldens = load_goldens(goldens_dir)
    samples = build_samples(goldens, embedder)
    embedding_dim = len(samples[0].embedding) if samples else _embedder_dim(embedder)
    return {
        "version": version,
        "name": name,
        "desc": "Eval suite goldens. Projected from evals/golden/*.yaml.",
        "source": "manual",
        "sourceType": "manual",
        "use": ["Eval"],
        "owner": "human",
        "growing": False,
        "created_at": _EPOCH,
        "embedder_model": _embedder_model_name(embedder),
        "embedding_dim": embedding_dim,
        "samples": [
            {
                "id": s.id,
                "prompt": s.prompt,
                "ground_truth": s.ground_truth,
                "tag": s.tag,
                "trace_id": s.trace_id,
                "added_at": s.added_at,
                "source": s.source,
                "embedding": s.embedding,
            }
            for s in samples
        ],
        "history": [
            {"when": _EPOCH, "what": f"Seeded from {goldens_dir} ({len(samples)} entries)."}
        ],
        "metadata": {"migration_source": str(goldens_dir)},
    }


def build_empty_growing_payload(
    name: str,
    source: str,
    embedder,
    *,
    desc: Optional[str] = None,
) -> dict:
    """An empty *growing* dataset wired to a mining adapter, ready to curate."""
    return {
        "version": 1,
        "name": name,
        "desc": desc or f"Growing eval dataset mined via {source!r}.",
        "source": source,
        "sourceType": "mined",
        "use": ["Eval"],
        "owner": "harness",
        "growing": True,
        "created_at": _EPOCH,
        "embedder_model": _embedder_model_name(embedder),
        "embedding_dim": _embedder_dim(embedder),
        "samples": [],
        "history": [{"when": _EPOCH, "what": "Seeded empty growing dataset."}],
        "metadata": {},
    }
