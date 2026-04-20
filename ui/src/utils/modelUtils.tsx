import React from 'react';
import { MODEL_ICONS } from '../constants/models';
import type { ModelIcons } from '../types/modelTypes';

interface ProviderMap {
  provider: string;
  patterns: string[];
  iconKey: keyof typeof MODEL_ICONS;
  tokenKey: string;
  isBedrock?: boolean;
  bedrockPrefix?: string; // The prefix used by Bedrock for this provider (e.g., "anthropic.", "meta.")
}

const PROVIDERS_MAP: ProviderMap[] = [
  {
    provider: 'OpenAI',
    patterns: ['gpt', 'chatgpt', 'openai', 'davinci', 'babbage', 'o1', 'o3'],
    iconKey: 'openaiIcon',
    tokenKey: 'openai_api_key',
  },
  {
    provider: 'Anthropic',
    patterns: ['claude', 'anthropic'],
    iconKey: 'anthropicIcon',
    tokenKey: 'anthropic_api_key',
    isBedrock: true,
    bedrockPrefix: 'anthropic.',
  },
  {
    provider: 'Mistral',
    patterns: ['mistral', 'ministral', 'mixtral', 'pixtral', 'codestral', 'devstral', 'magistral'],
    iconKey: 'mistralIcon',
    tokenKey: 'mistral_api_key',
    isBedrock: true,
    bedrockPrefix: 'mistral.',
  },
  {
    provider: 'Google',
    patterns: ['gemini', 'gemma'],
    iconKey: 'geminiIcon',
    tokenKey: 'google_api_key',
  },
  {
    provider: 'Meta',
    patterns: ['llama', 'meta'],
    iconKey: 'metaIcon',
    tokenKey: 'meta_api_key',
    isBedrock: true,
    bedrockPrefix: 'meta.',
  },
  {
    provider: 'Cohere',
    patterns: ['command', 'cohere'],
    iconKey: 'cohereIcon',
    tokenKey: 'cohere_api_key',
    isBedrock: true,
    bedrockPrefix: 'cohere.',
  },
  {
    provider: 'Cerebras',
    patterns: ['cerebras', 'cerebrascloud'],
    iconKey: 'cerebrasIcon',
    tokenKey: 'cerebras_api_key',
  },
  {
    provider: 'DeepSeek',
    patterns: ['deepseek'],
    iconKey: 'deepseekIcon',
    tokenKey: 'deepseek_api_key',
    isBedrock: true,
    bedrockPrefix: 'deepseek.',
  },
  {
    provider: 'Qwen',
    patterns: ['qwen'],
    iconKey: 'qwenIcon',
    tokenKey: 'qwen_api_key',
    isBedrock: true,
    bedrockPrefix: 'qwen.',
  },
  {
    provider: 'Amazon',
    patterns: ['titan', 'amazon'],
    iconKey: 'bedrockIcon',
    tokenKey: 'bedrock_api_key',
    isBedrock: true,
    bedrockPrefix: 'amazon.',
  },
  {
    provider: 'Moonshot',
    patterns: ['kimi', 'moonshot'],
    iconKey: 'moonshotIcon',
    tokenKey: 'moonshot_api_key',
  },
  {
    provider: 'Perplexity',
    patterns: ['sonar', 'perplexity'],
    iconKey: 'perplexityIcon',
    tokenKey: 'perplexity_api_key',
  },
  {
    provider: 'Groq',
    patterns: ['groq', 'groqcloud', 'groq-api'],
    iconKey: 'groqIcon',
    tokenKey: 'groq_api_key',
  },
  {
    provider: 'SambaNova',
    patterns: ['sambanova'],
    iconKey: 'sambanovaIcon',
    tokenKey: 'sambanova_api_key',
  },
  {
    provider: 'Together',
    patterns: ['together'],
    iconKey: 'togetherIcon',
    tokenKey: 'together_api_key',
  },
  {
    provider: 'HuggingFace',
    patterns: ['huggingface', 'hf'],
    iconKey: 'huggingFaceIcon',
    tokenKey: 'huggingface_api_key',
  },
];

export const BACKEND_PROVIDER_ICONS: Record<string, string> = {
  openai: MODEL_ICONS.openaiIcon,
  anthropic: MODEL_ICONS.anthropicIcon,
  google: MODEL_ICONS.geminiIcon,
  mistral: MODEL_ICONS.mistralIcon,
  meta: MODEL_ICONS.metaIcon,
  cohere: MODEL_ICONS.cohereIcon,
  deepseek: MODEL_ICONS.deepseekIcon,
  groq: MODEL_ICONS.groqIcon,
  together: MODEL_ICONS.togetherIcon,
  perplexity: MODEL_ICONS.perplexityIcon,
  sambanova: MODEL_ICONS.sambanovaIcon,
  cerebras: MODEL_ICONS.cerebrasIcon,
  huggingface: MODEL_ICONS.huggingFaceIcon,
  opentracy: MODEL_ICONS.opentracyIcon,
  bedrock: MODEL_ICONS.bedrockIcon,
  amazon: MODEL_ICONS.bedrockIcon,
  aws: MODEL_ICONS.bedrockIcon,
};

