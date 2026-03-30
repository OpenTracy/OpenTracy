import { useCallback } from 'react';
import { API_BASE_URL } from '../config/api';

const API_BASE = API_BASE_URL;

export interface RegisterModelRequest {
  hf_model_id: string;
  hf_api_key?: string;
}

// Model from /v1/models endpoint (all available models)
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

// Progress object returned by the backend during model download
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

// Model returned when registering a new HuggingFace model
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

export interface RegisterModelResponse {
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

export interface DeleteModelResponse {
  message: string;
}

export function useModelRegistryService() {
  const registerModel = useCallback(
    async (accessToken: string, request: RegisterModelRequest): Promise<RegisterModelResponse> => {
      console.log('[ModelRegistryService] Registering model:', request.hf_model_id);

      const res = await fetch(`${API_BASE}/v1/models/register`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        console.error(
          '[ModelRegistryService] Register failed:',
          res.status,
          res.statusText,
          errorText
        );

        if (res.status === 409) {
          throw new Error('Model already registered');
        }
        if (res.status === 401) {
          // Check if it's an API Gateway auth error vs our Lambda error
          try {
            const errorJson = JSON.parse(errorText);
            if (errorJson.message === 'Unauthorized') {
              throw new Error('Session expired. Please refresh the page and log in again.');
            }
            if (errorJson.requires_token || errorJson.is_gated) {
              throw new Error('Gated model requires HuggingFace API key');
            }
          } catch (parseErr) {
            // If parse fails, assume session expired
          }
          throw new Error('Session expired. Please refresh the page and log in again.');
        }
        if (res.status === 400) {
          try {
            const errorJson = JSON.parse(errorText);
            if (errorJson.requires_token || errorJson.is_gated) {
              throw new Error('Gated model requires HuggingFace API key');
            }
            throw new Error(errorJson.message || 'Validation failed');
          } catch (parseErr) {
            throw new Error('Model validation failed');
          }
        }
        throw new Error(`Failed to register model: ${res.status} ${res.statusText}`);
      }

      const result = await res.json();
      console.log('[ModelRegistryService] Model registered:', result);
      return result;
    },
    []
  );

  const getModelStatus = useCallback(
    async (accessToken: string, modelId: string): Promise<ModelStatusResponse> => {
      console.log('[ModelRegistryService] Getting status for model:', modelId);

      const res = await fetch(`${API_BASE}/v1/models/${modelId}/status`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        console.error(
          '[ModelRegistryService] Status failed:',
          res.status,
          res.statusText,
          errorText
        );
        throw new Error(`Failed to get model status: ${res.status} ${res.statusText}`);
      }

      const result = await res.json();
      console.log('[ModelRegistryService] Model status:', result);
      return result;
    },
    []
  );

  const listAvailableModels = useCallback(
    async (accessToken: string): Promise<AvailableModel[]> => {
      console.log('[ModelRegistryService] Listing available models');

      const res = await fetch(`${API_BASE}/v1/models`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        console.error('[ModelRegistryService] List failed:', res.status, res.statusText, errorText);
        throw new Error(`Failed to list models: ${res.status} ${res.statusText}`);
      }

      const result = await res.json();
      console.log('[ModelRegistryService] Models listed:', result);
      return result.models || result || [];
    },
    []
  );

  const deleteModel = useCallback(
    async (accessToken: string, modelId: string): Promise<DeleteModelResponse> => {
      console.log('[ModelRegistryService] Deleting model:', modelId);

      const res = await fetch(`${API_BASE}/v1/models/${modelId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        console.error(
          '[ModelRegistryService] Delete failed:',
          res.status,
          res.statusText,
          errorText
        );
        throw new Error(`Failed to delete model: ${res.status} ${res.statusText}`);
      }

      const result = await res.json().catch(() => ({ message: 'Model deleted' }));
      console.log('[ModelRegistryService] Model deleted:', result);
      return result;
    },
    []
  );

  return {
    registerModel,
    getModelStatus,
    listAvailableModels,
    deleteModel,
  };
}
