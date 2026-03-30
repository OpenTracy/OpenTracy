import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Trace } from '../types';

const DEFAULT_PAGE_SIZE = 15;
const PAGE_SIZE_OPTIONS = [10, 15, 25, 50, 100];

interface UseCreateFromTracesModalOptions {
  open: boolean;
  traces: Trace[];
  onCreate: (name: string, traceIds: string[]) => Promise<void>;
  onClose: () => void;
}

const DATE_RANGE_DAYS: Record<string, number | undefined> = {
  '1d': 1,
  '7d': 7,
  '30d': 30,
  all: undefined,
};

function getStartDate(range: string): string | undefined {
  const days = DATE_RANGE_DAYS[range];
  if (days === undefined) return undefined;
  const now = new Date();
  now.setDate(now.getDate() - days);
  return now.toISOString();
}

export function useCreateFromTracesModal({
  open,
  traces,
  onCreate,
  onClose,
}: UseCreateFromTracesModalOptions) {
  const [name, setName] = useState('');
  const [selectedTraces, setSelectedTraces] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState('all');
  const [selectedModel, setSelectedModel] = useState<string>('all');
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [successName, setSuccessName] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  useEffect(() => {
    if (open) {
      setName('');
      setSelectedTraces(new Set());
      setSearchTerm('');
      setDateRange('all');
      setSelectedModel('all');
      setError(null);
      setCreating(false);
      setSuccessName(null);
      setPage(0);
    }
  }, [open]);

  const uniqueModels = useMemo(() => {
    const models = new Set(traces.map((t) => t.model_id));
    return Array.from(models).sort();
  }, [traces]);

  const filteredTraces = useMemo(() => {
    const startDate = getStartDate(dateRange);

    return traces.filter((t) => {
      if (startDate) {
        const traceDate = new Date(t.created_at).getTime();
        const filterDate = new Date(startDate).getTime();
        if (traceDate < filterDate) return false;
      }

      if (selectedModel !== 'all' && t.model_id !== selectedModel) return false;

      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        if (
          !(t.input ?? '').toLowerCase().includes(search) &&
          !(t.output ?? '').toLowerCase().includes(search) &&
          !(t.model_id ?? '').toLowerCase().includes(search)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [traces, dateRange, selectedModel, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredTraces.length / pageSize));
  const paginatedTraces = useMemo(
    () => filteredTraces.slice(page * pageSize, (page + 1) * pageSize),
    [filteredTraces, page, pageSize]
  );

  useEffect(() => {
    setPage(0);
  }, [searchTerm, selectedModel, dateRange, pageSize]);

  const pageAllSelected =
    paginatedTraces.length > 0 && paginatedTraces.every((t) => selectedTraces.has(t.id));

  const pageSomeSelected =
    paginatedTraces.some((t) => selectedTraces.has(t.id)) && !pageAllSelected;

  const toggleTrace = useCallback((traceId: string) => {
    setSelectedTraces((prev) => {
      const next = new Set(prev);
      if (next.has(traceId)) {
        next.delete(traceId);
      } else {
        next.add(traceId);
      }
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedTraces((prev) => {
      const next = new Set(prev);
      if (pageAllSelected) {
        paginatedTraces.forEach((t) => next.delete(t.id));
      } else {
        paginatedTraces.forEach((t) => next.add(t.id));
      }
      return next;
    });
  }, [pageAllSelected, paginatedTraces]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      if (!name.trim()) {
        setError('Please enter a dataset name');
        return;
      }

      if (selectedTraces.size === 0) {
        setError('Please select at least one trace');
        return;
      }

      try {
        setCreating(true);
        await onCreate(name.trim(), Array.from(selectedTraces));
        setSuccessName(name.trim());
        setTimeout(() => {
          onClose();
          setCreating(false);
          setSuccessName(null);
        }, 800);
      } catch (err) {
        console.error('Failed to create dataset from traces:', err);
        setError(err instanceof Error ? err.message : 'Failed to create dataset');
        setCreating(false);
      }
    },
    [name, selectedTraces, onCreate, onClose]
  );

  const hasActiveFilters = searchTerm || selectedModel !== 'all' || dateRange !== 'all';

  const clearAllFilters = useCallback(() => {
    setSearchTerm('');
    setSelectedModel('all');
    setDateRange('all');
  }, []);

  return {
    name,
    setName,
    searchTerm,
    setSearchTerm,
    dateRange,
    setDateRange,
    selectedModel,
    setSelectedModel,
    error,
    creating,
    successName,
    page,
    setPage,
    pageSize,
    setPageSize,
    pageSizeOptions: PAGE_SIZE_OPTIONS,
    selectedTraces,

    uniqueModels,
    filteredTraces,
    paginatedTraces,
    totalPages,
    pageAllSelected,
    pageSomeSelected,
    hasActiveFilters,
    isDisabled: creating,

    toggleTrace,
    toggleSelectAll,
    handleSubmit,
    clearAllFilters,
  };
}
