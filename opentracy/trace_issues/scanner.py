"""
Issue Scanner Service

Heuristic + LLM-based trace issue detection.
Replaces AWS Bedrock converse() with ModelInvoker (Go engine).
"""
from __future__ import annotations

import json
import logging
import re
import concurrent.futures
from datetime import datetime
from typing import Any

from ..evals_common.model_invoker import ModelInvoker

logger = logging.getLogger(__name__)

LLM_SCAN_MODEL = "gpt-4o-mini"
LLM_SCAN_MAX_TRACES = 20
LLM_SCAN_WORKERS = 5

HALLUCINATION_RELEVANCE_PROMPT = """\
You are an AI quality auditor. Analyze this AI interaction:

1. HALLUCINATION: Does the response contain fabricated facts, invented information, or claims not supported by the input context?
2. RELEVANCE: How well does the response address the specific question/request?

## User Input:
{input}

## AI Response:
{output}

Respond ONLY with valid JSON:
{{
  "hallucination_score": <0.0-1.0, 1.0=clearly hallucinated>,
  "relevance_score": <0.0-1.0, 1.0=perfectly relevant>,
  "hallucination_reason": "<brief explanation>",
  "relevance_reason": "<brief explanation>"
}}"""

REFUSAL_PHRASES = [
    "i can't", "i cannot", "i'm unable", "i am unable",
    "as an ai", "as a language model", "i'm not able", "i am not able",
    "i don't have the ability", "i'm sorry, but i can't", "i apologize, but i cannot",
]

