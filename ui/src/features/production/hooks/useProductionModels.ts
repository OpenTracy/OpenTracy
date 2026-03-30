import { useState, useCallback, useMemo, useEffect } from 'react';
import { toast } from 'sonner';

import type {
  RegisteredModel,
  ModelStatusResponse,
  AvailableModel,
} from '@/services/modelRegistryService';
import { useModelRegistryService } from '@/services/modelRegistryService';
import type { DeploymentModel } from '@/types/deploymentTypes';
import { useUser } from '@/contexts/UserContext';
import { resolveModelIcon } from '../constants/productionModels';

const POLLING_INTERVAL_MS = 10_000;

function toDeploymentModel(model: AvailableModel): DeploymentModel {
  const features: string[] = [];

  if (model.source === 'huggingface') features.push('HuggingFace');
  if (model.is_custom) features.push('Custom');
  if (model.architecture) features.push(model.architecture);
  if (model.context_length) features.push(`${(model.context_length / 1024).toFixed(0)}K context`);
  if (model.license) features.push(model.license);

  return {
    id: model.model_id,
    name: model.display_name,
    description: model.hf_model_id
      ? `From HuggingFace: ${model.hf_model_id}`
      : `${model.display_name} - ${model.context_length?.toLocaleString() ?? 'N/A'} tokens context`,
    icon: resolveModelIcon(model.source, model.model_id, model.display_name),
    features: features.length > 0 ? features : ['LLM'],
  };
}

interface UseProductionModelsReturn {
  availableModels: AvailableModel[];
  registeredModels: RegisteredModel[];
  modelStatuses: Record<string, ModelStatusResponse>;
  loadingModels: boolean;
  deletingModels: Set<string>;

  allModels: DeploymentModel[];
  deployableModels: DeploymentModel[];
  inProgressModels: RegisteredModel[];
  readyModels: RegisteredModel[];
  failedModels: RegisteredModel[];

  handleModelRegistered: (model: RegisteredModel) => void;
  handleDeleteModel: (modelId: string, modelName?: string) => Promise<void>;
  handleRetryModel: (model: RegisteredModel) => void;

  preFillHfModelId: string | undefined;
  setPreFillHfModelId: (id: string | undefined) => void;
}

