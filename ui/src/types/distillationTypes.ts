// Distillation Job Types

export type DistillationStatus =
  | 'pending'
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';
export type DistillationPhase =
  | 'initializing'
  | 'data_generation'
  | 'curation'
  | 'training'
  | 'export'
  | 'completed';

// =============================================================================
// Backend response types (what the API returns)
// =============================================================================

export interface BackendJobStatus {
  id: string;
  name?: string;
  status: string;
  phase?: string;
  progress?: Record<string, Record<string, unknown>>;
  error?: string;
  created_at: string;
  updated_at: string;
  config?: Record<string, unknown>;
  cost_accrued?: number;
}

export interface BackendJobDetails extends BackendJobStatus {
  tenant_id: string;
  description?: string;
  config: Record<string, unknown>;
  artifacts?: Record<string, unknown>;
  results?: {
    quality_score?: number;
    cost_savings?: number;
    speed_improvement?: number;
    sample_comparisons?: SampleComparison[];
    model_artifact_url?: string;
    gguf_download_url?: string;
  } | null;
  cost_accrued: number;
  started_at?: string;
  completed_at?: string;
}

export interface CurationAgentConfig {
  id: 'quality' | 'difficulty' | 'consensus';
  enabled: boolean;
  threshold?: number;
}

export interface DistillationConfig {
  teacher_model: string;
  student_model: string;
  target_device: string;
  dataset_id: string;
  n_samples: number;
  temperature: number;
  curation_agents: CurationAgentConfig[];
  quantization: string;
  output_name: string;
  training_steps?: number;
  num_prompts?: number;
  base_model?: string;
  quantization_types?: string[];
  export_gguf?: boolean;
}

export interface DistillationProgress {
  phase: DistillationPhase;
  phase_progress: number; // 0-100
  overall_progress: number; // 0-100
  candidates_generated?: number;
  candidates_total?: number;
  samples_curated?: number;
  training_loss?: number;
  validation_loss?: number;
  training_epoch?: number;
  total_epochs?: number;
  current_step?: number;
  total_steps?: number;
  current_log?: string;
}

export interface DiffSegment {
  type: 'match' | 'insert' | 'delete';
  text: string;
}

export interface SampleComparison {
  prompt: string;
  response?: string;
  teacher_response?: string;
  student_response?: string;
  similarity_score?: number;
  diff_highlights?: DiffSegment[];
}

export interface AvailableTeacherModel {
  id: string;
  name: string;
  provider: string;
  type: 'external' | 'deployment' | 'registered' | 'deployed';
  available: boolean;
  providers?: string[];
}

export interface GGUFArtifact {
  key: string;
  size: number;
  url: string;
  expires_in: number;
}

export interface DistillationResults {
  quality_score: number; // vs teacher (0-1)
  cost_savings: number; // percentage
  speed_improvement: number; // multiplier
  sample_comparisons: SampleComparison[];
  model_artifact_url?: string;
  gguf_download_url?: string;
}

export interface DistillationJob {
  id: string;
  name: string;
  status: DistillationStatus;
  phase: DistillationPhase;
  config: DistillationConfig;
  progress: DistillationProgress;
  results?: DistillationResults;
  cost_accrued: number;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  error?: { code: string; message: string };
}

export interface CreateDistillationJobRequest {
  name: string;
  config: DistillationConfig;
}

// Teacher Models
export const TEACHER_MODELS = [
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'OpenAI',
    quality: 'highest' as const,
    cost_per_1k: 0.005,
  },
  {
    id: 'gpt-4-turbo',
    name: 'GPT-4 Turbo',
    provider: 'OpenAI',
    quality: 'high' as const,
    cost_per_1k: 0.01,
  },
  {
    id: 'claude-3-opus',
    name: 'Claude 3 Opus',
    provider: 'Anthropic',
    quality: 'highest' as const,
    cost_per_1k: 0.015,
  },
  {
    id: 'claude-3.5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'Anthropic',
    quality: 'high' as const,
    cost_per_1k: 0.003,
  },
];

