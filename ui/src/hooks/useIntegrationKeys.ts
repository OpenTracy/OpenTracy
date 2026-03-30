import { useState, useEffect, useCallback } from 'react';

interface IntegrationKey {
  id: string;
  keyName: string;
  keyValue?: string;
  provider?: string;
  createdAt?: string;
}

interface SimpleIntegration {
  keyName: string;
  keyValue: string;
  type: 'simple';
}

interface AWSIntegration {
  keyName: string;
  accessKey: string;
  secretKey: string;
  region?: string;
  type: 'aws';
}

export type IntegrationData = SimpleIntegration | AWSIntegration;
type UpdateIntegrationData = Partial<IntegrationData>;

interface UseIntegrationKeysState {
  integrationKeys: IntegrationKey[];
  loading: boolean;
  error: string | null;
  creating: boolean;
  updating: boolean;
  deleting: boolean;
  configuredProviders: string[];
  loadingProviders: boolean;
  providerLoadingStates: Record<string, boolean>;
  providerDeletingStates: Record<string, boolean>;
}

interface UseIntegrationKeysReturn extends UseIntegrationKeysState {
  createIntegrationKey: (data: IntegrationData) => Promise<IntegrationKey | null>;
  updateIntegrationKey: (id: string, data: UpdateIntegrationData) => Promise<IntegrationKey | null>;
  deleteIntegrationKey: (id: string) => Promise<boolean>;
  getIntegrationKeyByName: (keyName: string) => IntegrationKey | undefined;
  refreshIntegrationKeys: () => Promise<void>;
  clearError: () => void;
  validateIntegrationKeyData: (data: IntegrationData) => string[];
  refresh: () => Promise<void>;
  refreshConfiguredProviders: () => Promise<void>;
  isProviderConfigured: (provider: string) => boolean;
  isProviderLoading: (provider: string) => boolean;
  isProviderDeleting: (provider: string) => boolean;
}

const normalizeProvider = (p: string) =>
  p.toLowerCase().replace('_api_key', '').replace('_key', '');

const validateIntegrationKeyData = (data: IntegrationData): string[] => {
  const errors: string[] = [];

  if (!data.keyName?.trim()) errors.push('Key name is required');
  else if (data.keyName.length > 100) errors.push('Key name must be 100 characters or less');

  if (data.type === 'simple') {
    if (!data.keyValue?.trim()) errors.push('Key value is required for simple integration');
  } else if (data.type === 'aws') {
    if (!data.accessKey?.trim()) errors.push('Access key is required for AWS integration');
    if (!data.secretKey?.trim()) errors.push('Secret key is required for AWS integration');
    if (data.region !== undefined && data.region.trim() === '') {
      errors.push('Region cannot be empty if provided');
    }
  }

  return errors;
};

import { API_BASE_URL } from '../config/api';

const SECRETS_URL = `${API_BASE_URL}/v1/secrets`;

async function fetchConfiguredProviders(): Promise<string[]> {
  try {
    const res = await fetch(SECRETS_URL);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.configured_providers || []).map(normalizeProvider);
  } catch {
    return [];
  }
}

