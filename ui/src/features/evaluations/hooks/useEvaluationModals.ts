import { useState, useCallback } from 'react';
import { toast } from 'sonner';

import type {
  Evaluation,
  EvaluationMetric,
  EvaluationResults,
  EvalPrefillConfig,
  CreateEvaluationRequest,
  CreateCustomMetricRequest,
} from '../types';

interface EvaluationActions {
  createEvaluation: (request: CreateEvaluationRequest) => Promise<Evaluation | null>;
  deleteEvaluation: (id: string) => Promise<boolean>;
  cancelEvaluation: (id: string) => Promise<boolean>;
  getEvaluationResults: (
    id: string
  ) => Promise<{ results: EvaluationResults; samples_total?: number } | null>;
  createCustomMetric: (request: CreateCustomMetricRequest) => Promise<EvaluationMetric | null>;
  deleteCustomMetric: (id: string) => Promise<boolean>;
}

export function useEvaluationModals({
  createEvaluation,
  deleteEvaluation,
  cancelEvaluation,
  getEvaluationResults,
  createCustomMetric,
  deleteCustomMetric,
}: EvaluationActions) {
  const [showCreateMetric, setShowCreateMetric] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState<EvaluationMetric | null>(null);
  const [showRunEvaluation, setShowRunEvaluation] = useState(false);
  const [prefillConfig, setPrefillConfig] = useState<EvalPrefillConfig | null>(null);
  const [selectedEvaluation, setSelectedEvaluation] = useState<Evaluation | null>(null);
  const [cancellingEvaluation, setCancellingEvaluation] = useState<Evaluation | null>(null);
  const [runEvalLoading, setRunEvalLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);

  const handleCreateMetric = useCallback(
    async (request: CreateCustomMetricRequest) => {
      const metric = await createCustomMetric(request);
      if (metric) {
        toast.success(`Created metric "${metric.name}"`);
        setShowCreateMetric(false);
      }
    },
    [createCustomMetric]
  );

  const handleDeleteMetric = useCallback(
    async (id: string) => {
      const success = await deleteCustomMetric(id);
      if (success) toast.success('Metric deleted');
      else toast.error('Failed to delete metric');
    },
    [deleteCustomMetric]
  );

  const handleRunEvaluation = useCallback(
    async (request: CreateEvaluationRequest) => {
      setRunEvalLoading(true);
      try {
        const evaluation = await createEvaluation(request);
        if (evaluation) {
          toast.success(`Started evaluation "${evaluation.name}"`);
          setShowRunEvaluation(false);
          setPrefillConfig(null);
        }
      } finally {
        setRunEvalLoading(false);
      }
    },
    [createEvaluation]
  );

  const handleOpenRunEvaluation = useCallback((prefill?: EvalPrefillConfig) => {
    setPrefillConfig(prefill ?? null);
    setShowRunEvaluation(true);
  }, []);

  const handleCloseRunEvaluation = useCallback(() => {
    setShowRunEvaluation(false);
    setPrefillConfig(null);
  }, []);

  const handleViewResults = useCallback(
    async (evaluation: Evaluation) => {
      // Failed evaluations have no results — show directly for error details
      if (evaluation.status === 'failed') {
        setSelectedEvaluation(evaluation);
        return;
      }
      if (evaluation.results) {
        setSelectedEvaluation(evaluation);
        return;
      }
      const data = await getEvaluationResults(evaluation.id);
      if (data) {
        setSelectedEvaluation({ ...evaluation, results: data.results });
      } else {
        toast.error('Failed to load evaluation results');
      }
    },
    [getEvaluationResults]
  );

  const handleCancelEvaluation = useCallback(async () => {
    if (!cancellingEvaluation) return;
    setCancelLoading(true);
    try {
      const success = await cancelEvaluation(cancellingEvaluation.id);
      if (success) toast.success('Evaluation cancelled');
      else toast.error('Failed to cancel evaluation');
    } finally {
      setCancelLoading(false);
      setCancellingEvaluation(null);
    }
  }, [cancellingEvaluation, cancelEvaluation]);

  const handleDeleteEvaluation = useCallback(
    async (evaluation: Evaluation) => {
      const success = await deleteEvaluation(evaluation.id);
      if (success) toast.success('Evaluation deleted');
      else toast.error('Failed to delete evaluation');
    },
    [deleteEvaluation]
  );

  return {
    showCreateMetric,
    setShowCreateMetric,
    selectedMetric,
    setSelectedMetric,
    showRunEvaluation,
    prefillConfig,
    selectedEvaluation,
    setSelectedEvaluation,
    cancellingEvaluation,
    setCancellingEvaluation,
    runEvalLoading,
    cancelLoading,
    handleCreateMetric,
    handleDeleteMetric,
    handleRunEvaluation,
    handleOpenRunEvaluation,
    handleCloseRunEvaluation,
    handleViewResults,
    handleCancelEvaluation,
    handleDeleteEvaluation,
  };
}
