import qwenIcon from '../assets/qwen.svg';
import metaIcon from '../assets/meta.svg';
import deepseekIcon from '../assets/deepseek.svg';
import openaiIcon from '../assets/openai.svg';
import gemmaIcon from '../assets/gemma.svg';
import type { DeploymentModel, GPUInstanceType } from '../types/deploymentTypes';

export const MOCK_MODELS: DeploymentModel[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // Small models (1B-8B) - Tier XS
  // VRAM Formula: params × 2 bytes (FP16) + ~30% overhead for KV cache
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'Llama-3.2-1B',
    name: 'LLaMA 3.2 1B',
    description: 'Compact 1B parameter LLaMA model, designed for efficiency and experimentation.',
    features: ['LLM'],
    icon: metaIcon,
    availableInstances: ['gpu-xs', 'gpu-xs-2x'],
    recommendedInstance: 'gpu-xs',
    parameters: 1,
    vramRequired: { fp16: 3, int4: 1 },
  },
  {
    id: 'gemma-3-4b-it',
    name: 'Gemma 3 4B IT',
    description:
      'Instruction-tuned Gemma 3 model with 4B parameters, optimized for lightweight deployment and dialogue.',
    features: ['LLM'],
    icon: gemmaIcon,
    availableInstances: ['gpu-xs', 'gpu-xs-2x'],
    recommendedInstance: 'gpu-xs',
    parameters: 4,
    vramRequired: { fp16: 10, int4: 3 },
  },
  {
    id: 'Qwen3-4B-Instruct-2507',
    name: 'Qwen3 4B Instruct (2507)',
    description:
      'Instruction-tuned Qwen3 4B model, optimized for dialogue, reasoning, and lightweight deployments.',
    features: ['LLM'],
    icon: qwenIcon,
    availableInstances: ['gpu-xs', 'gpu-xs-2x'],
    recommendedInstance: 'gpu-xs',
    parameters: 4,
    vramRequired: { fp16: 10, int4: 3 },
  },
  {
    id: 'Qwen3-4B-Thinking-2507',
    name: 'Qwen3 4B Thinking (2507)',
    description:
      'Specialized Qwen3 4B model fine-tuned for chain-of-thought reasoning and step-by-step problem solving.',
    features: ['LLM'],
    icon: qwenIcon,
    availableInstances: ['gpu-xs', 'gpu-xs-2x'],
    recommendedInstance: 'gpu-xs',
    parameters: 4,
    vramRequired: { fp16: 10, int4: 3 },
  },
  {
    id: 'DeepSeek-R1-Distill-Qwen-7B',
    name: 'DeepSeek R1 Distill Qwen 7B',
    description:
      'Distilled version of Qwen 7B, fine-tuned for compact reasoning and instruction-following tasks.',
    features: ['LLM'],
    icon: deepseekIcon,
    availableInstances: ['gpu-xs', 'gpu-xs-2x', 'gpu-s', 'gpu-s-2x'],
    recommendedInstance: 'gpu-xs',
    parameters: 7,
    vramRequired: { fp16: 16, int4: 5 },
  },
  {
    id: 'DeepSeek-R1-Distill-Llama-8B',
    name: 'DeepSeek R1 Distill LLaMA 8B',
    description:
      'Distilled variant of LLaMA with 8B parameters, optimized for efficient reasoning and dialogue.',
    features: ['LLM'],
    icon: deepseekIcon,
    availableInstances: ['gpu-xs', 'gpu-xs-2x', 'gpu-s', 'gpu-s-2x'],
    recommendedInstance: 'gpu-xs',
    parameters: 8,
    vramRequired: { fp16: 18, int4: 6 },
  },
  {
    id: 'Llama-3.1-8B-Instruct',
    name: 'LLaMA 3.1 8B Instruct',
    description:
      'Highly capable 8B parameter LLaMA model, instruction-tuned for general-purpose tasks and dialogue.',
    features: ['LLM'],
    icon: metaIcon,
    availableInstances: ['gpu-xs', 'gpu-xs-2x', 'gpu-s', 'gpu-s-2x'],
    recommendedInstance: 'gpu-xs',
    parameters: 8,
    vramRequired: { fp16: 18, int4: 6 },
  },
  {
    id: 'Mistral-7B-Instruct-v0.3',
    name: 'Mistral 7B Instruct v0.3',
    description:
      'Efficient 7B parameter Mistral model with sliding window attention, optimized for instruction following.',
    features: ['LLM'],
    icon: metaIcon,
    availableInstances: ['gpu-xs', 'gpu-xs-2x'],
    recommendedInstance: 'gpu-xs',
    parameters: 7,
    vramRequired: { fp16: 16, int4: 5 },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // Medium models (13B-34B) - Tier S
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'Llama-3.1-13B-Instruct',
    name: 'LLaMA 3.1 13B Instruct',
    description: 'Mid-sized 13B parameter LLaMA model with strong reasoning capabilities.',
    features: ['LLM'],
    icon: metaIcon,
    availableInstances: ['gpu-s', 'gpu-s-2x', 'gpu-m'],
    recommendedInstance: 'gpu-s',
    parameters: 13,
    vramRequired: { fp16: 30, int4: 9 },
  },
  {
    id: 'CodeLlama-13b-Instruct-hf',
    name: 'CodeLlama 13B Instruct',
    description: 'Specialized 13B parameter model for code generation and programming tasks.',
    features: ['LLM', 'Code'],
    icon: metaIcon,
    availableInstances: ['gpu-s', 'gpu-s-2x'],
    recommendedInstance: 'gpu-s',
    parameters: 13,
    vramRequired: { fp16: 30, int4: 9 },
  },
  {
    id: 'Llama-4-Scout-17B-16E-Instruct',
    name: 'Llama 4 Scout 17B 16E Instruct',
    description:
      'Advanced 17B parameter Llama 4 Scout model with 16 experts, instruction-tuned for complex reasoning and multi-task performance.',
    features: ['LLM'],
    icon: metaIcon,
    availableInstances: ['gpu-s', 'gpu-s-2x', 'gpu-m', 'gpu-m-2x'],
    recommendedInstance: 'gpu-s',
    parameters: 17,
    vramRequired: { fp16: 38, int4: 12 },
  },
  {
    id: 'gpt-oss-20b',
    name: 'GPT OSS 20B',
    description:
      'Open-source 20B parameter model, optimized for advanced reasoning, code generation, and research workloads.',
    features: ['LLM'],
    icon: openaiIcon,
    availableInstances: ['gpu-s', 'gpu-s-2x', 'gpu-m', 'gpu-m-2x'],
    recommendedInstance: 'gpu-s',
    parameters: 20,
    vramRequired: { fp16: 44, int4: 14 },
  },
  {
    id: 'Qwen3-30B-A3B-Instruct-2507',
    name: 'Qwen3 30B A3B Instruct (2507)',
    description:
      'Large-scale Qwen3 model with 30B parameters, instruction-tuned for complex reasoning, coding, and multilingual tasks.',
    features: ['LLM'],
    icon: qwenIcon,
    availableInstances: ['gpu-s-2x', 'gpu-m', 'gpu-m-2x'],
    recommendedInstance: 'gpu-m',
    parameters: 30,
    vramRequired: { fp16: 66, int4: 20 },
  },
  {
    id: 'CodeLlama-34b-Instruct-hf',
    name: 'CodeLlama 34B Instruct',
    description: 'Large code-specialized model with 34B parameters for advanced programming tasks.',
    features: ['LLM', 'Code'],
    icon: metaIcon,
    availableInstances: ['gpu-s-2x', 'gpu-m', 'gpu-m-2x'],
    recommendedInstance: 'gpu-s-2x',
    parameters: 34,
    vramRequired: { fp16: 75, int4: 22 },
  },
  {
    id: 'Mixtral-8x7B-Instruct-v0.1',
    name: 'Mixtral 8x7B Instruct',
    description:
      'Sparse Mixture of Experts model with 8x7B architecture for efficient high-quality inference.',
    features: ['LLM', 'MoE'],
    icon: metaIcon,
    availableInstances: ['gpu-s-2x', 'gpu-m', 'gpu-m-2x'],
    recommendedInstance: 'gpu-m',
    parameters: 47, // Active params ~13B, total ~47B
    vramRequired: { fp16: 90, int4: 28 },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // Large models (70B INT4) - Tier M
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'Llama-3.1-70B-Instruct-AWQ',
    name: 'LLaMA 3.1 70B Instruct (AWQ)',
    description:
      '70B parameter LLaMA model quantized with AWQ for efficient deployment on 4x A10G GPUs.',
    features: ['LLM', 'Quantized'],
    icon: metaIcon,
    availableInstances: ['gpu-m', 'gpu-m-2x', 'gpu-m-4x'],
    recommendedInstance: 'gpu-m',
    parameters: 70,
    quantization: 'awq',
    vramRequired: { fp16: 154, int4: 50 },
  },
  {
    id: 'Qwen2-72B-Instruct-AWQ',
    name: 'Qwen2 72B Instruct (AWQ)',
    description:
      'Qwen2 72B model with AWQ quantization for balanced performance and resource efficiency.',
    features: ['LLM', 'Quantized'],
    icon: qwenIcon,
    availableInstances: ['gpu-m', 'gpu-m-2x', 'gpu-m-4x'],
    recommendedInstance: 'gpu-m',
    parameters: 72,
    quantization: 'awq',
    vramRequired: { fp16: 158, int4: 52 },
  },
  {
    id: 'DeepSeek-67B-Chat-AWQ',
    name: 'DeepSeek 67B Chat (AWQ)',
    description: "DeepSeek's 67B model with AWQ quantization for efficient chat and reasoning.",
    features: ['LLM', 'Quantized'],
    icon: deepseekIcon,
    availableInstances: ['gpu-m', 'gpu-m-2x', 'gpu-m-4x'],
    recommendedInstance: 'gpu-m',
    parameters: 67,
    quantization: 'awq',
    vramRequired: { fp16: 148, int4: 48 },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // Large models (70B FP16) - Tier L
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'Llama-3.1-70B-Instruct',
    name: 'LLaMA 3.1 70B Instruct',
    description:
      'State-of-the-art 70B parameter LLaMA model in full precision, instruction-tuned for advanced reasoning and complex tasks.',
    features: ['LLM'],
    icon: metaIcon,
    availableInstances: ['gpu-l', 'gpu-l-2x', 'gpu-l-4x', 'gpu-xl', 'gpu-xl-80'],
    recommendedInstance: 'gpu-l',
    parameters: 70,
    vramRequired: { fp16: 154, int4: 50 },
  },
  {
    id: 'Qwen2-72B-Instruct',
    name: 'Qwen2 72B Instruct',
    description:
      'Full precision Qwen2 72B with exceptional multilingual and reasoning capabilities.',
    features: ['LLM'],
    icon: qwenIcon,
    availableInstances: ['gpu-l', 'gpu-l-2x', 'gpu-l-4x', 'gpu-xl', 'gpu-xl-80'],
    recommendedInstance: 'gpu-l',
    parameters: 72,
    vramRequired: { fp16: 158, int4: 52 },
  },
  {
    id: 'DeepSeek-V3-70B',
    name: 'DeepSeek V3 70B',
    description:
      "DeepSeek's flagship 70B model with exceptional reasoning and coding capabilities.",
    features: ['LLM'],
    icon: deepseekIcon,
    availableInstances: ['gpu-l', 'gpu-l-2x', 'gpu-l-4x', 'gpu-xl', 'gpu-xl-80'],
    recommendedInstance: 'gpu-l',
    parameters: 70,
    vramRequired: { fp16: 154, int4: 50 },
  },
  {
    id: 'Mixtral-8x22B-Instruct-v0.1',
    name: 'Mixtral 8x22B Instruct',
    description: 'Large Mixture of Experts model with 8x22B architecture for maximum capability.',
    features: ['LLM', 'MoE'],
    icon: metaIcon,
    availableInstances: ['gpu-l-2x', 'gpu-l-4x', 'gpu-xl', 'gpu-xl-80'],
    recommendedInstance: 'gpu-l-2x',
    parameters: 141, // Total params
    vramRequired: { fp16: 280, int4: 85 },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // Extra Large models (180B) - Tier XL
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'Falcon-180B-Chat',
    name: 'Falcon 180B Chat',
    description:
      "TII's massive 180B parameter Falcon model with exceptional conversational capabilities.",
    features: ['LLM'],
    icon: metaIcon,
    availableInstances: ['gpu-xl', 'gpu-xl-80'],
    recommendedInstance: 'gpu-xl-80',
    parameters: 180,
    vramRequired: { fp16: 396, int4: 120 },
  },
  {
    id: 'DeepSeek-R1-180B',
    name: 'DeepSeek R1 180B',
    description:
      "DeepSeek's most powerful reasoning model with 180B parameters for complex problem solving.",
    features: ['LLM'],
    icon: deepseekIcon,
    availableInstances: ['gpu-xl', 'gpu-xl-80'],
    recommendedInstance: 'gpu-xl-80',
    parameters: 180,
    vramRequired: { fp16: 396, int4: 120 },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // Maximum models (405B) - Tier XXL
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'Llama-3.1-405B-Instruct-FP8',
    name: 'LLaMA 3.1 405B Instruct (FP8)',
    description:
      'The largest open LLaMA model with 405B parameters in FP8 precision for efficient H100 deployment.',
    features: ['LLM', 'Quantized'],
    icon: metaIcon,
    availableInstances: ['gpu-xxl'],
    recommendedInstance: 'gpu-xxl',
    parameters: 405,
    quantization: 'fp8',
    vramRequired: { fp16: 891, fp8: 500, int4: 270 },
  },
  {
    id: 'Llama-3.1-405B-Instruct',
    name: 'LLaMA 3.1 405B Instruct',
    description:
      'The largest open LLaMA model with 405B parameters in full precision. Requires H200 GPUs.',
    features: ['LLM'],
    icon: metaIcon,
    availableInstances: ['gpu-xxl-h200'],
    recommendedInstance: 'gpu-xxl-h200',
    parameters: 405,
    vramRequired: { fp16: 891, fp8: 500, int4: 270 },
  },
  {
    id: 'DBRX-132B-Instruct',
    name: 'DBRX 132B Instruct',
    description:
      "Databricks' 132B parameter model with state-of-the-art capabilities for enterprise workloads.",
    features: ['LLM'],
    icon: metaIcon,
    availableInstances: ['gpu-xxl', 'gpu-xxl-h200'],
    recommendedInstance: 'gpu-xxl',
    parameters: 132,
    vramRequired: { fp16: 290, int4: 88 },
  },
];

