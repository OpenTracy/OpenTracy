import { useState, useMemo, useCallback } from 'react';
import type { TraceItem } from '@/types/analyticsType';

export interface FilterState {
  deployments: string[];
  models: string[];
  minTokens: number | null;
  maxTokens: number | null;
  minLatency: number | null;
  maxLatency: number | null;
  minCost: number | null;
  maxCost: number | null;
  backends: string[];
}

interface FilterOptions {
  deployments: string[];
  models: string[];
  backends: string[];
}

interface DataRanges {
  tokens: { min: number; max: number };
  latency: { min: number; max: number };
  cost: { min: number; max: number };
}

interface SeriesData {
  by_model?: { model_id: string }[];
  by_backend?: { backend: string }[];
}

export function useAnalyticsFilters(traces: TraceItem[], seriesData?: SeriesData) {
  const [searchQuery, setSearchQuery] = useState('');
  const [timeRange, setTimeRange] = useState('7d');
  const [filterStatus, setFilterStatus] = useState<'all' | 'success' | 'error'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [showOnlyDeployments, setShowOnlyDeployments] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    deployments: [],
    models: [],
    minTokens: null,
    maxTokens: null,
    minLatency: null,
    maxLatency: null,
    minCost: null,
    maxCost: null,
    backends: [],
  });

  // Use series data (all models/backends from API) when available, fallback to traces (current page only)
  const filterOptions: FilterOptions = useMemo(() => {
    // Deployments from current page traces (API doesn't provide deployment list in series)
    const deployments = [
      ...new Set(traces.map((t) => t.deployment_id).filter((id): id is string => Boolean(id))),
    ];

    // Models: prefer series data (all models) over traces (current page)
    const models = seriesData?.by_model?.length
      ? seriesData.by_model.map((m) => m.model_id).filter(Boolean)
      : [...new Set(traces.map((t) => t.model_id).filter(Boolean))];

    // Backends: prefer series data (all backends) over traces (current page)
    const backends = seriesData?.by_backend?.length
      ? seriesData.by_backend.map((b) => b.backend).filter((id): id is string => Boolean(id))
      : [...new Set(traces.map((t) => t.backend).filter((id): id is string => Boolean(id)))];

    return { deployments, models, backends };
  }, [traces, seriesData]);

  const dataRanges: DataRanges = useMemo(() => {
    if (!traces.length) {
      return {
        tokens: { min: 0, max: 10000 },
        latency: { min: 0, max: 10 },
        cost: { min: 0, max: 1 },
      };
    }

    const tokens = traces.map((t) => t.total_tokens);
    const latencies = traces.map((t) => t.latency_s);
    const costs = traces.map((t) => t.cost_usd);

    return {
      tokens: { min: Math.min(...tokens), max: Math.max(...tokens) },
      latency: { min: Math.min(...latencies), max: Math.max(...latencies) },
      cost: { min: Math.min(...costs), max: Math.max(...costs) },
    };
  }, [traces]);

  const hasActiveFilters = useMemo(() => {
    return (
      filters.deployments.length > 0 ||
      filters.models.length > 0 ||
      filters.backends.length > 0 ||
      filters.minTokens !== null ||
      filters.maxTokens !== null ||
      filters.minLatency !== null ||
      filters.maxLatency !== null ||
      filters.minCost !== null ||
      filters.maxCost !== null ||
      showOnlyDeployments
    );
  }, [filters, showOnlyDeployments]);

  const filterCount = useMemo(() => {
    let count = 0;
    count += filters.deployments.length;
    count += filters.models.length;
    count += filters.backends.length;
    if (filters.minTokens !== null || filters.maxTokens !== null) count++;
    if (filters.minLatency !== null || filters.maxLatency !== null) count++;
    if (filters.minCost !== null || filters.maxCost !== null) count++;
    if (showOnlyDeployments) count++;
    return count;
  }, [filters, showOnlyDeployments]);

  const updateFilter = useCallback(<K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  }, []);

  const toggleArrayFilter = useCallback(
    (key: 'deployments' | 'models' | 'backends', value: string) => {
      setFilters((prev) => ({
        ...prev,
        [key]: prev[key].includes(value)
          ? prev[key].filter((item) => item !== value)
          : [...prev[key], value],
      }));
    },
    []
  );

  const clearAllFilters = useCallback(() => {
    setFilters({
      deployments: [],
      models: [],
      minTokens: null,
      maxTokens: null,
      minLatency: null,
      maxLatency: null,
      minCost: null,
      maxCost: null,
      backends: [],
    });
    setFilterStatus('all');
    setSearchQuery('');
    setShowOnlyDeployments(false);
  }, []);

  return {
    filters,
    searchQuery,
    timeRange,
    filterStatus,
    showFilters,
    showOnlyDeployments,

    setSearchQuery,
    setTimeRange,
    setFilterStatus,
    setShowFilters,
    setShowOnlyDeployments,

    hasActiveFilters,
    filterCount,
    filterOptions,
    dataRanges,

    updateFilter,
    toggleArrayFilter,
    clearAllFilters,
  };
}
