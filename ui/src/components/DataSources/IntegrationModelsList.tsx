import { DataSourceCard } from './DataSourceCard';
import { type ProviderModel, getProviderFromKey } from '../../constants/integrationModels';

interface IntegrationModelsListProps {
  readonly models: readonly ProviderModel[];
  readonly isProviderConfigured: (provider: string) => boolean;
  readonly isProviderLoading: (provider: string) => boolean;
  readonly isProviderDeleting: (provider: string) => boolean;
  readonly onEdit: (model: ProviderModel) => void;
  readonly onRemove: (model: ProviderModel) => void;
}

export function IntegrationModelsList({
  models,
  isProviderConfigured,
  isProviderLoading,
  isProviderDeleting,
  onEdit,
  onRemove,
}: IntegrationModelsListProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
      {models.map((model) => {
        const provider = getProviderFromKey(model.key);
        const isConfigured = isProviderConfigured(provider);

        return (
          <DataSourceCard
            key={model.key}
            name={model.name}
            icon={model.icon}
            isConfigured={isConfigured}
            loading={isProviderLoading(provider)}
            deleting={isProviderDeleting(provider)}
            onEdit={() => onEdit(model)}
            onRemove={isConfigured ? () => onRemove(model) : undefined}
          />
        );
      })}
    </div>
  );
}
