import { useState, useEffect, useCallback } from 'react';
import { usePostHog } from 'posthog-js/react';
import type { DeploymentResponse } from '../services/DeploymentService';
import { useDeploymentService } from '../services/DeploymentService';
import type { DeploymentData } from '../types/deploymentTypes';
import { useUser } from '../contexts/UserContext';

export interface Deployment {
  model_id: string;
  instance_type: string;
}

// Parse error object from backend (Java-style format: {key=value, key2=value2})
function parseErrorMessage(errorMessage?: string): { user_message?: string; error_code?: string } {
  if (!errorMessage) return {};

  // Try to extract user_message and error_code from the error string
  // Format: {Error=..., user_message=..., error_code=...}
  // user_message can contain commas, so we need to capture until the next key= or closing }
  const userMessageMatch = errorMessage.match(
    /user_message=(.+?)(?:,\s*error_code=|,\s*[a-zA-Z_]+=|}|$)/
  );
  const errorCodeMatch = errorMessage.match(/error_code=([^,}]+)/);

  if (userMessageMatch || errorCodeMatch) {
    return {
      user_message: userMessageMatch?.[1]?.trim(),
      error_code: errorCodeMatch?.[1]?.trim(),
    };
  }

  // If not in the special format, return original error message
  return { user_message: errorMessage };
}

interface UseDeploymentsState {
  deployments: DeploymentData[];
  loading: boolean;
  creating: boolean;
  error: string | null;
}

interface UseDeploymentsReturn extends UseDeploymentsState {
  createDeployment: (
    payload: Deployment,
    data: DeploymentData
  ) => Promise<{ deploymentData: DeploymentData; deploymentRes: DeploymentResponse } | null>;
  getDeploymentById: (id: string) => DeploymentData | undefined;
  listDeployments: () => Promise<DeploymentData[]>;
  deleteDeployment: (id: string) => Promise<boolean>;
  pauseDeployment: (id: string) => Promise<boolean>;
  resumeDeployment: (id: string) => Promise<boolean>;
  clearError: () => void;
}

