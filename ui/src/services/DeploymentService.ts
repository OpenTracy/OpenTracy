import { useCallback } from 'react';
import type { DeploymentData, DeploymentMetricsData } from '../types/deploymentTypes';
import { API_BASE_URL } from '../config/api';
import { INSTANCE_TYPES } from '../constants/deployment';

const API_BASE = API_BASE_URL;

type DeploymentRequest = {
  model_id: string;
  instance_type: string;
  scaling?: {
    min: number;
    max: number;
  };
};

export type DeploymentResponse = {
  deployment_id: string;
  endpoint_name?: string;
  status: string;
  model_id?: string;
  instance_type?: string;
  updated_at?: string;
  tenant_id?: string;
  scaling?: {
    min: number;
    max: number;
  };
  error_message?: string;
  error_code?: string;
};

function buildVLLMArgs(data: Partial<DeploymentData>): string {
  const args: string[] = [];

  // Core VLLM engine arguments (not inference parameters)
  if (data.modelOptions) {
    // Model context length
    if (data.modelOptions.maxTokens !== undefined) {
      args.push(`--max-model-len ${data.modelOptions.maxTokens}`);
    }

    // Data type for model weights
    if (data.modelOptions.dtype && data.modelOptions.dtype !== 'auto') {
      args.push(`--dtype ${data.modelOptions.dtype}`);
    }

    // GPU memory utilization
    if (data.modelOptions.gpuMemoryUtilization !== undefined) {
      args.push(`--gpu-memory-utilization ${data.modelOptions.gpuMemoryUtilization}`);
    }

    // Maximum number of sequences in a batch
    if (data.modelOptions.maxNumSeqs !== undefined) {
      args.push(`--max-num-seqs ${data.modelOptions.maxNumSeqs}`);
    }

    // Token block size for memory management
    if (data.modelOptions.blockSize !== undefined) {
      args.push(`--block-size ${data.modelOptions.blockSize}`);
    }

    // CPU swap space
    if (data.modelOptions.swapSpace !== undefined) {
      args.push(`--swap-space ${data.modelOptions.swapSpace}`);
    }

    // Note: temperature, top-p, top-k are inference parameters, not engine arguments
    // They should be passed during inference requests, not model initialization
  }

  // Calculate tensor-parallel-size based on instance type from INSTANCE_TYPES specs
  let tensorParallelSize = 1; // Default to 1 GPU

  if (data.selectedInstance) {
    const instanceConfig = INSTANCE_TYPES.find((i) => i.id === data.selectedInstance);
    if (instanceConfig?.specs) {
      tensorParallelSize = instanceConfig.specs.tensorParallelSize;
    }
  }

  console.log(
    `[DeploymentService] Instance: ${data.selectedInstance}, tensor-parallel-size: ${tensorParallelSize}`
  );

  if (!data.modelOptions?.dtype || data.modelOptions.dtype === 'auto') {
    args.push('--dtype bfloat16'); // Default data type
  }

  args.push(`--tensor-parallel-size ${tensorParallelSize}`); // GPU parallelization

  if (!data.modelOptions?.gpuMemoryUtilization) {
    args.push('--gpu-memory-utilization 0.92'); // Default GPU memory usage
  }

  return args.join(' ');
}

