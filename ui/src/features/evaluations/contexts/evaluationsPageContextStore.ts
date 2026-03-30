import { createContext, useMemo, useState } from 'react';

import { useEvaluations } from '../hooks/useEvaluations';
import { useMetrics } from '../hooks/useMetrics';
import { useAvailableModels } from '../hooks/useAvailableModels';
import { useEvaluationModals } from '../hooks/useEvaluationModals';
import { useDatasets } from '../../../hooks/useDatasets';
import { useTraceIssues } from '../hooks/useTraceIssues';
import type { TabId, EvaluationMetric } from '../types';

export function useEvaluationsPageValue() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  const {
    evaluations,
    loading,
    createEvaluation,
    deleteEvaluation,
    cancelEvaluation,
    getEvaluationResults,
  } = useEvaluations();

  const { metrics, createCustomMetric, deleteCustomMetric } = useMetrics();
  const { models: availableModels } = useAvailableModels();

  const { datasets } = useDatasets();
  const { issues: traceIssues } = useTraceIssues();

  const modals = useEvaluationModals({
    createEvaluation,
    deleteEvaluation,
    cancelEvaluation,
    getEvaluationResults,
    createCustomMetric,
    deleteCustomMetric,
  });

  const allMetrics = useMemo<EvaluationMetric[]>(
    () => [...metrics.builtin, ...metrics.custom],
    [metrics.builtin, metrics.custom]
  );

  return {
    activeTab,
    setActiveTab,
    evaluations,
    metrics,
    availableModels,
    loading,
    allMetrics,
    datasets,
    traceIssues,
    ...modals,
  };
}

type EvaluationsPageContextValue = ReturnType<typeof useEvaluationsPageValue>;

export const EvaluationsPageContext = createContext<EvaluationsPageContextValue | null>(null);
