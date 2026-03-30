import { useState, useEffect, useCallback } from 'react';

import type {
  CreateEvaluationRequest,
  EvaluationMetric,
  Dataset,
  AvailableModel,
  EvalPrefillConfig,
} from '../types';

const TOTAL_STEPS = 3;

export interface RunEvaluationFormData {
  name: string;
  datasetId: string;
  models: string[];
  metrics: string[];
}

interface UseRunEvaluationWizardOptions {
  datasets: Dataset[];
  availableModels: AvailableModel[];
  allMetrics: EvaluationMetric[];
  prefill?: EvalPrefillConfig | null;
  isOpen: boolean;
}

export function useRunEvaluationWizard({
  datasets,
  availableModels,
  allMetrics,
  prefill,
  isOpen,
}: UseRunEvaluationWizardOptions) {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<RunEvaluationFormData>({
    name: '',
    datasetId: '',
    models: [],
    metrics: [],
  });

  const models = availableModels.filter((m) => m.available);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0);
      setFormData({
        name: prefill?.name || `Evaluation ${new Date().toLocaleDateString()}`,
        datasetId: prefill?.datasetId || datasets[0]?.id || '',
        models: prefill?.models?.filter((id) => models.some((m) => m.id === id)) || [],
        metrics: prefill?.metrics?.filter((id) => allMetrics.some((m) => m.metric_id === id)) || [],
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, prefill]);

  const updateFormData = useCallback((partial: Partial<RunEvaluationFormData>) => {
    setFormData((prev) => ({ ...prev, ...partial }));
  }, []);

  const isStepValid = useCallback(
    (step: number): boolean => {
      switch (step) {
        case 0:
          return !!formData.name.trim() && !!formData.datasetId;
        case 1:
          return formData.models.length > 0;
        case 2:
          return formData.metrics.length > 0;
        default:
          return false;
      }
    },
    [formData]
  );

  const canProceed = isStepValid(currentStep);
  const isLastStep = currentStep === TOTAL_STEPS - 1;

  const handleNext = useCallback(() => {
    if (canProceed && currentStep < TOTAL_STEPS - 1) {
      setCurrentStep((s) => s + 1);
    }
  }, [canProceed, currentStep]);

  const handlePrevious = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1);
    }
  }, [currentStep]);

  const goToStep = useCallback(
    (step: number) => {
      if (step < currentStep) {
        setCurrentStep(step);
      }
    },
    [currentStep]
  );

  const buildPayload = useCallback((): CreateEvaluationRequest => {
    return {
      name: formData.name.trim(),
      dataset_id: formData.datasetId,
      models: formData.models,
      metrics: formData.metrics,
    };
  }, [formData]);

  return {
    currentStep,
    formData,
    models,
    canProceed,
    isLastStep,
    updateFormData,
    handleNext,
    handlePrevious,
    goToStep,
    buildPayload,
  };
}
