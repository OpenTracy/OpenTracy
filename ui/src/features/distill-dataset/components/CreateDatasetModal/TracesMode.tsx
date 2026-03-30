import { useState, useCallback } from 'react';
import { X, Search, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useCreateFromTracesModal } from '../../hooks/useCreateFromTracesModal';
import { TracesTable } from './TracesTable';
import { DATE_RANGES } from '../../constants';
import type { Trace } from '../../types';

interface TracesModeProps {
  traces: Trace[];
  tracesLoading: boolean;
  disabled: boolean;
  onCreateFromTraces: (name: string, traceIds: string[]) => Promise<void>;
  onSuccess: (name: string) => void;
}

export function TracesMode({
  traces,
  tracesLoading,
  disabled,
  onCreateFromTraces,
  onSuccess,
}: TracesModeProps) {
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filter = useCreateFromTracesModal({
    open: true,
    traces,
    onCreate: async () => {},
    onClose: () => {},
  });

  const isDisabled = disabled || creating;

  const handleCreate = useCallback(async () => {
    setError(null);
    if (!name.trim()) {
      setError('Please enter a dataset name');
      return;
    }
    if (filter.selectedTraces.size === 0) {
      setError('Select at least one trace');
      return;
    }
    setCreating(true);
    try {
      await onCreateFromTraces(name.trim(), Array.from(filter.selectedTraces));
      onSuccess(name.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create dataset');
      setCreating(false);
    }
  }, [name, filter.selectedTraces, onCreateFromTraces, onSuccess]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-6 pt-5">
        <div className="space-y-1.5">
          <Label htmlFor="traces-dataset-name">Dataset Name</Label>
          <Input
            id="traces-dataset-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Production Traces Q4"
            disabled={isDisabled}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 px-6 pt-4">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filter.searchTerm}
            onChange={(e) => filter.setSearchTerm(e.target.value)}
            placeholder="Search traces..."
            className="h-8 pl-9 pr-9 text-xs"
            disabled={isDisabled}
          />
          {filter.searchTerm && (
            <button
              type="button"
              onClick={() => filter.setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        <Tabs value={filter.dateRange} onValueChange={filter.setDateRange}>
          <TabsList className="h-8">
            {DATE_RANGES.map((range) => (
              <TabsTrigger
                key={range.value}
                value={range.value}
                disabled={isDisabled}
                className="h-7 px-2.5 text-xs"
              >
                {range.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {filter.uniqueModels.length > 0 && (
          <Select
            value={filter.selectedModel}
            onValueChange={filter.setSelectedModel}
            disabled={isDisabled}
          >
            <SelectTrigger size="sm" className="h-8 w-40 text-xs">
              <SelectValue placeholder="All models" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All models</SelectItem>
              {filter.uniqueModels.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {filter.hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={filter.clearAllFilters}
            className="h-8 text-muted-foreground"
          >
            <X className="size-3" />
            Clear
          </Button>
        )}
      </div>

      <div className="mt-4 flex min-h-0 flex-1 flex-col border-t">
        <TracesTable
          paginatedTraces={filter.paginatedTraces}
          filteredTraces={filter.filteredTraces}
          selectedTraces={filter.selectedTraces}
          pageAllSelected={filter.pageAllSelected}
          pageSomeSelected={filter.pageSomeSelected}
          page={filter.page}
          totalPages={filter.totalPages}
          pageSize={filter.pageSize}
          pageSizeOptions={filter.pageSizeOptions}
          loading={tracesLoading}
          disabled={isDisabled}
          hasActiveFilters={!!filter.hasActiveFilters}
          hasSearchTerm={filter.searchTerm.length > 0}
          onToggleTrace={filter.toggleTrace}
          onToggleSelectAll={filter.toggleSelectAll}
          onPageChange={filter.setPage}
          onPageSizeChange={filter.setPageSize}
          onClearFilters={filter.clearAllFilters}
        />
      </div>

      {error && (
        <div className="px-6 pt-3">
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      )}

      <div className="flex items-center justify-between border-t px-6 py-4">
        <span className="text-sm text-muted-foreground">
          {filter.selectedTraces.size > 0
            ? `${filter.selectedTraces.size} trace${filter.selectedTraces.size > 1 ? 's' : ''} selected`
            : 'Select traces to create a dataset'}
        </span>
        <Button
          disabled={isDisabled || filter.selectedTraces.size === 0 || !name.trim()}
          loading={creating}
          onClick={handleCreate}
        >
          {creating
            ? 'Creating...'
            : `Create Dataset${filter.selectedTraces.size > 0 ? ` (${filter.selectedTraces.size})` : ''}`}
        </Button>
      </div>
    </div>
  );
}
