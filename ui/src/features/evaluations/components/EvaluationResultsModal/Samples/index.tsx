import { useState, useCallback, useMemo } from 'react';
import type { SampleResult, EvaluationMetric } from '../../../types';
import { formatModelName } from '../utils';
import { SamplesHeader, type SamplesColumn } from '../../shared/SamplesHeader';
import { SampleRow } from './SampleRow';

interface SamplesProps {
  samples: SampleResult[];
  modelIds: string[];
  metricIds: string[];
  metrics: EvaluationMetric[];
}

export function Samples({ samples, modelIds, metricIds, metrics }: SamplesProps) {
  const [expandedSample, setExpandedSample] = useState<string | null>(null);

  const handleToggle = useCallback((sampleId: string) => {
    setExpandedSample((prev) => (prev === sampleId ? null : sampleId));
  }, []);

  const columns: SamplesColumn[] = useMemo(
    () => modelIds.map((id) => ({ id, label: formatModelName(id) })),
    [modelIds]
  );

  if (!samples.length) {
    return (
      <p className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
        No samples available.
      </p>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <SamplesHeader columns={columns} />

      <div role="list" className="divide-y">
        {samples.map((sample, idx) => (
          <SampleRow
            key={sample.sample_id}
            sample={sample}
            index={idx}
            modelIds={modelIds}
            metricIds={metricIds}
            metrics={metrics}
            isOpen={expandedSample === sample.sample_id}
            onToggle={() => handleToggle(sample.sample_id)}
          />
        ))}
      </div>
    </div>
  );
}
