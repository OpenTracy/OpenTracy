import { API_BASE_URL } from '@/config/api';

const API_BASE = API_BASE_URL;

// Types
interface RegisterModelRequest {
  hf_model_id: string;
  hf_api_key?: string;
}

export interface AvailableModel {
  model_id: string;
  name: string;
  display_name: string;
  source: 'internal' | 'huggingface';
  hf_model_id: string | null;
  context_length: number;
  architecture: string | null;
  is_gated: boolean;
  is_custom: boolean;
  license: string | null;
  registered_at: string | null;
  download_status: 'downloading' | 'ready' | 'failed' | 'pending' | 'uploading';
  ready_for_deployment: boolean;
}

export interface DownloadProgress {
  status: string;
  progress_percent: number;
  downloaded_bytes: number;
  total_bytes: number;
  uploaded_bytes?: number;
  speed_mbps: number;
  eta_seconds: number;
  current_file: string;
  files_completed: number;
  files_total: number;
  error_message?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
}

export interface RegisteredModel {
  model_id: string;
  hf_model_id: string;
  display_name: string;
  architecture: string;
  context_length: number;
  is_gated: boolean;
  license: string | null;
  download_status: 'downloading' | 'ready' | 'failed' | 'pending' | 'uploading';
  task_arn?: string;
  progress?: DownloadProgress | null;
  s3_uri?: string;
  ready_for_deployment?: boolean;
}

interface RegisterModelResponse {
  message: string;
  model: RegisteredModel;
}

export interface ModelStatusResponse {
  model_id: string;
  hf_model_id: string;
  display_name: string;
  download_status: 'downloading' | 'ready' | 'failed' | 'pending' | 'uploading';
  progress: DownloadProgress | null;
  s3_uri: string | null;
  ready_for_deployment: boolean;
}

interface DeleteModelResponse {
  message: string;
}

// Internal helpers
function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

function jsonHeaders(token: string): Record<string, string> {
  return { ...authHeaders(token), 'Content-Type': 'application/json' };
}

/**
 * Parses a failed response body and maps known HTTP status codes to
 * user-friendly error messages specific to the model registry domain.
 */
async function parseRegisterError(res: Response): Promise<Error> {
  const text = await res.text().catch(() => '');

  if (res.status === 409) return new Error('Model already registered');

  if (res.status === 401) {
    try {
      const json = JSON.parse(text);
      if (json.message === 'Unauthorized') {
        return new Error('Session expired. Please refresh the page and log in again.');
      }
      if (json.requires_token ?? json.is_gated) {
        return new Error('Gated model requires HuggingFace API key');
      }
    } catch {
      // fall through to default
    }
    return new Error('Session expired. Please refresh the page and log in again.');
  }

  if (res.status === 400) {
    try {
      const json = JSON.parse(text);
      if (json.requires_token ?? json.is_gated) {
        return new Error('Gated model requires HuggingFace API key');
      }
      return new Error(json.message ?? 'Validation failed');
    } catch {
      return new Error('Model validation failed');
    }
  }

  return new Error(`Failed to register model: ${res.status} ${res.statusText}`);
}

// API functions
export async function registerModel(
  accessToken: string,
  request: RegisterModelRequest
): Promise<RegisterModelResponse> {
  const res = await fetch(`${API_BASE}/v1/models/register`, {
    method: 'POST',
    headers: jsonHeaders(accessToken),
    body: JSON.stringify(request),
  });

  if (!res.ok) throw await parseRegisterError(res);

  return res.json();
}

export async function _getModelStatus(
  accessToken: string,
  modelId: string
): Promise<ModelStatusResponse> {
  const res = await fetch(`${API_BASE}/v1/models/${modelId}/status`, {
    headers: authHeaders(accessToken),
  });

  if (!res.ok) {
    throw new Error(`Failed to get model status: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

export async function _listAvailableModels(accessToken: string): Promise<AvailableModel[]> {
  const res = await fetch(`${API_BASE}/v1/models`, {
    headers: authHeaders(accessToken),
  });

  if (!res.ok) {
    throw new Error(`Failed to list models: ${res.status} ${res.statusText}`);
  }

  const result = await res.json();
  return result.models ?? result ?? [];
}

export async function _deleteModel(
  accessToken: string,
  modelId: string
): Promise<DeleteModelResponse> {
  const res = await fetch(`${API_BASE}/v1/models/${modelId}`, {
    method: 'DELETE',
    headers: authHeaders(accessToken),
  });

  if (!res.ok) {
    throw new Error(`Failed to delete model: ${res.status} ${res.statusText}`);
  }

  return res.json().catch(() => ({ message: 'Model deleted' }));
}
