import { PageSkeleton } from '../shared';
import { ErrorState } from '../shared';
import { EmptyState } from '../shared';
import { OverviewContent } from './OverviewContent';
import type { ObservabilityMetrics } from '../../types';
import type { TimeRange } from '../../constants';

interface OverviewTabProps {
  metrics: ObservabilityMetrics;
  onTimeRangeChange: (days: TimeRange) => void;
}

export function OverviewTab({ metrics, onTimeRangeChange }: OverviewTabProps) {
  const { loading, error, overviewData, selectedDays, refreshData } = metrics;

  if (loading) return <PageSkeleton />;
  if (error) return <ErrorState error={error} onRetry={refreshData} />;
  if (!overviewData) return <EmptyState message="No data available" onRefresh={refreshData} />;

  return (
    <OverviewContent
      data={overviewData}
      selectedDays={selectedDays}
      onTimeRangeChange={onTimeRangeChange}
    />
  );
}
