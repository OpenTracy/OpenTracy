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

function resolveModelIcon(modelId: string): LobeIcon | null {
  const lower = modelId.toLowerCase();
  for (const entry of MODEL_ICON_MAP) {
    if (entry.patterns.some((p) => lower.includes(p))) return entry.icon;
  }
  return null;
}

export function ModelIcon({ modelId }: { modelId: string }) {
  const icon = resolveModelIcon(modelId);
  if (icon) {
    const AvatarComp = icon.Avatar;
    return <AvatarComp size={20} />;
  }
  return (
    <div className="size-5 rounded-full bg-muted flex items-center justify-center">
      <Cpu className="size-3 text-muted-foreground" />
    </div>
  );
}