// Student Models (bnb-4bit, fits on A10G 24GB VRAM)
export interface StudentModel {
  id: string;
  name: string;
  params: string;
  memory: string;
  family: string;
}

export const STUDENT_MODEL_FAMILIES = [
  'Llama',
  'Qwen 3',
  'Qwen 2.5',
  'Qwen 2.5 Coder',
  'Gemma',
  'Mistral',
  'Phi',
  'DeepSeek R1',
  'SmolLM',
  'Granite',
] as const;

export const STUDENT_MODELS: StudentModel[] = [
  // Llama
  { id: 'llama-3.2-1b', name: 'Llama 3.2 1B', params: '1B', memory: '~2GB', family: 'Llama' },
  { id: 'llama-3.2-3b', name: 'Llama 3.2 3B', params: '3B', memory: '~4GB', family: 'Llama' },
  { id: 'llama-3.1-8b', name: 'Llama 3.1 8B', params: '8B', memory: '~8GB', family: 'Llama' },
  // Qwen 3
  { id: 'qwen3-0.6b', name: 'Qwen 3 0.6B', params: '0.6B', memory: '~1GB', family: 'Qwen 3' },
  { id: 'qwen3-1.7b', name: 'Qwen 3 1.7B', params: '1.7B', memory: '~2GB', family: 'Qwen 3' },
  { id: 'qwen3-4b', name: 'Qwen 3 4B', params: '4B', memory: '~4GB', family: 'Qwen 3' },
  { id: 'qwen3-8b', name: 'Qwen 3 8B', params: '8B', memory: '~8GB', family: 'Qwen 3' },
  { id: 'qwen3-14b', name: 'Qwen 3 14B', params: '14B', memory: '~12GB', family: 'Qwen 3' },
  // Qwen 2.5
  { id: 'qwen2.5-0.5b', name: 'Qwen 2.5 0.5B', params: '0.5B', memory: '~1GB', family: 'Qwen 2.5' },
  { id: 'qwen2.5-1.5b', name: 'Qwen 2.5 1.5B', params: '1.5B', memory: '~2GB', family: 'Qwen 2.5' },
  { id: 'qwen2.5-3b', name: 'Qwen 2.5 3B', params: '3B', memory: '~4GB', family: 'Qwen 2.5' },
  { id: 'qwen2.5-7b', name: 'Qwen 2.5 7B', params: '7B', memory: '~6GB', family: 'Qwen 2.5' },
  { id: 'qwen2.5-14b', name: 'Qwen 2.5 14B', params: '14B', memory: '~12GB', family: 'Qwen 2.5' },
  // Qwen 2.5 Coder
  {
    id: 'qwen2.5-coder-1.5b',
    name: 'Qwen 2.5 Coder 1.5B',
    params: '1.5B',
    memory: '~2GB',
    family: 'Qwen 2.5 Coder',
  },
  {
    id: 'qwen2.5-coder-3b',
    name: 'Qwen 2.5 Coder 3B',
    params: '3B',
    memory: '~4GB',
    family: 'Qwen 2.5 Coder',
  },
  {
    id: 'qwen2.5-coder-7b',
    name: 'Qwen 2.5 Coder 7B',
    params: '7B',
    memory: '~6GB',
    family: 'Qwen 2.5 Coder',
  },
  {
    id: 'qwen2.5-coder-14b',
    name: 'Qwen 2.5 Coder 14B',
    params: '14B',
    memory: '~12GB',
    family: 'Qwen 2.5 Coder',
  },
  // Gemma
  { id: 'gemma-3-1b', name: 'Gemma 3 1B', params: '1B', memory: '~2GB', family: 'Gemma' },
  { id: 'gemma-3-4b', name: 'Gemma 3 4B', params: '4B', memory: '~4GB', family: 'Gemma' },
  { id: 'gemma-3-12b', name: 'Gemma 3 12B', params: '12B', memory: '~10GB', family: 'Gemma' },
  { id: 'gemma-2-2b', name: 'Gemma 2 2B', params: '2B', memory: '~3GB', family: 'Gemma' },
  { id: 'gemma-2-9b', name: 'Gemma 2 9B', params: '9B', memory: '~8GB', family: 'Gemma' },
  // Mistral
  {
    id: 'mistral-7b-v0.3',
    name: 'Mistral 7B v0.3',
    params: '7B',
    memory: '~6GB',
    family: 'Mistral',
  },
  {
    id: 'mistral-nemo-12b',
    name: 'Mistral NeMo 12B',
    params: '12B',
    memory: '~10GB',
    family: 'Mistral',
  },
  // Phi
  { id: 'phi-4-mini', name: 'Phi-4 Mini', params: '3.8B', memory: '~4GB', family: 'Phi' },
  { id: 'phi-4', name: 'Phi-4', params: '14B', memory: '~12GB', family: 'Phi' },
  { id: 'phi-3.5-mini', name: 'Phi-3.5 Mini', params: '3.8B', memory: '~4GB', family: 'Phi' },
  // DeepSeek R1 Distillations
  {
    id: 'deepseek-r1-qwen-1.5b',
    name: 'DeepSeek R1 Qwen 1.5B',
    params: '1.5B',
    memory: '~2GB',
    family: 'DeepSeek R1',
  },
  {
    id: 'deepseek-r1-qwen-7b',
    name: 'DeepSeek R1 Qwen 7B',
    params: '7B',
    memory: '~6GB',
    family: 'DeepSeek R1',
  },
  {
    id: 'deepseek-r1-qwen-14b',
    name: 'DeepSeek R1 Qwen 14B',
    params: '14B',
    memory: '~12GB',
    family: 'DeepSeek R1',
  },
  {
    id: 'deepseek-r1-llama-8b',
    name: 'DeepSeek R1 Llama 8B',
    params: '8B',
    memory: '~8GB',
    family: 'DeepSeek R1',
  },
  // SmolLM
  { id: 'smollm2-1.7b', name: 'SmolLM2 1.7B', params: '1.7B', memory: '~2GB', family: 'SmolLM' },
  { id: 'smollm3-3b', name: 'SmolLM3 3B', params: '3B', memory: '~4GB', family: 'SmolLM' },
  // Granite
  { id: 'granite-3.2-2b', name: 'Granite 3.2 2B', params: '2B', memory: '~3GB', family: 'Granite' },
  { id: 'granite-3.2-8b', name: 'Granite 3.2 8B', params: '8B', memory: '~8GB', family: 'Granite' },
];

