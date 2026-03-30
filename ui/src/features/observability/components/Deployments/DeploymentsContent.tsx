import { Clock } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

import { DEPLOYMENT_TIME_RANGE_OPTIONS, type DeploymentTimeRange } from '../../constants';
import type { DeploymentKPI, DeploymentWithMetrics } from '../../types';
import { EmptyState } from '../shared';
import { DeploymentKpis } from './DeploymentKpis';
import { DeploymentSelector } from './DeploymentSelector';
import { DeploymentDetails } from './DeploymentDetails';

interface DeploymentsContentProps {
  deployments: DeploymentWithMetrics[];
  selectedDeployment: DeploymentWithMetrics | null;
  selectedDeploymentId: string | null;
  setSelectedDeploymentId: (id: string) => void;
  selectedTimeRange: DeploymentTimeRange;
  onTimeRangeChange: (opt: DeploymentTimeRange) => void;
  refreshData: () => void;
  formatNumber: (n: number) => string;
  formatLatency: (n: number) => string;
  formatCost: (n: number) => string;
  kpis: DeploymentKPI;
}

export function DeploymentsContent({
  deployments,
  selectedDeployment,
  selectedDeploymentId,
  setSelectedDeploymentId,
  selectedTimeRange,
  onTimeRangeChange,
  refreshData,
  formatNumber,
  formatLatency,
  formatCost,
  kpis,
}: DeploymentsContentProps) {
  return (
    <div className="space-y-6">
      {/* Time-range selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="size-3.5" />
            <span className="hidden sm:inline">Period:</span>
          </div>
          <div className="inline-flex items-center gap-0.5 rounded-lg border bg-muted/50 p-0.5">
            {DEPLOYMENT_TIME_RANGE_OPTIONS.map((opt) => (
              <Button
                key={opt.label}
                size="sm"
                variant={selectedTimeRange.label === opt.label ? 'default' : 'ghost'}
                className={`h-7 px-3 text-xs font-medium transition-all ${
                  selectedTimeRange.label === opt.label
                    ? 'shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => onTimeRangeChange(opt)}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>
        <Badge
          variant="outline"
          className="hidden gap-1.5 text-xs font-normal text-muted-foreground md:flex"
        >
          {deployments.length} deployment{deployments.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      {/* KPIs */}
      <DeploymentKpis
        kpis={kpis}
        formatNumber={formatNumber}
        formatLatency={formatLatency}
        formatCost={formatCost}
      />

      {/* Deployment details */}
      {deployments.length > 0 ? (
        <>
          <DeploymentSelector
            deployments={deployments}
            selectedId={selectedDeploymentId}
            onSelect={setSelectedDeploymentId}
          />

          {selectedDeployment && (
            <DeploymentDetails
              deployment={selectedDeployment}
              formatNumber={formatNumber}
              formatLatency={formatLatency}
              formatCost={formatCost}
              timeRangeMinutes={selectedTimeRange.minutes}
            />
          )}
        </>
      ) : (
        <EmptyState
          message="Create a deployment to start monitoring its performance"
          onRefresh={refreshData}
        />
      )}
    </div>
  );
}
