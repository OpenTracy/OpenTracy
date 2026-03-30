import { Activity, BarChart3 } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DeploymentWithMetrics } from '../../types';
import { DeploymentInfo } from './DeploymentInfo';
import { DeploymentMetricsGrid } from './DeploymentMetricsGrid';
import { DeploymentChartsSection } from './DeploymentChartsSection';

interface DeploymentDetailsProps {
  deployment: DeploymentWithMetrics;
  formatNumber: (n: number) => string;
  formatLatency: (n: number) => string;
  formatCost: (n: number) => string;
  timeRangeMinutes: number;
}

export function DeploymentDetails({
  deployment,
  formatNumber,
  formatLatency,
  formatCost,
  timeRangeMinutes,
}: DeploymentDetailsProps) {
  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="flex size-6 items-center justify-center rounded-md bg-muted">
              <BarChart3 className="size-3.5 text-muted-foreground" />
            </div>
            <CardTitle className="text-sm font-medium">Deployment Configuration</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <DeploymentInfo deployment={deployment} />
        </CardContent>
      </Card>

      {deployment.metricsData ? (
        <>
          <DeploymentMetricsGrid
            metricsData={deployment.metricsData}
            formatNumber={formatNumber}
            formatLatency={formatLatency}
            formatCost={formatCost}
          />

          <DeploymentChartsSection
            metricsData={deployment.metricsData}
            timeRangeMinutes={timeRangeMinutes}
            deploymentId={deployment.id}
          />
        </>
      ) : (
        <Card className="overflow-hidden">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-muted">
              <Activity className="size-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">No metrics data available</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Metrics will appear once the deployment starts processing requests.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
