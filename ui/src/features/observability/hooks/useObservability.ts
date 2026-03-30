import { useState, useCallback } from 'react';

import { useDashboardMetrics } from '@/hooks/useDashboardMetrics';
import type { TabId } from '../types';

export function useObservability() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const metrics = useDashboardMetrics();

  const handleTimeRangeChange = useCallback(
    (days: number) => {
      metrics.updateDateRange(days);
    },
    [metrics]
  );

  return {
    activeTab,
    setActiveTab,
    metrics,
    handleTimeRangeChange,
  };
}
