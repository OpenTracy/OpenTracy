import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

import type { DeploymentModel, DeploymentData } from '@/types/deploymentTypes';
import { useDeploymentWizard } from '@/features/production/hooks/useDeploymentWizard';
import { WizardBreadcrumb } from '@/components/shared/WizardBreadcrumb';
import { StepContent } from './StepContent';

const STEPS = [
  { title: 'Info', id: 'basic' },
  { title: 'Model', id: 'model' },
  { title: 'Instance', id: 'instance' },
  { title: 'Config', id: 'options' },
  { title: 'Scaling', id: 'scaling' },
] as const;

type StepId = (typeof STEPS)[number]['id'];

const STEP_DESCRIPTIONS: Record<StepId, string> = {
  basic: 'Configure your deployment settings',
  model: 'Select the AI model to deploy',
  instance: 'Choose the compute instance',
  options: 'Configure model options',
  scaling: 'Set up auto-scaling parameters',
};

interface DeploymentModalProps {
  isOpen: boolean;
  deploymentModels: DeploymentModel[];
  preSelectedModelId?: string;
  onClose: () => void;
  onDeploy: (data: Omit<DeploymentData, 'id' | 'createdAt' | 'status'>) => void;
}

export function DeploymentModal({
  isOpen,
  deploymentModels,
  preSelectedModelId,
  onClose,
  onDeploy,
}: DeploymentModalProps) {
  const wizard = useDeploymentWizard(deploymentModels, preSelectedModelId);

  const isLastStep = wizard.currentStep === STEPS.length - 1;
  const currentStepId = STEPS[wizard.currentStep].id as StepId;

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      wizard.reset();
      onClose();
    }
  };

  const handleFormChange = (partial: Partial<typeof wizard.formData>) => {
    wizard.setFormData({ ...wizard.formData, ...partial });
  };

  const handleDeploy = () => {
    const payload = wizard.buildPayload();
    wizard.reset();
    onClose();
    onDeploy(payload);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-6xl gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b flex-row items-start justify-between gap-4 space-y-0">
          <div className="flex-1">
            <DialogTitle>Create Deployment</DialogTitle>
            <DialogDescription className="mt-1">
              {STEP_DESCRIPTIONS[currentStepId]}
            </DialogDescription>
          </div>
          <DialogClose className="mt-0.5" />
        </DialogHeader>

        <WizardBreadcrumb
          steps={[...STEPS]}
          currentStep={wizard.currentStep}
          onStepClick={(i) => {
            if (i < wizard.currentStep) wizard.goToStep(i);
          }}
        />

        <ScrollArea className="min-h-96 max-h-[50vh]">
          <div className="px-10 pt-4">
            <StepContent
              stepId={currentStepId}
              formData={wizard.formData}
              deploymentModels={deploymentModels}
              selectedModelName={wizard.selectedModel?.name}
              availableInstances={wizard.availableInstances}
              recommendedInstanceId={wizard.selectedModel?.recommendedInstance}
              onFormChange={handleFormChange}
            />
          </div>
        </ScrollArea>

        <DialogFooter className="px-6 py-4 border-t flex-row items-center justify-between gap-3 sm:justify-between">
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>

          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={wizard.handlePrevious}
              disabled={wizard.currentStep === 0}
            >
              Previous
            </Button>
            <Button
              disabled={!wizard.canProceed}
              onClick={isLastStep ? handleDeploy : wizard.handleNext}
            >
              {isLastStep ? 'Create Deployment' : 'Next'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
