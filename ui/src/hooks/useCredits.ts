import { useState, useCallback, useEffect } from 'react';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useUser } from '../contexts/UserContext';
import type { Schema } from '../../amplify/data/resource';
import { creditsService } from '../services/creditsService';
import { getAmplifyClient } from '@/lib/amplifyClient';

type Credits = NonNullable<Schema['Credits']['type']>;
type CreateCreditsInput = Schema['Credits']['createType'];
type UpdateCreditsInput = Schema['Credits']['updateType'];

interface UseCreditsState {
  credits: Credits | null;
  loading: boolean;
  error: string | null;
  creating: boolean;
  updating: boolean;
}

interface UseCreditsReturn extends UseCreditsState {
  addCredits: (value: number) => Promise<boolean>;
  subtractCredits: (value: number) => Promise<boolean>;
  toggleAutoRefill: () => Promise<boolean>;
  updateRefillSettings: (amount: number, trigger: number) => Promise<boolean>;
  refreshCredits: () => Promise<void>;
  clearError: () => void;
  validateCreditsData: (data: Partial<CreateCreditsInput>) => string[];
}

const isPositiveInteger = (n: number) => Number.isInteger(n) && n > 0;
const isNonNegativeInteger = (n: number) => Number.isInteger(n) && n >= 0;

const validateCreditsFields = (data: Partial<CreateCreditsInput>): string[] => {
  const errors: string[] = [];

  const hasUserId = !!data.userId?.trim();
  const hasOrgId = !!data.organizationId?.trim();

  if (!hasUserId && !hasOrgId) {
    errors.push('Either User ID or Organization ID is required');
  } else if (hasUserId && hasOrgId) {
    errors.push('Cannot have both User ID and Organization ID');
  }

  if (data.credits !== undefined && !isNonNegativeInteger(data.credits)) {
    errors.push('Credits must be a non-negative integer');
  }

  if (data.autoRefillAmount !== undefined && !isNonNegativeInteger(data.autoRefillAmount)) {
    errors.push('Auto refill amount must be a non-negative integer');
  }

  if (data.autoRefillTrigger !== undefined && !isNonNegativeInteger(data.autoRefillTrigger)) {
    errors.push('Auto refill trigger must be a non-negative integer');
  }

  return errors;
};

const buildCreateInput = (
  credits: number,
  userId?: string,
  organizationId?: string
): CreateCreditsInput => ({
  credits,
  autoRefill: false,
  autoRefillAmount: 0,
  autoRefillTrigger: 0,
  ...(userId ? { userId } : {}),
  ...(organizationId ? { organizationId } : {}),
});

