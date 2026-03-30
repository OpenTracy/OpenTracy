import { useMemo } from 'react';
import { Server, Activity, Gauge, DollarSign } from 'lucide-react';

import type { DeploymentKPI } from '../../types';
import { KpiCard } from '@/components/shared/KpiCard';

interface DeploymentKpisProps {
  kpis: DeploymentKPI;
  formatNumber: (n: number) => string;
  formatLatency: (n: number) => string;
  formatCost: (n: number) => string;
}

export function DeploymentKpis({
  kpis,
  formatNumber,
  formatLatency,
  formatCost,
}: DeploymentKpisProps) {
  const cards = useMemo(
    () => [
      {
        label: 'Active Deployments',
        value: String(kpis.activeDeployments),
        change: `${kpis.totalDeployments} total`,
        isPositive: true,
        icon: Server,
      },
      {
        label: 'Total Invocations',
        value: formatNumber(kpis.totalInvocations),
        change: 'In selected period',
        isPositive: true,
        icon: Activity,
      },
      {
        label: 'Average Latency',
        value: formatLatency(kpis.avgLatency),
        change: kpis.avgLatency > 2000 ? 'High latency' : 'Normal',
        isPositive: kpis.avgLatency <= 2000,
        icon: Gauge,
      },
      {
        label: 'Total Cost',
        value: formatCost(kpis.totalCost),
        change:
          kpis.avgSuccessRate > 95
            ? 'Excellent success rate'
            : kpis.avgSuccessRate > 85
              ? 'Good success rate'
              : 'Check errors',
        isPositive: kpis.avgSuccessRate > 95,
        icon: DollarSign,
      },
    ],
    [kpis, formatNumber, formatLatency, formatCost]
  );

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => (
        <KpiCard
          key={c.label}
          label={c.label}
          value={c.value}
          icon={c.icon}
          change={c.change}
          isPositive={c.isPositive}
        />
      ))}
    </div>
  );
}
