import { API_BASE_URL } from '../config/api';

export interface SecretPayload {
  name: string; // ex: "OPENAI_API_KEY"
  api_key: string; // ex: "sk-xxx..."
  description?: string;
}

export interface SecretResponse {
  message: string;
  secret_id: string; // ex: "openai_api_key"
  name: string;
}

// Mapeamento de provider para nome do secret
const PROVIDER_SECRET_NAMES: Record<string, string> = {
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  deepseek: 'DEEPSEEK_API_KEY',
  gemini: 'GEMINI_API_KEY',
  cohere: 'COHERE_API_KEY',
  groq: 'GROQ_API_KEY',
  together: 'TOGETHER_API_KEY',
  togetherai: 'TOGETHER_API_KEY',
  perplexity: 'PERPLEXITY_API_KEY',
  sambanova: 'SAMBANOVA_API_KEY',
  cerebras: 'CEREBRAS_API_KEY',
  mistral: 'MISTRAL_API_KEY',
  huggingface: 'HUGGINGFACE_API_KEY',
  bedrock: 'BEDROCK_API_KEY',
  aws: 'BEDROCK_API_KEY', // alias for bedrock
  amazon: 'BEDROCK_API_KEY', // alias for bedrock
  azure: 'AZURE_API_KEY',
};

// Mapeamento de provider para secret_id (usado no DELETE)
const PROVIDER_SECRET_IDS: Record<string, string> = {
  openai: 'openai_api_key',
  anthropic: 'anthropic_api_key',
  deepseek: 'deepseek_api_key',
  gemini: 'gemini_api_key',
  cohere: 'cohere_api_key',
  groq: 'groq_api_key',
  together: 'together_api_key',
  togetherai: 'together_api_key',
  perplexity: 'perplexity_api_key',
  sambanova: 'sambanova_api_key',
  cerebras: 'cerebras_api_key',
  mistral: 'mistral_api_key',
  huggingface: 'huggingface_api_key',
  bedrock: 'bedrock_api_key',
  aws: 'bedrock_api_key', // alias for bedrock
  amazon: 'bedrock_api_key', // alias for bedrock
  azure: 'azure_api_key',
};

export interface TenantSecretsResponse {
  secrets?: Array<{
    secret_id: string;
    name: string;
    description?: string;
    created_at: string;
  }>;
  configured_providers?: string[];
}

export async function getTenantSecrets(accessToken: string): Promise<TenantSecretsResponse> {
  if (!accessToken) {
    throw new Error('accessToken is required');
  }

  console.log('[TenantSecrets] Fetching configured secrets');

  const res = await fetch(`${API_BASE_URL}/v1/secrets`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Error to search secrets: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  console.log('[TenantSecrets] Secrets fetched:', data);

  // Transformar para formato compatível com a interface antiga (configured_providers)
  if (data.secrets && Array.isArray(data.secrets)) {
    const providers = data.secrets
      .map((s: any) => {
        // Extrair provider do secret_id (ex: "openai_api_key" -> "openai")
        const secretId = s.secret_id || s.name?.toLowerCase().replace('_api_key', '');
        return secretId?.replace('_api_key', '') || secretId;
      })
      .filter(Boolean);

    return {
      ...data,
      configured_providers: providers,
    };
  }

  return data;
}

export async function createOrUpdateTenantSecret(
  accessToken: string,
  provider: string,
  payload: { api_key: string }
): Promise<SecretResponse> {
  if (!accessToken) {
    throw new Error('accessToken is required');
  }

  if (!provider) {
    throw new Error('provider is required');
  }

  const normalizedProvider = provider.toLowerCase();
  const secretName = PROVIDER_SECRET_NAMES[normalizedProvider];

  if (!secretName) {
    throw new Error(`Unsupported provider: ${provider}`);
  }

  console.log(`[TenantSecrets] Saving secret for provider: ${provider} -> name: ${secretName}`);

  const requestBody: SecretPayload = {
    name: secretName,
    api_key: payload.api_key,
    description: `API Key for ${provider}`,
  };

  const res = await fetch(`${API_BASE_URL}/v1/secrets`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(
      `Error to create or update secret for ${provider}: ${res.status} ${res.statusText} - ${errorText}`
    );
  }

  return res.json();
}

export async function deleteTenantSecret(accessToken: string, provider: string): Promise<boolean> {
  if (!accessToken) {
    throw new Error('accessToken is required');
  }

  if (!provider) {
    throw new Error('provider is required');
  }

  const normalizedProvider = provider.toLowerCase();
  const secretId = PROVIDER_SECRET_IDS[normalizedProvider];

  if (!secretId) {
    throw new Error(`Unsupported provider: ${provider}`);
  }

  console.log(
    `[TenantSecrets] Deleting secret for provider: ${provider} -> secret_id: ${secretId}`
  );

  const res = await fetch(`${API_BASE_URL}/v1/secrets/${secretId}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(
      `Error to delete secret for ${provider}: ${res.status} ${res.statusText} - ${errorText}`
    );
  }

  console.log(`[TenantSecrets] Secret deleted successfully for provider: ${provider}`);
  return res.ok;
}
