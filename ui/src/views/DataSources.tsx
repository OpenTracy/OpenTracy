import { useMemo } from 'react';
import { PageHeader } from '../components/shared/PageHeader';
import {
  DataSourcesSkeleton,
  DataSourcesHeader,
  IntegrationModelsList,
  DataSourcesModalsManager,
} from '../components/DataSources';
import { INTEGRATION_MODELS, getProviderFromKey } from '../constants/integrationModels';
import { useIntegrationsLogic } from '../hooks/useIntegrationsLogic';
export default function DataSources() {
  const {
    modalState,
    loading,
    updateModalState,
    handleOpenModal,
    handleSaveKey,
    handleSaveBedrockKey,
    handleConfirmDelete,
    isProviderConfigured,
    isProviderLoading,
    isProviderDeleting,
  } = useIntegrationsLogic();

  const configuredCount = useMemo(
    () => INTEGRATION_MODELS.filter((m) => isProviderConfigured(getProviderFromKey(m.key))).length,
    [isProviderConfigured]
  );

  if (loading) return <DataSourcesSkeleton />;

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Data Sources" />

      <main className="relative max-w-6xl mx-auto px-6 py-10 space-y-6">
        <DataSourcesHeader configuredCount={configuredCount} />

        <IntegrationModelsList
          models={INTEGRATION_MODELS}
          isProviderConfigured={isProviderConfigured}
          isProviderLoading={isProviderLoading}
          isProviderDeleting={isProviderDeleting}
          onEdit={handleOpenModal}
          onRemove={(model) => updateModalState({ deleteTarget: model })}
        />
      </main>

      <DataSourcesModalsManager
        modalState={modalState}
        onUpdateInputValue={(value: string) => updateModalState({ inputValue: value })}
        onSaveKey={handleSaveKey}
        onSaveBedrockKey={handleSaveBedrockKey}
        onConfirmDelete={handleConfirmDelete}
        onCloseActiveModal={() => updateModalState({ activeModel: null })}
        onCloseBedrockModal={() => updateModalState({ showBedrockModal: false })}
        onCancelDelete={() => updateModalState({ deleteTarget: null })}
      />
    </div>
  );
}