PII_PATTERNS = [
    (r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', "email address"),
    (r'\b\d{3}[-.]?\d{3}[-.]?\d{4}\b', "phone number"),
    (r'\b\d{3}-\d{2}-\d{4}\b', "SSN"),
]

UNCLOSED_CODE_BLOCK = re.compile(r'```', re.DOTALL)


def _truncate(text: str, max_len: int = 500) -> str:
    if not text:
        return ""
    return text[:max_len] + "..." if len(text) > max_len else text


class IssueScanner:
    """Scans traces for issues using heuristic rules + LLM."""

    def scan_traces(self, traces: list[dict[str, Any]]) -> list[dict[str, Any]]:
        issues = []
        for trace in traces:
            issues.extend(self._scan_single_trace(trace))
        return issues

    def _scan_single_trace(self, trace: dict[str, Any]) -> list[dict[str, Any]]:
        issues = []
        trace_id = trace.get("trace_id") or trace.get("id", "")
        model_id = trace.get("model_id", "unknown")
        output = trace.get("output", "")
        input_text = trace.get("input", "")
        latency_ms = trace.get("latency_ms", 0)
        cost_usd = trace.get("cost_usd", 0)
        now = datetime.utcnow().isoformat()
        ti = _truncate(input_text)
        to_ = _truncate(output)
        base = {"trace_id": trace_id, "model_id": model_id, "trace_input": ti, "trace_output": to_, "detected_at": now}

        if len(output.strip()) < 10:
            issues.append({**base, "type": "incomplete_response", "severity": "high",
                           "title": "Very short or empty response",
                           "description": f"Output is only {len(output.strip())} characters.",
                           "ai_confidence": 0.90,
                           "suggested_action": "Check model configuration and retry."})

        output_lower = output.lower()
        for phrase in REFUSAL_PHRASES:
            if phrase in output_lower:
                issues.append({**base, "type": "refusal", "severity": "medium",
                               "title": "Potential refusal detected",
                               "description": f'Contains refusal phrase: "{phrase}".',
                               "ai_confidence": 0.75,
                               "suggested_action": "Review if refusal was appropriate."})
                break

        if latency_ms > 10000:
            issues.append({**base, "type": "latency_spike", "severity": "medium",
                           "title": f"High latency ({latency_ms}ms)",
                           "description": f"Response took {latency_ms}ms (>10s threshold).",
                           "ai_confidence": 0.95,
                           "suggested_action": "Investigate input length and model load."})

        if cost_usd > 0.10:
            issues.append({**base, "type": "cost_anomaly", "severity": "low",
                           "title": f"High cost (${cost_usd:.4f})",
                           "description": f"Cost ${cost_usd:.4f} exceeds $0.10 threshold.",
                           "ai_confidence": 0.85,
                           "suggested_action": "Review prompt engineering to reduce token usage."})

        for pattern, pii_type in PII_PATTERNS:
            if re.search(pattern, output):
                issues.append({**base, "type": "safety", "severity": "high",
                               "title": f"Potential PII ({pii_type})",
                               "description": f"Output matches {pii_type} pattern.",
                               "ai_confidence": 0.80,
                               "suggested_action": "Implement PII detection and redaction."})
                break

        if len(UNCLOSED_CODE_BLOCK.findall(output)) % 2 != 0:
            issues.append({**base, "type": "format_violation", "severity": "low",
                           "title": "Unclosed code block",
                           "description": "Odd number of ``` markers.",
                           "ai_confidence": 0.85,
                           "suggested_action": "Increase max_tokens or check truncation."})

        stripped = output.strip()
        if stripped.startswith("{") and not stripped.endswith("}"):
            issues.append({**base, "type": "format_violation", "severity": "low",
                           "title": "Incomplete JSON",
                           "description": "Starts with '{' but doesn't end with '}'.",
                           "ai_confidence": 0.80,
                           "suggested_action": "Increase max_tokens or use structured output."})

        return issues

    # ── LLM-based analysis via ModelInvoker ───────────────────────

    def _analyze_trace_with_llm(self, trace: dict[str, Any], authorization: str | None = None) -> list[dict[str, Any]]:
        trace_id = trace.get("trace_id") or trace.get("id", "")
        model_id = trace.get("model_id", "unknown")
        input_text = trace.get("input", "")
        output = trace.get("output", "")
        now = datetime.utcnow().isoformat()
        ti = _truncate(input_text)
        to_ = _truncate(output)

        prompt = HALLUCINATION_RELEVANCE_PROMPT.format(input=input_text[:1000], output=output[:1000])

        try:
            invoker = ModelInvoker()
            result = invoker.invoke(LLM_SCAN_MODEL, prompt, authorization=authorization)
            raw = result.get("output", "").strip()
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
            if raw.endswith("```"):
                raw = raw[:-3]
            scores = json.loads(raw.strip())
        except Exception:
            logger.warning("LLM analysis failed for trace %s", trace_id, exc_info=True)
            return []

        issues: list[dict[str, Any]] = []
        base = {"trace_id": trace_id, "model_id": model_id, "trace_input": ti, "trace_output": to_, "detected_at": now}

        h_score = float(scores.get("hallucination_score", 0))
        r_score = float(scores.get("relevance_score", 1))

        if h_score > 0.7:
            issues.append({**base, "type": "hallucination", "severity": "high",
                           "title": "Potential hallucination detected",
                           "description": f"Score: {h_score:.2f}. {scores.get('hallucination_reason', '')}",
                           "ai_confidence": h_score,
                           "suggested_action": "Verify response facts. Consider RAG."})
        if r_score < 0.3:
            issues.append({**base, "type": "low_relevance", "severity": "medium",
                           "title": "Low input-output relevance",
                           "description": f"Relevance score: {r_score:.2f}. {scores.get('relevance_reason', '')}",
                           "ai_confidence": round(1.0 - r_score, 2),
                           "suggested_action": "Review system prompt and retrieval context."})
        return issues

    def scan_traces_with_llm(self, traces: list[dict[str, Any]], authorization: str | None = None) -> list[dict[str, Any]]:
        eligible = [t for t in traces if t.get("input", "").strip() and t.get("output", "").strip()]
        if not eligible:
            return []
        eligible.sort(key=lambda t: len(t.get("output", "")), reverse=True)
        sample = eligible[:LLM_SCAN_MAX_TRACES]
        logger.info("LLM scanning %d traces (out of %d eligible)", len(sample), len(eligible))

        all_issues: list[dict[str, Any]] = []
        with concurrent.futures.ThreadPoolExecutor(max_workers=LLM_SCAN_WORKERS) as pool:
            futures = {pool.submit(self._analyze_trace_with_llm, t, authorization): t for t in sample}
            for future in concurrent.futures.as_completed(futures):
                try:
                    all_issues.extend(future.result())
                except Exception:
                    logger.warning("LLM scan thread failed", exc_info=True)
        logger.info("LLM scan found %d issues", len(all_issues))
        return all_issues