export const useIntegrationKeys = (): UseIntegrationKeysReturn => {
  const [state, setState] = useState<UseIntegrationKeysState>({
    integrationKeys: [],
    loading: true,
    error: null,
    creating: false,
    updating: false,
    deleting: false,
    configuredProviders: [],
    loadingProviders: false,
    providerLoadingStates: {},
    providerDeletingStates: {},
  });

  const setPartialState = useCallback((partial: Partial<UseIntegrationKeysState>) => {
    setState((prev) => ({ ...prev, ...partial }));
  }, []);

  const isProviderLoading = useCallback(
    (provider: string) => !!state.providerLoadingStates[normalizeProvider(provider)],
    [state.providerLoadingStates]
  );

  const isProviderDeleting = useCallback(
    (provider: string) => !!state.providerDeletingStates[normalizeProvider(provider)],
    [state.providerDeletingStates]
  );

  const isProviderConfigured = useCallback(
    (provider: string) => state.configuredProviders.map(normalizeProvider).includes(normalizeProvider(provider)),
    [state.configuredProviders]
  );

  const refreshConfiguredProviders = useCallback(async () => {
    const providers = await fetchConfiguredProviders();
    setState((prev) => ({ ...prev, configuredProviders: providers, loading: false }));
  }, []);

  const createIntegrationKey = useCallback(
    async (input: IntegrationData) => {
      const errors = validateIntegrationKeyData(input);
      if (errors.length > 0) {
        setPartialState({ error: errors.join('\n') });
        return null;
      }

      const provider = normalizeProvider(input.keyName);
      const apiKey = input.type === 'simple'
        ? input.keyValue
        : JSON.stringify({ accessKey: input.accessKey, secretKey: input.secretKey, region: input.region || 'us-east-1' });

      setState((prev) => ({
        ...prev,
        creating: true,
        providerLoadingStates: { ...prev.providerLoadingStates, [provider]: true },
      }));

      try {
        const res = await fetch(`${SECRETS_URL}/${provider}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ api_key: apiKey }),
        });
        if (!res.ok) throw new Error(`Failed to save key: ${res.status}`);

        setState((prev) => ({
          ...prev,
          configuredProviders: Array.from(new Set([...prev.configuredProviders, provider])),
          creating: false,
          providerLoadingStates: { ...prev.providerLoadingStates, [provider]: false },
        }));

        return { id: `${provider}_${Date.now()}`, keyName: input.keyName } as IntegrationKey;
      } catch (err) {
        setPartialState({
          creating: false,
          error: err instanceof Error ? err.message : 'Failed to save key',
          providerLoadingStates: { ...state.providerLoadingStates, [provider]: false },
        });
        return null;
      }
    },
    [state.configuredProviders, state.providerLoadingStates, setPartialState]
  );

  const updateIntegrationKey = useCallback(
    async (_id: string, data: UpdateIntegrationData) => {
      if (!data.keyName) return null;
      // Reuse create logic
      return createIntegrationKey(data as IntegrationData);
    },
    [createIntegrationKey]
  );

  const deleteIntegrationKey = useCallback(
    async (keyName: string) => {
      const normalized = normalizeProvider(keyName);
      setState((prev) => ({
        ...prev,
        deleting: true,
        providerDeletingStates: { ...prev.providerDeletingStates, [normalized]: true },
      }));

      try {
        await fetch(`${SECRETS_URL}/${normalized}`, { method: 'DELETE' });
        setState((prev) => ({
          ...prev,
          configuredProviders: prev.configuredProviders.filter((p) => normalizeProvider(p) !== normalized),
          deleting: false,
          providerDeletingStates: { ...prev.providerDeletingStates, [normalized]: false },
        }));
        return true;
      } catch {
        setPartialState({ deleting: false });
        return false;
      }
    },
    [setPartialState]
  );

  const getIntegrationKeyByName = useCallback(() => undefined, []);
  const clearError = useCallback(() => setPartialState({ error: null }), [setPartialState]);
  const refreshIntegrationKeys = useCallback(async () => {}, []);
  const refresh = useCallback(async () => refreshConfiguredProviders(), [refreshConfiguredProviders]);

  // Load on mount
  useEffect(() => {
    refreshConfiguredProviders();
  }, [refreshConfiguredProviders]);

  return {
    ...state,
    createIntegrationKey,
    updateIntegrationKey,
    deleteIntegrationKey,
    getIntegrationKeyByName,
    refreshIntegrationKeys,
    clearError,
    validateIntegrationKeyData,
    refresh,
    refreshConfiguredProviders,
    isProviderConfigured,
    isProviderLoading,
    isProviderDeleting,
  };
};
