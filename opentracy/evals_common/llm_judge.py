"""
LLM-as-Judge — uses the Go engine to evaluate responses.

Port of evaluations-api/services/llm_judge.py.
Calls /v1/chat/completions via ModelInvoker.
"""
from __future__ import annotations

import json
import logging
import re
from typing import Any, Optional

from .model_invoker import ModelInvoker

logger = logging.getLogger(__name__)

DEFAULT_JUDGE_PROMPT = """You are an expert evaluator. Evaluate the following AI response.

**User Input:**
{input}

**Expected Output:**
{expected}

**Actual Output:**
{output}

**Evaluation Criteria:**
{criteria}

Rate the response on a scale of {min_score} to {max_score}.

Return your evaluation as JSON:
{{
  "score": <number between {min_score} and {max_score}>,
  "explanation": "<brief explanation of your rating>"
}}"""


class LLMJudge:
    """LLM-based evaluation using a judge model via the Go engine."""

    def __init__(self, invoker: ModelInvoker | None = None):
        self.invoker = invoker or ModelInvoker()

    def evaluate(
        self,
        *,
        input_text: str,
        output_text: str,
        expected_text: str = "",
        judge_model: str = "gpt-4",
        judge_prompt: str | None = None,
        criteria: str = "accuracy, relevance, and completeness",
        min_score: int = 1,
        max_score: int = 10,
        authorization: str | None = None,
    ) -> dict[str, Any]:
        """
        Evaluate a response using an LLM judge.

        Returns:
            {"score": float (0-1 normalized), "raw_score": int, "explanation": str}
        """
        prompt_template = judge_prompt or DEFAULT_JUDGE_PROMPT

        prompt = prompt_template.format(
            input=input_text[:2000],
            expected=expected_text[:2000] if expected_text else "(none provided)",
            output=output_text[:2000],
            criteria=criteria,
            min_score=min_score,
            max_score=max_score,
        )

        try:
            result = self.invoker.invoke(
                judge_model,
                prompt,
                authorization=authorization,
                temperature=0.1,
                max_tokens=512,
            )

            raw_output = result.get("output", "")
            return self._parse_judge_response(raw_output, min_score, max_score)

        except Exception as e:
            logger.error("LLM Judge evaluation failed: %s", e)
            return {
                "score": 0.0,
                "raw_score": min_score,
                "explanation": f"Judge evaluation failed: {str(e)}",
                "error": str(e),
            }

    def _parse_judge_response(
        self, text: str, min_score: int, max_score: int
    ) -> dict[str, Any]:
        """Parse JSON or regex-extract score from judge output."""
        # Try JSON parse
        try:
            # Extract JSON block
            json_match = re.search(r"\{[^}]+\}", text, re.DOTALL)
            if json_match:
                data = json.loads(json_match.group())
                raw_score = float(data.get("score", min_score))
                explanation = data.get("explanation", "")

                # Clamp
                raw_score = max(min_score, min(max_score, raw_score))

                # Normalize to 0-1
                score_range = max_score - min_score
                normalized = (raw_score - min_score) / score_range if score_range > 0 else 0.0

                return {
                    "score": round(normalized, 4),
                    "raw_score": raw_score,
                    "explanation": explanation,
                }
        except (json.JSONDecodeError, ValueError, TypeError):
            pass

        # Fallback: regex for numbers
        numbers = re.findall(r"(\d+(?:\.\d+)?)", text)
        if numbers:
            for n in numbers:
                val = float(n)
                if min_score <= val <= max_score:
                    score_range = max_score - min_score
                    normalized = (val - min_score) / score_range if score_range > 0 else 0.0
                    return {
                        "score": round(normalized, 4),
                        "raw_score": val,
                        "explanation": text[:500],
                    }

        # Total fallback
        return {
            "score": 0.5,
            "raw_score": (min_score + max_score) / 2,
            "explanation": f"Could not parse score from: {text[:200]}",
        }
