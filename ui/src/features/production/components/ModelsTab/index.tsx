import { Search } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { DeploymentListSkeleton } from './Skeleton';
import { INSTANCE_TYPES } from '@/features/production/constants/instanceTypes';
import type { DeploymentData, DeploymentModel } from '@/types/deploymentTypes';

import { DeploymentEmptyState } from './EmptyState';
import { DeploymentCard } from './DeploymentCard';

interface DeploymentTabProps {
  deployments: DeploymentData[];
  filteredDeployments: DeploymentData[];
  allModels: DeploymentModel[];
  isLoading: boolean;
  deletingDeploymentIds: Set<string>;
  pausingDeploymentIds: Set<string>;
  resumingDeploymentIds: Set<string>;
  highlightedDeploymentId?: string | null;
  searchTerm: string;
  onBrowseLibrary: () => void;
  onPause: (deployment: DeploymentData) => Promise<void>;
  onResume: (deployment: DeploymentData) => Promise<void>;
  onDelete: (deployment: DeploymentData) => Promise<void>;
}

export function DeploymentTab({
  deployments,
  filteredDeployments,
  allModels,
  isLoading,
  deletingDeploymentIds,
  pausingDeploymentIds,
  resumingDeploymentIds,
  highlightedDeploymentId,
  searchTerm,
  onBrowseLibrary,
  onPause,
  onResume,
  onDelete,
}: DeploymentTabProps) {
  if (isLoading && deployments.length === 0) {
    return <DeploymentListSkeleton />;
  }

  if (deployments.length === 0) {
    return <DeploymentEmptyState onBrowseLibrary={onBrowseLibrary} />;
  }

  if (filteredDeployments.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center mb-3">
            <Search className="w-5 h-5 text-muted-foreground" />
          </div>
          <h3 className="text-sm font-semibold mb-1">No deployments found</h3>
          <p className="text-sm text-muted-foreground">
            No deployments match <span className="font-medium">"{searchTerm}"</span>.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {filteredDeployments.map((deployment) => (
        <DeploymentCard
          key={deployment.id}
          deployment={deployment}
          models={allModels}
          instances={INSTANCE_TYPES}
          isDeleting={deletingDeploymentIds.has(deployment.id)}
          isPausing={pausingDeploymentIds.has(deployment.id)}
          isResuming={resumingDeploymentIds.has(deployment.id)}
          isHighlighted={deployment.id === highlightedDeploymentId}
          onPause={onPause}
          onResume={onResume}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
