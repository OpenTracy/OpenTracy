import { useState, useEffect } from 'react';
import { useMetrics } from '../contexts/MetricsContext';
import type { TraceItem } from '../types/analyticsType';

export function useTraceDetails(traceId: string | undefined) {
  const { findTraceById } = useMetrics();
  const [trace, setTrace] = useState<TraceItem | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!traceId) {
      setTrace(null);
      return;
    }

    setLoading(true);

    const timer = setTimeout(() => {
      const foundTrace = findTraceById(traceId);
      setTrace(foundTrace);
      setLoading(false);
    }, 100);

    return () => clearTimeout(timer);
  }, [traceId, findTraceById]);

  return { trace, loading };
}
