"""
Distillation Schemas — Pydantic models for the distillation API.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, model_validator



STUDENT_MODEL_MAP: dict[str, str] = {
    # Llama
    "llama-3.2-1b": "unsloth/Llama-3.2-1B-Instruct-bnb-4bit",
    "llama-3.2-3b": "unsloth/Llama-3.2-3B-Instruct-bnb-4bit",
    "llama-3.1-8b": "unsloth/Meta-Llama-3.1-8B-Instruct-bnb-4bit",
    # Qwen 3
    "qwen3-0.6b": "unsloth/Qwen3-0.6B-unsloth-bnb-4bit",
    "qwen3-1.7b": "unsloth/Qwen3-1.7B-unsloth-bnb-4bit",
    "qwen3-4b": "unsloth/Qwen3-4B-unsloth-bnb-4bit",
    "qwen3-8b": "unsloth/Qwen3-8B-unsloth-bnb-4bit",
    "qwen3-14b": "unsloth/Qwen3-14B-unsloth-bnb-4bit",
    # Qwen 2.5
    "qwen2.5-0.5b": "unsloth/Qwen2.5-0.5B-Instruct-bnb-4bit",
    "qwen2.5-1.5b": "unsloth/Qwen2.5-1.5B-Instruct-bnb-4bit",
    "qwen2.5-3b": "unsloth/Qwen2.5-3B-Instruct-bnb-4bit",
    "qwen2.5-7b": "unsloth/Qwen2.5-7B-Instruct-bnb-4bit",
    "qwen2.5-14b": "unsloth/Qwen2.5-14B-Instruct-bnb-4bit",
    # Qwen 2.5 Coder
    "qwen2.5-coder-1.5b": "unsloth/Qwen2.5-Coder-1.5B-Instruct-bnb-4bit",
    "qwen2.5-coder-3b": "unsloth/Qwen2.5-Coder-3B-Instruct-bnb-4bit",
    "qwen2.5-coder-7b": "unsloth/Qwen2.5-Coder-7B-Instruct-bnb-4bit",
    "qwen2.5-coder-14b": "unsloth/Qwen2.5-Coder-14B-Instruct-bnb-4bit",
    # Gemma
    "gemma-3-1b": "unsloth/gemma-3-1b-it-unsloth-bnb-4bit",
    "gemma-3-4b": "unsloth/gemma-3-4b-it-unsloth-bnb-4bit",
    "gemma-3-12b": "unsloth/gemma-3-12b-it-unsloth-bnb-4bit",
    "gemma-2-2b": "unsloth/gemma-2-2b-it-bnb-4bit",
    "gemma-2-9b": "unsloth/gemma-2-9b-it-bnb-4bit",
    # Mistral
    "mistral-7b-v0.3": "unsloth/mistral-7b-instruct-v0.3-bnb-4bit",
    "mistral-nemo-12b": "unsloth/Mistral-Nemo-Instruct-2407-bnb-4bit",
    # Phi
    "phi-4-mini": "unsloth/Phi-4-mini-instruct-unsloth-bnb-4bit",
    "phi-4": "unsloth/phi-4-unsloth-bnb-4bit",
    "phi-3.5-mini": "unsloth/Phi-3.5-mini-instruct-bnb-4bit",
    # DeepSeek R1
    "deepseek-r1-qwen-1.5b": "unsloth/DeepSeek-R1-Distill-Qwen-1.5B-unsloth-bnb-4bit",
    "deepseek-r1-qwen-7b": "unsloth/DeepSeek-R1-Distill-Qwen-7B-unsloth-bnb-4bit",
    "deepseek-r1-qwen-14b": "unsloth/DeepSeek-R1-Distill-Qwen-14B-unsloth-bnb-4bit",
    "deepseek-r1-llama-8b": "unsloth/DeepSeek-R1-Distill-Llama-8B-unsloth-bnb-4bit",
    # SmolLM
    "smollm2-1.7b": "unsloth/SmolLM2-1.7B-Instruct-bnb-4bit",
    "smollm3-3b": "unsloth/SmolLM3-3B-bnb-4bit",
    # Granite
    "granite-3.2-2b": "unsloth/granite-3.2-2b-instruct-bnb-4bit",
    "granite-3.2-8b": "unsloth/granite-3.2-8b-instruct-bnb-4bit",
}

MODEL_PARAM_SIZES: dict[str, float] = {
    "llama-3.2-1b": 1.2, "llama-3.2-3b": 3.2, "llama-3.1-8b": 8.0,
    "qwen3-0.6b": 0.6, "qwen3-1.7b": 1.7, "qwen3-4b": 4.0,
    "qwen3-8b": 8.0, "qwen3-14b": 14.0,
    "qwen2.5-0.5b": 0.5, "qwen2.5-1.5b": 1.5, "qwen2.5-3b": 3.0,
    "qwen2.5-7b": 7.0, "qwen2.5-14b": 14.0,
    "qwen2.5-coder-1.5b": 1.5, "qwen2.5-coder-3b": 3.0,
    "qwen2.5-coder-7b": 7.0, "qwen2.5-coder-14b": 14.0,
    "gemma-3-1b": 1.0, "gemma-3-4b": 4.0, "gemma-3-12b": 12.0,
    "gemma-2-2b": 2.0, "gemma-2-9b": 9.0,
    "mistral-7b-v0.3": 7.0, "mistral-nemo-12b": 12.0,
    "phi-4-mini": 3.8, "phi-4": 14.0, "phi-3.5-mini": 3.8,
    "deepseek-r1-qwen-1.5b": 1.5, "deepseek-r1-qwen-7b": 7.0,
    "deepseek-r1-qwen-14b": 14.0, "deepseek-r1-llama-8b": 8.0,
    "smollm2-1.7b": 1.7, "smollm3-3b": 3.0,
    "granite-3.2-2b": 2.0, "granite-3.2-8b": 8.0,
}


def resolve_student_model(model_key: str) -> str:
    """Resolve a short student model key to a HuggingFace path."""
    return STUDENT_MODEL_MAP.get(model_key, model_key)



TEACHER_MODEL_MAP: list[dict[str, str]] = [
    # OpenAI
    {"id": "openai/gpt-4o",       "name": "GPT-4o",            "provider": "OpenAI"},
    {"id": "openai/gpt-4o-mini",  "name": "GPT-4o Mini",       "provider": "OpenAI"},
    {"id": "openai/gpt-4-turbo",  "name": "GPT-4 Turbo",       "provider": "OpenAI"},
    {"id": "openai/o1",           "name": "o1",                "provider": "OpenAI"},
    {"id": "openai/o1-mini",      "name": "o1 Mini",           "provider": "OpenAI"},
    {"id": "openai/o3-mini",      "name": "o3 Mini",           "provider": "OpenAI"},
    # Anthropic
    {"id": "anthropic/claude-sonnet-4-20250514", "name": "Claude Sonnet 4", "provider": "Anthropic"},
    {"id": "anthropic/claude-3-5-sonnet-20241022", "name": "Claude 3.5 Sonnet", "provider": "Anthropic"},
    {"id": "anthropic/claude-3-5-haiku-20241022",  "name": "Claude 3.5 Haiku",  "provider": "Anthropic"},
    {"id": "anthropic/claude-3-opus-20240229",     "name": "Claude 3 Opus",     "provider": "Anthropic"},
    # Google
    {"id": "gemini/gemini-2.0-flash",   "name": "Gemini 2.0 Flash",   "provider": "Google"},
    {"id": "gemini/gemini-2.5-flash-preview-04-17", "name": "Gemini 2.5 Flash", "provider": "Google"},
    {"id": "gemini/gemini-1.5-pro",     "name": "Gemini 1.5 Pro",     "provider": "Google"},
    # DeepSeek
    {"id": "deepseek/deepseek-chat",      "name": "DeepSeek V3",      "provider": "DeepSeek"},
    {"id": "deepseek/deepseek-reasoner",  "name": "DeepSeek R1",      "provider": "DeepSeek"},
    # Groq
    {"id": "groq/llama-3.3-70b-versatile",  "name": "Llama 3.3 70B (Groq)",  "provider": "Groq"},
    {"id": "groq/llama-3.1-8b-instant",     "name": "Llama 3.1 8B (Groq)",   "provider": "Groq"},
    # Mistral
    {"id": "mistral/mistral-large-latest",  "name": "Mistral Large",   "provider": "Mistral"},
    {"id": "mistral/mistral-small-latest",  "name": "Mistral Small",   "provider": "Mistral"},
    # Together
    {"id": "together/meta-llama/Llama-3.3-70B-Instruct-Turbo", "name": "Llama 3.3 70B (Together)", "provider": "Together"},
    {"id": "together/Qwen/Qwen2.5-72B-Instruct-Turbo",         "name": "Qwen 2.5 72B (Together)",  "provider": "Together"},
]



class CurationAgentConfig(BaseModel):
    id: str
    enabled: bool = True
    threshold: Optional[float] = None


class DistillationConfig(BaseModel):
    """Configuration for a BOND distillation job."""
    base_model: str = Field(
        default="unsloth/Llama-3.2-1B-Instruct-bnb-4bit",
        description="Base model to fine-tune (HuggingFace path)",
    )
    teacher_model: str = Field(
        default="openai/gpt-4o",
        description="Teacher model for data generation (provider/model format)",
    )
    n_samples: int = Field(default=4, ge=2, le=16)
    num_prompts: int = Field(default=1000, ge=10, le=100000)
    training_steps: int = Field(default=500, ge=10, le=10000)
    bond_beta: float = Field(default=0.5, ge=0.0, le=1.0)
    bond_gamma: float = Field(default=0.1, ge=0.0, le=1.0)
    temperature: float = Field(default=0.8, ge=0.1, le=2.0)
    export_gguf: bool = Field(default=True)
    quantization_types: List[str] = Field(default=["q4_k_m", "q8_0"])

    # Frontend-aligned aliases
    student_model: Optional[str] = None
    curation_agents: Optional[List[CurationAgentConfig]] = None
    quantization: Optional[str] = None
    output_name: Optional[str] = None
    dataset_id: Optional[str] = None

    # In-process / standalone path — the pipeline reads prompts from here
    # when `opentracy.distill()` runs without a dataset stored in ClickHouse.
    prompts: Optional[List[Dict[str, Any]]] = Field(
        default=None,
        description="Inline prompts list: [{'id': str, 'text': str, 'system': str?}]. "
                    "Used by opentracy.distill() to skip the dataset lookup.",
    )

    @model_validator(mode="before")
    @classmethod
    def _replace_nulls(cls, data):
        if not isinstance(data, dict):
            return data
        defaults = {
            "n_samples": 4, "num_prompts": 1000, "training_steps": 500,
            "bond_beta": 0.5, "bond_gamma": 0.1, "temperature": 0.8,
        }
        for field, default in defaults.items():
            if field in data and data[field] is None:
                data[field] = default
        # Map student_model → base_model
        if data.get("student_model"):
            data["base_model"] = resolve_student_model(data["student_model"])
        # Map single quantization → quantization_types list
        if data.get("quantization") and not data.get("quantization_types"):
            data["quantization_types"] = [data["quantization"]]
        return data


class CreateJobRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    config: DistillationConfig = Field(default_factory=DistillationConfig)


class JobStatusResponse(BaseModel):
    id: str
    name: Optional[str] = None
    status: str
    phase: Optional[str] = None
    progress: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    created_at: str
    updated_at: str


class EstimateRequest(BaseModel):
    student_model: str = "llama-3.2-1b"
    num_prompts: int = 1000
    n_samples: int = 4
