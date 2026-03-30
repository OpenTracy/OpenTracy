import { Shield, Sparkles } from 'lucide-react';

import { FieldLegend, FieldSet } from '@/components/ui/field';
import type { ValidationState } from '@/features/production/types/hfModelModal.types';

import { ValidationItem } from './ValidationItem';

interface ValidationPanelProps {
  validation: ValidationState;
}

export function ValidationPanel({ validation }: ValidationPanelProps) {
  return (
    <FieldSet className="animate-in slide-in-from-top-2 duration-300">
      <FieldLegend className="flex items-center gap-2">
        <Sparkles className="size-4 text-primary" />
        Validating Model Compatibility
      </FieldLegend>

      <div className="space-y-2">
        <ValidationItem
          label="Model Access"
          status={validation.modelAccess}
          message={validation.modelAccessMessage}
          icon={
            validation.modelAccess === 'idle' ? (
              <Shield className="text-muted-foreground" />
            ) : undefined
          }
        />
        <ValidationItem
          label="Text Generation Support"
          status={validation.textGeneration}
          message={validation.textGenerationMessage}
        />
        <ValidationItem
          label="vLLM Compatibility"
          status={validation.vllm}
          message={validation.vllmMessage}
        />
      </div>
    </FieldSet>
  );
}