export const useCredits = (): UseCreditsReturn => {
  const { currentWorkspace, loading: workspaceLoading } = useWorkspace();
  const { fetchCredits, addCredits: addServiceCredits } = creditsService();
  const { accessToken } = useUser();

  const userId = currentWorkspace?.type === 'personal' ? currentWorkspace.id : undefined;
  const organizationId =
    currentWorkspace?.type === 'organization' ? currentWorkspace.id : undefined;

  const [state, setState] = useState<UseCreditsState>({
    credits: null,
    loading: false,
    error: null,
    creating: false,
    updating: false,
  });

  const setPartialState = useCallback((partial: Partial<UseCreditsState>) => {
    setState((prev) => ({ ...prev, ...partial }));
  }, []);

  const loadCredits = useCallback(async (): Promise<void> => {
    if (!userId && !organizationId) return;

    setPartialState({ loading: true, error: null });

    try {
      const filter = userId
        ? { userId: { eq: userId } }
        : { organizationId: { eq: organizationId } };

      const { data } = await getAmplifyClient().models.Credits.list({ filter });

      const local = data?.[0] ?? null;
      setPartialState({ credits: local });

      if (accessToken) {
        try {
          const routerBalance = await fetchCredits(accessToken);
          if (local) {
            if ((local.credits ?? 0) !== routerBalance.balance) {
              const { data: updated } = await getAmplifyClient().models.Credits.update({
                id: local.id,
                credits: routerBalance.balance,
              });

              setPartialState({ credits: updated ?? { ...local, credits: routerBalance.balance } });
            } else {
              setPartialState({ credits: { ...local, credits: routerBalance.balance } });
            }
          } else {
            const input = buildCreateInput(routerBalance.balance, userId, organizationId);
            const validationErrors = validateCreditsFields(input);
            if (validationErrors.length === 0) {
              const { data: created } = await getAmplifyClient().models.Credits.create(input);
              setPartialState({ credits: created ?? ({ ...input, id: 'temp-id' } as Credits) });
            } else {
              console.warn('Credits validation failed for create from router:', validationErrors);
            }
          }
        } catch (routerErr) {
          console.warn('Failed to sync with router credits:', routerErr);
        }
      }

      setPartialState({ loading: false });
    } catch (err) {
      setPartialState({
        loading: false,
        error: err instanceof Error ? err.message : 'Error loading credits',
      });
    }
  }, [userId, organizationId, accessToken, setPartialState]);

  useEffect(() => {
    if (!workspaceLoading && (userId || organizationId)) {
      void loadCredits();
    }
  }, [workspaceLoading, userId, organizationId, loadCredits]);

  const addCredits = useCallback(
    async (value: number): Promise<boolean> => {
      if (!isNonNegativeInteger(value)) {
        setPartialState({ error: 'Credits must be a non-negative integer' });
        return false;
      }
      if (!accessToken) {
        setPartialState({ error: 'Missing access token for external credits API' });
        return false;
      }

      setPartialState({ creating: true, error: null });

      try {
        const routerResp = await addServiceCredits(accessToken, value);
        const newBalance = routerResp.balance;

        if (state.credits) {
          const { data: updated } = await getAmplifyClient().models.Credits.update({
            id: state.credits.id,
            credits: newBalance,
          });
          setPartialState({ credits: updated ?? state.credits, creating: false });
        } else {
          const input = buildCreateInput(newBalance, userId, organizationId);
          const validationErrors = validateCreditsFields(input);
          if (validationErrors.length) {
            setPartialState({ creating: false, error: validationErrors.join(', ') });
            return false;
          }
          const { data: created } = await getAmplifyClient().models.Credits.create(input);
          setPartialState({ credits: created ?? null, creating: false });
        }

        return true;
      } catch (err) {
        setPartialState({
          creating: false,
          error: err instanceof Error ? err.message : 'Error adding credits',
        });
        return false;
      }
    },
    [accessToken, state.credits, userId, organizationId, setPartialState]
  );

  const subtractCredits = useCallback(
    async (value: number): Promise<boolean> => {
      if (!isPositiveInteger(value)) {
        setPartialState({ error: 'Credits value must be a positive integer' });
        return false;
      }

      const currentCredits = state.credits?.credits ?? 0;
      if (currentCredits < value) {
        setPartialState({ error: 'Insufficient credits' });
        return false;
      }

      try {
        setPartialState({ updating: true, error: null });

        const newCredits = currentCredits - value;
        if (!state.credits) {
          setPartialState({ updating: false, error: 'Credits not initialized' });
          return false;
        }

        const { data: updated } = await getAmplifyClient().models.Credits.update({
          id: state.credits.id,
          credits: newCredits,
        });

        setPartialState({ credits: updated ?? state.credits, updating: false });
        return true;
      } catch (err) {
        setPartialState({
          updating: false,
          error: err instanceof Error ? err.message : 'Error subtracting credits',
        });
        return false;
      }
    },
    [state.credits, setPartialState]
  );

  const updateCreditsFields = useCallback(
    async (fields: Partial<UpdateCreditsInput>): Promise<boolean> => {
      if (!state.credits) {
        setPartialState({ error: 'Credits not initialized' });
        return false;
      }

      try {
        setPartialState({ updating: true, error: null });

        const { data } = await getAmplifyClient().models.Credits.update({
          id: state.credits.id,
          ...fields,
        });

        setPartialState({ credits: data ?? state.credits, updating: false });
        return true;
      } catch (err) {
        setPartialState({
          updating: false,
          error: err instanceof Error ? err.message : 'Error updating credits',
        });
        return false;
      }
    },
    [state.credits, setPartialState]
  );

  const toggleAutoRefill = (): Promise<boolean> =>
    updateCreditsFields({ autoRefill: !state.credits?.autoRefill });

  const updateRefillSettings = (amount: number, trigger: number): Promise<boolean> => {
    if (!isNonNegativeInteger(amount) || !isNonNegativeInteger(trigger)) {
      setPartialState({ error: 'Refill values must be non-negative integers' });
      return Promise.resolve(false);
    }

    return updateCreditsFields({
      autoRefillAmount: amount,
      autoRefillTrigger: trigger,
    });
  };

  const clearError = useCallback(() => setPartialState({ error: null }), []);

  return {
    ...state,
    addCredits,
    subtractCredits,
    toggleAutoRefill,
    updateRefillSettings,
    refreshCredits: loadCredits,
    clearError,
    validateCreditsData: validateCreditsFields,
  };
};
