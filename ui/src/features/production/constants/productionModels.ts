import { DeepSeek, Gemma, HuggingFace, Meta, OpenAI, Qwen } from '@lobehub/icons';
import type { SVGProps } from 'react';

type ModelIcon = React.ComponentType<SVGProps<SVGSVGElement>>;

interface ProductionModel {
  readonly keywords: string[];
  readonly icon: ModelIcon;
}

const PRODUCTION_MODELS: ProductionModel[] = [
  {
    keywords: ['llama', 'codellama'],
    icon: Meta,
  },
  {
    keywords: ['qwen'],
    icon: Qwen,
  },
  {
    keywords: ['deepseek'],
    icon: DeepSeek,
  },
  {
    keywords: ['gpt', 'openai'],
    icon: OpenAI,
  },
  {
    keywords: ['gemma'],
    icon: Gemma,
  },
  {
    keywords: ['huggingface', 'hugging-face'],
    icon: HuggingFace,
  },
];

export function resolveModelIcon(
  source: string,
  modelId: string,
  modelName: string
): ModelIcon | null {
  if (source === 'huggingface') {
    return HuggingFace;
  }

  const haystack = `${modelId} ${modelName}`.toLowerCase();
  for (const { keywords, icon } of PRODUCTION_MODELS) {
    if (keywords.some((kw) => haystack.includes(kw))) {
      return icon;
    }
  }

  return null;
}
