import { useState, useMemo } from 'react';

import type { DeploymentKPI, DeploymentWithMetrics } from '../types';
import { DEPLOYMENT_TIME_RANGE_OPTIONS, type DeploymentTimeRange } from '../constants';

function simplifyDeploymentName(name: string, modelId: string): string {
  if (name.startsWith('ten-') && name.includes('-mdl-')) {
    const modelParts = name.split('-mdl-')[1].split('-');
    if (modelParts.length >= 1) {
      return modelParts.slice(0, -1).join(' ').toUpperCase();
    }
  }
  return modelId || name;
}

const fmt = {
  number: (n: number) => n.toLocaleString(),
  latency: (ms: number) => (ms < 1000 ? `${ms.toFixed(0)} ms` : `${(ms / 1000).toFixed(2)} s`),
  cost: (c: number) => `$${c.toFixed(4)}`,
};

export function useDeploymentTab() {
  const [selectedDeploymentId, setSelectedDeploymentId] = useState<string | null>(null);
  const [selectedTimeRange, setSelectedTimeRange] = useState<DeploymentTimeRange>(
    DEPLOYMENT_TIME_RANGE_OPTIONS[0]
  );

  const kpis = useMemo<DeploymentKPI>(() => ({
    activeDeployments: 0,
    totalDeployments: 0,
    avgLatency: 0,
    avgSuccessRate: 100,
    totalInvocations: 0,
    totalCost: 0,
  }), []);

  return {
    loading: false,
    error: null,
    deployments: [] as DeploymentWithMetrics[],
    selectedDeployment: null,
    selectedDeploymentId,
    setSelectedDeploymentId,
    selectedTimeRange,
    handleTimeRangeChange: setSelectedTimeRange,
    refreshData: async () => {},
    formatNumber: fmt.number,
    formatLatency: fmt.latency,
    formatCost: fmt.cost,
    kpis,
  };
}
