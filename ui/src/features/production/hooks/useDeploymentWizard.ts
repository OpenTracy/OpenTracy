import { useState, useCallback, useEffect } from 'react';
import type {
  DeploymentData,
  DeploymentModel,
  ModelOptions,
  AutoscalingConfig,
} from '@/types/deploymentTypes';
import { INSTANCE_TYPES } from '@/features/production/constants/instanceTypes';

const DEPLOYMENT_DEFAULTS = {
  modelOptions: {
    maxTokens: 4096,
    dtype: 'bfloat16' as const,
    gpuMemoryUtilization: 0.92,
    maxNumSeqs: 256,
    blockSize: 16,
    swapSpace: 4,
    temperature: 0.7,
    topP: 0.9,
    topK: 50,
  },
  autoscalingConfig: {
    enabled: true,
    maxReplicas: 1,
    versionComment: '',
  },
};

interface DeploymentFormData {
  name: string;
  selectedModel: string;
  selectedInstance: string;
  modelOptions: ModelOptions;
  autoscalingConfig: AutoscalingConfig;
}

export function useDeploymentWizard(models: DeploymentModel[], preSelectedModelId?: string) {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<DeploymentFormData>({
    name: '',
    selectedModel: preSelectedModelId || '',
    selectedInstance: 'ml.g5.2xlarge',
    modelOptions: DEPLOYMENT_DEFAULTS.modelOptions,
    autoscalingConfig: DEPLOYMENT_DEFAULTS.autoscalingConfig,
  });

  // Initialize or reset form
  useEffect(() => {
    if (preSelectedModelId) {
      const model = models.find((m) => m.id === preSelectedModelId);
      const instances = model?.availableInstances || INSTANCE_TYPES.map((i) => i.id);
      const defaultInstance =
        model?.recommendedInstance && instances.includes(model.recommendedInstance)
          ? model.recommendedInstance
          : instances[Math.floor(instances.length / 2)] || instances[0] || 'ml.g5.2xlarge';

      setFormData((prev) => ({
        ...prev,
        selectedModel: preSelectedModelId,
        selectedInstance: defaultInstance,
      }));
    }
  }, [preSelectedModelId, models]);

  // Auto-update instance when model changes
  useEffect(() => {
    if (!formData.selectedModel) return;

    const model = models.find((m) => m.id === formData.selectedModel);
    const availableInstances = model?.availableInstances || INSTANCE_TYPES.map((i) => i.id);
    const newInstance =
      model?.recommendedInstance && availableInstances.includes(model.recommendedInstance)
        ? model.recommendedInstance
        : availableInstances[Math.floor(availableInstances.length / 2)] || availableInstances[0];

    if (newInstance) {
      setFormData((prev) => ({
        ...prev,
        selectedInstance: newInstance,
      }));
    }
  }, [formData.selectedModel, models]);

  const getAvailableInstances = useCallback((): string[] => {
    if (!formData.selectedModel) return INSTANCE_TYPES.map((i) => i.id);

    const model = models.find((m) => m.id === formData.selectedModel);
    return model?.availableInstances || INSTANCE_TYPES.map((i) => i.id);
  }, [formData.selectedModel, models]);

  const isStepValid = useCallback(
    (stepIndex: number): boolean => {
      switch (stepIndex) {
        case 0:
          return true;
        case 1:
          return !!formData.selectedModel;
        case 2:
          return !!formData.selectedInstance;
        default:
          return true;
      }
    },
    [formData.selectedModel, formData.selectedInstance]
  );

  const handleNext = useCallback(() => {
    const steps = ['basic', 'model', 'instance', 'options', 'scaling'];
    if (currentStep < steps.length - 1 && isStepValid(currentStep)) {
      setCurrentStep((prev) => prev + 1);
    }
  }, [currentStep, isStepValid]);

  const handlePrevious = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  }, [currentStep]);

  const goToStep = useCallback((stepIndex: number) => {
    if (stepIndex >= 0 && stepIndex <= 4) {
      setCurrentStep(stepIndex);
    }
  }, []);

  const buildPayload = useCallback((): Omit<DeploymentData, 'id' | 'createdAt' | 'status'> => {
    const deploymentName =
      formData.name || models.find((m) => m.id === formData.selectedModel)?.name || 'Deployment';

    return {
      name: deploymentName,
      selectedModel: formData.selectedModel,
      selectedInstance: formData.selectedInstance,
      modelOptions: formData.modelOptions,
      autoscalingConfig: formData.autoscalingConfig,
    };
  }, [formData, models]);

  const reset = useCallback(() => {
    setCurrentStep(0);
    setFormData({
      name: '',
      selectedModel: preSelectedModelId || '',
      selectedInstance: 'ml.g5.2xlarge',
      modelOptions: DEPLOYMENT_DEFAULTS.modelOptions,
      autoscalingConfig: DEPLOYMENT_DEFAULTS.autoscalingConfig,
    });
  }, [preSelectedModelId]);

  return {
    // State
    currentStep,
    formData,

    // Computed
    canProceed: isStepValid(currentStep),
    availableInstances: getAvailableInstances(),
    selectedModel: models.find((m) => m.id === formData.selectedModel),

    // Actions
    setCurrentStep,
    setFormData,
    handleNext,
    handlePrevious,
    goToStep,
    buildPayload,
    reset,
  };
}