// Provider display name mapping for formatting backend names
const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google',
  mistral: 'Mistral',
  meta: 'Meta',
  cohere: 'Cohere',
  deepseek: 'DeepSeek',
  groq: 'Groq',
  together: 'Together',
  perplexity: 'Perplexity',
  sambanova: 'SambaNova',
  cerebras: 'Cerebras',
  huggingface: 'HuggingFace',
  opentracy: 'OpenTracy',
  bedrock: 'bedrock',
  amazon: 'bedrock',
  aws: 'bedrock',
};

// Format backend name to human-readable provider name
export function formatProviderName(backend: string): string {
  const backendLower = backend?.toLowerCase() || '';
  return PROVIDER_DISPLAY_NAMES[backendLower] || backend;
}

// Gets provider icon for a trace. Prefer deriving from the model id because
// historical traces are known to have `backend='openai'` hard-coded even when
// the model is Claude / Mistral / etc. — trusting `backend` first painted
// every trace with the OpenAI icon. The model name is almost always correct
// (set by the caller based on what they actually requested), so match that
// first and only fall back to backend when the model name didn't tell us
// anything (findEarliestMatch returned the openai default).
export function getProviderIconByBackend(
  backend: string | undefined | null,
  modelId?: string
): string {
  if (modelId) {
    const modelLower = modelId.toLowerCase();

    // Bedrock is identified by the model id shape, not the provider field.
    if (isBedrockModel(modelId)) {
      return MODEL_ICONS.bedrockIcon;
    }

    const iconKey = findEarliestMatch<keyof typeof MODEL_ICONS>(modelLower, 'iconKey');
    if (iconKey) {
      return MODEL_ICONS[iconKey];
    }
  }

  // Model id didn't reveal the provider — trust the backend field if known.
  const backendLower = backend?.toLowerCase() || '';
  if (backendLower && BACKEND_PROVIDER_ICONS[backendLower]) {
    return BACKEND_PROVIDER_ICONS[backendLower];
  }

  // Last resort: the OpenTracy logo. Picking OpenAI as the generic default is
  // misleading — it's what caused every trace to look like OpenAI traffic.
  return MODEL_ICONS.opentracyIcon;
}

function findEarliestMatch<T>(modelLower: string, keyToReturn: keyof ProviderMap): T | undefined {
  let earliestMatchIndex = Infinity;
  let earliestMatchResult: T | undefined;

  for (const providerInfo of PROVIDERS_MAP) {
    for (const keyword of providerInfo.patterns) {
      const idx = modelLower.indexOf(keyword);

      if (idx !== -1 && idx < earliestMatchIndex) {
        earliestMatchIndex = idx;
        earliestMatchResult = providerInfo[keyToReturn] as T;

        if (idx === 0) {
          return earliestMatchResult;
        }
      }
    }
  }

  return earliestMatchResult;
}

export function getModelIcon(model: string): string {
  const modelLower = model.toLowerCase();

  // If it's a Bedrock model, return Bedrock icon
  if (isBedrockModel(model)) {
    return MODEL_ICONS.bedrockIcon;
  }

  // Fall back to the OpenTracy logo when the model id doesn't match any
  // known provider. Using openaiIcon here made every unrecognized model show
  // up as OpenAI in trace lists — actively misleading.
  const iconKey = findEarliestMatch<keyof typeof MODEL_ICONS>(modelLower, 'iconKey');
  return iconKey ? MODEL_ICONS[iconKey] : MODEL_ICONS.opentracyIcon;
}

export function isBedrockModel(model: string): boolean {
  const modelLower = model.toLowerCase();

  // Get all Bedrock prefixes from providers that have bedrockPrefix defined
  const bedrockPrefixes = PROVIDERS_MAP.filter((p) => p.isBedrock && p.bedrockPrefix).map(
    (p) => p.bedrockPrefix as string
  );

  // Check if model starts with any Bedrock prefix
  // Also check for regional prefixes like "us.anthropic." or "eu.meta."
  return bedrockPrefixes.some(
    (prefix) =>
      modelLower.startsWith(prefix) ||
      modelLower.match(new RegExp(`^[a-z]{2}\\.${prefix.replace('.', '\\.')}`))
  );
}