export const INSTANCE_TYPES: GPUInstanceType[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // TIER XS - Entry Level (7B-13B models)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'gpu-xs',
    name: 'GPU XS',
    tier: 'XS',
    ec2Instance: 'g6.xlarge',
    gpus: '1x NVIDIA L4',
    memory: '24GB VRAM',
    description: 'Entry-level GPU for 7B-8B parameter models (FP16) or 13B (INT4/INT8).',
    specs: {
      gpu: 'NVIDIA L4',
      vram: '24GB',
      vCPUs: 4,
      ram: '16GB',
      storage: '250GB NVMe',
      network: '10 Gbps',
      spotPrice: '~$0.20/h',
      modelSize: '7B - 13B',
      gpuCount: 1,
      tensorParallelSize: 1,
    },
  },
  {
    id: 'gpu-xs-2x',
    name: 'GPU XS (2x)',
    tier: 'XS',
    ec2Instance: 'g6.2xlarge',
    gpus: '1x NVIDIA L4',
    memory: '24GB VRAM',
    description: 'Entry-level GPU with more CPU/RAM for 7B-8B parameter models.',
    specs: {
      gpu: 'NVIDIA L4',
      vram: '24GB',
      vCPUs: 8,
      ram: '32GB',
      storage: '450GB NVMe',
      network: '15 Gbps',
      spotPrice: '~$0.35/h',
      modelSize: '7B - 13B',
      gpuCount: 1,
      tensorParallelSize: 1,
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TIER S - Small Production (13B-30B models)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'gpu-s',
    name: 'GPU S',
    tier: 'S',
    ec2Instance: 'g6e.xlarge',
    gpus: '1x NVIDIA L40S',
    memory: '48GB VRAM',
    description: 'Small GPU for 13B (FP16) or 30B-34B (INT4) parameter models.',
    recommended: true,
    specs: {
      gpu: 'NVIDIA L40S',
      vram: '48GB',
      vCPUs: 4,
      ram: '16GB',
      storage: '250GB NVMe',
      network: '10 Gbps',
      spotPrice: '~$0.60/h',
      modelSize: '13B - 34B',
      gpuCount: 1,
      tensorParallelSize: 1,
    },
  },
  {
    id: 'gpu-s-2x',
    name: 'GPU S (2x)',
    tier: 'S',
    ec2Instance: 'g6e.2xlarge',
    gpus: '1x NVIDIA L40S',
    memory: '48GB VRAM',
    description: 'Small GPU with more CPU/RAM for 13B-34B parameter models.',
    specs: {
      gpu: 'NVIDIA L40S',
      vram: '48GB',
      vCPUs: 8,
      ram: '32GB',
      storage: '450GB NVMe',
      network: '15 Gbps',
      spotPrice: '~$1.00/h',
      modelSize: '13B - 34B',
      gpuCount: 1,
      tensorParallelSize: 1,
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TIER M - Medium Production (30B-70B INT4 models)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'gpu-m',
    name: 'GPU M',
    tier: 'M',
    ec2Instance: 'g5.12xlarge',
    gpus: '4x NVIDIA A10G',
    memory: '96GB VRAM',
    description: 'Medium multi-GPU for 70B (INT4/INT8) or Mixtral 8x7B (FP16) models.',
    specs: {
      gpu: '4x NVIDIA A10G',
      vram: '96GB',
      vCPUs: 48,
      ram: '192GB',
      storage: '3.8TB NVMe',
      network: '40 Gbps',
      spotPrice: '~$1.80/h',
      modelSize: '30B - 70B INT4',
      gpuCount: 4,
      tensorParallelSize: 4,
    },
  },
  {
    id: 'gpu-m-2x',
    name: 'GPU M (2x)',
    tier: 'M',
    ec2Instance: 'g5.24xlarge',
    gpus: '4x NVIDIA A10G',
    memory: '96GB VRAM',
    description: 'Medium multi-GPU with more CPU/RAM for 70B (INT4) models.',
    specs: {
      gpu: '4x NVIDIA A10G',
      vram: '96GB',
      vCPUs: 96,
      ram: '384GB',
      storage: '3.8TB NVMe',
      network: '50 Gbps',
      spotPrice: '~$3.00/h',
      modelSize: '30B - 70B INT4',
      gpuCount: 4,
      tensorParallelSize: 4,
    },
  },
  {
    id: 'gpu-m-4x',
    name: 'GPU M (4x)',
    tier: 'M',
    ec2Instance: 'g5.48xlarge',
    gpus: '8x NVIDIA A10G',
    memory: '192GB VRAM',
    description: 'Large A10G configuration for 70B (INT4) with more throughput.',
    specs: {
      gpu: '8x NVIDIA A10G',
      vram: '192GB',
      vCPUs: 192,
      ram: '768GB',
      storage: '7.6TB NVMe',
      network: '100 Gbps',
      spotPrice: '~$5.00/h',
      modelSize: '30B - 70B INT4',
      gpuCount: 8,
      tensorParallelSize: 4,
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TIER L - Large Production (70B FP16 models)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'gpu-l',
    name: 'GPU L',
    tier: 'L',
    ec2Instance: 'g6e.12xlarge',
    gpus: '4x NVIDIA L40S',
    memory: '192GB VRAM',
    description: 'Large multi-GPU for 70B (FP16) or Mixtral 8x22B (INT4) models.',
    specs: {
      gpu: '4x NVIDIA L40S',
      vram: '192GB',
      vCPUs: 48,
      ram: '384GB',
      storage: '3.8TB NVMe',
      network: '40 Gbps',
      spotPrice: '~$3.50/h',
      modelSize: '70B FP16',
      gpuCount: 4,
      tensorParallelSize: 4,
    },
  },
  {
    id: 'gpu-l-2x',
    name: 'GPU L (2x)',
    tier: 'L',
    ec2Instance: 'g6e.24xlarge',
    gpus: '4x NVIDIA L40S',
    memory: '192GB VRAM',
    description: 'Large multi-GPU with more CPU/RAM for 70B (FP16) models.',
    specs: {
      gpu: '4x NVIDIA L40S',
      vram: '192GB',
      vCPUs: 96,
      ram: '768GB',
      storage: '3.8TB NVMe',
      network: '50 Gbps',
      spotPrice: '~$6.00/h',
      modelSize: '70B FP16',
      gpuCount: 4,
      tensorParallelSize: 4,
    },
  },
  {
    id: 'gpu-l-4x',
    name: 'GPU L (4x)',
    tier: 'L',
    ec2Instance: 'g6e.48xlarge',
    gpus: '8x NVIDIA L40S',
    memory: '384GB VRAM',
    description: 'Maximum L40S configuration for 70B (FP16) with large KV cache.',
    specs: {
      gpu: '8x NVIDIA L40S',
      vram: '384GB',
      vCPUs: 192,
      ram: '1536GB',
      storage: '7.6TB NVMe',
      network: '100 Gbps',
      spotPrice: '~$10.00/h',
      modelSize: '70B FP16',
      gpuCount: 8,
      tensorParallelSize: 4,
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TIER XL - Enterprise (70B-180B models)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'gpu-xl',
    name: 'GPU XL',
    tier: 'XL',
    ec2Instance: 'p4d.24xlarge',
    gpus: '8x NVIDIA A100 (40GB)',
    memory: '320GB VRAM',
    description: 'Enterprise setup with NVLink for 70B+ or 405B (FP8/INT4) models.',
    specs: {
      gpu: '8x NVIDIA A100 (40GB)',
      vram: '320GB',
      vCPUs: 96,
      ram: '1152GB',
      storage: '8TB NVMe',
      network: '400 Gbps EFA',
      spotPrice: '~$12.00/h',
      modelSize: '70B - 180B',
      gpuCount: 8,
      tensorParallelSize: 8,
    },
  },
  {
    id: 'gpu-xl-80',
    name: 'GPU XL (80GB)',
    tier: 'XL',
    ec2Instance: 'p4de.24xlarge',
    gpus: '8x NVIDIA A100 (80GB)',
    memory: '640GB VRAM',
    description: 'High-memory A100 setup for larger models and KV cache.',
    specs: {
      gpu: '8x NVIDIA A100 (80GB)',
      vram: '640GB',
      vCPUs: 96,
      ram: '1152GB',
      storage: '8TB NVMe',
      network: '400 Gbps EFA',
      spotPrice: '~$18.00/h',
      modelSize: '70B - 180B+',
      gpuCount: 8,
      tensorParallelSize: 8,
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TIER XXL - Colossal (405B models)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'gpu-xxl',
    name: 'GPU XXL',
    tier: 'XXL',
    ec2Instance: 'p5.48xlarge',
    gpus: '8x NVIDIA H100 (80GB)',
    memory: '640GB VRAM',
    description: 'Maximum H100 performance for 405B (FP8) models with NVSwitch.',
    specs: {
      gpu: '8x NVIDIA H100 (80GB)',
      vram: '640GB',
      vCPUs: 192,
      ram: '2048GB',
      storage: '8TB NVMe',
      network: '3200 Gbps EFA v2',
      spotPrice: '~$20.00/h',
      modelSize: '405B FP8',
      gpuCount: 8,
      tensorParallelSize: 8,
    },
  },
  {
    id: 'gpu-xxl-h200',
    name: 'GPU XXL (H200)',
    tier: 'XXL',
    ec2Instance: 'p5e.48xlarge',
    gpus: '8x NVIDIA H200 (141GB)',
    memory: '1128GB VRAM',
    description: 'Ultra high-memory H200 for 405B (FP16) with maximum context.',
    specs: {
      gpu: '8x NVIDIA H200 (141GB)',
      vram: '1128GB',
      vCPUs: 192,
      ram: '2048GB',
      storage: '8TB NVMe',
      network: '3200 Gbps EFA v2',
      spotPrice: '~$30.00/h',
      modelSize: '405B FP16',
      gpuCount: 8,
      tensorParallelSize: 8,
    },
  },
];

export const DEPLOYMENT_ACTIVATION_DELAY = 60 * 60 * 1000;
