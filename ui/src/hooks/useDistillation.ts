import { useState, useCallback, useEffect, useRef } from 'react';
import { useUser } from '../contexts/UserContext';
import { useDistillationService } from '../services/distillationService';
import { useQuotaCheck } from './useQuotaCheck';
import type {
  DistillationJob,
  DistillationStatus,
  DistillationResults,
  CreateDistillationJobRequest,
  GGUFArtifact,
  AvailableTeacherModel,
} from '../types/distillationTypes';
import type {
  CurationSample,
  EstimateRequest,
  EstimateResponse,
} from '../services/distillationService';

const ACTIVE_STATUSES: DistillationStatus[] = ['pending', 'queued', 'running'];

const POLLING_INTERVALS: Record<DistillationStatus, number> = {
  pending: 5000,
  queued: 5000,
  running: 5000,
  completed: 0,
  failed: 0,
  cancelled: 0,
};

interface UseDistillationState {
  jobs: DistillationJob[];
  loading: boolean;
  error: string | null;
}

interface DeployJobResult {
  deployment_id: string;
  model_id: string;
  status: string;
  already_deployed: boolean;
}

interface UseDistillationReturn extends UseDistillationState {
  refreshJobs: () => Promise<void>;
  getJob: (id: string) => Promise<DistillationJob | null>;
  createJob: (request: CreateDistillationJobRequest) => Promise<DistillationJob | null>;
  cancelJob: (id: string) => Promise<boolean>;
  deleteJob: (id: string) => Promise<boolean>;
  getJobResults: (id: string) => Promise<DistillationResults | null>;
  getJobLogs: (id: string) => Promise<string[]>;
  getJobCandidates: (id: string) => Promise<{ samples: CurationSample[]; total: number }>;
  getJobArtifacts: (id: string) => Promise<GGUFArtifact[]>;
  listAvailableModels: () => Promise<AvailableTeacherModel[]>;
  estimateJob: (request: EstimateRequest) => Promise<EstimateResponse | null>;
  deployJob: (id: string, instanceType?: string) => Promise<DeployJobResult | null>;
  clearError: () => void;
}

