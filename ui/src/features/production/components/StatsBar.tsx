import {
  Beaker,
  CheckCircle,
  Download,
  Library,
  Loader2,
  Rocket,
  Search,
  Server,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import type { DeploymentData } from '@/types/deploymentTypes';
import type { RegisteredModel } from '@/features/production/api/modelRegistryService';

type TabId = 'deployments' | 'library' | 'distilled';

interface StatPillProps {
  icon: React.ReactNode;
  count: number;
  label: string;
}

function StatPill({ icon, count, label }: StatPillProps) {
  return (
    <Badge variant="outline" className="gap-1.5 px-3 py-1.5 text-sm font-normal rounded-full">
      {icon}
      <span className="font-medium tabular-nums">{count}</span>
      <span className="text-muted-foreground">{label}</span>
    </Badge>
  );
}

interface StatsBarProps {
  activeTab: TabId;
  deployments: DeploymentData[];
  totalModelsCount: number;
  downloadingModels: RegisteredModel[];
  readyModels: RegisteredModel[];
  completedJobsCount?: number;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  isSearchDisabled: boolean;
}

export function StatsBar({
  activeTab,
  deployments,
  totalModelsCount,
  downloadingModels,
  readyModels,
  completedJobsCount = 0,
  searchTerm,
  onSearchChange,
  isSearchDisabled,
}: StatsBarProps) {
  const activeDeploymentsCount = deployments.filter(
    (d) => d.status === 'in_service' || d.status === 'active'
  ).length;

  const startingDeploymentsCount = deployments.filter((d) =>
    ['creating', 'starting', 'pending'].includes(d.status)
  ).length;

  return (
    <div className="flex items-center justify-between gap-4 mb-6">
      <div className="flex items-center gap-2">
        {activeTab === 'deployments' ? (
          <>
            <StatPill
              icon={<Server className="w-3.5 h-3.5 text-muted-foreground" />}
              count={activeDeploymentsCount}
              label="Active"
            />
            {startingDeploymentsCount > 0 && (
              <StatPill
                icon={<Loader2 className="w-3.5 h-3.5 text-muted-foreground animate-spin" />}
                count={startingDeploymentsCount}
                label="Starting"
              />
            )}
            <StatPill
              icon={<Rocket className="w-3.5 h-3.5 text-muted-foreground" />}
              count={deployments.length}
              label="Total"
            />
          </>
        ) : activeTab === 'library' ? (
          <>
            {downloadingModels.length > 0 && (
              <StatPill
                icon={<Download className="w-3.5 h-3.5 text-muted-foreground animate-pulse" />}
                count={downloadingModels.length}
                label="Downloading"
              />
            )}
            {readyModels.length > 0 && (
              <StatPill
                icon={<CheckCircle className="w-3.5 h-3.5 text-muted-foreground" />}
                count={readyModels.length}
                label="Ready"
              />
            )}
            <StatPill
              icon={<Library className="w-3.5 h-3.5 text-muted-foreground" />}
              count={totalModelsCount}
              label="Total"
            />
          </>
        ) : (
          <StatPill
            icon={<Beaker className="w-3.5 h-3.5 text-muted-foreground" />}
            count={completedJobsCount}
            label="Ready to Deploy"
          />
        )}
      </div>

      <div className="relative w-64">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder={
            activeTab === 'deployments'
              ? 'Search deployments...'
              : activeTab === 'library'
                ? 'Search models...'
                : 'Search distilled models...'
          }
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          disabled={isSearchDisabled}
          className="pl-9"
        />
      </div>
    </div>
  );
}
