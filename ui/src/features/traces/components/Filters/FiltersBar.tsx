import { Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SearchBar } from '@/components/shared/SearchBar';
import { TimeRangeButtons } from './TimeRangeButtons';
import { StatusButtons } from './StatusButtons';
import { AdvancedFiltersPanel } from './AdvancedFiltersPanel';
import type { FilterState } from '../../hooks/UseAnalyticsFilters';

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

interface FiltersBarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  timeRange: string;
  onTimeRangeChange: (value: string) => void;
  filterStatus: 'all' | 'success' | 'error';
  onStatusChange: (value: 'all' | 'success' | 'error') => void;
  showFilters: boolean;
  onToggleFilters: () => void;
  hasActiveFilters: boolean;
  filterCount: number;
  filteredCount: number;
  filters: FilterState;
  filterOptions: FilterOptions;
  dataRanges: DataRanges;
  showOnlyDeployments: boolean;
  onUpdateFilter: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
  onToggleArrayFilter: (key: 'deployments' | 'models' | 'backends', value: string) => void;
  onClearAllFilters: () => void;
  onToggleDeployments: (value: boolean) => void;
}

export function FiltersBar({
  searchQuery,
  onSearchChange,
  timeRange,
  onTimeRangeChange,
  filterStatus,
  onStatusChange,
  showFilters,
  onToggleFilters,
  hasActiveFilters,
  filterCount,
  filteredCount,
  filters,
  filterOptions,
  dataRanges,
  showOnlyDeployments,
  onUpdateFilter,
  onToggleArrayFilter,
  onClearAllFilters,
  onToggleDeployments,
}: FiltersBarProps) {
  return (
    <div className="flex flex-col gap-3">
      <SearchBar
        value={searchQuery}
        onChange={onSearchChange}
        placeholder="Search by model, input, or output..."
        resultCount={filteredCount}
        resultCountPosition="inside"
        maxWidth="max-w-sm"
        filters={
          <div className="flex items-center gap-2 flex-wrap">
            <Popover open={showFilters} onOpenChange={onToggleFilters}>
              <PopoverTrigger asChild>
                <Button variant={hasActiveFilters ? 'default' : 'outline'} size="sm">
                  <Filter className="size-4" />
                  Filters
                  {hasActiveFilters && (
                    <Badge variant="secondary" className="ml-1">
                      {filterCount}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-115 p-0" sideOffset={8}>
                <AdvancedFiltersPanel
                  filters={filters}
                  filterOptions={filterOptions}
                  dataRanges={dataRanges}
                  showOnlyDeployments={showOnlyDeployments}
                  onUpdateFilter={onUpdateFilter}
                  onToggleArrayFilter={onToggleArrayFilter}
                  onClearAll={onClearAllFilters}
                  onToggleDeployments={onToggleDeployments}
                  hasActiveFilters={hasActiveFilters}
                />
              </PopoverContent>
            </Popover>

            <TimeRangeButtons value={timeRange} onChange={onTimeRangeChange} />
            <StatusButtons value={filterStatus} onChange={onStatusChange} />
          </div>
        }
      />
    </div>
  );
}
