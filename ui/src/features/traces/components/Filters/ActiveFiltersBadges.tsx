import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { FilterState } from '../../hooks/UseAnalyticsFilters';

interface ActiveFiltersBadgesProps {
  filters: FilterState;
  showOnlyDeployments: boolean;
  onToggleArrayFilter: (key: 'deployments' | 'models' | 'backends', value: string) => void;
  onUpdateFilter: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
  onClearAll: () => void;
  onToggleDeployments: (value: boolean) => void;
  totalCount: number;
  filteredCount: number;
}

export function ActiveFiltersBadges({
  filters,
  showOnlyDeployments,
  onToggleArrayFilter,
  onUpdateFilter,
  onClearAll,
  onToggleDeployments,
  totalCount,
  filteredCount,
}: ActiveFiltersBadgesProps) {
  const hasAnyFilters =
    filters.deployments.length > 0 ||
    filters.models.length > 0 ||
    filters.backends.length > 0 ||
    filters.minLatency !== null ||
    filters.maxLatency !== null ||
    filters.minTokens !== null ||
    filters.maxTokens !== null ||
    filters.minCost !== null ||
    filters.maxCost !== null ||
    showOnlyDeployments;

  if (!hasAnyFilters) return null;

  return (
    <div className="flex items-center justify-between gap-4 py-0">
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-xs font-medium text-muted-foreground mr-1">Filters:</span>

        {showOnlyDeployments && (
          <Badge variant="outline" className="gap-1">
            Deployment Runs Only
            <button
              className="ml-0.5 rounded-full hover:bg-muted transition-colors"
              onClick={() => onToggleDeployments(false)}
            >
              <X className="size-3" />
            </button>
          </Badge>
        )}

        {filters.deployments.map((deployment) => (
          <Badge key={`dep-${deployment}`} variant="outline" className="gap-1">
            {deployment}
            <button
              className="ml-0.5 rounded-full hover:bg-muted transition-colors"
              onClick={() => onToggleArrayFilter('deployments', deployment)}
            >
              <X className="size-3" />
            </button>
          </Badge>
        ))}

        {filters.models.map((model) => (
          <Badge key={`model-${model}`} variant="outline" className="gap-1">
            {model.split('/').pop()}
            <button
              className="ml-0.5 rounded-full hover:bg-muted transition-colors"
              onClick={() => onToggleArrayFilter('models', model)}
            >
              <X className="size-3" />
            </button>
          </Badge>
        ))}

        {filters.backends.map((backend) => (
          <Badge key={`back-${backend}`} variant="outline" className="gap-1">
            {backend.charAt(0).toUpperCase() + backend.slice(1)}
            <button
              className="ml-0.5 rounded-full hover:bg-muted transition-colors"
              onClick={() => onToggleArrayFilter('backends', backend)}
            >
              <X className="size-3" />
            </button>
          </Badge>
        ))}

        {(filters.minTokens !== null || filters.maxTokens !== null) && (
          <Badge variant="outline" className="gap-1 tabular-nums">
            Tokens: {filters.minTokens || 0} – {filters.maxTokens || '∞'}
            <button
              className="ml-0.5 rounded-full hover:bg-muted transition-colors"
              onClick={() => {
                onUpdateFilter('minTokens', null);
                onUpdateFilter('maxTokens', null);
              }}
            >
              <X className="size-3" />
            </button>
          </Badge>
        )}

        {(filters.minLatency !== null || filters.maxLatency !== null) && (
          <Badge variant="outline" className="gap-1 tabular-nums">
            Latency: {filters.minLatency || 0}s – {filters.maxLatency || '∞'}s
            <button
              className="ml-0.5 rounded-full hover:bg-muted transition-colors"
              onClick={() => {
                onUpdateFilter('minLatency', null);
                onUpdateFilter('maxLatency', null);
              }}
            >
              <X className="size-3" />
            </button>
          </Badge>
        )}

        {(filters.minCost !== null || filters.maxCost !== null) && (
          <Badge variant="outline" className="gap-1 tabular-nums">
            Cost: ${filters.minCost || 0} – ${filters.maxCost || '∞'}
            <button
              className="ml-0.5 rounded-full hover:bg-muted transition-colors"
              onClick={() => {
                onUpdateFilter('minCost', null);
                onUpdateFilter('maxCost', null);
              }}
            >
              <X className="size-3" />
            </button>
          </Badge>
        )}

        <Button variant="ghost" size="sm" onClick={onClearAll}>
          Clear all
        </Button>
      </div>

      <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
        {filteredCount} of {totalCount} traces
      </span>
    </div>
  );
}
