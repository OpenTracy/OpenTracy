import { Clock, DollarSign, Search, Loader2 } from 'lucide-react';
import type { Trace } from '../../types';
import { formatCost, formatLatencyMs } from '@/utils/formatUtils';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
} from '@/components/ui/pagination';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from '@/components/ui/empty';
import { ModelIcon } from '../../utils/ModelIcons';
import { cn } from '@/lib/utils';

interface TracesTableProps {
  paginatedTraces: Trace[];
  filteredTraces: Trace[];
  selectedTraces: Set<string>;
  pageAllSelected: boolean;
  pageSomeSelected: boolean;
  page: number;
  totalPages: number;
  pageSize: number;
  pageSizeOptions: number[];
  loading: boolean;
  disabled: boolean;
  hasActiveFilters: boolean;
  hasSearchTerm: boolean;
  onToggleTrace: (traceId: string) => void;
  onToggleSelectAll: () => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onClearFilters: () => void;
}

const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const getPaginationPages = (current: number, total: number): (number | 'ellipsis')[] => {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i);
  const pages: (number | 'ellipsis')[] = [0];
  if (current > 2) pages.push('ellipsis');
  const start = Math.max(1, current - 1);
  const end = Math.min(total - 2, current + 1);
  for (let i = start; i <= end; i++) pages.push(i);
  if (current < total - 3) pages.push('ellipsis');
  pages.push(total - 1);
  return pages;
};

export function TracesTable({
  paginatedTraces,
  filteredTraces,
  selectedTraces,
  pageAllSelected,
  pageSomeSelected,
  page,
  totalPages,
  pageSize,
  pageSizeOptions,
  loading,
  disabled,
  hasActiveFilters,
  hasSearchTerm,
  onToggleTrace,
  onToggleSelectAll,
  onPageChange,
  onPageSizeChange,
  onClearFilters,
}: TracesTableProps) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Loading traces...</p>
      </div>
    );
  }

  if (filteredTraces.length === 0) {
    return (
      <Empty className="py-16">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Search className="size-5" />
          </EmptyMedia>
          <EmptyTitle>{hasSearchTerm ? 'No matching traces' : 'No traces found'}</EmptyTitle>
          <EmptyDescription>
            {hasSearchTerm
              ? 'Try adjusting your search or filters'
              : 'No traces found for the selected time range and source'}
          </EmptyDescription>
        </EmptyHeader>
        {hasActiveFilters && (
          <Button variant="outline" size="sm" onClick={onClearFilters}>
            Clear all filters
          </Button>
        )}
      </Empty>
    );
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10 pl-4">
                <Checkbox
                  checked={pageAllSelected ? true : pageSomeSelected ? 'indeterminate' : false}
                  onCheckedChange={onToggleSelectAll}
                  disabled={disabled || paginatedTraces.length === 0}
                />
              </TableHead>
              <TableHead className="min-w-48">Input</TableHead>
              <TableHead>Model</TableHead>
              <TableHead className="text-right">Latency</TableHead>
              <TableHead className="text-right">Cost</TableHead>
              <TableHead className="pr-4 text-right">Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedTraces.map((trace) => {
              const isSelected = selectedTraces.has(trace.id);
              return (
                <TableRow
                  key={trace.id}
                  data-state={isSelected ? 'selected' : undefined}
                  className="cursor-pointer"
                  onClick={() => !disabled && onToggleTrace(trace.id)}
                >
                  <TableCell className="pl-4" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => onToggleTrace(trace.id)}
                      disabled={disabled}
                    />
                  </TableCell>
                  <TableCell className="max-w-xs">
                    <p className="truncate text-sm">{(trace.input ?? '').slice(0, 100)}</p>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <ModelIcon modelId={trace.model_id} />
                      <span className="text-xs">{trace.model_id}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="size-3" />
                      {formatLatencyMs(trace.latency_ms)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <DollarSign className="size-3" />
                      {formatCost(trace.cost_usd)}
                    </span>
                  </TableCell>
                  <TableCell className="pr-4 text-right tabular-nums text-xs text-muted-foreground">
                    {formatDate(trace.created_at)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between border-t px-4 py-2 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="whitespace-nowrap text-xs">
            {selectedTraces.size > 0 ? (
              <>
                <span className="font-medium text-foreground">{selectedTraces.size}</span> selected
              </>
            ) : (
              <>{filteredTraces.length} traces</>
            )}
          </span>
          <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
            <SelectTrigger size="sm" className="h-7 w-17.5 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizeOptions.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">/ page</span>
        </div>

        <Pagination className="mx-0 w-auto">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                className={cn(
                  'h-8 text-xs',
                  page === 0 ? 'pointer-events-none opacity-50' : 'cursor-pointer'
                )}
                onClick={() => page > 0 && onPageChange(page - 1)}
              />
            </PaginationItem>
            {getPaginationPages(page, totalPages).map((p, i) =>
              p === 'ellipsis' ? (
                <PaginationItem key={`e-${i}`}>
                  <PaginationEllipsis className="size-8" />
                </PaginationItem>
              ) : (
                <PaginationItem key={p}>
                  <PaginationLink
                    className="size-8 cursor-pointer text-xs"
                    isActive={p === page}
                    onClick={() => onPageChange(p)}
                  >
                    {p + 1}
                  </PaginationLink>
                </PaginationItem>
              )
            )}
            <PaginationItem>
              <PaginationNext
                className={cn(
                  'h-8 text-xs',
                  page >= totalPages - 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'
                )}
                onClick={() => page < totalPages - 1 && onPageChange(page + 1)}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </>
  );
}
