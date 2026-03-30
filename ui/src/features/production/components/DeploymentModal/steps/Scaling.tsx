import { HelpCircle } from 'lucide-react';

import { Label } from '@/components/ui/label';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupTextarea,
} from '@/components/ui/input-group';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { AutoscalingConfig } from '@/types/deploymentTypes';

interface ScalingProps {
  config: AutoscalingConfig;
  onChange: (config: AutoscalingConfig) => void;
}

interface LabelWithTooltipProps {
  label: string;
  tooltip: string;
}

function LabelWithTooltip({ label, tooltip }: LabelWithTooltipProps) {
  return (
    <div className="flex items-center gap-1">
      <Label className="text-sm font-medium">{label}</Label>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <HelpCircle className="w-4 h-4 text-muted-foreground shrink-0 hover:text-foreground transition-colors" />
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={4} className="max-w-xs">
            {tooltip}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

export function Scaling({ config, onChange }: ScalingProps) {
  const handleChange = <K extends keyof AutoscalingConfig>(key: K, value: AutoscalingConfig[K]) => {
    onChange({ ...config, [key]: value });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-2">Scaling Configuration</h3>
        <p className="text-sm text-muted-foreground">
          Auto-scaling is always enabled. Set the maximum number of replicas.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <LabelWithTooltip
            label="Maximum Replicas"
            tooltip="Deployment will scale between 1 and this maximum based on demand."
          />
          <InputGroup>
            <InputGroupInput
              type="number"
              value={config.maxReplicas}
              onChange={(e) =>
                handleChange('maxReplicas', Math.max(1, parseInt(e.target.value) || 1))
              }
              min={1}
              max={50}
              placeholder="1"
            />
            <InputGroupAddon align="inline-end">
              <span className="text-xs text-muted-foreground">replicas</span>
            </InputGroupAddon>
          </InputGroup>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">Version Comment (optional)</Label>
          <InputGroup>
            <InputGroupTextarea
              placeholder="Describe the purpose of this deployment or notes..."
              value={config.versionComment}
              onChange={(e) => handleChange('versionComment', e.target.value)}
              rows={4}
              maxLength={280}
            />
            <InputGroupAddon align="block-end">
              <span className="text-xs text-muted-foreground">
                {config.versionComment.length}/280
              </span>
            </InputGroupAddon>
          </InputGroup>
        </div>
      </div>
    </div>
  );
}
