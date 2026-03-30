import type { DeploymentData } from '@/types/deploymentTypes';

export interface SpecModalProps {
  deployment: DeploymentData;
  modelId?: string;
  isOpen: boolean;
  onClose: () => void;
}

export interface SectionProps {
  apiModelId: string;
}
