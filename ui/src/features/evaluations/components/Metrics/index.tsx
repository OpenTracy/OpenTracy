import { useState, useMemo } from 'react';
import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SearchBar } from '@/components/shared/SearchBar';

import { useEvaluationsPage } from '../../contexts/useEvaluationsPage';
import { MetricsSkeleton } from './Skeleton';
import { MetricsEmpty } from './MetricsEmpty';
import { MetricRow } from './MetricRow';
import { TYPE_FILTERS } from './constants';
import type { MetricType } from '../../types/evaluationsTypes';

export function MetricsTab() {
  const { allMetrics, loading, setShowCreateMetric, handleDeleteMetric } = useEvaluationsPage();

  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<MetricType | 'all'>('all');

  const filteredMetrics = useMemo(
    () =>
      allMetrics.filter((m) => {
        if (typeFilter !== 'all' && m.type !== typeFilter) return false;
        if (searchTerm) {
          const term = searchTerm.toLowerCase();
          if (!m.name.toLowerCase().includes(term) && !m.description.toLowerCase().includes(term)) {
            return false;
          }
        }
        return true;
      }),
    [allMetrics, searchTerm, typeFilter]
  );

  if (loading) return <MetricsSkeleton />;

  const isEmpty = allMetrics.length === 0;
  const hasResults = filteredMetrics.length > 0;

  return (
    <div className="space-y-4 animate-in fade-in-50 duration-300">
      <div className="flex items-center gap-3">
        <SearchBar
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Search metrics…"
          resultCount={!isEmpty ? filteredMetrics.length : undefined}
          filters={
            <Select
              value={typeFilter}
              onValueChange={(v) => setTypeFilter(v as MetricType | 'all')}
            >
              <SelectTrigger size="sm" className="w-fit min-w-28">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                {TYPE_FILTERS.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
        />

        <Button size="sm" className="shrink-0" onClick={() => setShowCreateMetric(true)}>
          <Plus className="size-4" />
          Create Metric
        </Button>
      </div>

      {!hasResults ? (
        <MetricsEmpty
          isEmpty={isEmpty}
          onCreateClick={isEmpty ? () => setShowCreateMetric(true) : undefined}
        />
      ) : (
        <ScrollArea className="max-h-[calc(100vh-280px)]">
          <div className="space-y-2 pr-2">
            {filteredMetrics.map((metric) => (
              <MetricRow key={metric.metric_id} metric={metric} onDelete={handleDeleteMetric} />
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
