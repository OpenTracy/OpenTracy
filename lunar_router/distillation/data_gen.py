"""
Data Generation Service — generates N candidate responses per prompt via teacher model.

Replaces the cloud-based bond-data-gen SQS worker.
Uses the Go engine's /v1/chat/completions endpoint via ModelInvoker.
"""
from __future__ import annotations

import asyncio
import json
import logging
import uuid
from typing import Any

from ..evals_common.model_invoker import ModelInvoker
from . import repository as repo

logger = logging.getLogger(__name__)

BATCH_SIZE = 10


async def generate_data(
    job_id: str,
    tenant_id: str,
    prompts: list[dict[str, Any]],
    *,
    teacher_model: str = "gpt-4o",
    n_samples: int = 4,
    temperature: float = 0.8,
    max_tokens: int = 1024,
) -> dict[str, Any]:
    """
    Generate N candidate responses for each prompt using the teacher model.

    Args:
        job_id: Distillation job ID
        tenant_id: Tenant ID
        prompts: List of prompt dicts with 'text'/'prompt' and optional 'system'
        teacher_model: Teacher model name for the Go engine
        n_samples: Number of candidate responses per prompt
        temperature: Sampling temperature
        max_tokens: Max tokens per response

    Returns:
        Summary dict with counts
    """
    invoker = ModelInvoker()
    total_prompts = len(prompts)
    total_candidates = 0
    errors = 0
    last_error = ""

    # Verify teacher model connectivity before starting (with retry for rate limits)
    for attempt in range(5):
        try:
            test_result = await asyncio.to_thread(
                invoker.invoke_with_messages, teacher_model,
                [{"role": "user", "content": "Say OK"}],
                temperature=0.0, max_tokens=8,
            )
            if not test_result.get("output"):
                raise RuntimeError("Empty response from teacher model")
            break
        except Exception as e:
            err = str(e)
            if ("429" in err or "rate" in err.lower()) and attempt < 4:
                delay = 10 * (2 ** attempt)
                logger.info("Teacher model rate limited on pre-check, waiting %ds (attempt %d/5)", delay, attempt + 1)
                repo.append_log(tenant_id, job_id, f"Rate limited by teacher model, waiting {delay}s...")
                await asyncio.sleep(delay)
                continue
            elif "401" in err or "API key" in err or "Unauthorized" in err:
                raise RuntimeError(
                    f"Data generation failed: the teacher model '{teacher_model}' requires an API key. "
                    f"Please add a valid API key in Settings > API Keys and try again."
                ) from e
            elif "402" in err or "insufficient" in err.lower() or "quota" in err.lower() or "credit" in err.lower():
                raise RuntimeError(
                    f"Data generation failed: insufficient credits for '{teacher_model}'. "
                    f"Please check your billing/credits with the provider and try again."
                ) from e
            elif "429" in err or "rate" in err.lower():
                raise RuntimeError(
                    f"Data generation failed: rate limit exceeded for '{teacher_model}' after 5 retries. "
                    f"Please wait a few minutes and try again."
                ) from e
            elif "timeout" in err.lower() or "connect" in err.lower():
                raise RuntimeError(
                    f"Data generation failed: could not connect to the provider for '{teacher_model}'. "
                    f"Please check your network connection."
                ) from e
            else:
                raise RuntimeError(
                    f"Data generation failed: teacher model '{teacher_model}' returned an error: {err}"
                ) from e

    repo.append_log(tenant_id, job_id, f"Data generation: {total_prompts} prompts × {n_samples} candidates")
    _update_phase_progress(tenant_id, job_id, "data_generation", 0, {
        "total": total_prompts,
        "total_candidates": 0,
    })

    for batch_start in range(0, total_prompts, BATCH_SIZE):
        batch = prompts[batch_start : batch_start + BATCH_SIZE]

        for idx, prompt_data in enumerate(batch):
            prompt_text = prompt_data.get("text") or prompt_data.get("prompt", "")
            system_prompt = prompt_data.get("system", "")
            prompt_id = prompt_data.get("id", str(uuid.uuid4()))

            candidates_batch: list[dict[str, Any]] = []

            for sample_idx in range(n_samples):
                messages: list[dict[str, str]] = []
                if system_prompt:
                    messages.append({"role": "system", "content": system_prompt})
                messages.append({"role": "user", "content": prompt_text})

                # Pass tools to model if the prompt has tool definitions
                extra_kwargs: dict[str, Any] = {}
                tools_str = prompt_data.get("tools", "")
                if tools_str:
                    try:
                        tools_list = json.loads(tools_str) if isinstance(tools_str, str) else tools_str
                        if isinstance(tools_list, list) and tools_list:
                            extra_kwargs["tools"] = tools_list
                    except (json.JSONDecodeError, TypeError):
                        pass

                result = None
                for attempt in range(5):
                    try:
                        result = await asyncio.to_thread(
                            invoker.invoke_with_messages,
                            teacher_model,
                            messages,
                            temperature=temperature,
                            max_tokens=max_tokens,
                            **extra_kwargs,
                        )
                        break
                    except Exception as e:
                        err = str(e)
                        if ("429" in err or "rate" in err.lower()) and attempt < 4:
                            delay = 5 * (2 ** attempt)
                            logger.info("Rate limited, waiting %ds (attempt %d/5)", delay, attempt + 1)
                            await asyncio.sleep(delay)
                            continue
                        logger.warning("Failed to generate candidate %d for prompt %s: %s", sample_idx, prompt_id[:8], e)
                        errors += 1
                        last_error = err
                        break

                if result:
                    candidates_batch.append({
                        "candidate_id": str(uuid.uuid4()),
                        "job_id": job_id,
                        "tenant_id": tenant_id,
                        "prompt_id": prompt_id,
                        "candidate_idx": sample_idx,
                        "prompt": prompt_text,
                        "system_prompt": system_prompt,
                        "response": result.get("output", ""),
                        "model": teacher_model,
                        "temperature": temperature,
                        "score": 0.0,
                        "selected": 0,
                        "usage": json.dumps(result.get("usage", {})),
                    })

            # Insert batch of candidates
            if candidates_batch:
                try:
                    repo.insert_candidates(candidates_batch)
                    total_candidates += len(candidates_batch)
                except Exception as e:
                    logger.error("Failed to insert candidates: %s", e)

        # Update progress
        processed = min(batch_start + len(batch), total_prompts)
        pct = min(99, int(processed / total_prompts * 100))
        _update_phase_progress(tenant_id, job_id, "data_generation", pct, {
            "processed": processed,
            "total": total_prompts,
            "total_candidates": total_candidates,
        })

    # Final update
    _update_phase_progress(tenant_id, job_id, "data_generation", 100, {
        "processed": total_prompts,
        "total": total_prompts,
        "total_candidates": total_candidates,
    })
    repo.append_log(tenant_id, job_id, f"Data generation complete: {total_candidates} candidates")

    return {
        "total_prompts": total_prompts,
        "total_candidates": total_candidates,
        "errors": errors,
        "last_error": last_error,
    }


def _update_phase_progress(
    tenant_id: str,
    job_id: str,
    phase: str,
    pct: int,
    details: dict[str, Any] | None = None,
) -> None:
    """Update a specific phase's progress within the job's progress dict."""
    try:
        job = repo.get_job(tenant_id, job_id)
        if not job:
            return
        progress = job.get("progress", {})
        if not isinstance(progress, dict):
            progress = {}
        phase_data = progress.get(phase, {})
        phase_data["status"] = "completed" if pct >= 100 else "running"
        phase_data["progress"] = pct
        if details:
            phase_data.update(details)
        progress[phase] = phase_data
        repo.update_job(tenant_id, job_id, {"progress": progress})
    except Exception as e:
        logger.warning("Failed to update phase progress: %s", e)
