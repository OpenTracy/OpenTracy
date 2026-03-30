import { useState, useEffect, useCallback } from 'react';
import { usePostHog } from 'posthog-js/react';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useUser } from '../contexts/UserContext';
import type { KeyResponse } from '../services/keyService';
import { keyService } from '../services/keyService';
import type { Schema } from '../../amplify/data/resource';
import { getAmplifyClient } from '@/lib/amplifyClient';

type ApiKey = NonNullable<Schema['ApiKeys']['type']>;
type CreateApiKeyInput = Schema['ApiKeys']['createType'];
type UpdateApiKeyInput = Schema['ApiKeys']['updateType'];

interface UseApiKeysState {
  apiKeys: ApiKey[];
  loading: boolean;
  error: string | null;
  creating: boolean;
  updating: boolean;
  deleting: boolean;
  lastCreatedKey: KeyResponse | null; // <- contém key "pk_live_..."
}

interface UseApiKeysReturn extends UseApiKeysState {
  createApiKey: (data: Partial<CreateApiKeyInput>) => Promise<ApiKey | null>;
  updateApiKey: (id: string, data: Partial<UpdateApiKeyInput>) => Promise<ApiKey | null>;
  deleteApiKey: (id: string) => Promise<boolean>;
  getApiKeyById: (id: string) => ApiKey | undefined;
  getApiKeyByUuid: (uuid: string) => ApiKey | undefined;
  searchApiKeys: (query: string) => ApiKey[];
  refreshApiKeys: () => Promise<void>;
  clearError: () => void;
  clearLastCreatedKey: () => void;
  validateApiKeyData: (data: Partial<CreateApiKeyInput>) => string[];
}

const validateApiKeyData = (data: Partial<CreateApiKeyInput>): string[] => {
  const errors: string[] = [];
  if (!data.name?.trim()) errors.push('Name is required');
  else if (data.name.length > 100) errors.push('Name must be 100 characters or less');
  if (data.maxCreditsAmount != null && data.maxCreditsAmount < 0) {
    errors.push('Max credits amount must be a non-negative integer');
  }
  return errors;
};

