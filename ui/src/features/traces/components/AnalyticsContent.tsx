import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

import { useAnalyticsMetrics } from '../hooks/UseAnalyticsMetrics';
import { useAnalyticsFilters } from '../hooks/UseAnalyticsFilters';
import type { TraceItem } from '@/types/analyticsType';
import { getModelCategory } from '@/utils/modelUtils';
import { convertToCSV, downloadCSV, flattenMetricsForCSV } from '../utils/ExportUtils';

import { ActiveFiltersBadges } from './Filters/ActiveFiltersBadges';
import { FiltersBar } from './Filters/FiltersBar';
import { AnalyticsHeader } from './Header/AnalyticsHeader';
import { AnalyticsMetricsGrid } from './Metrics/AnalyticsMetricsGrid';
import { TracesTable } from './Table/TracesTable';
import { Pagination } from './Table/Pagination';
import { TableSkeletonLoader } from './SkeletonLoader';
import { TraceDrawer } from './TraceDrawer';

export function AnalyticsContent() {
  const showToast = (message: string, type: 'success' | 'error' | 'info') => {
    toast[type](message);
  };
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedTraceId, setSelectedTraceId] = useState<string | undefined>(undefined);
  const drawerOpen = selectedTraceId !== undefined;

  const {
    isLoading,
    metrics,
    traces,
    totalTraces,
    timeRange,
    setTimeRange,
    fetchMetrics,
    findTraceById,
  } = useAnalyticsMetrics();

  const {
    filters,
    searchQuery,
    setSearchQuery,
    filterStatus,
    setFilterStatus,
    showFilters,
    setShowFilters,
    showOnlyDeployments,
    setShowOnlyDeployments,
    hasActiveFilters,
    filterCount,
    clearAllFilters,
    updateFilter,
    toggleArrayFilter,
    filterOptions,
    dataRanges,
  } = useAnalyticsFilters(traces, metrics?.series);

  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [isFiltering, setIsFiltering] = useState(false);

  const traceIdFromUrl = searchParams.get('trace') ?? undefined;

  useEffect(() => {
    if (traceIdFromUrl) {
      const trace = findTraceById(traceIdFromUrl);
      if (trace) {
        setSelectedTraceId(trace.id);
      } else {
        showToast('Trace not found in current data', 'info');
      }
      searchParams.delete('trace');
      setSearchParams(searchParams, { replace: true });
    }
  }, [traceIdFromUrl, findTraceById, searchParams, setSearchParams, showToast]);

  const filteredTraces = useMemo(() => {
    return traces
      .filter((trace) => {
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          const matchesSearch =
            trace.model_id.toLowerCase().includes(query) ||
            trace.backend.toLowerCase().includes(query) ||
            trace.input_preview?.toLowerCase().includes(query) ||
            trace.output_preview?.toLowerCase().includes(query) ||
            trace.id?.toLowerCase().includes(query);

          if (!matchesSearch) return false;
        }

        if (filterStatus === 'success' && trace.status !== 'Success') return false;
        if (filterStatus === 'error' && trace.status !== 'Error') return false;

        if (filters.deployments.length > 0) {
          if (!filters.deployments.includes(trace.deployment_id ?? '')) return false;
        }

        if (filters.models.length > 0) {
          if (!filters.models.includes(trace.model_id)) return false;
        }

        if (filters.backends.length > 0) {
          if (!filters.backends.includes(trace.backend)) return false;
        }

        if (filters.minTokens !== null && trace.total_tokens < filters.minTokens) return false;
        if (filters.maxTokens !== null && trace.total_tokens > filters.maxTokens) return false;

        if (filters.minLatency !== null && trace.latency_s < filters.minLatency) return false;
        if (filters.maxLatency !== null && trace.latency_s > filters.maxLatency) return false;

        if (filters.minCost !== null && trace.cost_usd < filters.minCost) return false;
        if (filters.maxCost !== null && trace.cost_usd > filters.maxCost) return false;

        if (showOnlyDeployments) {
          if (getModelCategory(trace.model_id) !== 'Other') return false;
        }

        return true;
      })
      .sort((a, b) => {
        const dateA = new Date(a.created_at).getTime();
        const dateB = new Date(b.created_at).getTime();
        return dateB - dateA;
      });
  }, [traces, searchQuery, filterStatus, filters, showOnlyDeployments]);

  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedTraces = filteredTraces.slice(startIndex, startIndex + itemsPerPage);
  const totalPages = Math.ceil(filteredTraces.length / itemsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterStatus, filters, showOnlyDeployments]);

  // Brief loading flash when filters change
  useEffect(() => {
    setIsFiltering(true);
    const timeout = setTimeout(() => setIsFiltering(false), 300);
    return () => clearTimeout(timeout);
  }, [filterStatus, filters, showOnlyDeployments, timeRange]);

  const handleRefresh = () => {
    fetchMetrics();
    showToast('Data refreshed successfully', 'success');
  };

  const handleExportData = () => {
    try {
      const timestamp = new Date().toISOString().split('T')[0];

      if (filteredTraces.length > 0) {
        const traceHeaders = [
          'id',
          'model_id',
          'model',
          'input_preview',
          'input_tokens',
          'output_preview',
          'output_tokens',
          'created_at',
          'startTime',
          'latency_s',
          'ttft_s',
          'tokens_per_s',
          'total_tokens',
          'tokens',
          'provider',
          'cost_usd',
          'status',
          'backend',
          'deployment_id',
          'is_stream',
          'error_code',
        ];
        const tracesCSV = convertToCSV(filteredTraces, traceHeaders);
        downloadCSV(tracesCSV, `traces_${timestamp}.csv`);
      }

      if (metrics) {
        const flattenedMetrics = flattenMetricsForCSV(metrics);
        if (flattenedMetrics.length > 0) {
          const metricsHeaders = Object.keys(flattenedMetrics[0]);
          const metricsCSV = convertToCSV(flattenedMetrics, metricsHeaders);
          downloadCSV(metricsCSV, `metrics_${timestamp}.csv`);
        }
      }

      showToast('Data exported successfully', 'success');
    } catch (error) {
      console.error('Export error:', error);
      showToast('Error exporting data', 'error');
    }
  };

  const toggleRowExpansion = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedRows((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleTraceSelect = useCallback((trace: TraceItem) => {
    setSelectedTraceId(trace.id);
  }, []);

  const handleDrawerClose = useCallback(() => {
    setSelectedTraceId(undefined);
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-background relative overflow-x-hidden w-full max-w-full">
      <AnalyticsHeader
        isLoading={isLoading}
        hasData={traces.length > 0}
        onRefresh={handleRefresh}
        onExport={handleExportData}
      />

      {metrics && <AnalyticsMetricsGrid metrics={metrics} />}

      <div className="flex-1 px-2 sm:px-6 pb-6 space-y-3">
        <FiltersBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          timeRange={timeRange}
          onTimeRangeChange={setTimeRange}
          filterStatus={filterStatus}
          onStatusChange={setFilterStatus}
          showFilters={showFilters}
          onToggleFilters={() => setShowFilters(!showFilters)}
          hasActiveFilters={hasActiveFilters}
          filterCount={filterCount}
          filteredCount={filteredTraces.length}
          filters={filters}
          filterOptions={filterOptions}
          dataRanges={dataRanges}
          showOnlyDeployments={showOnlyDeployments}
          onUpdateFilter={updateFilter}
          onToggleArrayFilter={toggleArrayFilter}
          onClearAllFilters={clearAllFilters}
          onToggleDeployments={setShowOnlyDeployments}
        />

        {hasActiveFilters && (
          <ActiveFiltersBadges
            filters={filters}
            showOnlyDeployments={showOnlyDeployments}
            onToggleArrayFilter={toggleArrayFilter}
            onUpdateFilter={updateFilter}
            onClearAll={clearAllFilters}
            onToggleDeployments={setShowOnlyDeployments}
            totalCount={totalTraces}
            filteredCount={filteredTraces.length}
          />
        )}

        {isLoading || isFiltering ? (
          <TableSkeletonLoader rows={5} className="animate-pulse" />
        ) : filteredTraces.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 rounded-lg border bg-card">
            <div className="size-14 bg-muted rounded-2xl flex items-center justify-center mb-4">
              <AlertCircle className="size-7 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">No traces found</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Try adjusting your filters or search query
            </p>
          </div>
        ) : (
          <>
            <TracesTable
              traces={paginatedTraces}
              expandedRows={expandedRows}
              onToggleExpand={toggleRowExpansion}
              onSelectTrace={handleTraceSelect}
            />

            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filteredTraces.length}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
              onItemsPerPageChange={setItemsPerPage}
            />
          </>
        )}
      </div>

      <TraceDrawer traceId={selectedTraceId} open={drawerOpen} onClose={handleDrawerClose} />
    </div>
  );
}
