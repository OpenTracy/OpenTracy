import { useCallback } from 'react';
import type {
  FineTuningJob,
  CreateFineTuningJobRequest,
  FineTuningJobResponse,
} from '../types/fineTuningTypes';
import { API_BASE_URL } from '../config/api';

const API_BASE = API_BASE_URL;

export function useFineTuningService() {
  const createFineTuningJob = useCallback(
    async (idToken: string, jobData: Partial<FineTuningJob>): Promise<FineTuningJobResponse> => {
      try {
        const payload: CreateFineTuningJobRequest = {
          name: jobData.name!,
          baseModel: jobData.baseModel!,
          trainingConfig: jobData.trainingConfig!,
          loraConfig: jobData.loraConfig,
        };

        // Handle dataset file upload or URL
        if (jobData.dataset?.type === 'upload' && jobData.dataset.file) {
          // For file uploads, we'll use multipart/form-data
          const formData = new FormData();
          formData.append('name', payload.name);
          formData.append('baseModel', payload.baseModel);
          formData.append('trainingConfig', JSON.stringify(payload.trainingConfig));
          if (payload.loraConfig) {
            formData.append('loraConfig', JSON.stringify(payload.loraConfig));
          }
          formData.append('dataset', jobData.dataset.file);

          console.log('[FineTuningService] Creating job with file upload');

          const res = await fetch(`${API_BASE}/v1/fine-tuning/jobs`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${idToken}`,
            },
            body: formData,
          });

          if (!res.ok) {
            const errorText = await res.text().catch(() => '');
            console.error(
              '[FineTuningService] Create job failed:',
              res.status,
              res.statusText,
              errorText
            );
            throw new Error(
              `Failed to create fine-tuning job: ${res.status} ${res.statusText}${errorText ? ` - ${errorText}` : ''}`
            );
          }

          const result = await res.json();
          console.log('[FineTuningService] Job created:', result);
          return result;
        } else if (jobData.dataset?.type === 'url' && jobData.dataset.url) {
          // For URL datasets, use JSON payload
          const body = {
            ...payload,
            datasetUrl: jobData.dataset.url,
          };

          console.log('[FineTuningService] Creating job with dataset URL');

          const res = await fetch(`${API_BASE}/v1/fine-tuning/jobs`, {
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
              '[FineTuningService] Create job failed:',
              res.status,
              res.statusText,
              errorText
            );
            throw new Error(
              `Failed to create fine-tuning job: ${res.status} ${res.statusText}${errorText ? ` - ${errorText}` : ''}`
            );
          }

          const result = await res.json();
          console.log('[FineTuningService] Job created:', result);
          return result;
        } else {
          throw new Error('No dataset provided');
        }
      } catch (error) {
        console.error('[FineTuningService] Create job error:', error);
        throw error;
      }
    },
    []
  );

  const listFineTuningJobs = useCallback(async (idToken: string): Promise<FineTuningJob[]> => {
    try {
      console.log('[FineTuningService] Fetching fine-tuning jobs');

      const res = await fetch(`${API_BASE}/v1/fine-tuning/jobs`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        console.error(
          '[FineTuningService] List jobs failed:',
          res.status,
          res.statusText,
          errorText
        );
        throw new Error(`Failed to fetch fine-tuning jobs: ${res.status} ${res.statusText}`);
      }

      const result = await res.json();
      console.log('[FineTuningService] Jobs fetched:', result);

      // API might return { jobs: [...] } or just [...]
      return Array.isArray(result) ? result : result.jobs || [];
    } catch (error) {
      console.error('[FineTuningService] List jobs error:', error);
      throw error;
    }
  }, []);

  const getFineTuningJob = useCallback(
    async (idToken: string, jobId: string): Promise<FineTuningJob> => {
      try {
        console.log('[FineTuningService] Fetching job:', jobId);

        const res = await fetch(`${API_BASE}/v1/fine-tuning/jobs/${jobId}`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        });

        if (!res.ok) {
          const errorText = await res.text().catch(() => '');
          console.error(
            '[FineTuningService] Get job failed:',
            res.status,
            res.statusText,
            errorText
          );
          throw new Error(`Failed to fetch fine-tuning job: ${res.status} ${res.statusText}`);
        }

        const result = await res.json();
        console.log('[FineTuningService] Job fetched:', result);
        return result.job || result;
      } catch (error) {
        console.error('[FineTuningService] Get job error:', error);
        throw error;
      }
    },
    []
  );

  const cancelFineTuningJob = useCallback(async (idToken: string, jobId: string): Promise<void> => {
    try {
      console.log('[FineTuningService] Cancelling job:', jobId);

      const res = await fetch(`${API_BASE}/v1/fine-tuning/jobs/${jobId}/cancel`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        console.error(
          '[FineTuningService] Cancel job failed:',
          res.status,
          res.statusText,
          errorText
        );
        throw new Error(`Failed to cancel fine-tuning job: ${res.status} ${res.statusText}`);
      }

      console.log('[FineTuningService] Job cancelled');
    } catch (error) {
      console.error('[FineTuningService] Cancel job error:', error);
      throw error;
    }
  }, []);

  const deleteFineTuningJob = useCallback(async (idToken: string, jobId: string): Promise<void> => {
    try {
      console.log('[FineTuningService] Deleting job:', jobId);

      const res = await fetch(`${API_BASE}/v1/fine-tuning/jobs/${jobId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        console.error(
          '[FineTuningService] Delete job failed:',
          res.status,
          res.statusText,
          errorText
        );
        throw new Error(`Failed to delete fine-tuning job: ${res.status} ${res.statusText}`);
      }

      console.log('[FineTuningService] Job deleted');
    } catch (error) {
      console.error('[FineTuningService] Delete job error:', error);
      throw error;
    }
  }, []);

  return {
    createFineTuningJob,
    listFineTuningJobs,
    getFineTuningJob,
    cancelFineTuningJob,
    deleteFineTuningJob,
  };
}
