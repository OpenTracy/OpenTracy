import { PageSkeleton, ErrorState, EmptyState } from '../shared';
import { useDeploymentTab } from '../../hooks/useDeploymentTab';
import { DeploymentsContent } from './DeploymentsContent';

export function DeploymentsTab() {
  const {
    loading,
    error,
    deployments,
    selectedDeployment,
    selectedDeploymentId,
    setSelectedDeploymentId,
    selectedTimeRange,
    handleTimeRangeChange,
    refreshData,
    formatNumber,
    formatLatency,
    formatCost,
    kpis,
  } = useDeploymentTab();

  if (loading) return <PageSkeleton />;
  if (error) return <ErrorState error={error} onRetry={refreshData} />;
  if (!deployments) return <EmptyState message="No deployments found" onRefresh={refreshData} />;

  return (
    <DeploymentsContent
      deployments={deployments}
      selectedDeployment={selectedDeployment}
      selectedDeploymentId={selectedDeploymentId}
      setSelectedDeploymentId={setSelectedDeploymentId}
      selectedTimeRange={selectedTimeRange}
      onTimeRangeChange={handleTimeRangeChange}
      refreshData={refreshData}
      formatNumber={formatNumber}
      formatLatency={formatLatency}
      formatCost={formatCost}
      kpis={kpis}
    />
  );
}
