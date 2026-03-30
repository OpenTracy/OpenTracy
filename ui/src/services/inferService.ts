import { ROUTER_BASE_URL } from '../config/api';

export interface InferRequest {
  prompt: string;
  profile?: string;
  max_tokens?: number;
}

export interface InferResponse {
  provider?: string;
  model?: string;
  text?: string;
  output?: any;
  metrics?: {
    ttft_ms?: number;
    latency_ms?: number;
    tokens_in?: number;
    tokens_out?: number;
  };
  chosen_by?: {
    strategy?: string;
  };
  [key: string]: any;
}

export interface ChatCompletionRequest {
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
}

export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// Inferência usando /v1/infer/{model}
export async function runInference(
  apiKey: string,
  body: InferRequest,
  model?: string
): Promise<InferResponse> {
  const endpoint = model ? `/v1/infer/${model}` : '/v1/infer';

  const res = await fetch(`${ROUTER_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new Error(`Error to call infer: ${res.status} ${errorText}`);
  }

  return res.json();
}

// Chat completions usando /v1/chat/completions (compatível com OpenAI)
export async function chatCompletion(
  apiKey: string,
  body: ChatCompletionRequest
): Promise<ChatCompletionResponse> {
  const res = await fetch(`${ROUTER_BASE_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new Error(`Error to call chat completions: ${res.status} ${errorText}`);
  }

  return res.json();
}
