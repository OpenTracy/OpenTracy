import type { DeploymentModel, DeploymentData } from '@/types/deploymentTypes';
import { BasicInfo } from './steps/BasicInfo';
import { ModelSelection } from './steps/ModelSelection';
import { InstanceSelection } from './steps/InstanceSelection';
import { ModelConfiguration } from './steps/ModelConfiguration';
import { Scaling } from './steps/Scaling';

type FormData = Omit<DeploymentData, 'id' | 'createdAt' | 'status'>;
type StepId = 'basic' | 'model' | 'instance' | 'options' | 'scaling';

interface StepContentProps {
  stepId: StepId;
  formData: FormData;
  deploymentModels: DeploymentModel[];
  selectedModelName: string | undefined;
  availableInstances: string[];
  recommendedInstanceId: string | undefined;
  onFormChange: (partial: Partial<FormData>) => void;
}

export function StepContent({
  stepId,
  formData,
  deploymentModels,
  selectedModelName,
  availableInstances,
  recommendedInstanceId,
  onFormChange,
}: StepContentProps) {
  switch (stepId) {
    case 'basic':
      return <BasicInfo selectedModelName={selectedModelName} />;

    case 'model':
      return (
        <ModelSelection
          selectedModelId={formData.selectedModel}
          models={deploymentModels}
          onModelChange={(id) => onFormChange({ selectedModel: id })}
        />
      );

    case 'instance':
      return (
        <InstanceSelection
          selectedInstanceId={formData.selectedInstance}
          availableInstanceIds={availableInstances}
          recommendedInstanceId={recommendedInstanceId}
          onInstanceChange={(id) => onFormChange({ selectedInstance: id })}
        />
      );

    case 'options':
      return (
        <ModelConfiguration
          options={formData.modelOptions}
          onChange={(opts: typeof formData.modelOptions) => onFormChange({ modelOptions: opts })}
        />
      );

    case 'scaling':
      return (
        <Scaling
          config={formData.autoscalingConfig}
          onChange={(autoscalingConfig: typeof formData.autoscalingConfig) =>
            onFormChange({ autoscalingConfig })
          }
        />
      );
  }
}
