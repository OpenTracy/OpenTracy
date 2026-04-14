"""Bootstrap initial Psi weights from clustered traces.

Usage:
    python -m lunar_router.scripts.bootstrap_weights [--weights-dir PATH] [--limit N]

Pulls up to N recent traces from ClickHouse, runs the existing training
pipeline, and writes ``psi.npz`` (plus cluster centroids) under ``--weights-dir``.

This is a stub: it delegates to the existing training pipeline rather than
reimplementing clustering logic. Run once before enabling ``AUTO_TRAINER=true``.
"""
from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

logger = logging.getLogger(__name__)


def main(argv: list[str] | None = None) -> int:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")

    parser = argparse.ArgumentParser(description="Bootstrap Psi weights from traces.")
    parser.add_argument("--weights-dir", default="./weights", help="Output directory for psi.npz")
    parser.add_argument("--limit", type=int, default=5000, help="Max traces to pull")
    parser.add_argument("--days", type=int, default=30, help="Lookback window in days")
    args = parser.parse_args(argv)

    weights_dir = Path(args.weights_dir)
    weights_dir.mkdir(parents=True, exist_ok=True)

    try:
        from ..feedback.collector import collect_traces
    except Exception as exc:
        logger.error("Failed to import collector: %s", exc)
        return 2

    traces = collect_traces(days=args.days, limit=args.limit)
    if not traces:
        logger.error("No traces found — cannot bootstrap weights. Run traffic first.")
        return 3
    logger.info("Collected %d traces for bootstrap", len(traces))

    # Delegate to the existing training pipeline. It already knows how to
    # cluster prompts, fit Psi, and serialize to disk.
    try:
        from ..training.pipeline import run_bootstrap  # type: ignore
    except Exception:
        run_bootstrap = None  # type: ignore

    if run_bootstrap is not None:
        try:
            run_bootstrap(traces=traces, output_dir=str(weights_dir))
            logger.info("Bootstrap complete — weights written under %s", weights_dir)
            return 0
        except Exception as exc:
            logger.exception("run_bootstrap failed: %s", exc)
            return 4

    # Fallback: use AutoTrainer's training step on traces-only.
    try:
        from ..training.auto_trainer import AutoTrainer, AutoTrainConfig  # type: ignore

        cfg = AutoTrainConfig(output_dir=str(weights_dir))
        trainer = AutoTrainer(config=cfg)
        trainer.train(production_traces=traces, quality_flags=[])
        logger.info("Bootstrap via AutoTrainer complete — weights under %s", weights_dir)
        return 0
    except Exception as exc:
        logger.exception("Bootstrap fallback failed: %s", exc)
        logger.error("No bootstrap implementation available — ship manual weights in %s", weights_dir)
        return 5


if __name__ == "__main__":
    sys.exit(main())
