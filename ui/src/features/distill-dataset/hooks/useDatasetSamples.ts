import { useState, useEffect, useCallback, useMemo } from 'react';
import { useDatasets } from '@/hooks/useDatasets';
import { TOKEN_BUCKETS } from '../constants';
import type { DatasetSample } from '../types';

interface TokenBucket {
  label: string;
  min: number;
  max: number;
  count: number;
}

export interface DatasetStats {
  total: number;
  withOutput: number;
  missingOutput: number;
  avgInputTokens: number;
  avgOutputTokens: number;
  maxInputTokens: number;
  maxOutputTokens: number;
  minInputTokens: number;
  minOutputTokens: number;
  totalTokens: number;
  inputHistogram: TokenBucket[];
  outputHistogram: TokenBucket[];
}

interface UseDatasetSamplesOptions {
  datasetId: string | undefined;
}

export function useDatasetSamples({ datasetId }: UseDatasetSamplesOptions) {
  const { getDataset } = useDatasets();
  const [samples, setSamples] = useState<DatasetSample[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [samplesPerPage, setSamplesPerPage] = useState(100);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [inputLengthFilter, setInputLengthFilter] = useState<{ min: number; max: number } | null>(
    null
  );
  const [outputLengthFilter, setOutputLengthFilter] = useState<{ min: number; max: number } | null>(
    null
  );

  const loadSamples = useCallback(async () => {
    if (!datasetId) return;
    setLoading(true);
    try {
      const result = await getDataset(datasetId);
      setSamples(result?.samples ?? []);
    } catch {
      setSamples([]);
    } finally {
      setLoading(false);
    }
  }, [datasetId, getDataset]);

  useEffect(() => {
    loadSamples();
  }, [loadSamples]);

  const stats = useMemo<DatasetStats | null>(() => {
    if (samples.length === 0) return null;

    const inputLengths = samples.map((s) => s.input?.length ?? 0);
    const outputLengths = samples.map((s) => s.expected_output?.length ?? s.output?.length ?? 0);
    const inputTokens = inputLengths.map((l) => Math.round(l / 4));
    const outputTokens = outputLengths.map((l) => Math.round(l / 4));

    const inputHistogram = TOKEN_BUCKETS.map((bucket) => ({
      ...bucket,
      count: inputTokens.filter((t) => t >= bucket.min && t <= bucket.max).length,
    }));

    const outputHistogram = TOKEN_BUCKETS.map((bucket) => ({
      ...bucket,
      count: outputTokens.filter((t) => t >= bucket.min && t <= bucket.max).length,
    }));

    const withOutput = samples.filter((s) => s.expected_output || s.output).length;

    return {
      total: samples.length,
      withOutput,
      missingOutput: samples.length - withOutput,
      avgInputTokens: Math.round(inputTokens.reduce((a, b) => a + b, 0) / inputTokens.length),
      avgOutputTokens: Math.round(outputTokens.reduce((a, b) => a + b, 0) / outputTokens.length),
      maxInputTokens: Math.max(...inputTokens),
      maxOutputTokens: Math.max(...outputTokens),
      minInputTokens: Math.min(...inputTokens),
      minOutputTokens: Math.min(...outputTokens),
      totalTokens: inputTokens.reduce((a, b) => a + b, 0) + outputTokens.reduce((a, b) => a + b, 0),
      inputHistogram,
      outputHistogram,
    };
  }, [samples]);

  const filteredSamples = useMemo(() => {
    return samples.filter((s) => {
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const matches =
          (s.input ?? '').toLowerCase().includes(q) ||
          s.expected_output?.toLowerCase().includes(q) ||
          s.output?.toLowerCase().includes(q);
        if (!matches) return false;
      }
      if (inputLengthFilter) {
        const tokens = Math.round((s.input?.length ?? 0) / 4);
        if (tokens < inputLengthFilter.min || tokens > inputLengthFilter.max) return false;
      }
      if (outputLengthFilter) {
        const tokens = Math.round((s.expected_output?.length ?? s.output?.length ?? 0) / 4);
        if (tokens < outputLengthFilter.min || tokens > outputLengthFilter.max) return false;
      }
      return true;
    });
  }, [samples, searchTerm, inputLengthFilter, outputLengthFilter]);

  const totalPages = Math.ceil(filteredSamples.length / samplesPerPage);
  const startIndex = (currentPage - 1) * samplesPerPage;
  const paginatedSamples = filteredSamples.slice(startIndex, startIndex + samplesPerPage);

  const hasActiveFilters = !!(inputLengthFilter || outputLengthFilter || searchTerm);

  const toggleRowExpand = useCallback((id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearFilters = useCallback(() => {
    setInputLengthFilter(null);
    setOutputLengthFilter(null);
    setSearchTerm('');
    setCurrentPage(1);
  }, []);

  const handleHistogramClick = useCallback(
    (type: 'input' | 'output', bucket: { min: number; max: number }) => {
      if (type === 'input') {
        setInputLengthFilter((prev) => (prev?.min === bucket.min ? null : bucket));
      } else {
        setOutputLengthFilter((prev) => (prev?.min === bucket.min ? null : bucket));
      }
      setCurrentPage(1);
    },
    []
  );

  return {
    samples,
    loading,
    stats,
    searchTerm,
    setSearchTerm,
    currentPage,
    setCurrentPage,
    samplesPerPage,
    setSamplesPerPage,
    expandedRows,
    toggleRowExpand,
    inputLengthFilter,
    outputLengthFilter,
    setInputLengthFilter,
    setOutputLengthFilter,
    filteredSamples,
    paginatedSamples,
    totalPages,
    startIndex,
    hasActiveFilters,
    clearFilters,
    handleHistogramClick,
    reload: loadSamples,
  };
}
