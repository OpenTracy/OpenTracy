import { useMemo } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import type { DeploymentModel } from '@/types/deploymentTypes';
import type {
  AvailableModel,
  RegisteredModel,
  ModelStatusResponse,
} from '@/features/production/api/modelRegistryService';

import { HuggingFaceImporter } from './HuggingFaceImporter';
import {
  DownloadProgressBanner,
  FailedDownloadsBanner,
  ReadyToDeployBanner,
} from './ModelStatusBanners';
import { ModelCard } from './ModelCard';
import { LibrarySearchEmptyState } from './EmptyState';

const SKELETON_CARD_COUNT = 8;

function ModelGridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {Array.from({ length: SKELETON_CARD_COUNT }).map((_, i) => (
        <div key={i} className="rounded-lg border bg-card p-5 space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton className="w-8 h-8 rounded-lg shrink-0" />
            <Skeleton className="h-4 w-28" />
          </div>
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-3/4" />
          <div className="flex gap-1.5 pt-1">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-12 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

interface LibraryTabProps {
  allModels: DeploymentModel[];
  availableModels: AvailableModel[];
  downloadingModels: RegisteredModel[];
  readyModels: RegisteredModel[];
  failedModels: RegisteredModel[];
  modelStatuses: Record<string, ModelStatusResponse>;
  isLoadingModels: boolean;
  deletingModelIds: Set<string>;
  searchTerm: string;
  onAddModel: () => void;
  onViewSpecs: (model: DeploymentModel) => void;
  onDeploy: (modelId: string) => void;
  onDelete: (modelId: string, modelName?: string) => void;
  onRetry: (model: RegisteredModel) => void;
  onClearSearch: () => void;
}

export function LibraryTab({
  allModels,
  availableModels,
  downloadingModels,
  readyModels,
  failedModels,
  modelStatuses,
  isLoadingModels,
  deletingModelIds,
  searchTerm,
  onAddModel,
  onViewSpecs,
  onDeploy,
  onDelete,
  onRetry,
  onClearSearch,
}: LibraryTabProps) {
  const filteredModels = useMemo(() => {
    if (!searchTerm) return allModels;
    const query = searchTerm.toLowerCase();
    return allModels.filter(
      (m) => m.name.toLowerCase().includes(query) || m.description.toLowerCase().includes(query)
    );
  }, [allModels, searchTerm]);

  const showSearchEmptyState = !isLoadingModels && searchTerm && filteredModels.length === 0;

  return (
    <>
      <HuggingFaceImporter onAddModel={onAddModel} />

      <DownloadProgressBanner models={downloadingModels} modelStatuses={modelStatuses} />

      <FailedDownloadsBanner
        models={failedModels}
        deletingModelIds={deletingModelIds}
        onRetry={onRetry}
        onDelete={onDelete}
      />

      <ReadyToDeployBanner models={readyModels} onDeploy={onDeploy} />

      <section>
        <h2 className="text-base font-semibold mb-4">
          Available Models
          {!isLoadingModels && availableModels.length > 0 && (
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({availableModels.length})
            </span>
          )}
        </h2>

        {isLoadingModels ? (
          <ModelGridSkeleton />
        ) : showSearchEmptyState ? (
          <LibrarySearchEmptyState searchTerm={searchTerm} onClearSearch={onClearSearch} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredModels.map((model) => (
              <ModelCard
                key={model.id}
                model={model}
                apiModel={availableModels.find((m) => m.model_id === model.id)}
                isDeletingInProgress={deletingModelIds.has(model.id)}
                onViewSpecs={onViewSpecs}
                onDeploy={(m) => onDeploy(m.id)}
                onDelete={onDelete}
              />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
