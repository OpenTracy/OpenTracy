import { useState, useCallback } from 'react';
import {
  X,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  Table2,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SearchBar } from '@/components/shared/SearchBar';
import { SAMPLES_PER_PAGE_OPTIONS } from '../../constants';
import type { DatasetSample } from '../../types';

type ViewMode = 'table' | 'cards';

interface SamplesExplorerProps {
  filteredSamples: DatasetSample[];
  paginatedSamples: DatasetSample[];
  totalPages: number;
  currentPage: number;
  startIndex: number;
  samplesPerPage: number;
  searchTerm: string;
  hasActiveFilters: boolean;
  expandedRows: Set<string>;
  inputLengthFilter?: { min: number; max: number } | null;
  outputLengthFilter?: { min: number; max: number } | null;
  onSearchChange: (value: string) => void;
  onPageChange: (page: number) => void;
  onSamplesPerPageChange: (value: number) => void;
  onToggleExpand: (id: string) => void;
  onClearFilters: () => void;
  onClearInputFilter?: () => void;
  onClearOutputFilter?: () => void;
}

export function SamplesExplorer({
  filteredSamples,
  paginatedSamples,
  totalPages,
  currentPage,
  startIndex,
  samplesPerPage,
  searchTerm,
  hasActiveFilters,
  expandedRows,
  inputLengthFilter,
  outputLengthFilter,
  onSearchChange,
  onPageChange,
  onSamplesPerPageChange,
  onToggleExpand,
  onClearFilters,
  onClearInputFilter,
  onClearOutputFilter,
}: SamplesExplorerProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedRow, setSelectedRow] = useState<string | null>(null);
  const [jumpToPage, setJumpToPage] = useState('');

  const copyToClipboard = useCallback((text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const handleJumpToPage = useCallback(() => {
    const page = parseInt(jumpToPage);
    if (!isNaN(page) && page >= 1 && page <= totalPages) {
      onPageChange(page);
      setJumpToPage('');
    }
  }, [jumpToPage, totalPages, onPageChange]);

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 px-4 py-3 border-b border-border space-y-2">
        <div className="flex items-center gap-3">
          <SearchBar
            value={searchTerm}
            onChange={(v) => {
              onSearchChange(v);
              onPageChange(1);
            }}
            placeholder="Search in samples..."
            inputClassName="pr-4 py-2 text-sm"
            maxWidth="max-w-md"
          />

          {hasActiveFilters && (
            <div className="flex items-center gap-2">
              {inputLengthFilter && (
                <Badge variant="secondary" className="gap-1.5 pr-1.5">
                  Input: {inputLengthFilter.min}-
                  {inputLengthFilter.max === Infinity ? '∞' : inputLengthFilter.max}t
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-4 ml-0.5"
                    onClick={onClearInputFilter}
                  >
                    <X className="size-3" />
                  </Button>
                </Badge>
              )}
              {outputLengthFilter && (
                <Badge variant="secondary" className="gap-1.5 pr-1.5">
                  Output: {outputLengthFilter.min}-
                  {outputLengthFilter.max === Infinity ? '∞' : outputLengthFilter.max}t
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-4 ml-0.5"
                    onClick={onClearOutputFilter}
                  >
                    <X className="size-3" />
                  </Button>
                </Badge>
              )}
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 text-xs text-muted-foreground"
                onClick={onClearFilters}
              >
                Clear all
              </Button>
            </div>
          )}

          <div className="flex-1" />

          <div className="flex items-center border border-border rounded-lg p-0.5">
            <Button
              variant={viewMode === 'table' ? 'secondary' : 'ghost'}
              size="icon"
              className="size-8 rounded-md"
              onClick={() => setViewMode('table')}
            >
              <Table2 className="size-4" />
            </Button>
            <Button
              variant={viewMode === 'cards' ? 'secondary' : 'ghost'}
              size="icon"
              className="size-8 rounded-md"
              onClick={() => setViewMode('cards')}
            >
              <LayoutGrid className="size-4" />
            </Button>
          </div>

          <Select
            value={String(samplesPerPage)}
            onValueChange={(v) => {
              onSamplesPerPageChange(Number(v));
              onPageChange(1);
            }}
          >
            <SelectTrigger className="w-28 text-xs" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SAMPLES_PER_PAGE_OPTIONS.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n} rows
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <p className="text-xs text-muted-foreground">
          {hasActiveFilters ? (
            <>
              <span className="font-medium text-foreground">
                {filteredSamples.length.toLocaleString()}
              </span>{' '}
              filtered samples
            </>
          ) : (
            <>
              <span className="font-medium text-foreground">
                {filteredSamples.length.toLocaleString()}
              </span>{' '}
              samples
            </>
          )}
        </p>
      </div>

      <div className="flex-1 overflow-auto">
        {filteredSamples.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="size-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
                <Search className="size-7 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">No matches found</p>
              <p className="text-xs text-muted-foreground mt-1">Try adjusting your filters</p>
              <Button variant="link" size="sm" className="mt-3 text-xs" onClick={onClearFilters}>
                Clear filters
              </Button>
            </div>
          </div>
        ) : viewMode === 'table' ? (
          <Table>
            <TableHeader className="sticky top-0 bg-muted z-10">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-16 px-4 py-3 text-xs font-medium text-muted-foreground uppercase">
                  #
                </TableHead>
                <TableHead className="w-1/2 px-4 py-3 text-xs font-medium text-muted-foreground uppercase">
                  Input
                </TableHead>
                <TableHead className="w-1/2 px-4 py-3 text-xs font-medium text-muted-foreground uppercase">
                  Output
                </TableHead>
                <TableHead className="w-20 px-4 py-3" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedSamples.map((sample, idx) => {
                const isExpanded = expandedRows.has(sample.id);
                const output = sample.expected_output || sample.output || '';
                const rowNumber = startIndex + idx + 1;
                const isSelected = selectedRow === sample.id;

                return (
                  <TableRow
                    key={sample.id}
                    onClick={() => setSelectedRow(isSelected ? null : sample.id)}
                    className={`border-0 transition-colors group cursor-pointer ${isSelected ? 'bg-accent' : 'hover:bg-muted'}`}
                  >
                    <TableCell className="px-4 py-3 text-xs text-muted-foreground font-mono align-top">
                      {rowNumber}
                    </TableCell>
                    <TableCell className="px-4 py-3 align-top">
                      <div
                        className={`text-sm text-foreground whitespace-pre-wrap ${!isExpanded ? 'line-clamp-3' : ''}`}
                      >
                        {sample.input}
                      </div>
                      {(sample.input?.length ?? 0) > 200 && (
                        <Button
                          variant="link"
                          size="sm"
                          className="h-auto p-0 text-xs gap-1 mt-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleExpand(sample.id);
                          }}
                        >
                          {isExpanded ? (
                            <>
                              <ChevronUp className="size-3" /> Less
                            </>
                          ) : (
                            <>
                              <ChevronDown className="size-3" /> More
                            </>
                          )}
                        </Button>
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-3 align-top">
                      {output ? (
                        <div
                          className={`text-sm text-foreground whitespace-pre-wrap ${!isExpanded ? 'line-clamp-3' : ''}`}
                        >
                          {output}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">No output</span>
                      )}
                      {output && output.length > 200 && (
                        <Button
                          variant="link"
                          size="sm"
                          className="h-auto p-0 text-xs gap-1 mt-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleExpand(sample.id);
                          }}
                        >
                          {isExpanded ? (
                            <>
                              <ChevronUp className="size-3" /> Less
                            </>
                          ) : (
                            <>
                              <ChevronDown className="size-3" /> More
                            </>
                          )}
                        </Button>
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-3 align-top">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 opacity-0 group-hover:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          copyToClipboard(
                            JSON.stringify({ input: sample.input, output }, null, 2),
                            sample.id
                          );
                        }}
                      >
                        {copiedId === sample.id ? (
                          <Check className="size-4" />
                        ) : (
                          <Copy className="size-4" />
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <div className="p-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            {paginatedSamples.map((sample, idx) => {
              const output = sample.expected_output || sample.output || '';
              const rowNumber = startIndex + idx + 1;

              return (
                <Card key={sample.id} className="overflow-hidden">
                  <div className="px-4 py-2 bg-muted border-b border-border flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">
                      Sample #{rowNumber}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      onClick={() =>
                        copyToClipboard(
                          JSON.stringify({ input: sample.input, output }, null, 2),
                          sample.id
                        )
                      }
                    >
                      {copiedId === sample.id ? (
                        <Check className="size-4" />
                      ) : (
                        <Copy className="size-4" />
                      )}
                    </Button>
                  </div>
                  <div className="p-4 border-b border-border">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="secondary" className="text-xs">
                        INPUT
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        ~{Math.round((sample.input?.length ?? 0) / 4)} tokens
                      </span>
                    </div>
                    <div className="text-sm text-foreground whitespace-pre-wrap bg-muted rounded-lg p-3 max-h-48 overflow-y-auto">
                      {sample.input}
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant={output ? 'default' : 'outline'} className="text-xs">
                        OUTPUT
                      </Badge>
                      {output && (
                        <span className="text-xs text-muted-foreground">
                          ~{Math.round(output.length / 4)} tokens
                        </span>
                      )}
                    </div>
                    {output ? (
                      <div className="text-sm text-foreground whitespace-pre-wrap bg-muted rounded-lg p-3 max-h-48 overflow-y-auto">
                        {output}
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground italic bg-muted rounded-lg p-3">
                        No output available
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="shrink-0 border-t border-border px-4 py-3 flex items-center justify-between bg-muted">
          <span className="text-xs text-muted-foreground tabular-nums">
            {startIndex + 1}–{Math.min(startIndex + samplesPerPage, filteredSamples.length)} of{' '}
            {filteredSamples.length.toLocaleString()}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onPageChange(1)}
              disabled={currentPage === 1}
              className="px-2"
            >
              <ChevronsLeft className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-2"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <div className="flex items-center gap-2 mx-1">
              <Input
                type="text"
                value={jumpToPage}
                onChange={(e) => setJumpToPage(e.target.value.replace(/\D/g, ''))}
                onKeyDown={(e) => e.key === 'Enter' && handleJumpToPage()}
                onBlur={handleJumpToPage}
                placeholder={String(currentPage)}
                className="w-12 h-8 px-2 text-xs text-center font-medium"
              />
              <span className="text-xs text-muted-foreground">/ {totalPages.toLocaleString()}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="px-2"
            >
              <ChevronRight className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onPageChange(totalPages)}
              disabled={currentPage === totalPages}
              className="px-2"
            >
              <ChevronsRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