export function useDistillation(): UseDistillationReturn {
  const { accessToken, tenantId } = useUser();
  const service = useDistillationService();
  const { checkResourceQuota } = useQuotaCheck();
  const initialLoadDone = useRef(false);

  const [state, setState] = useState<UseDistillationState>({
    jobs: [],
    loading: true,
    error: null,
  });

  const setPartialState = useCallback((partial: Partial<UseDistillationState>) => {
    setState((prev) => ({ ...prev, ...partial }));
  }, []);

  const refreshJobs = useCallback(async () => {
    if (!accessToken || !tenantId) return;

    setPartialState({ loading: true, error: null });
    try {
      const jobs = await service.listJobs(accessToken, tenantId);
      setPartialState({ jobs, loading: false });
    } catch (err) {
      console.error('Failed to fetch distillation jobs:', err);
      setPartialState({
        jobs: [],
        error: err instanceof Error ? err.message : 'Failed to fetch jobs',
        loading: false,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, tenantId]);

  const getJob = useCallback(
    async (id: string): Promise<DistillationJob | null> => {
      if (!accessToken || !tenantId) return null;
      try {
        return await service.getJob(accessToken, id, tenantId);
      } catch (err) {
        console.error('Failed to get distillation job:', err);
        return null;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [accessToken, tenantId]
  );

  const createJob = useCallback(
    async (request: CreateDistillationJobRequest): Promise<DistillationJob | null> => {
      if (!accessToken || !tenantId) return null;

      try {
        const { available } = await checkResourceQuota('gpu_training');
        if (!available) return null;

        const job = await service.createJob(accessToken, request, tenantId);
        setState((prev) => ({
          ...prev,
          jobs: [job, ...prev.jobs],
        }));
        return job;
      } catch (err) {
        console.error('Failed to create distillation job:', err);
        setPartialState({
          error: err instanceof Error ? err.message : 'Failed to create job',
        });
        return null;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [accessToken, tenantId]
  );

  const cancelJob = useCallback(
    async (id: string): Promise<boolean> => {
      if (!accessToken || !tenantId) return false;

      try {
        const success = await service.cancelJob(accessToken, id, tenantId);
        if (success) {
          setState((prev) => ({
            ...prev,
            jobs: prev.jobs.map((j) =>
              j.id === id ? { ...j, status: 'cancelled' as DistillationStatus } : j
            ),
          }));
        }
        return success;
      } catch (err) {
        console.error('Failed to cancel distillation job:', err);
        setPartialState({
          error: err instanceof Error ? err.message : 'Failed to cancel job',
        });
        return false;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [accessToken, tenantId]
  );

  const deleteJob = useCallback(
    async (id: string): Promise<boolean> => {
      if (!accessToken || !tenantId) return false;

      try {
        const success = await service.deleteJob(accessToken, id, tenantId);
        if (success) {
          setState((prev) => ({
            ...prev,
            jobs: prev.jobs.filter((j) => j.id !== id),
          }));
        }
        return success;
      } catch (err) {
        console.error('Failed to delete distillation job:', err);
        setPartialState({
          error: err instanceof Error ? err.message : 'Failed to delete job',
        });
        return false;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [accessToken, tenantId]
  );

  const getJobResults = useCallback(
    async (id: string): Promise<DistillationResults | null> => {
      if (!accessToken || !tenantId) return null;
      try {
        return await service.getJobResults(accessToken, id, tenantId);
      } catch (err) {
        console.error('Failed to get job results:', err);
        return null;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [accessToken, tenantId]
  );

  const getJobLogs = useCallback(
    async (id: string): Promise<string[]> => {
      if (!accessToken || !tenantId) return [];
      try {
        return await service.getJobLogs(accessToken, id, tenantId);
      } catch (err) {
        console.error('Failed to get job logs:', err);
        return [];
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [accessToken, tenantId]
  );

  const getJobCandidates = useCallback(
    async (id: string): Promise<{ samples: CurationSample[]; total: number }> => {
      if (!accessToken || !tenantId) return { samples: [], total: 0 };
      try {
        return await service.getJobCandidates(accessToken, id, tenantId);
      } catch (err) {
        console.error('Failed to get job candidates:', err);
        return { samples: [], total: 0 };
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [accessToken, tenantId]
  );

  const getJobArtifacts = useCallback(
    async (id: string): Promise<GGUFArtifact[]> => {
      if (!accessToken || !tenantId) return [];
      try {
        return await service.getJobArtifacts(accessToken, id, tenantId);
      } catch (err) {
        console.error('Failed to get job artifacts:', err);
        return [];
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [accessToken, tenantId]
  );

  const listAvailableModels = useCallback(
    async (): Promise<AvailableTeacherModel[]> => {
      if (!accessToken) return [];
      try {
        return await service.listAvailableModels(accessToken);
      } catch (err) {
        console.error('Failed to list available models:', err);
        return [];
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [accessToken]
  );

  const estimateJob = useCallback(
    async (request: EstimateRequest): Promise<EstimateResponse | null> => {
      if (!accessToken || !tenantId) return null;
      try {
        return await service.estimateJob(accessToken, request, tenantId);
      } catch (err) {
        console.error('Failed to estimate job cost:', err);
        return null;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [accessToken, tenantId]
  );

  const deployJob = useCallback(
    async (id: string, instanceType?: string): Promise<DeployJobResult | null> => {
      if (!accessToken || !tenantId) return null;
      try {
        const { available } = await checkResourceQuota('cpu_export');
        if (!available) return null;

        return await service.deployJob(accessToken, id, tenantId, instanceType);
      } catch (err) {
        console.error('Failed to deploy distillation job:', err);
        setPartialState({
          error: err instanceof Error ? err.message : 'Failed to deploy job',
        });
        return null;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [accessToken, tenantId]
  );

  const clearError = useCallback(() => {
    setPartialState({ error: null });
  }, [setPartialState]);

  // Initial load
  useEffect(() => {
    if (!accessToken || !tenantId || initialLoadDone.current) return;
    initialLoadDone.current = true;

    const loadData = async () => {
      setPartialState({ loading: true });
      try {
        const jobs = await service.listJobs(accessToken, tenantId);
        setPartialState({ jobs, loading: false });
      } catch (err) {
        console.error('Failed to load distillation jobs:', err);
        setPartialState({
          jobs: [],
          loading: false,
          error: err instanceof Error ? err.message : 'Failed to load jobs',
        });
      }
    };
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, tenantId]);

  // Polling for active jobs
  useEffect(() => {
    if (!accessToken || !tenantId) return;

    const activeJobs = state.jobs.filter((j) => ACTIVE_STATUSES.includes(j.status));
    if (activeJobs.length === 0) return;

    const hasPending = activeJobs.some((j) => j.status === 'pending' || j.status === 'queued');
    const interval = hasPending ? POLLING_INTERVALS.pending : POLLING_INTERVALS.running;

    const poll = async () => {
      try {
        const jobs = await service.listJobs(accessToken, tenantId);
        setPartialState({ jobs });
      } catch {
        // Silent fail on polling
      }
    };

    const intervalId = setInterval(poll, interval);
    return () => clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    state.jobs
      .filter((j) => ACTIVE_STATUSES.includes(j.status))
      .map((j) => `${j.id}:${j.status}`)
      .sort()
      .join(','),
    accessToken,
    tenantId,
  ]);

  return {
    ...state,
    refreshJobs,
    getJob,
    createJob,
    cancelJob,
    deleteJob,
    getJobResults,
    getJobLogs,
    getJobCandidates,
    getJobArtifacts,
    listAvailableModels,
    estimateJob,
    deployJob,
    clearError,
  };
}
