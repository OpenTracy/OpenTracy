import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';

import type { DeploymentData, DeploymentModel } from '@/types/deploymentTypes';
import type { DeploymentRequest } from '../api/deploymentService';
import { useDeployments } from './useDeployments';
import { useQuotaCheck } from '@/hooks/useQuotaCheck';

type CreatePayload = Omit<DeploymentData, 'id' | 'status' | 'createdAt'>;

interface UseDeploymentActionsOptions {
  allModels: DeploymentModel[];
}

interface UseDeploymentActionsReturn {
  deployments: DeploymentData[];
  loading: boolean;
  isCreating: boolean;
  deletingDeployments: Set<string>;
  pausingDeployments: Set<string>;
  resumingDeployments: Set<string>;
  listDeployments: () => Promise<DeploymentData[]>;
  handleCreate: (data: CreatePayload) => Promise<string | null>;
  handlePause: (deploymentId: string) => Promise<void>;
  handleResume: (deploymentId: string) => Promise<void>;
  handleDelete: (deploymentId: string) => Promise<void>;
}

function useLoadingSet() {
  const [set, setSet] = useState<Set<string>>(new Set());

  const add = useCallback((id: string) => {
    setSet((prev) => new Set(prev).add(id));
  }, []);

  const remove = useCallback((id: string) => {
    setSet((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  return { set, add, remove } as const;
}

export function useDeploymentActions({
  allModels,
}: UseDeploymentActionsOptions): UseDeploymentActionsReturn {
  const [isCreating, setIsCreating] = useState(false);
  const deleting = useLoadingSet();
  const pausing = useLoadingSet();
  const resuming = useLoadingSet();
  const { checkResourceQuota } = useQuotaCheck();

  const {
    deployments,
    loading,
    listDeployments,
    createDeployment,
    deleteDeployment,
    pauseDeployment,
    resumeDeployment,
  } = useDeployments(
    (deployment) => toast.success(`Deployment "${deployment.name}" is now ready!`),
    (deployment) => {
      const msg =
        deployment.error_message ??
        `Deployment "${deployment.name}" failed. Check details for more information.`;
      toast.error(msg);
    }
  );

  useEffect(() => {
    listDeployments();
  }, [listDeployments]);

  const modelNameFor = useCallback(
    (modelId: string) => allModels.find((m) => m.id === modelId)?.name ?? 'Deployment',
    [allModels]
  );

  const handleCreate = useCallback(
    async (data: CreatePayload): Promise<string | null> => {
      setIsCreating(true);

      const { available } = await checkResourceQuota('gpu_training');
      if (!available) {
        setIsCreating(false);
        return null;
      }

      toast.info('Creating deployment...');

      const payload: DeploymentRequest = {
        model_id: data.selectedModel,
        instance_type: data.selectedInstance,
      };

      try {
        const result = await createDeployment(payload, data);
        if (result) {
          toast.success('Deployment created successfully!');
          return result.deploymentData.id;
        }
        return null;
      } catch (err) {
        const raw = err instanceof Error ? err.message : String(err);
        const display = raw.toLowerCase().includes('download')
          ? 'Model is still downloading. Please wait for it to complete.'
          : raw.toLowerCase().includes('already_exists')
            ? 'A deployment with this configuration already exists.'
            : raw || 'Failed to create deployment. Please try again.';
        toast.error(display);
        return null;
      } finally {
        setIsCreating(false);
      }
    },
    [createDeployment, checkResourceQuota]
  );

  const handlePause = useCallback(
    async (deploymentId: string) => {
      pausing.add(deploymentId);
      toast.info('Pausing deployment...');
      try {
        const ok = await pauseDeployment(deploymentId);
        if (ok) toast.success(`${modelNameFor(deploymentId)} paused successfully!`);
      } catch {
        toast.error('Failed to pause deployment.');
      } finally {
        pausing.remove(deploymentId);
      }
    },
    [pauseDeployment, modelNameFor, pausing]
  );

  const handleResume = useCallback(
    async (deploymentId: string) => {
      resuming.add(deploymentId);
      toast.info('Resuming deployment...');
      try {
        const ok = await resumeDeployment(deploymentId);
        if (ok) toast.success(`${modelNameFor(deploymentId)} resumed successfully!`);
      } catch {
        toast.error('Failed to resume deployment.');
      } finally {
        resuming.remove(deploymentId);
      }
    },
    [resumeDeployment, modelNameFor, resuming]
  );

  const handleDelete = useCallback(
    async (deploymentId: string) => {
      deleting.add(deploymentId);
      toast.info('Deleting deployment...');
      try {
        const ok = await deleteDeployment(deploymentId);
        if (ok) toast.success(`${modelNameFor(deploymentId)} deleted successfully!`);
      } catch {
        toast.error('Failed to delete deployment.');
      } finally {
        deleting.remove(deploymentId);
      }
    },
    [deleteDeployment, modelNameFor, deleting]
  );

  return {
    deployments,
    loading,
    isCreating,
    deletingDeployments: deleting.set,
    pausingDeployments: pausing.set,
    resumingDeployments: resuming.set,
    listDeployments,
    handleCreate,
    handlePause,
    handleResume,
    handleDelete,
  };
}
