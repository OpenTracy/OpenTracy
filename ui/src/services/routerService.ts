import { isBedrockModel, guessTokenKey } from '../utils/modelUtils';
import { useIntegrationKeys } from '../hooks/useIntegrationKeys';
import { ROUTER_BASE_URL } from '../config/api';

export function useModelAPI() {
  const { getIntegrationKeyByName } = useIntegrationKeys();

  async function callRouterAPI(message: string, apiKey: string) {
    const response = await fetch(`${ROUTER_BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        model: 'mistral-small-latest',
        messages: [{ role: 'user', content: message }],
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.detail || data.message || 'Unknown error from model router.');
    }

    return data.choices?.[0]?.message?.content || data.result;
  }

  async function callModelAPI(model: string, message: string) {
    if (isBedrockModel(model)) {
      return callBedrockAPI(model, message);
    } else {
      return callStandardAPI(model, message);
    }
  }

  async function callBedrockAPI(model: string, message: string) {
    const apiKeyEntry = getIntegrationKeyByName('LUNAR_API_KEY');

    if (!apiKeyEntry?.keyValue) {
      throw new Error(`Missing OpenTracy API key for model ${model}. Please configure it in settings.`);
    }

    const response = await fetch(`${ROUTER_BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKeyEntry.keyValue,
      },
      body: JSON.stringify({
        model: `bedrock/${model}`,
        messages: [{ role: 'user', content: message }],
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.detail || data.message || 'Unknown error from bedrock model.');
    }

    return data.choices?.[0]?.message?.content || data.result;
  }

  async function callStandardAPI(model: string, message: string) {
    const tokenKey = guessTokenKey(model);
    const modelTokenEntry = getIntegrationKeyByName(tokenKey);
    const apiKeyEntry = getIntegrationKeyByName('LUNAR_API_KEY');

    const apiKey = apiKeyEntry?.keyValue || modelTokenEntry?.keyValue;

    if (!apiKey) {
      throw new Error(`API Key for ${tokenKey} not found in IntegrationKeys.`);
    }

    const response = await fetch(`${ROUTER_BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: message }],
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.detail || data.message || 'Unknown error from selected model.');
    }

    return data.choices?.[0]?.message?.content || data.result;
  }

  return { callRouterAPI, callModelAPI };
}
