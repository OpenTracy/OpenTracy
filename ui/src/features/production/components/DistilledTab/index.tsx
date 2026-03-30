import { Search } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import type { DistillationJob } from '@/types/distillationTypes';

import { DistilledListSkeleton } from './Skeleton';
import { DistilledEmptyState } from './EmptyState';
import { DistilledJobCard } from './DistilledJobCard';

interface DistilledTabProps {
  completedJobs: DistillationJob[];
  filteredJobs: DistillationJob[];
  isLoading: boolean;
  deployingJobIds: Set<string>;
  searchTerm: string;
  onGoToDistillLab: () => void;
  onDeploy: (jobId: string) => void;
  onViewResults: (jobId: string) => void;
}

export function DistilledTab({
  completedJobs,
  filteredJobs,
  isLoading,
  deployingJobIds,
  searchTerm,
  onGoToDistillLab,
  onDeploy,
  onViewResults,
}: DistilledTabProps) {
  if (isLoading && completedJobs.length === 0) {
    return <DistilledListSkeleton />;
  }

  if (completedJobs.length === 0) {
    return <DistilledEmptyState onGoToDistillLab={onGoToDistillLab} />;
  }

  if (filteredJobs.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center mb-3">
            <Search className="w-5 h-5 text-muted-foreground" />
          </div>
          <h3 className="text-sm font-semibold mb-1">No results found</h3>
          <p className="text-sm text-muted-foreground">
            No distilled models match <span className="font-medium">"{searchTerm}"</span>.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {filteredJobs.map((job) => (
        <DistilledJobCard
          key={job.id}
          job={job}
          isDeploying={deployingJobIds.has(job.id)}
          onDeploy={onDeploy}
          onViewResults={onViewResults}
        />
      ))}
    </div>
  );
}
