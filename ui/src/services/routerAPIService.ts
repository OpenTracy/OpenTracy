import { useUser } from '../contexts/UserContext';
import { useIntegrationKeys } from '../hooks/useIntegrationKeys';
import { useRouterKeyStorage } from '../hooks/useRouterKeyStorage';
import { API_BASE_URL, ROUTER_BASE_URL } from '../config/api';

const API_GATEWAY_URL = API_BASE_URL;
const ROUTER_URL = ROUTER_BASE_URL;

export interface PlaygroundMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface PlaygroundInferenceRequest {
  model: string;
  messages: PlaygroundMessage[];
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
}

export interface PlaygroundInferenceResponse {
  output: string;
  cost_usd?: number;
  latency_ms?: number;
  model?: string;
  usage?: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
  };
}

export interface RouterAPIRequest {
  prompt: string;
  provider: string;
  model?: string;
  max_tokens?: number;
  temperature?: number;
}

export interface RouterAPIResponse {
  output: string;
  cost?: number;
  total_cost?: number;
  [key: string]: any;
}

// Função para obter o modelo padrão de cada provedor
function getDefaultModelForProvider(provider: string): string {
  const defaultModels: Record<string, string> = {
    openai: 'gpt-4o-2024-08-06',
    anthropic: 'claude-3-5-sonnet-20241022',
    deepseek: 'deepseek-chat',
    mistral: 'mistral-large-latest',
    gemini: 'gemini-pro',
    cohere: 'command-r-plus',
    groq: 'llama-3.1-70b-versatile',
    perplexity: 'llama-3.1-sonar-large-128k-online',
    sambanova: 'Meta-Llama-3.1-70B-Instruct',
    togetherai: 'meta-llama/Llama-3-70b-chat-hf',
    cerebras: 'llama3.1-70b',
    bedrock: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
  };
  return defaultModels[provider] || 'default';
}

export function useRouterAPI() {
  const { accessToken } = useUser();
  const { isProviderConfigured } = useIntegrationKeys();
  const { routerKey } = useRouterKeyStorage();

  const callProviderAPI = async (request: RouterAPIRequest): Promise<RouterAPIResponse> => {
    if (!accessToken) {
      throw new Error('Access token is required');
    }

    if (!isProviderConfigured(request.provider)) {
      throw new Error(
        `Provider ${request.provider} is not configured. Please configure it in the Integrations tab.`
      );
    }

    const response = await fetch(`${API_GATEWAY_URL}/v1/direct/${request.provider}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        model: request.model || getDefaultModelForProvider(request.provider),
        messages: [
          {
            role: 'user',
            content: request.prompt,
          },
        ],
        max_tokens: request.max_tokens || 4096,
        temperature: request.temperature || 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Error calling ${request.provider} API: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    const data = await response.json();

    // Normalizar a resposta para o formato esperado
    return {
      output: data.choices?.[0]?.message?.content || data.output || '',
      cost: data.cost_usd || data.usage?.total_cost || data.cost || 0,
      total_cost: data.cost_usd || data.usage?.total_cost || data.total_cost || 0,
      ...data,
    };
  };

  const callRouterInference = async (
    prompt: string,
    modelId?: string
  ): Promise<RouterAPIResponse> => {
    if (!routerKey) {
      throw new Error(
        'Router key is required. Please create an API key in the Access Keys tab first.'
      );
    }

    const requestBody: Record<string, unknown> = {
      prompt,
      max_tokens: 4096,
    };

    // If a specific model is provided, use it; otherwise let the router decide
    if (modelId) {
      requestBody.model = modelId;
    }

    console.log('[RouterAPI] Making request to:', `${ROUTER_URL}/v1/infer`);
    console.log('[RouterAPI] Request body:', JSON.stringify(requestBody, null, 2));

    const response = await fetch(`${ROUTER_URL}/v1/infer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': routerKey,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Error calling router inference: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    const data = await response.json();

    const result = {
      output: data.output_text || data.output || '',
      cost: data.cost_usd || data.usage?.total_cost || data.cost || 0,
      total_cost: data.cost_usd || data.usage?.total_cost || data.total_cost || data.cost || 0,
      model: data.model || modelId || 'auto',
      ...data,
    };

    return result;
  };

  /**
   * Playground inference using JWT authentication
   * Uses the Router API /v1/chat/completions endpoint with Bearer token
   */
  const callPlaygroundInference = async (
    messages: PlaygroundMessage[],
    modelId: string,
    options?: { max_tokens?: number; temperature?: number }
  ): Promise<PlaygroundInferenceResponse> => {
    if (!accessToken) {
      throw new Error('Authentication required. Please log in.');
    }

    const requestBody: PlaygroundInferenceRequest = {
      model: modelId,
      messages,
      max_tokens: options?.max_tokens || 4096,
      temperature: options?.temperature || 0.7,
    };

    console.log('[RouterAPI] Making playground request to:', `${ROUTER_URL}/v1/chat/completions`);
    console.log('[RouterAPI] Request body:', JSON.stringify(requestBody, null, 2));

    const response = await fetch(`${ROUTER_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Error calling playground: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    const data = await response.json();

    // Normalize response to our expected format
    const result: PlaygroundInferenceResponse = {
      output: data.choices?.[0]?.message?.content || data.output_text || data.output || '',
      cost_usd: data.cost_usd || data.usage?.total_cost || data.cost || 0,
      latency_ms: data.latency_ms || data.latency || 0,
      model: data.model || modelId,
      usage: data.usage,
    };

    return result;
  };

  return {
    callProviderAPI,
    callRouterInference,
    callPlaygroundInference,
  };
}