// Target Devices
export const TARGET_DEVICES = [
  { id: 'nvidia-a100', name: 'NVIDIA A100', vram: '80GB' },
  { id: 'nvidia-h100', name: 'NVIDIA H100', vram: '80GB' },
  { id: 'nvidia-l4', name: 'NVIDIA L4', vram: '24GB' },
  { id: 'nvidia-t4', name: 'NVIDIA T4', vram: '16GB' },
];

// Quantization Options
export const QUANTIZATION_OPTIONS = [
  { id: 'q2_k', name: 'Q2_K (2-bit)', size: '~550MB', quality: 2, recommended: false },
  { id: 'q4_k_m', name: 'Q4_K_M (4-bit)', size: '~770MB', quality: 4, recommended: true },
  { id: 'q6_k', name: 'Q6_K (6-bit)', size: '~1.1GB', quality: 5, recommended: false },
  { id: 'q8_0', name: 'Q8_0 (8-bit)', size: '~1.3GB', quality: 5, recommended: false },
];

// Curation Agents
export const CURATION_AGENTS = [
  {
    id: 'quality' as const,
    name: 'Quality Agent',
    description: 'Evaluates response quality (0.0-1.0) using LLM-as-Judge',
    details: 'Criteria: clarity, completeness, accuracy',
  },
  {
    id: 'difficulty' as const,
    name: 'Difficulty Agent',
    description: 'Classifies complexity (easy/medium/hard)',
    details: 'Based on: length, technical terms, structure',
  },
  {
    id: 'consensus' as const,
    name: 'Consensus Agent',
    description: 'Cross-validation (0.0-1.0) between instruction/response',
    details: 'Detects hallucinations and inconsistencies',
  },
];