export const useDeployments = (
  onDeploymentReady?: (deployment: DeploymentData) => void,
  onDeploymentFailed?: (deployment: DeploymentData) => void
): UseDeploymentsReturn => {
  const { accessToken, idToken } = useUser();
  const posthog = usePostHog();
  const {
    createDeployment: createDeploymentAPI,
    deleteDeployment: deleteDeploymentAPI,
    listDeployments: listDeploymentsAPI,
    pauseDeployment: pauseDeploymentAPI,
    resumeDeployment: resumeDeploymentAPI,
  } = useDeploymentService();

  const [state, setState] = useState<UseDeploymentsState>({
    deployments: [],
    loading: false,
    creating: false,
    error: null,
  });

  const setPartialState = (
    partial:
      | Partial<UseDeploymentsState>
      | ((prev: UseDeploymentsState) => Partial<UseDeploymentsState>)
  ) =>
    setState((prev) => ({
      ...prev,
      ...(typeof partial === 'function' ? partial(prev) : partial),
    }));

  const createDeployment = useCallback(
    async (
      payload: Deployment,
      data: Omit<DeploymentData, 'id' | 'status' | 'createdAt'>
    ): Promise<{ deploymentData: DeploymentData; deploymentRes: DeploymentResponse } | null> => {
      if (!idToken) throw new Error('ID token not available. Please login again.');

      setPartialState({ creating: true, error: null });
      try {
        const deploymentRes = await createDeploymentAPI(idToken, payload, data);

        // If deployment already exists, don't add to list but return the response
        if (deploymentRes.status === 'already_exists') {
          setPartialState({ creating: false });
          return {
            deploymentData: {
              ...data,
              id: deploymentRes.deployment_id,
              deployment_id: deploymentRes.deployment_id,
              status: 'already_exists' as any,
              createdAt: new Date().toISOString(),
            },
            deploymentRes,
          };
        }

        const deploymentData: DeploymentData = {
          ...data,
          id: deploymentRes.deployment_id,
          deployment_id: deploymentRes.deployment_id,
          status: 'pending',
          createdAt: new Date().toISOString(),
        };

        setPartialState((prev) => ({
          creating: false,
          deployments: [...prev.deployments, deploymentData],
        }));

        // Track deployment creation event
        posthog.capture('deployment_created', {
          model_id: payload.model_id,
          instance_type: payload.instance_type,
        });

        return { deploymentData, deploymentRes };
      } catch (err) {
        setPartialState({
          creating: false,
          error: err instanceof Error ? err.message : 'Error creating deployment',
        });
        throw err; // Re-throw the error so it can be caught in the component
      }
    },
    [createDeploymentAPI, idToken, posthog]
  );

  const listDeployments = useCallback(async (): Promise<DeploymentData[]> => {
    if (!accessToken) {
      setPartialState({ error: 'No access token' });
      return [];
    }

    try {
      const statuses = [
        'in_service',
        'starting',
        'creating',
        'failed',
        'stopped',
        'deleting',
        'paused',
        'pausing',
        'resuming',
      ];
      const apiDeployments = await listDeploymentsAPI(accessToken, statuses);

      const mapped: DeploymentData[] = apiDeployments.map((apiDep) => {
        // Parse error message to extract user-friendly message and error code
        const parsedError = parseErrorMessage(apiDep.error_message);

        return {
          id: apiDep.deployment_id,
          name: `Deployment ${apiDep.deployment_id.slice(0, 8)}`,
          selectedModel: apiDep.model_id || 'unknown',
          selectedInstance: apiDep.instance_type || 'unknown',
          deployment_id: apiDep.deployment_id,
          modelOptions: {
            maxTokens: 4096,
            dtype: 'bfloat16' as 'auto' | 'bfloat16' | 'float16' | 'float32',
            gpuMemoryUtilization: 0.92,
            maxNumSeqs: 256,
            blockSize: 16,
            swapSpace: 4,
            temperature: 0.7,
            topP: 0.9,
            topK: 50,
          },
          autoscalingConfig: {
            enabled: true,
            maxReplicas: 1,
            versionComment: '',
          },
          createdAt: apiDep.updated_at || new Date().toISOString(),
          status: apiDep.status as DeploymentData['status'],
          error_message: parsedError.user_message,
          error_code: parsedError.error_code || apiDep.error_code,
        };
      });

      setPartialState((prev) => {
        const current = prev.deployments;

        const updated = [...current];
        mapped.forEach((m) => {
          const idx = updated.findIndex((d) => d.id === m.id);
          if (idx >= 0) {
            updated[idx] = { ...updated[idx], ...m };
          } else {
            updated.push(m);
          }
        });

        return { deployments: updated, loading: false };
      });

      return mapped;
    } catch (err) {
      setPartialState({
        loading: false,
        error: err instanceof Error ? err.message : 'Error fetching deployments',
      });
      return [];
    }
  }, [accessToken, listDeploymentsAPI]);

  const getDeploymentById = useCallback(
    (id: string) => state.deployments.find((d) => d.id === id),
    [state.deployments]
  );

  const deleteDeployment = useCallback(
    async (id: string) => {
      if (!accessToken) return false;
      try {
        await deleteDeploymentAPI(accessToken, id);
        setPartialState((prev) => ({
          deployments: prev.deployments.filter((d) => d.id !== id),
        }));

        // Track deployment deletion event
        posthog.capture('deployment_deleted');

        return true;
      } catch (err) {
        setPartialState({
          error: err instanceof Error ? err.message : 'Error deleting deployment',
        });
        return false;
      }
    },
    [accessToken, deleteDeploymentAPI, posthog]
  );

  const pauseDeployment = useCallback(
    async (id: string) => {
      if (!accessToken) return false;
      try {
        // Optimistically update status to 'pausing'
        setPartialState((prev) => ({
          deployments: prev.deployments.map((d) =>
            d.id === id ? { ...d, status: 'pausing' as const } : d
          ),
        }));

        await pauseDeploymentAPI(accessToken, id);

        // Track deployment paused event
        posthog.capture('deployment_paused');

        // Refresh deployments to get actual status
        await listDeployments();
        return true;
      } catch (err) {
        // Revert optimistic update on error
        await listDeployments();
        setPartialState({
          error: err instanceof Error ? err.message : 'Error pausing deployment',
        });
        return false;
      }
    },
    [accessToken, pauseDeploymentAPI, listDeployments, posthog]
  );

  const resumeDeployment = useCallback(
    async (id: string) => {
      if (!accessToken) return false;
      try {
        // Optimistically update status to 'resuming'
        setPartialState((prev) => ({
          deployments: prev.deployments.map((d) =>
            d.id === id ? { ...d, status: 'resuming' as const } : d
          ),
        }));

        await resumeDeploymentAPI(accessToken, id);

        // Track deployment resumed event
        posthog.capture('deployment_resumed');

        // Refresh deployments to get actual status
        await listDeployments();
        return true;
      } catch (err) {
        // Revert optimistic update on error
        await listDeployments();
        setPartialState({
          error: err instanceof Error ? err.message : 'Error resuming deployment',
        });
        return false;
      }
    },
    [accessToken, resumeDeploymentAPI, listDeployments, posthog]
  );

  const clearError = useCallback(() => setPartialState({ error: null }), []);

  useEffect(() => {
    if (!accessToken) return;

    console.log('[useDeployments] Starting polling with listDeployments');

    const interval = setInterval(() => {
      listDeployments()
        .then((deployments) => {
          deployments.forEach((d) => {
            const prev = state.deployments.find((p) => p.id === d.id);

            // Check if deployment became ready
            const ready = d.status === 'in_service' || d.status === 'active';
            if (ready && onDeploymentReady) {
              if (
                prev &&
                (prev.status === 'pending' ||
                  prev.status === 'starting' ||
                  prev.status === 'creating')
              ) {
                onDeploymentReady(d);
              }
            }

            // Check if deployment failed
            if (d.status === 'failed' && onDeploymentFailed) {
              if (prev && prev.status !== 'failed') {
                onDeploymentFailed(d);
              }
            }
          });
        })
        .catch((error) => {
          console.error('[useDeployments] Polling error:', error);
        });
    }, 5000);

    return () => clearInterval(interval);
  }, [accessToken, listDeployments, onDeploymentReady, onDeploymentFailed, state.deployments]);

  return {
    ...state,
    listDeployments,
    createDeployment,
    deleteDeployment,
    pauseDeployment,
    resumeDeployment,
    getDeploymentById,
    clearError,
  };
};
