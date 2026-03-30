import { Activity, BarChart2, Clock, Cpu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import LunarLogo from '@/assets/lunar-logo.png';
import { CheckboxGroup } from './CheckboxGroup';
import { RangeSlider } from './RangeSlider';
import { DeploymentToggle } from './DeploymentToggle';
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
    <div className="flex flex-col max-h-130">
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Advanced Filters</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Refine your trace search</p>
        </div>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={onClearAll} className="text-destructive">
            <X className="size-3.5" />
            Clear All
          </Button>
        )}
      </div>

      <Separator />

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          <DeploymentToggle
            checked={showOnlyDeployments}
            onChange={onToggleDeployments}
            logo={LunarLogo}
          />

          {filterOptions.deployments.length > 0 && (
            <CheckboxGroup
              label="Deployments"
              icon={Activity}
              options={filterOptions.deployments}
              selected={filters.deployments}
              onToggle={(value) => onToggleArrayFilter('deployments', value)}
            />
          )}

          {filterOptions.models.length > 0 && (
            <CheckboxGroup
              label="Models"
              icon={Cpu}
              options={filterOptions.models}
              selected={filters.models}
              onToggle={(value) => onToggleArrayFilter('models', value)}
              formatLabel={(model) => model.split('/').pop() || model}
            />
          )}

          {filterOptions.backends.length > 0 && (
            <CheckboxGroup
              label="Providers"
              icon={BarChart2}
              options={filterOptions.backends}
              selected={filters.backends}
              onToggle={(value) => onToggleArrayFilter('backends', value)}
              formatLabel={(backend) => backend.charAt(0).toUpperCase() + backend.slice(1)}
            />
          )}

          <RangeSlider
            label="Total Tokens"
            icon={Cpu}
            min={dataRanges.tokens.min}
            max={dataRanges.tokens.max}
            valueMin={filters.minTokens}
            valueMax={filters.maxTokens}
            onMinChange={(val) => onUpdateFilter('minTokens', val)}
            onMaxChange={(val) => onUpdateFilter('maxTokens', val)}
            formatValue={(val) => val.toLocaleString()}
          />

          <RangeSlider
            label="Latency (seconds)"
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
    </div>
  );
}
