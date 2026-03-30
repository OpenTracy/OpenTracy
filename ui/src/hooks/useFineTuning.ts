import { useState, useEffect, useCallback } from 'react';
import { usePostHog } from 'posthog-js/react';
import { useFineTuningService } from '../services/fineTuningService';
import type { FineTuningJob } from '../types/fineTuningTypes';
import { useUser } from '../contexts/UserContext';
import { useQuotaCheck } from './useQuotaCheck';

interface UseFineTuningState {
  jobs: FineTuningJob[];
  loading: boolean;
  creating: boolean;
  error: string | null;
}

interface UseFineTuningReturn extends UseFineTuningState {
  createJob: (jobData: Partial<FineTuningJob>) => Promise<FineTuningJob | null>;
  refreshJobs: () => Promise<void>;
  deleteJob: (jobId: string) => Promise<boolean>;
  cancelJob: (jobId: string) => Promise<boolean>;
  getJobById: (jobId: string) => FineTuningJob | undefined;
  clearError: () => void;
}

export const useFineTuning = (): UseFineTuningReturn => {
  const { idToken } = useUser();
  const posthog = usePostHog();
  const { createFineTuningJob, listFineTuningJobs, deleteFineTuningJob, cancelFineTuningJob } =
    useFineTuningService();
  const { checkResourceQuota } = useQuotaCheck();

  const [state, setState] = useState<UseFineTuningState>({
    jobs: [],
    loading: false,
    creating: false,
    error: null,
  });

  const setPartialState = (
    partial:
      | Partial<UseFineTuningState>
      | ((prev: UseFineTuningState) => Partial<UseFineTuningState>)
  ) =>
    setState((prev) => ({
      ...prev,
      ...(typeof partial === 'function' ? partial(prev) : partial),
    }));

  const createJob = useCallback(
    async (jobData: Partial<FineTuningJob>): Promise<FineTuningJob | null> => {
      if (!idToken) {
        throw new Error('ID token not available. Please login again.');
      }

      setPartialState({ creating: true, error: null });
      try {
        const { available } = await checkResourceQuota('gpu_training');
        if (!available) {
          setPartialState({ creating: false });
          return null;
        }

        const response = await createFineTuningJob(idToken, jobData);

        const newJob: FineTuningJob = {
          ...response.job,
          id: response.job.id || crypto.randomUUID(),
          name: response.job.name || jobData.name!,
          baseModel: response.job.baseModel || jobData.baseModel!,
          dataset: response.job.dataset || jobData.dataset!,
          trainingConfig: response.job.trainingConfig || jobData.trainingConfig!,
          loraConfig: response.job.loraConfig || jobData.loraConfig,
          status: response.job.status || 'pending',
          createdAt: response.job.createdAt || new Date().toISOString(),
        };

        setPartialState((prev) => ({
          jobs: [newJob, ...prev.jobs],
          creating: false,
        }));

        // Track fine-tuning job creation event
        posthog.capture('fine_tuning_job_created', {
          base_model: jobData.baseModel,
        });

        return newJob;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to create fine-tuning job';
        setPartialState({ error: errorMessage, creating: false });
        throw error;
      }
    },
    [idToken, createFineTuningJob, posthog, checkResourceQuota]
  );

  const refreshJobs = useCallback(async () => {
    if (!idToken) return;

    setPartialState({ loading: true, error: null });
    try {
      const jobs = await listFineTuningJobs(idToken);
      setPartialState({ jobs, loading: false });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to fetch fine-tuning jobs';
      setPartialState({ error: errorMessage, loading: false });
    }
  }, [idToken, listFineTuningJobs]);

  const deleteJob = useCallback(
    async (jobId: string): Promise<boolean> => {
      if (!idToken) {
        throw new Error('ID token not available. Please login again.');
      }

      try {
        await deleteFineTuningJob(idToken, jobId);

        setPartialState((prev) => ({
          jobs: prev.jobs.filter((job) => job.id !== jobId),
        }));

        // Track fine-tuning job deletion event
        posthog.capture('fine_tuning_job_deleted');

        return true;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to delete fine-tuning job';
        setPartialState({ error: errorMessage });
        return false;
      }
    },
    [idToken, deleteFineTuningJob, posthog]
  );

  const cancelJob = useCallback(
    async (jobId: string): Promise<boolean> => {
      if (!idToken) {
        throw new Error('ID token not available. Please login again.');
      }

      try {
        await cancelFineTuningJob(idToken, jobId);

        setPartialState((prev) => ({
          jobs: prev.jobs.map((job) =>
            job.id === jobId ? { ...job, status: 'cancelled' as const } : job
          ),
        }));

        // Track fine-tuning job cancellation event
        posthog.capture('fine_tuning_job_cancelled');

        return true;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to cancel fine-tuning job';
        setPartialState({ error: errorMessage });
        return false;
      }
    },
    [idToken, cancelFineTuningJob, posthog]
  );

  const getJobById = useCallback(
    (jobId: string) => {
      return state.jobs.find((job) => job.id === jobId);
    },
    [state.jobs]
  );

  const clearError = useCallback(() => {
    setPartialState({ error: null });
  }, []);

  // Load jobs on mount
  useEffect(() => {
    refreshJobs();
  }, [refreshJobs]);

  // Poll for job updates every 10 seconds if there are running jobs
  useEffect(() => {
    const hasRunningJobs = state.jobs.some(
      (job) => job.status === 'running' || job.status === 'pending'
    );

    if (!hasRunningJobs) return;

    const interval = setInterval(() => {
      refreshJobs();
    }, 10000); // Poll every 10 seconds

    return () => clearInterval(interval);
  }, [state.jobs, refreshJobs]);

  return {
    ...state,
    createJob,
    refreshJobs,
    deleteJob,
    cancelJob,
    getJobById,
    clearError,
  };
};
