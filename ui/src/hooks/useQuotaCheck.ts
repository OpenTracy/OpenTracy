import { useCallback } from 'react';
import { toast } from 'sonner';
import { useUser } from '../contexts/UserContext';
import { checkQuota, type ResourceType, type QuotaCheckResponse } from '../services/quotaService';

const environment = import.meta.env.VITE_ENVIRONMENT || 'dev';
const isDevEnvironment = environment !== 'prod';

/**
 * Hook that checks resource quota before job submission.
 * Only active in dev environment — in prod it always returns available: true.
 */
export function useQuotaCheck() {
  const { idToken } = useUser();

  const checkResourceQuota = useCallback(
    async (
      resourceType: ResourceType
    ): Promise<{ available: boolean; data?: QuotaCheckResponse }> => {
      if (!isDevEnvironment) {
        return { available: true };
      }

      if (!idToken) {
        return { available: true };
      }

      try {
        const data = await checkQuota(idToken, resourceType);

        if (!data.available) {
          const pool = Object.values(data.resources)[0];
          if (pool) {
            if (pool.queue_pressure === 'high') {
              toast.warning(
                'Queue is busy — your job may take longer to start. Consider waiting for current jobs to complete.',
                { duration: 6000 }
              );
            } else {
              toast.error(
                `No ${resourceType === 'gpu_training' ? 'GPU' : 'CPU'} capacity available. Try again later.`,
                { duration: 6000 }
              );
              return { available: false, data };
            }
          }
        }

        return { available: true, data };
      } catch (err) {
        // Quota check failure should not block job submission
        console.warn('[QuotaCheck] Failed to check quota, allowing submission:', err);
        return { available: true };
      }
    },
    [idToken]
  );

  return { checkResourceQuota, isQuotaCheckEnabled: isDevEnvironment };
}
