import { Activity, Clock, Hash, Layers, Rocket, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CheckboxGroup } from './CheckboxGroup';
import { RangeSlider } from './RangeSlider';
import { DeploymentToggle } from './DeploymentToggle';
import { ProviderIcon } from './ProviderIcon';
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

interface AdvancedFiltersPanelProps {
  filters: FilterState;
  filterOptions: FilterOptions;
  dataRanges: DataRanges;
  showOnlyDeployments: boolean;
  onUpdateFilter: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
  onToggleArrayFilter: (key: 'deployments' | 'models' | 'backends', value: string) => void;
  onClearAll: () => void;
  onToggleDeployments: (value: boolean) => void;
  hasActiveFilters: boolean;
}

export function AdvancedFiltersPanel({
  filters,
  filterOptions,
  dataRanges,
  showOnlyDeployments,
  onUpdateFilter,
  onToggleArrayFilter,
  onClearAll,
  onToggleDeployments,
  hasActiveFilters,
}: AdvancedFiltersPanelProps) {
  return (
    <div className="flex flex-col max-h-112 overflow-hidden">
      <ScrollArea className="flex-1 overflow-auto scrollbar-thin">
        <div className="p-4 space-y-5">
          <DeploymentToggle checked={showOnlyDeployments} onChange={onToggleDeployments} />

          {filterOptions.deployments.length > 0 && (
            <CheckboxGroup
              label="Deployments"
              icon={Rocket}
              options={filterOptions.deployments}
              selected={filters.deployments}
              onToggle={(value) => onToggleArrayFilter('deployments', value)}
            />
          )}

          {filterOptions.models.length > 0 && (
            <CheckboxGroup
              label="Models"
              icon={Layers}
              options={filterOptions.models}
              selected={filters.models}
              onToggle={(value) => onToggleArrayFilter('models', value)}
              formatLabel={(model) => model.split('/').pop() || model}
              renderIcon={(model) => <ProviderIcon modelId={model} size={16} />}
            />
          )}

          {filterOptions.backends.length > 0 && (
            <CheckboxGroup
              label="Providers"
              icon={Activity}
              options={filterOptions.backends}
              selected={filters.backends}
              onToggle={(value) => onToggleArrayFilter('backends', value)}
              formatLabel={(backend) => backend.charAt(0).toUpperCase() + backend.slice(1)}
              renderIcon={(backend) => <ProviderIcon backend={backend} size={16} />}
            />
          )}

          <RangeSlider
            label="Total Tokens"
            icon={Hash}
            min={dataRanges.tokens.min}
            max={dataRanges.tokens.max}
            valueMin={filters.minTokens}
            valueMax={filters.maxTokens}
            onMinChange={(val) => onUpdateFilter('minTokens', val)}
            onMaxChange={(val) => onUpdateFilter('maxTokens', val)}
            formatValue={(val) => val.toLocaleString()}
          />

          <RangeSlider
            label="Latency"
            icon={Clock}
            min={dataRanges.latency.min}
            max={dataRanges.latency.max}
            valueMin={filters.minLatency}
            valueMax={filters.maxLatency}
            onMinChange={(val) => onUpdateFilter('minLatency', val)}
            onMaxChange={(val) => onUpdateFilter('maxLatency', val)}
            step={0.01}
            formatValue={(val) => `${val.toFixed(2)}s`}
          />
        </div>
      </ScrollArea>

      {hasActiveFilters && (
        <div className="px-4 py-3 border-t border-border">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearAll}
            className="w-full text-muted-foreground hover:text-foreground"
          >
            <X className="size-3.5" />
            Clear all filters
          </Button>
        </div>
      )}
    </div>
  );
}