export function getModelIcons(model: string): ModelIcons {
  const isBedrock = isBedrockModel(model);

  // For Bedrock models, get the underlying provider icon (not the Bedrock icon)
  let providerIcon: string;
  if (isBedrock) {
    const modelLower = model.toLowerCase();
    const iconKey = findEarliestMatch<keyof typeof MODEL_ICONS>(modelLower, 'iconKey');
    providerIcon = iconKey ? MODEL_ICONS[iconKey] : MODEL_ICONS.bedrockIcon;
  } else {
    providerIcon = getModelIcon(model);
  }

  return {
    isBedrock,
    providerIcon,
    bedrockIcon: MODEL_ICONS.bedrockIcon,
  };
}

export function getCleanModelName(model: string): string {
  let cleanedModel = model;

  cleanedModel = cleanedModel.replace(/^(meta-llama|mistralai|deepseek-ai|moonshotai|qwen)\//i, '');

  for (const { patterns } of PROVIDERS_MAP) {
    const prefix = `${patterns[0]}.`;
    if (cleanedModel.toLowerCase().startsWith(prefix)) {
      cleanedModel = cleanedModel.substring(prefix.length);
      break;
    }
  }

  return cleanedModel.replace(/-v\d:\d/g, '');
}

export function getModelCategory(model: string): string {
  // If it's a Bedrock model, return "Bedrock" as category
  if (isBedrockModel(model)) {
    return 'Bedrock';
  }

  const modelLower = model.toLowerCase();
  const provider = findEarliestMatch<string>(modelLower, 'provider');
  return provider || 'Other';
}

export function guessTokenKey(model: string): string {
  const modelLower = model.toLowerCase();

  if (isBedrockModel(modelLower)) {
    return 'aws_credentials';
  }

  const tokenKey = findEarliestMatch<string>(modelLower, 'tokenKey');
  return tokenKey || 'openai_api_key';
}

export const simplifyDeploymentName = (name: string, modelId: string): string => {
  if (name.startsWith('ten-') && name.includes('-mdl-')) {
    const parts = name.split('-mdl-');
    if (parts.length > 1) {
      const modelNameParts = parts[1].split('-');
      return modelNameParts.slice(0, -1).join(' ').toUpperCase();
    }
  }

  if (modelId) {
    return modelId;
  }

  return name;
};

export function getProviderIcon(model: string, className: string = 'w-5 h-5'): React.ReactElement {
  const { providerIcon } = getModelIcons(model);

  return (
    <img
      src={providerIcon}
      alt="Provider icon"
      className={className}
      onError={(e) => {
        e.currentTarget.style.display = 'none';
      }}
    />
  );
}

/**
 * Checks if a model ID is a deployment (UUID format)
 */
export function isDeploymentModel(modelId: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(modelId);
}

/**
 * Gets the display name and icon for a model, handling deployments and bedrock models
 */
export function getModelDisplayInfo(modelId: string): {
  displayName: string;
  icon: string;
  provider: string;
  isDeployment: boolean;
  isBedrock: boolean;
} {
  // Check if it's a deployment (UUID)
  if (isDeploymentModel(modelId)) {
    return {
      displayName: 'OpenTracy',
      icon: MODEL_ICONS.opentracyIcon,
      provider: 'OpenTracy',
      isDeployment: true,
      isBedrock: false,
    };
  }

  // Check if it's a Bedrock model
  const isBedrock = isBedrockModel(modelId);

  // Get clean model name
  let displayName = modelId;
  if (modelId.includes('/')) {
    displayName = modelId.split('/')[1] || modelId;
  }
  displayName = getCleanModelName(displayName);

  // Get provider and icon
  const provider = getModelCategory(modelId);
  const { providerIcon } = getModelIcons(modelId);

  return {
    displayName,
    icon: providerIcon,
    provider,
    isDeployment: false,
    isBedrock,
  };
}

//Gets provider display info for dashboard charts
export function getProviderDisplayInfo(providerId: string): {
  displayName: string;
  icon: string;
} {
  const providerLower = providerId.toLowerCase();

  // Check if it's a deployment/OpenTracy
  if (providerLower === 'deployment' || providerLower === 'opentracy') {
    return {
      displayName: 'OpenTracy',
      icon: MODEL_ICONS.opentracyIcon,
    };
  }

  // Check if it's Bedrock
  if (
    providerLower === 'bedrock' ||
    providerLower === 'aws' ||
    providerLower === 'amazon' ||
    providerLower.startsWith('amazon.')
  ) {
    return {
      displayName: 'bedrock',
      icon: MODEL_ICONS.bedrockIcon,
    };
  }

  // Find provider in map
  const modelLower = providerLower;
  const iconKey = findEarliestMatch<keyof typeof MODEL_ICONS>(modelLower, 'iconKey');

  return {
    displayName: providerId,
    icon: iconKey ? MODEL_ICONS[iconKey] : MODEL_ICONS.openaiIcon,
  };
}
