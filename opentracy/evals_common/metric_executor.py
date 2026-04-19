"""
Metric Executor — dispatches metric evaluation by type.

Port of evaluations-api/services/metric_executor.py.
Handles: exact_match, contains, llm_judge, latency, cost, python, semantic_sim.
Bedrock embeddings replaced with simple TF-IDF cosine similarity.
"""
from __future__ import annotations

import logging
import math
import re
import subprocess
import sys
import tempfile
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Optional

from .llm_judge import LLMJudge
from .model_invoker import ModelInvoker

logger = logging.getLogger(__name__)


class MetricExecutor:
    """Execute metrics against model outputs."""

    def __init__(
        self,
        invoker: ModelInvoker | None = None,
        judge: LLMJudge | None = None,
    ):
        self.invoker = invoker or ModelInvoker()
        self.judge = judge or LLMJudge(self.invoker)

    def execute(
        self,
        metric: dict[str, Any],
        *,
        input_text: str,
        output_text: str,
        expected_text: str = "",
        latency: float = 0.0,
        cost: float = 0.0,
        authorization: str | None = None,
    ) -> dict[str, Any]:
        """
        Execute a single metric.

        Returns:
            {"score": float (0-1), "raw_value": Any, "explanation": str}
        """
        metric_type = metric.get("type", "")
        config = metric.get("config", {})

        try:
            if metric_type == "exact_match":
                return self._exact_match(output_text, expected_text)
            elif metric_type == "contains":
                return self._contains(output_text, expected_text)
            elif metric_type == "semantic_sim":
                return self._semantic_similarity(output_text, expected_text)
            elif metric_type == "hf_similarity":
                return self._semantic_similarity(output_text, expected_text)
            elif metric_type == "llm_judge":
                return self._llm_judge(
                    input_text, output_text, expected_text,
                    config=config,
                    authorization=authorization,
                )
            elif metric_type == "latency":
                return self._latency(latency, config)
            elif metric_type == "cost":
                return self._cost(cost, config)
            elif metric_type == "python":
                return self._python_sandbox(
                    metric, input_text, output_text, expected_text,
                )
            else:
                return {
                    "score": 0.0,
                    "raw_value": None,
                    "explanation": f"Unknown metric type: {metric_type}",
                }
        except Exception as e:
            logger.error("Metric execution error (%s): %s", metric_type, e)
            return {
                "score": 0.0,
                "raw_value": None,
                "explanation": f"Metric execution error: {str(e)}",
                "error": str(e),
            }

    # -----------------------------------------------------------------------
    # Metric implementations
    # -----------------------------------------------------------------------

    def _exact_match(self, output: str, expected: str) -> dict[str, Any]:
        match = output.strip().lower() == expected.strip().lower()
        return {
            "score": 1.0 if match else 0.0,
            "raw_value": match,
            "explanation": "Exact match" if match else "No match",
        }

    def _contains(self, output: str, expected: str) -> dict[str, Any]:
        contained = expected.strip().lower() in output.strip().lower()
        return {
            "score": 1.0 if contained else 0.0,
            "raw_value": contained,
            "explanation": "Output contains expected" if contained else "Output does not contain expected",
        }

    def _semantic_similarity(self, output: str, expected: str) -> dict[str, Any]:
        """Simple TF-IDF cosine similarity (no external embeddings needed)."""
        if not output.strip() or not expected.strip():
            return {"score": 0.0, "raw_value": 0.0, "explanation": "Empty text"}

        score = self._tfidf_cosine(output, expected)
        return {
            "score": round(score, 4),
            "raw_value": round(score, 4),
            "explanation": f"TF-IDF cosine similarity: {score:.4f}",
        }

    def _tfidf_cosine(self, text_a: str, text_b: str) -> float:
        """Compute TF-IDF cosine similarity between two texts."""
        words_a = re.findall(r"\w+", text_a.lower())
        words_b = re.findall(r"\w+", text_b.lower())
        if not words_a or not words_b:
            return 0.0

        tf_a = Counter(words_a)
        tf_b = Counter(words_b)
        all_words = set(tf_a) | set(tf_b)

        # IDF (simple: 2 "documents")
        idf: dict[str, float] = {}
        for w in all_words:
            doc_freq = (1 if w in tf_a else 0) + (1 if w in tf_b else 0)
            idf[w] = math.log(2 / doc_freq) + 1

        # TF-IDF vectors (as dicts)
        vec_a = {w: tf_a.get(w, 0) * idf[w] for w in all_words}
        vec_b = {w: tf_b.get(w, 0) * idf[w] for w in all_words}

        # Cosine
        dot = sum(vec_a[w] * vec_b[w] for w in all_words)
        mag_a = math.sqrt(sum(v ** 2 for v in vec_a.values()))
        mag_b = math.sqrt(sum(v ** 2 for v in vec_b.values()))

        if mag_a == 0 or mag_b == 0:
            return 0.0
        return dot / (mag_a * mag_b)

    def _llm_judge(
        self,
        input_text: str,
        output_text: str,
        expected_text: str,
        config: dict[str, Any],
        authorization: str | None = None,
    ) -> dict[str, Any]:
        judge_model = config.get("judge_model", "gpt-4")
        judge_prompt = config.get("judge_prompt")
        criteria = config.get("criteria", "accuracy, relevance, and completeness")
        scale = config.get("scale", {})
        min_score = scale.get("min", 1)
        max_score = scale.get("max", 10)

        return self.judge.evaluate(
            input_text=input_text,
            output_text=output_text,
            expected_text=expected_text,
            judge_model=judge_model,
            judge_prompt=judge_prompt,
            criteria=criteria,
            min_score=min_score,
            max_score=max_score,
            authorization=authorization,
        )

    def _latency(self, latency: float, config: dict[str, Any]) -> dict[str, Any]:
        threshold = config.get("threshold", 10.0)
        score = max(0.0, 1.0 - (latency / threshold)) if threshold > 0 else 0.0
        return {
            "score": round(max(0.0, min(1.0, score)), 4),
            "raw_value": round(latency, 3),
            "explanation": f"Latency: {latency:.3f}s (threshold: {threshold}s)",
        }

    def _cost(self, cost: float, config: dict[str, Any]) -> dict[str, Any]:
        threshold = config.get("threshold", 0.10)
        score = max(0.0, 1.0 - (cost / threshold)) if threshold > 0 else 0.0
        return {
            "score": round(max(0.0, min(1.0, score)), 4),
            "raw_value": round(cost, 6),
            "explanation": f"Cost: ${cost:.6f} (threshold: ${threshold})",
        }

    def _python_sandbox(
        self,
        metric: dict[str, Any],
        input_text: str,
        output_text: str,
        expected_text: str,
    ) -> dict[str, Any]:
        """Run a user-provided Python script in a subprocess sandbox."""
        script = metric.get("python_script", "")
        if not script:
            return {"score": 0.0, "raw_value": None, "explanation": "No script provided"}

        requirements = metric.get("requirements", [])
        timeout = 30

        # Install requirements if needed
        if requirements:
            try:
                subprocess.run(
                    [sys.executable, "-m", "pip", "install", "--quiet"] + requirements,
                    timeout=60,
                    capture_output=True,
                )
            except Exception as e:
                logger.warning("Failed to install requirements: %s", e)

        # Write script to temp file
        wrapper = f"""
import json, sys

{script}

result = evaluate(
    output={repr(output_text)},
    expected={repr(expected_text)},
    input_text={repr(input_text)},
)

if isinstance(result, (int, float)):
    result = {{"score": float(result)}}
elif isinstance(result, dict):
    if "score" not in result:
        result["score"] = 0.0
else:
    result = {{"score": 0.0, "error": "evaluate() must return a number or dict"}}

print(json.dumps(result))
"""
        try:
            with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as f:
                f.write(wrapper)
                f.flush()
                proc = subprocess.run(
                    [sys.executable, f.name],
                    timeout=timeout,
                    capture_output=True,
                    text=True,
                )

            if proc.returncode != 0:
                return {
                    "score": 0.0,
                    "raw_value": None,
                    "explanation": f"Script error: {proc.stderr[:500]}",
                }

            import json
            data = json.loads(proc.stdout.strip())
            return {
                "score": float(data.get("score", 0.0)),
                "raw_value": data.get("raw_value"),
                "explanation": data.get("explanation", "Custom script result"),
            }

        except subprocess.TimeoutExpired:
            return {"score": 0.0, "raw_value": None, "explanation": f"Script timed out after {timeout}s"}
        except Exception as e:
            return {"score": 0.0, "raw_value": None, "explanation": f"Script execution error: {e}"}
