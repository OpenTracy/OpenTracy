import { Cpu } from 'lucide-react';
import {
  OpenAI,
  Anthropic,
  Mistral,
  DeepSeek,
  Gemini,
  Meta,
  Cohere,
  Groq,
  Together,
  Qwen,
  Perplexity,
  Cerebras,
  SambaNova,
  HuggingFace,
  Moonshot,
  Bedrock,
} from '@lobehub/icons';

type LobeIcon = { Avatar: React.ComponentType<{ size?: number }> };

const MODEL_ICON_MAP: { patterns: string[]; icon: LobeIcon }[] = [
  {
    patterns: ['gpt', 'chatgpt', 'openai', 'davinci', 'o1', 'o3'],
    icon: OpenAI as unknown as LobeIcon,
  },
  { patterns: ['claude', 'anthropic'], icon: Anthropic as unknown as LobeIcon },
  {
    patterns: ['mistral', 'ministral', 'mixtral', 'pixtral', 'codestral', 'magistral'],
    icon: Mistral as unknown as LobeIcon,
  },
  { patterns: ['deepseek'], icon: DeepSeek as unknown as LobeIcon },
  { patterns: ['gemini', 'gemma'], icon: Gemini as unknown as LobeIcon },
  { patterns: ['llama', 'meta'], icon: Meta as unknown as LobeIcon },
  { patterns: ['command', 'cohere'], icon: Cohere as unknown as LobeIcon },
  { patterns: ['groq'], icon: Groq as unknown as LobeIcon },
  { patterns: ['together'], icon: Together as unknown as LobeIcon },
  { patterns: ['qwen'], icon: Qwen as unknown as LobeIcon },
  { patterns: ['sonar', 'perplexity'], icon: Perplexity as unknown as LobeIcon },
  { patterns: ['cerebras'], icon: Cerebras as unknown as LobeIcon },
  { patterns: ['sambanova'], icon: SambaNova as unknown as LobeIcon },
  { patterns: ['huggingface', 'hf'], icon: HuggingFace as unknown as LobeIcon },
  { patterns: ['kimi', 'moonshot'], icon: Moonshot as unknown as LobeIcon },
  { patterns: ['titan', 'amazon', 'bedrock'], icon: Bedrock as unknown as LobeIcon },
];

const BACKEND_ICON_MAP: Record<string, LobeIcon> = {
  openai: OpenAI as unknown as LobeIcon,
  anthropic: Anthropic as unknown as LobeIcon,
  mistral: Mistral as unknown as LobeIcon,
  deepseek: DeepSeek as unknown as LobeIcon,
  google: Gemini as unknown as LobeIcon,
  meta: Meta as unknown as LobeIcon,
  cohere: Cohere as unknown as LobeIcon,
  groq: Groq as unknown as LobeIcon,
  together: Together as unknown as LobeIcon,
  perplexity: Perplexity as unknown as LobeIcon,
  cerebras: Cerebras as unknown as LobeIcon,
  sambanova: SambaNova as unknown as LobeIcon,
  huggingface: HuggingFace as unknown as LobeIcon,
  bedrock: Bedrock as unknown as LobeIcon,
  amazon: Bedrock as unknown as LobeIcon,
  aws: Bedrock as unknown as LobeIcon,
};

function resolveByModelId(modelId: string): LobeIcon | null {
  const lower = modelId.toLowerCase();
  for (const entry of MODEL_ICON_MAP) {
    if (entry.patterns.some((p) => lower.includes(p))) return entry.icon;
  }
  return null;
}

function resolveByBackend(backend: string): LobeIcon | null {
  return BACKEND_ICON_MAP[backend.toLowerCase()] ?? null;
}

interface ProviderIconProps {
  modelId?: string;
  backend?: string;
  size?: number;
}

export function ProviderIcon({ modelId, backend, size = 16 }: ProviderIconProps) {
  const icon = modelId ? resolveByModelId(modelId) : backend ? resolveByBackend(backend) : null;

  if (icon) {
    const AvatarComp = icon.Avatar;
    return <AvatarComp size={size} />;
  }

  return <Cpu className="text-muted-foreground" style={{ width: size, height: size }} />;
}
