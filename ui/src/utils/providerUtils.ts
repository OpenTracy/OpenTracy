// Mapeamento de modelos para provedores
export function getProviderFromModel(model: string): string {
  // OpenAI models
  if (
    model.startsWith('gpt-') ||
    model.startsWith('o1-') ||
    model.startsWith('o3-') ||
    model.includes('chatgpt') ||
    model.includes('davinci') ||
    model.includes('babbage')
  ) {
    return 'openai';
  }

  // Mistral API models
  if (model.startsWith('mistral-') || model.startsWith('ministral-')) {
    return 'mistral';
  }

  // DeepSeek API models
  if (model.startsWith('deepseek-')) {
    return 'deepseek';
  }

  // Anthropic API models
  if (model.startsWith('claude-') && !model.includes('anthropic.')) {
    return 'anthropic';
  }

  // Gemini models
  if (model.startsWith('gemini-') || model.includes('gemini')) {
    return 'gemini';
  }

  // Cohere models
  if (model.startsWith('command-') || model.includes('cohere')) {
    return 'cohere';
  }

  // Groq models
  if (model.includes('groq') || model.startsWith('llama') || model.startsWith('mixtral')) {
    return 'groq';
  }

  // Perplexity models
  if (model.includes('perplexity') || model.startsWith('pplx-')) {
    return 'perplexity';
  }

  // SambaNova models
  if (model.includes('sambanova') || model.startsWith('samba-')) {
    return 'sambanova';
  }

  // Together AI models
  if (model.includes('together') || model.startsWith('meta-llama')) {
    return 'togetherai';
  }

  // Cerebras models
  if (model.includes('cerebras')) {
    return 'cerebras';
  }

  // AWS Bedrock models
  if (
    model.includes('.') &&
    (model.includes('anthropic.') ||
      model.includes('mistral.') ||
      model.includes('meta.') ||
      model.includes('deepseek.') ||
      model.includes('amazon.'))
  ) {
    return 'bedrock';
  }

  // Default fallback
  console.warn(`Unknown provider for model: ${model}`);
  return 'openai'; // Default to OpenAI
}

// Função para verificar se um modelo é do Bedrock
export function isBedrockModel(model: string): boolean {
  return (
    model.includes('.') &&
    (model.includes('anthropic.') ||
      model.includes('mistral.') ||
      model.includes('meta.') ||
      model.includes('deepseek.') ||
      model.includes('amazon.'))
  );
}

// Função para extrair o nome do modelo sem o prefixo do provedor
export function getModelName(model: string): string {
  if (isBedrockModel(model)) {
    return model; // Para Bedrock, mantemos o nome completo
  }
  return model;
}

// Mapeamento de provedores para nomes de display
export const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  deepseek: 'DeepSeek',
  mistral: 'Mistral',
  gemini: 'Google Gemini',
  cohere: 'Cohere',
  groq: 'Groq',
  perplexity: 'Perplexity',
  sambanova: 'SambaNova',
  togetherai: 'Together AI',
  cerebras: 'Cerebras',
  bedrock: 'AWS Bedrock',
};

export function getProviderDisplayName(provider: string): string {
  return PROVIDER_DISPLAY_NAMES[provider] || provider;
}
