import { PageSkeleton, ErrorState, EmptyState } from '../shared';
import { PerformanceContent } from './PerformanceContent';
import type { ObservabilityMetrics } from '../../types';
import type { TimeRange } from '../../constants';

interface PerformanceTabProps {
  metrics: ObservabilityMetrics;
  onTimeRangeChange: (days: TimeRange) => void;
}

export function PerformanceTab({ metrics, onTimeRangeChange }: PerformanceTabProps) {
  const { loading, error, performanceData, selectedDays, refreshData } = metrics;

  if (loading) return <PageSkeleton />;
  if (error) return <ErrorState error={error} onRetry={refreshData} />;
  if (!performanceData)
    return <EmptyState message="No performance data available" onRefresh={refreshData} />;

  return (
    <PerformanceContent
      data={performanceData}
      selectedDays={selectedDays}
      onTimeRangeChange={onTimeRangeChange}
    />
  );
}
