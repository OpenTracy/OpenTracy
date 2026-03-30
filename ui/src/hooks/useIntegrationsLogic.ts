import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { useIntegrationKeys, type IntegrationData } from './useIntegrationKeys';
import { type ProviderModel, getProviderFromKey } from '../constants/integrationModels';
import type { BedrockCredentials } from '../components/DataSources/Modal/BedrockDataSourceModal';

const BEDROCK_KEY = 'bedrock_api_key';
const DEFAULT_REGION = 'us-east-1';

export interface IntegrationsModalState {
  readonly activeModel: ProviderModel | null;
  readonly inputValue: string;
  readonly showBedrockModal: boolean;
  readonly deleteTarget: ProviderModel | null;
}

const INITIAL_MODAL_STATE: IntegrationsModalState = {
  activeModel: null,
  inputValue: '',
  showBedrockModal: false,
  deleteTarget: null,
};

export const useIntegrationsLogic = () => {
  const {
    createIntegrationKey,
    updateIntegrationKey,
    deleteIntegrationKey,
    loading,
    isProviderConfigured,
    isProviderLoading,
    isProviderDeleting,
  } = useIntegrationKeys();

  const [modalState, setModalState] = useState<IntegrationsModalState>(INITIAL_MODAL_STATE);

  const updateModalState = useCallback((updates: Partial<IntegrationsModalState>) => {
    setModalState((prev) => ({ ...prev, ...updates }));
  }, []);

  const upsertIntegration = useCallback(
    async (provider: string, payload: IntegrationData) => {
      const isConfigured = isProviderConfigured(provider);
      return isConfigured
        ? updateIntegrationKey(`${provider}_api_key`, payload)
        : createIntegrationKey(payload);
    },
    [createIntegrationKey, updateIntegrationKey, isProviderConfigured]
  );

  const handleOpenModal = useCallback(
    (model: ProviderModel) => {
      if (model.key === BEDROCK_KEY) {
        updateModalState({ showBedrockModal: true });
        return;
      }

      updateModalState({
        activeModel: model,
        inputValue: '',
      });
    },
    [updateModalState]
  );

  const handleSaveKey = useCallback(async () => {
    const { activeModel, inputValue } = modalState;
    if (!activeModel) return;

    // Validate input
    if (!inputValue.trim()) {
      toast.error('API Key is required');
      return;
    }

    const provider = getProviderFromKey(activeModel.key);

    try {
      const success = await upsertIntegration(provider, {
        type: 'simple',
        keyName: activeModel.key,
        keyValue: inputValue,
      });

      if (success) {
        toast.success(`${activeModel.name} connected successfully`, {
          id: `datasource-save-${provider}`,
          description: 'Your integration is now active',
          closeButton: true,
        });
        updateModalState({
          activeModel: null,
          inputValue: '',
        });
      } else {
        toast.error('Failed to connect data source', {
          id: `datasource-save-${provider}`,
          description: 'Please check your credentials and try again',
          closeButton: true,
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect data source';
      toast.error(errorMessage, {
        id: `datasource-save-${provider}`,
        description: 'Please try again or contact support',
        closeButton: true,
      });
    }
  }, [modalState, upsertIntegration, updateModalState]);

  const handleSaveBedrockKey = useCallback(
    async (credentials: BedrockCredentials) => {
      // Validate inputs
      if (!credentials.accessKeyId.trim() || !credentials.secretAccessKey.trim()) {
        toast.error('All AWS credentials are required');
        return;
      }

      try {
        const success = await upsertIntegration('bedrock', {
          type: 'aws',
          keyName: BEDROCK_KEY,
          accessKey: credentials.accessKeyId,
          secretKey: credentials.secretAccessKey,
          region: credentials.region || DEFAULT_REGION,
        });

        if (success) {
          toast.success('AWS Bedrock connected successfully', {
            id: 'datasource-save-bedrock',
            description: 'Your integration is now active',
            closeButton: true,
          });
          updateModalState({ showBedrockModal: false });
        } else {
          toast.error('Failed to connect AWS Bedrock', {
            id: 'datasource-save-bedrock',
            description: 'Please check your credentials and try again',
            closeButton: true,
          });
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to connect AWS Bedrock';
        toast.error(errorMessage, {
          id: 'datasource-save-bedrock',
          description: 'Please try again or contact support',
          closeButton: true,
        });
      }
    },
    [upsertIntegration, updateModalState]
  );

  const handleConfirmDelete = useCallback(async () => {
    const { deleteTarget } = modalState;
    if (!deleteTarget) return;

    try {
      await deleteIntegrationKey(deleteTarget.key);
      toast.success(`${deleteTarget.name} disconnected`, {
        description: 'The integration has been removed',
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to disconnect data source';
      toast.error(errorMessage, {
        description: 'Please try again or contact support',
      });
      console.error('Delete integration error:', err);
    } finally {
      updateModalState({ deleteTarget: null });
    }
  }, [modalState, deleteIntegrationKey, updateModalState]);

  const closeAllModals = useCallback(() => {
    updateModalState(INITIAL_MODAL_STATE);
  }, [updateModalState]);

  return {
    // State
    modalState,
    loading,

    // Modal Management
    updateModalState,
    handleOpenModal,
    closeAllModals,

    // Handlers
    handleSaveKey,
    handleSaveBedrockKey,
    handleConfirmDelete,

    // Utils
    isProviderConfigured,
    isProviderLoading,
    isProviderDeleting,
  };
};