export const useApiKeys = (): UseApiKeysReturn => {
  const { currentWorkspace, loading: workspaceLoading } = useWorkspace();
  const { accessToken } = useUser();
  const posthog = usePostHog();

  // keyService agora só precisa do accessToken (JWT) para todas as operações
  const { createKey, deleteKey } = keyService(accessToken ?? undefined);

  const userId = currentWorkspace?.type === 'personal' ? currentWorkspace.id : undefined;
  const organizationId =
    currentWorkspace?.type === 'organization' ? currentWorkspace.id : undefined;

  const [state, setState] = useState<UseApiKeysState>({
    apiKeys: [],
    loading: false,
    error: null,
    creating: false,
    updating: false,
    deleting: false,
    lastCreatedKey: null,
  });

  const setPartialState = useCallback(
    (partial: Partial<UseApiKeysState> | ((prev: UseApiKeysState) => Partial<UseApiKeysState>)) => {
      if (typeof partial === 'function') {
        setState((prev) => ({ ...prev, ...partial(prev) }));
      } else {
        setState((prev) => ({ ...prev, ...partial }));
      }
    },
    []
  );

  const loadApiKeys = useCallback(async () => {
    if (!userId && !organizationId) return;

    setPartialState({ loading: true, error: null });

    try {
      const filter = userId
        ? { userId: { eq: userId } }
        : { organizationId: { eq: organizationId } };

      console.debug('[ApiKeys] listing keys (GraphQL) with filter:', filter);
      const { data } = await getAmplifyClient().models.ApiKeys.list({ filter });
      setPartialState({ apiKeys: data ?? [], loading: false });
    } catch (err) {
      console.error('[ApiKeys] load error', err);
      setPartialState({
        loading: false,
        error: err instanceof Error ? err.message : 'Error loading API keys',
      });
    }
  }, [userId, organizationId, setPartialState]);

  useEffect(() => {
    if (!workspaceLoading && (userId || organizationId)) {
      loadApiKeys();
    }
  }, [workspaceLoading, userId, organizationId, loadApiKeys]);

  const createApiKey = useCallback(
    async (input: Partial<CreateApiKeyInput>): Promise<ApiKey | null> => {
      const errors = validateApiKeyData(input);
      if (errors.length > 0) {
        setPartialState({ error: errors.join(', ') });
        return null;
      }

      setPartialState({ creating: true, error: null, lastCreatedKey: null });

      try {
        const name = input.name!.trim();

        // Evita duplicar por nome na lista local
        const duplicated = state.apiKeys.find((k) => k.name.toLowerCase() === name.toLowerCase());
        if (duplicated) throw new Error(`An API key with name "${name}" already exists`);

        if (!accessToken) throw new Error('Not authenticated (missing accessToken)');

        // 1) CHAMADA ao API Gateway
        console.debug('[ApiKeys] calling API Gateway POST /api-keys with name =', name);
        const remote = await createKey(name); // <- dispara a chamada externa
        console.debug('[ApiKeys] API Gateway returned:', remote);

        // 2) Persistência local (somente o ID do Gateway — NÃO o segredo)
        const { data } = await getAmplifyClient().models.ApiKeys.create({
          uuid: String(remote.id), // <- identificador do API Gateway (convertido para string)
          name,
          userId,
          organizationId,
          maxCreditsAmount: input.maxCreditsAmount ?? 0,
          isActive: input.isActive ?? true,
          lastUsed: null,
        });

        if (!data) throw new Error('Failed to persist API key locally');

        // 3) Atualiza lista + expõe o segredo para o modal
        setPartialState((prev) => ({
          apiKeys: [...prev.apiKeys, data],
          creating: false,
          lastCreatedKey: remote, // <- contém key "pk_live_..."
        }));

        // Track API key creation event
        posthog.capture('api_key_created', {
          workspace_type: currentWorkspace?.type,
        });

        return data;
      } catch (err) {
        console.error('[ApiKeys] create error', err);
        setPartialState({
          creating: false,
          error: err instanceof Error ? err.message : 'Error creating API key',
        });
        return null;
      }
    },
    [
      state.apiKeys,
      userId,
      organizationId,
      accessToken,
      createKey,
      setPartialState,
      posthog,
      currentWorkspace,
    ]
  );

  const updateApiKey = useCallback(
    async (id: string, updates: Partial<UpdateApiKeyInput>): Promise<ApiKey | null> => {
      setPartialState({ updating: true, error: null });
      try {
        const { data } = await getAmplifyClient().models.ApiKeys.update({ id, ...updates });
        if (!data) throw new Error('Update failed');
        setPartialState((prev) => ({
          apiKeys: prev.apiKeys.map((k) => (k.id === id ? data : k)),
          updating: false,
        }));
        return data;
      } catch (err) {
        console.error('[ApiKeys] update error', err);
        setPartialState({
          updating: false,
          error: err instanceof Error ? err.message : 'Error updating API key',
        });
        return null;
      }
    },
    [setPartialState]
  );

  const deleteApiKey = useCallback(
    async (id: string): Promise<boolean> => {
      setPartialState({ deleting: true, error: null });
      try {
        const { data } = await getAmplifyClient().models.ApiKeys.delete({ id });
        if (!data) throw new Error('Delete failed (local)');

        await deleteKey((data as ApiKey).uuid); // revoga no API Gateway usando accessToken (JWT)
        setPartialState((prev) => ({
          apiKeys: prev.apiKeys.filter((k) => k.id !== id),
          deleting: false,
        }));

        // Track API key deletion event
        posthog.capture('api_key_deleted', {
          workspace_type: currentWorkspace?.type,
        });

        return true;
      } catch (err) {
        console.error('[ApiKeys] delete error', err);
        setPartialState({
          deleting: false,
          error: err instanceof Error ? err.message : 'Error deleting API key',
        });
        return false;
      }
    },
    [deleteKey, setPartialState, posthog, currentWorkspace]
  );

  const getApiKeyById = useCallback(
    (id: string) => {
      return state.apiKeys.find((k) => k.id === id);
    },
    [state.apiKeys]
  );

  const getApiKeyByUuid = useCallback(
    (uuid: string) => {
      return state.apiKeys.find((k) => k.uuid === uuid);
    },
    [state.apiKeys]
  );

  const searchApiKeys = useCallback(
    (q: string) => {
      const term = q.toLowerCase().trim();
      return !term
        ? state.apiKeys
        : state.apiKeys.filter((k) => k.name.toLowerCase().includes(term));
    },
    [state.apiKeys]
  );

  const refreshApiKeys = useCallback(async () => {
    await loadApiKeys();
  }, [loadApiKeys]);

  const clearError = useCallback(() => setPartialState({ error: null }), [setPartialState]);

  const clearLastCreatedKey = useCallback(
    () => setPartialState({ lastCreatedKey: null }),
    [setPartialState]
  );

  return {
    ...state,
    createApiKey,
    updateApiKey,
    deleteApiKey,
    getApiKeyById,
    getApiKeyByUuid,
    searchApiKeys,
    refreshApiKeys,
    clearError,
    clearLastCreatedKey,
    validateApiKeyData,
  };
};