export function useDeploymentService() {
  const createDeployment = useCallback(
    async (
      idToken: string,
      payload: DeploymentRequest,
      data: Partial<DeploymentData>
    ): Promise<DeploymentResponse> => {
      try {
        const vllmArgs = buildVLLMArgs(data);

        const body = {
          ...payload,
          config: {
            vllm_args: vllmArgs,
          },
        };

        console.log('[DeploymentService] Creating deployment with ID token:', body);

        const res = await fetch(`${API_BASE}/v1/deployments`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const errorText = await res.text().catch(() => '');
          console.error(
            '[DeploymentService] Deploy failed:',
            res.status,
            res.statusText,
            errorText
          );

          // Try to parse JSON error response from backend
          let errorMessage = '';
          try {
            const errorJson = JSON.parse(errorText);
            errorMessage = errorJson.message || errorJson.error || errorText;
          } catch {
            errorMessage = errorText;
          }

          // Throw with the actual error message from the backend
          throw new Error(
            errorMessage || `Failed to create deployment: ${res.status} ${res.statusText}`
          );
        }

        const result = await res.json();
        console.log('[DeploymentService] Deploy success:', result);
        return result;
      } catch (error) {
        console.error('[DeploymentService] Deploy error:', error);
        throw error;
      }
    },
    []
  );

  const getDeploymentStatus = useCallback(
    async (token: string, id: string): Promise<DeploymentResponse> => {
      console.log('[DeploymentService] Getting deployment status for:', id);

      // Usar endpoint específico de status: GET /v1/deployments/{id}/status
      const url = `${API_BASE}/v1/deployments/${id}/status`;

      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
      };

      console.log('[DeploymentService] Using Bearer token for authentication with URL:', url);

      const res = await fetch(url, {
        method: 'GET',
        headers,
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        console.error(
          '[DeploymentService] Status check failed:',
          res.status,
          res.statusText,
          errorText
        );
        throw new Error(`Failed to fetch deployment status: ${res.status} ${res.statusText}`);
      }

      const result = await res.json();
      console.log('[DeploymentService] Status result:', result);

      return result;
    },
    []
  );

  const listDeployments = useCallback(
    async (accessToken: string, statuses?: string[]): Promise<DeploymentResponse[]> => {
      console.log('[DeploymentService] Listing deployments with statuses:', statuses);

      let url = `${API_BASE}/v1/deployments`;
      if (statuses && statuses.length > 0) {
        const statusParams = statuses.join(',');
        url += `?statuses=${encodeURIComponent(statusParams)}`;
      }

      const res = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        console.error('[DeploymentService] List failed:', res.status, res.statusText, errorText);
        throw new Error(`Failed to fetch deployments: ${res.status} ${res.statusText}`);
      }

      const result = await res.json();
      console.log('[DeploymentService] Deployments listed:', result);
      return result.deployments || [];
    },
    []
  );

  const deleteDeployment = useCallback(async (accessToken: string, id: string): Promise<void> => {
    console.log('[DeploymentService] Deleting deployment:', id);

    const res = await fetch(`${API_BASE}/v1/deployments/${id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      console.error('[DeploymentService] Delete failed:', res.status, res.statusText, errorText);
      throw new Error(`Failed to delete deployment: ${res.status} ${res.statusText}`);
    }

    console.log('[DeploymentService] Deployment deleted successfully');
  }, []);

  const getDeploymentMetrics = useCallback(
    async (accessToken: string, deploymentId: string): Promise<DeploymentMetricsData> => {
      console.log('[DeploymentService] Getting metrics for deployment:', deploymentId);

      const res = await fetch(`${API_BASE}/v1/deployments/${deploymentId}/metrics`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        console.error('[DeploymentService] Metrics failed:', res.status, res.statusText, errorText);
        throw new Error(`Failed to fetch deployment metrics: ${res.status} ${res.statusText}`);
      }

      const result = await res.json();
      console.log('[DeploymentService] Metrics result:', result);
      return result;
    },
    []
  );

  const pauseDeployment = useCallback(
    async (accessToken: string, deploymentId: string): Promise<DeploymentResponse> => {
      console.log('[DeploymentService] Pausing deployment:', deploymentId);

      const res = await fetch(`${API_BASE}/v1/deployments/${deploymentId}/pause`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        console.error('[DeploymentService] Pause failed:', res.status, res.statusText, errorText);
        throw new Error(
          `Failed to pause deployment: ${res.status} ${res.statusText}${errorText ? ` - ${errorText}` : ''}`
        );
      }

      const result = await res.json();
      console.log('[DeploymentService] Pause result:', result);
      return result;
    },
    []
  );

  const resumeDeployment = useCallback(
    async (accessToken: string, deploymentId: string): Promise<DeploymentResponse> => {
      console.log('[DeploymentService] Resuming deployment:', deploymentId);

      const res = await fetch(`${API_BASE}/v1/deployments/${deploymentId}/resume`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        console.error('[DeploymentService] Resume failed:', res.status, res.statusText, errorText);
        throw new Error(
          `Failed to resume deployment: ${res.status} ${res.statusText}${errorText ? ` - ${errorText}` : ''}`
        );
      }

      const result = await res.json();
      console.log('[DeploymentService] Resume result:', result);
      return result;
    },
    []
  );

  return {
    createDeployment,
    getDeploymentStatus,
    listDeployments,
    deleteDeployment,
    getDeploymentMetrics,
    pauseDeployment,
    resumeDeployment,
  };
}