export function useProductionModels(): UseProductionModelsReturn {
  const { accessToken } = useUser();
  const { getModelStatus, listAvailableModels, deleteModel } = useModelRegistryService();

  const [availableModels, setAvailableModels] = useState<AvailableModel[]>([]);
  const [registeredModels, setRegisteredModels] = useState<RegisteredModel[]>([]);
  const [modelStatuses, setModelStatuses] = useState<Record<string, ModelStatusResponse>>({});
  const [loadingModels, setLoadingModels] = useState(false);
  const [deletingModels, setDeletingModels] = useState<Set<string>>(new Set());
  const [preFillHfModelId, setPreFillHfModelId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!accessToken) return;

    const fetchModels = async () => {
      setLoadingModels(true);
      try {
        const models = await listAvailableModels(accessToken);
        setAvailableModels(models);

        // Check status of all HuggingFace models to resume any pending downloads
        const hfModels = models.filter((m) => m.source === 'huggingface');
        const results = await Promise.all(
          hfModels.map(async (model) => {
            try {
              return { model, status: await getModelStatus(accessToken, model.model_id) };
            } catch {
              return null;
            }
          })
        );

        const downloading: RegisteredModel[] = [];
        const statuses: Record<string, ModelStatusResponse> = {};

        for (const result of results) {
          if (!result || result.status.download_status === 'ready') continue;

          downloading.push({
            model_id: result.model.model_id,
            hf_model_id: result.model.hf_model_id ?? '',
            display_name: result.model.display_name,
            architecture: result.model.architecture ?? '',
            context_length: result.model.context_length,
            is_gated: result.model.is_gated,
            license: result.model.license,
            download_status: result.status.download_status,
            progress: result.status.progress,
          });
          statuses[result.model.model_id] = result.status;
        }

        if (downloading.length > 0) {
          setRegisteredModels(downloading);
          setModelStatuses(statuses);
        }
      } catch (err) {
        console.error('Failed to fetch models:', err);
      } finally {
        setLoadingModels(false);
      }
    };

    fetchModels();
  }, [accessToken, listAvailableModels, getModelStatus]);

  const refreshModelsList = useCallback(async () => {
    if (!accessToken) return;
    try {
      setAvailableModels(await listAvailableModels(accessToken));
    } catch (err) {
      console.error('Failed to refresh models:', err);
    }
  }, [accessToken, listAvailableModels]);

  useEffect(() => {
    if (!accessToken || registeredModels.length === 0) return;

    const pollStatuses = async () => {
      for (const model of registeredModels) {
        if (model.download_status === 'ready') continue;
        try {
          const status = await getModelStatus(accessToken, model.model_id);
          setModelStatuses((prev) => ({ ...prev, [model.model_id]: status }));

          if (status.download_status === 'ready' && status.ready_for_deployment) {
            // Mark model as ready so the next poll cycle skips it (prevents duplicate toasts)
            setRegisteredModels((prev) =>
              prev.map((m) =>
                m.model_id === model.model_id ? { ...m, download_status: 'ready' } : m
              )
            );
            toast.success(`Model "${status.display_name}" is ready for deployment!`);
            await refreshModelsList();
          }
        } catch (err) {
          console.error(`Failed to poll status for ${model.model_id}:`, err);
        }
      }
    };

    pollStatuses();
    const interval = setInterval(pollStatuses, POLLING_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [accessToken, registeredModels, getModelStatus, refreshModelsList]);

  // Actions
  const handleDeleteModel = useCallback(
    async (modelId: string, modelName?: string) => {
      if (!accessToken) {
        toast.error('Authentication required to delete model');
        return;
      }

      setDeletingModels((prev) => new Set(prev).add(modelId));
      try {
        await deleteModel(accessToken, modelId);
        setRegisteredModels((prev) => prev.filter((m) => m.model_id !== modelId));
        setModelStatuses(({ [modelId]: _removed, ...rest }) => rest);
        setAvailableModels((prev) => prev.filter((m) => m.model_id !== modelId));
        toast.success(modelName ? `"${modelName}" deleted successfully` : 'Model deleted');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to delete model');
      } finally {
        setDeletingModels((prev) => {
          const next = new Set(prev);
          next.delete(modelId);
          return next;
        });
      }
    },
    [accessToken, deleteModel]
  );

  const handleRetryModel = useCallback(
    async (model: RegisteredModel) => {
      await handleDeleteModel(model.model_id);
      setPreFillHfModelId(model.hf_model_id);
    },
    [handleDeleteModel]
  );

  const handleModelRegistered = useCallback((model: RegisteredModel) => {
    setRegisteredModels((prev) => [...prev, model]);
    setPreFillHfModelId(undefined);
    toast.info(`Model "${model.display_name}" is being downloaded...`);
  }, []);

  const allModels = useMemo(
    () => (availableModels.length === 0 ? [] : availableModels.map(toDeploymentModel)),
    [availableModels]
  );

  const deployableModels = useMemo(
    () =>
      allModels.filter((model) => {
        const apiModel = availableModels.find((m) => m.model_id === model.id);
        return apiModel?.ready_for_deployment ?? true;
      }),
    [allModels, availableModels]
  );

  const getStatus = useCallback(
    (model: RegisteredModel) => modelStatuses[model.model_id] ?? model,
    [modelStatuses]
  );

  const inProgressModels = useMemo(
    () =>
      registeredModels.filter((m) =>
        ['downloading', 'pending', 'uploading'].includes(getStatus(m).download_status)
      ),
    [registeredModels, getStatus]
  );

  const readyModels = useMemo(
    () => registeredModels.filter((m) => getStatus(m).download_status === 'ready'),
    [registeredModels, getStatus]
  );

  const failedModels = useMemo(
    () => registeredModels.filter((m) => getStatus(m).download_status === 'failed'),
    [registeredModels, getStatus]
  );

  return {
    availableModels,
    registeredModels,
    modelStatuses,
    loadingModels,
    deletingModels,
    allModels,
    deployableModels,
    inProgressModels,
    readyModels,
    failedModels,
    handleModelRegistered,
    handleDeleteModel,
    handleRetryModel,
    preFillHfModelId,
    setPreFillHfModelId,
  };
}
