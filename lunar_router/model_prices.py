"""
Model pricing and metadata for all supported providers.

Prices are in USD per token. Context windows in tokens.
Updated: 2025-03.
"""

from typing import Optional

# (input_cost_per_token, output_cost_per_token, max_input_tokens, max_output_tokens)
MODEL_INFO: dict[str, tuple[float, float, int, int]] = {
    # ── OpenAI ──────────────────────────────────────────────────
    "gpt-4o": (2.50e-6, 10.00e-6, 128_000, 16_384),
    "gpt-4o-mini": (0.15e-6, 0.60e-6, 128_000, 16_384),
    "gpt-4o-2024-11-20": (2.50e-6, 10.00e-6, 128_000, 16_384),
    "gpt-4-turbo": (10.00e-6, 30.00e-6, 128_000, 4_096),
    "gpt-4": (30.00e-6, 60.00e-6, 8_192, 8_192),
    "gpt-3.5-turbo": (0.50e-6, 1.50e-6, 16_385, 4_096),
    "o1": (15.00e-6, 60.00e-6, 200_000, 100_000),
    "o1-mini": (3.00e-6, 12.00e-6, 128_000, 65_536),
    "o1-preview": (15.00e-6, 60.00e-6, 128_000, 32_768),
    "o3": (10.00e-6, 40.00e-6, 200_000, 100_000),
    "o3-mini": (1.10e-6, 4.40e-6, 200_000, 100_000),
    "o4-mini": (1.10e-6, 4.40e-6, 200_000, 100_000),
    # ── Anthropic ───────────────────────────────────────────────
    "claude-sonnet-4-6": (3.00e-6, 15.00e-6, 200_000, 64_000),
    "claude-opus-4-6": (15.00e-6, 75.00e-6, 200_000, 32_000),
    "claude-haiku-4-5-20251001": (0.80e-6, 4.00e-6, 200_000, 8_192),
    "claude-sonnet-4-5-20250929": (3.00e-6, 15.00e-6, 200_000, 64_000),
    "claude-opus-4-5-20251101": (15.00e-6, 75.00e-6, 200_000, 32_000),
    "claude-opus-4-1-20250805": (15.00e-6, 75.00e-6, 200_000, 32_000),
    "claude-opus-4-20250514": (15.00e-6, 75.00e-6, 200_000, 32_000),
    "claude-sonnet-4-20250514": (3.00e-6, 15.00e-6, 200_000, 64_000),
    "claude-3-haiku-20240307": (0.25e-6, 1.25e-6, 200_000, 4_096),
    # ── Gemini (Google) ─────────────────────────────────────────
    "gemini-2.0-flash": (0.10e-6, 0.40e-6, 1_048_576, 8_192),
    "gemini-2.0-flash-exp": (0.0, 0.0, 1_048_576, 8_192),
    "gemini-1.5-pro": (1.25e-6, 5.00e-6, 2_097_152, 8_192),
    "gemini-1.5-pro-latest": (1.25e-6, 5.00e-6, 2_097_152, 8_192),
    "gemini-1.5-flash": (0.075e-6, 0.30e-6, 1_048_576, 8_192),
    "gemini-1.5-flash-latest": (0.075e-6, 0.30e-6, 1_048_576, 8_192),
    "gemini-1.5-flash-8b": (0.0375e-6, 0.15e-6, 1_048_576, 8_192),
    # ── Mistral ─────────────────────────────────────────────────
    "mistral-large-latest": (2.00e-6, 6.00e-6, 128_000, 8_192),
    "mistral-medium-latest": (2.70e-6, 8.10e-6, 32_000, 8_192),
    "mistral-small-latest": (0.20e-6, 0.60e-6, 32_000, 8_192),
    "ministral-3b-latest": (0.04e-6, 0.04e-6, 128_000, 8_192),
    "ministral-8b-latest": (0.10e-6, 0.10e-6, 128_000, 8_192),
    "codestral-latest": (0.30e-6, 0.90e-6, 32_000, 8_192),
    "pixtral-large-latest": (2.00e-6, 6.00e-6, 128_000, 8_192),
    "pixtral-12b-2409": (0.15e-6, 0.15e-6, 128_000, 8_192),
    "open-mistral-nemo": (0.15e-6, 0.15e-6, 128_000, 8_192),
    "open-mixtral-8x7b": (0.70e-6, 0.70e-6, 32_000, 8_192),
    "open-mixtral-8x22b": (2.00e-6, 6.00e-6, 64_000, 8_192),
    # ── DeepSeek ────────────────────────────────────────────────
    "deepseek-chat": (0.14e-6, 0.28e-6, 64_000, 8_192),
    "deepseek-reasoner": (0.55e-6, 2.19e-6, 64_000, 8_192),
    "deepseek-coder": (0.14e-6, 0.28e-6, 64_000, 8_192),
    # ── Groq ────────────────────────────────────────────────────
    "llama-3.3-70b-versatile": (0.59e-6, 0.79e-6, 128_000, 32_768),
    "llama-3.1-70b-versatile": (0.59e-6, 0.79e-6, 128_000, 32_768),
    "llama-3.1-8b-instant": (0.05e-6, 0.08e-6, 128_000, 8_192),
    "llama-3.2-90b-vision-preview": (0.90e-6, 0.90e-6, 128_000, 8_192),
    "llama-3.2-11b-vision-preview": (0.18e-6, 0.18e-6, 128_000, 8_192),
    "llama-3.2-3b-preview": (0.06e-6, 0.06e-6, 128_000, 8_192),
    "llama-3.2-1b-preview": (0.04e-6, 0.04e-6, 128_000, 8_192),
    "mixtral-8x7b-32768": (0.24e-6, 0.24e-6, 32_768, 8_192),
    "gemma2-9b-it": (0.20e-6, 0.20e-6, 8_192, 8_192),
    # ── Perplexity ──────────────────────────────────────────────
    "sonar": (1.00e-6, 1.00e-6, 128_000, 8_192),
    "sonar-pro": (3.00e-6, 15.00e-6, 200_000, 8_192),
    "sonar-reasoning": (1.00e-6, 5.00e-6, 128_000, 8_192),
    # ── Cerebras ────────────────────────────────────────────────
    "llama3.1-8b": (0.10e-6, 0.10e-6, 8_192, 8_192),
    "llama3.1-70b": (0.60e-6, 0.60e-6, 8_192, 8_192),
    # ── SambaNova ───────────────────────────────────────────────
    "Meta-Llama-3.1-8B-Instruct": (0.10e-6, 0.10e-6, 8_192, 8_192),
    "Meta-Llama-3.1-70B-Instruct": (0.60e-6, 0.60e-6, 8_192, 8_192),
    "Meta-Llama-3.1-405B-Instruct": (1.00e-6, 1.00e-6, 8_192, 8_192),
    # ── Together AI ─────────────────────────────────────────────
    "meta-llama/Llama-3.3-70B-Instruct-Turbo": (0.88e-6, 0.88e-6, 128_000, 8_192),
    "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo": (0.18e-6, 0.18e-6, 128_000, 8_192),
    "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo": (0.88e-6, 0.88e-6, 128_000, 8_192),
    "meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo": (3.50e-6, 3.50e-6, 128_000, 8_192),
    "mistralai/Mixtral-8x7B-Instruct-v0.1": (0.60e-6, 0.60e-6, 32_768, 8_192),
    "Qwen/Qwen2.5-72B-Instruct-Turbo": (1.20e-6, 1.20e-6, 128_000, 8_192),
    # ── Fireworks ───────────────────────────────────────────────
    "accounts/fireworks/models/llama-v3p1-8b-instruct": (0.20e-6, 0.20e-6, 128_000, 8_192),
    "accounts/fireworks/models/llama-v3p1-70b-instruct": (0.90e-6, 0.90e-6, 128_000, 8_192),
    "accounts/fireworks/models/llama-v3p1-405b-instruct": (3.00e-6, 3.00e-6, 128_000, 8_192),
    # ── Cohere ──────────────────────────────────────────────────
    "command-r-plus": (2.50e-6, 10.00e-6, 128_000, 4_096),
    "command-r": (0.15e-6, 0.60e-6, 128_000, 4_096),
    "command-light": (0.30e-6, 0.60e-6, 4_096, 4_096),
    "command": (1.00e-6, 2.00e-6, 4_096, 4_096),
    "c4ai-aya-expanse-32b": (0.50e-6, 1.50e-6, 128_000, 4_096),
}


def model_cost(
    model: str,
    input_tokens: int = 0,
    output_tokens: int = 0,
) -> float:
    """Calculate the cost in USD for a model call."""
    info = MODEL_INFO.get(model)
    if info is None:
        return 0.0
    return input_tokens * info[0] + output_tokens * info[1]


def get_model_info(model: str) -> Optional[dict]:
    """Get pricing and context info for a model.

    Returns dict with keys: input_cost_per_token, output_cost_per_token,
    max_input_tokens, max_output_tokens, or None if model is unknown.
    """
    info = MODEL_INFO.get(model)
    if info is None:
        return None
    return {
        "input_cost_per_token": info[0],
        "output_cost_per_token": info[1],
        "max_input_tokens": info[2],
        "max_output_tokens": info[3],
    }


def supported_models() -> list[str]:
    """Return all models with known pricing."""
    return sorted(MODEL_INFO.keys())
