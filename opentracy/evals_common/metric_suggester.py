"""
Metric Suggester — LLM-powered metric recommendation via the Go engine.

Port of evaluations-api/services/metric_suggester.py.
"""
from __future__ import annotations

import json
import logging
import re
from typing import Any, Optional

from .model_invoker import ModelInvoker

logger = logging.getLogger(__name__)

SUGGEST_PROMPT = """Analyze these dataset samples and suggest the best evaluation metrics.

Samples:
{samples_text}

Return a JSON array of metric suggestions, each with:
- metric_id: one of "exact_match", "contains", "semantic_sim", "llm_judge", "latency", "cost"
  OR for custom metrics: a descriptive snake_case id
- type: "builtin" or "custom_judge"
- name: display name
- description: why this metric is appropriate
- weight: importance (0.0-1.0)
- If type is "custom_judge", also include:
  - judge_prompt: custom evaluation prompt
  - judge_model: model to use (default "claude-sonnet-4")

Return ONLY the JSON array, no explanation."""

ANALYZE_PROMPT = """Analyze these dataset samples and classify the task.

Samples:
{samples_text}

Return JSON:
{{
  "domain": "general|code|math|creative|qa|summarization|translation|...",
  "task_type": "generation|classification|extraction|transformation|...",
  "complexity": "low|medium|high",
  "metrics": [same format as metric suggestions]
}}

Return ONLY the JSON."""


class MetricSuggester:
    """Suggest evaluation metrics for a dataset using an LLM."""

    def __init__(self, invoker: ModelInvoker | None = None):
        self.invoker = invoker or ModelInvoker()

    def _format_samples(self, samples: list[dict[str, Any]], max_samples: int = 5) -> str:
        lines = []
        for i, s in enumerate(samples[:max_samples]):
            inp = str(s.get("input", ""))[:300]
            out = str(s.get("expected_output", s.get("output", "")))[:300]
            lines.append(f"Sample {i+1}:\n  Input: {inp}\n  Expected: {out}")
        return "\n\n".join(lines)

    def suggest(
        self,
        samples: list[dict[str, Any]],
        authorization: str | None = None,
        model: str = "gpt-4",
    ) -> list[dict[str, Any]]:
        """Suggest metrics for the given samples."""
        samples_text = self._format_samples(samples)
        prompt = SUGGEST_PROMPT.format(samples_text=samples_text)

        try:
            result = self.invoker.invoke(
                model, prompt,
                authorization=authorization,
                temperature=0.3,
                max_tokens=1024,
            )
            raw = result.get("output", "")
            return self._parse_metrics_list(raw)
        except Exception as e:
            logger.warning("Metric suggestion failed, returning defaults: %s", e)
            return self._default_suggestions()

    def analyze(
        self,
        samples: list[dict[str, Any]],
        authorization: str | None = None,
        model: str = "gpt-4",
    ) -> dict[str, Any]:
        """Analyze dataset and return domain/task/metrics classification."""
        samples_text = self._format_samples(samples)
        prompt = ANALYZE_PROMPT.format(samples_text=samples_text)

        try:
            result = self.invoker.invoke(
                model, prompt,
                authorization=authorization,
                temperature=0.3,
                max_tokens=1024,
            )
            raw = result.get("output", "")
            json_match = re.search(r"\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}", raw, re.DOTALL)
            if json_match:
                data = json.loads(json_match.group())
                return data
        except Exception as e:
            logger.warning("Dataset analysis failed, returning defaults: %s", e)

        return {
            "domain": "general",
            "task_type": "generation",
            "complexity": "medium",
            "metrics": self._default_suggestions(),
        }

    def _parse_metrics_list(self, text: str) -> list[dict[str, Any]]:
        try:
            arr_match = re.search(r"\[.*\]", text, re.DOTALL)
            if arr_match:
                return json.loads(arr_match.group())
        except (json.JSONDecodeError, ValueError):
            pass
        return self._default_suggestions()

    def _default_suggestions(self) -> list[dict[str, Any]]:
        return [
            {
                "metric_id": "llm_judge",
                "type": "builtin",
                "name": "LLM-as-Judge",
                "description": "General quality evaluation",
                "weight": 1.0,
            },
            {
                "metric_id": "latency",
                "type": "builtin",
                "name": "Latency",
                "description": "Response time measurement",
                "weight": 0.5,
            },
        ]
