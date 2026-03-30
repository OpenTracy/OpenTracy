import { PageSkeleton, ErrorState, EmptyState } from '../shared';
import { CostContent } from './CostContent';
import type { ObservabilityMetrics } from '../../types';
import type { TimeRange } from '../../constants';

interface CostTabProps {
  metrics: ObservabilityMetrics;
  onTimeRangeChange: (days: TimeRange) => void;
}

export function CostTab({ metrics, onTimeRangeChange }: CostTabProps) {
  const { loading, error, costData, selectedDays, refreshData } = metrics;

  if (loading) return <PageSkeleton />;
  if (error) return <ErrorState error={error} onRetry={refreshData} />;
  if (!costData) return <EmptyState message="No cost data available" onRefresh={refreshData} />;

  return (
    <CostContent
      data={costData}
      selectedDays={selectedDays}
      onTimeRangeChange={onTimeRangeChange}
    />
  );
}
