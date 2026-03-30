import { Check } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FieldLegend, FieldSet } from '@/components/ui/field';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type { EvaluationMetric } from '../../../types';

interface MetricsStepProps {
  builtin: EvaluationMetric[];
  custom: EvaluationMetric[];
  selectedMetrics: string[];
  onToggle: (metricId: string) => void;
}

export function MetricsStep({ builtin, custom, selectedMetrics, onToggle }: MetricsStepProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-1">Select Metrics</h3>
        <p className="text-sm text-muted-foreground">
          Choose which metrics to use for scoring model responses.{' '}
          {selectedMetrics.length > 0 && (
            <Badge variant="secondary" className="ml-1">
              {selectedMetrics.length} selected
            </Badge>
          )}
        </p>
      </div>

      {builtin.length > 0 && (
        <FieldSet>
          <FieldLegend variant="label">Built-in</FieldLegend>
          <div className="flex flex-wrap gap-2">
            {builtin.map((metric) => (
              <MetricToggle
                key={metric.metric_id}
                metric={metric}
                isSelected={selectedMetrics.includes(metric.metric_id)}
                onToggle={onToggle}
              />
            ))}
          </div>
        </FieldSet>
      )}

      {builtin.length > 0 && custom.length > 0 && <Separator />}

      {custom.length > 0 && (
        <FieldSet>
          <FieldLegend variant="label">Custom</FieldLegend>
          <div className="flex flex-wrap gap-2">
            {custom.map((metric) => (
              <MetricToggle
                key={metric.metric_id}
                metric={metric}
                isSelected={selectedMetrics.includes(metric.metric_id)}
                onToggle={onToggle}
              />
            ))}
          </div>
        </FieldSet>
      )}
    </div>
  );
}

interface MetricToggleProps {
  metric: EvaluationMetric;
  isSelected: boolean;
  onToggle: (metricId: string) => void;
}

function MetricToggle({ metric, isSelected, onToggle }: MetricToggleProps) {
  return (
    <Button
      type="button"
      variant={isSelected ? 'default' : 'outline'}
      size="sm"
      onClick={() => onToggle(metric.metric_id)}
      className={cn('transition-all', isSelected && 'shadow-sm')}
    >
      {isSelected && <Check className="size-3.5" />}
      {metric.name}
    </Button>
  );
}
