import { useCallback } from 'react';
import { useMetrics } from '@/contexts/MetricsContext';

export function useAnalyticsMetrics() {
  const {
    isLoading,
    error,
    analyticsData,
    selectedDays,
    setSelectedDays,
    refreshData,
    findTraceById,
  } = useMetrics();

  const daysToTimeRange = useCallback((days: number): string => {
    if (days <= 1) return '24h';
    if (days <= 7) return '7d';
    if (days <= 30) return '30d';
    if (days <= 90) return '90d';
    return 'All';
  }, []);

  const timeRange = daysToTimeRange(selectedDays);

  const setTimeRange = useCallback(
    (range: string) => {
      const daysMap: Record<string, number> = {
        '24h': 1,
        '7d': 7,
        '30d': 30,
        '90d': 90,
        All: 365,
      };
      setSelectedDays(daysMap[range] || 30);
    },
    [setSelectedDays]
  );

  return {
    isLoading,
    isLoadingTraces: false,
    error,

    metrics: analyticsData.metrics,
    traces: analyticsData.traces,
    totalTraces: analyticsData.totalTraces,

    timeRange,
    setTimeRange,

    fetchMetrics: refreshData,
    clearError: () => {},
    findTraceById,
  };
}
