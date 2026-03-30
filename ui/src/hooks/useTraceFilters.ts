import { useState, useMemo } from 'react';
import type { TraceItem } from '../types/analyticsType';
import { getModelCategory } from '../utils/modelUtils';

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

const initialFilterState: FilterState = {
  deployments: [],
  models: [],
  minTokens: null,
  maxTokens: null,
  minLatency: null,
  maxLatency: null,
  minCost: null,
  maxCost: null,
  backends: [],
};

export function useTraceFilters(traces: TraceItem[]) {
  const [filters, setFilters] = useState<FilterState>(initialFilterState);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'success' | 'error'>('all');
  const [showOnlyDeployments, setShowOnlyDeployments] = useState(false);

  const dataRanges = useMemo(() => {
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

  const filterOptions = useMemo(() => {
    const deployments = [...new Set(traces.map((t) => t.deployment_id).filter(Boolean))];
    const models = [...new Set(traces.map((t) => t.model_id).filter(Boolean))];
    const backends = [...new Set(traces.map((t) => t.backend).filter(Boolean))];

    return { deployments, models, backends };
  }, [traces]);

  const filteredData = useMemo(() => {
    return traces.filter((item: TraceItem) => {
      const matchesSearch =
        item.model_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.input_preview.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.output_preview.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        filterStatus === 'all' ||
        (filterStatus === 'success' && item.status === 'Success') ||
        (filterStatus === 'error' && item.status === 'Error');

      const matchesDeployment =
        filters.deployments.length === 0 || filters.deployments.includes(item.deployment_id ?? '');
      const matchesModel = filters.models.length === 0 || filters.models.includes(item.model_id);
      const matchesBackend =
        filters.backends.length === 0 || filters.backends.includes(item.backend ?? '');

      const matchesTokens =
        (filters.minTokens === null || item.total_tokens >= filters.minTokens) &&
        (filters.maxTokens === null || item.total_tokens <= filters.maxTokens);

      const matchesLatency =
        (filters.minLatency === null || item.latency_s >= filters.minLatency) &&
        (filters.maxLatency === null || item.latency_s <= filters.maxLatency);

      const matchesCost =
        (filters.minCost === null || item.cost_usd >= filters.minCost) &&
        (filters.maxCost === null || item.cost_usd <= filters.maxCost);

      const matchesDeploymentFilter =
        !showOnlyDeployments || getModelCategory(item.model_id) === 'Other';

      return (
        matchesSearch &&
        matchesStatus &&
        matchesDeployment &&
        matchesModel &&
        matchesBackend &&
        matchesTokens &&
        matchesLatency &&
        matchesCost &&
        matchesDeploymentFilter
      );
    });
  }, [traces, searchQuery, filterStatus, filters, showOnlyDeployments]);

  const hasActiveFilters =
    filters.deployments.length > 0 ||
    filters.models.length > 0 ||
    filters.backends.length > 0 ||
    filters.minTokens !== null ||
    filters.maxTokens !== null ||
    filters.minLatency !== null ||
    filters.maxLatency !== null ||
    filters.minCost !== null ||
    filters.maxCost !== null ||
    showOnlyDeployments;

  const updateFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const toggleArrayFilter = (key: 'deployments' | 'models' | 'backends', value: string) => {
    setFilters((prev) => ({
      ...prev,
      [key]: prev[key].includes(value)
        ? prev[key].filter((item) => item !== value)
        : [...prev[key], value],
    }));
  };

  const clearAllFilters = () => {
    setFilters(initialFilterState);
    setFilterStatus('all');
    setSearchQuery('');
    setShowOnlyDeployments(false);
  };

  return {
    filters,
    searchQuery,
    filterStatus,
    showOnlyDeployments,
    dataRanges,
    filterOptions,
    filteredData,
    hasActiveFilters,
    setSearchQuery,
    setFilterStatus,
    setShowOnlyDeployments,
    updateFilter,
    toggleArrayFilter,
    clearAllFilters,
  };
}
