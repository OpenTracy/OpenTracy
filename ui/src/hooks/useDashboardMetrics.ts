import { useMetrics } from '../contexts/MetricsContext';

export function useDashboardMetrics() {
  const {
    isLoading,
    error,
    overviewData,
    costData,
    performanceData,
    selectedDays,
    setSelectedDays,
    refreshData,
  } = useMetrics();

  return {
    loading: isLoading,
    error,
    overviewData,
    costData,
    performanceData,
    selectedDays,
    updateDateRange: setSelectedDays,
    refreshData,
  };
}
