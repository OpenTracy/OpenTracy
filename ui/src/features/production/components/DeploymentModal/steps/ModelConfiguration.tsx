import { HelpCircle } from 'lucide-react';

import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { ModelOptions } from '@/types/deploymentTypes';

interface ModelConfigurationProps {
  options: ModelOptions;
  onChange: (options: ModelOptions) => void;
}

const DTYPE_OPTIONS = [
  { label: 'Auto', value: 'auto' },
  { label: 'BFloat16 (Recommended)', value: 'bfloat16' },
  { label: 'Float16', value: 'float16' },
  { label: 'Float32', value: 'float32' },
] as const;

const TOOLTIPS = {
  maxTokens: 'Maximum context length. Controls how much text the model can process at once.',
  dtype: 'Data type for model weights. bfloat16 is recommended for most deployments.',
  gpuMemoryUtilization:
    'Fraction of GPU memory to use (0.0-1.0). Higher values allow larger batches.',
  maxNumSeqs: 'Maximum sequences to process in parallel. Affects throughput and memory usage.',
  blockSize: 'Token block size for memory management. Larger blocks are more efficient.',
  swapSpace: 'CPU swap space in GB. Used when GPU memory is exceeded.',
  temperature: 'Controls randomness. Lower values (0.1-0.5) for deterministic outputs.',
  topP: 'Nucleus sampling. Typical values: 0.9-1.0. Controls diversity.',
  topK: 'Use only top-k most likely tokens. Typical: 40-100.',
};

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

interface SliderFieldProps {
  label: string;
  tooltip: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  format?: (val: number) => string;
}

function SliderField({
  label,
  tooltip,
  value,
  onChange,
  min,
  max,
  step,
  format,
}: SliderFieldProps) {
  const displayValue = format ? format(value) : value;

  return (
    <div className="space-y-2">
      <LabelWithTooltip label={label} tooltip={tooltip} />
      <Slider
        value={[value]}
        onValueChange={(vals) => onChange(vals[0])}
        min={min}
        max={max}
        step={step}
        className="w-full"
      />
      <div className="text-xs text-muted-foreground text-right">{displayValue}</div>
    </div>
  );
}

export function ModelConfiguration({ options, onChange }: ModelConfigurationProps) {
  const handleChange = <K extends keyof ModelOptions>(key: K, value: ModelOptions[K]) => {
    onChange({ ...options, [key]: value });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-1">Model Configuration</h3>
        <p className="text-sm text-muted-foreground">
          Configure advanced parameters for optimal performance and resource usage.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Engine Configuration</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <SliderField
            label="Context Length"
            tooltip={TOOLTIPS.maxTokens}
            value={options.maxTokens}
            onChange={(val) => handleChange('maxTokens', val)}
            min={512}
            max={32768}
            step={512}
            format={(val) => `${val.toLocaleString()} tokens`}
          />

          <div className="space-y-2">
            <LabelWithTooltip label="Data Type" tooltip={TOOLTIPS.dtype} />
            <Select
              value={options.dtype}
              onValueChange={(val) =>
                handleChange('dtype', val as 'auto' | 'bfloat16' | 'float16' | 'float32')
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DTYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <SliderField
            label="GPU Memory"
            tooltip={TOOLTIPS.gpuMemoryUtilization}
            value={options.gpuMemoryUtilization}
            onChange={(val) => handleChange('gpuMemoryUtilization', val)}
            min={0.1}
            max={1.0}
            step={0.05}
            format={(val) => `${(val * 100).toFixed(0)}%`}
          />

          <SliderField
            label="Block Size"
            tooltip={TOOLTIPS.blockSize}
            value={options.blockSize}
            onChange={(val) => handleChange('blockSize', val)}
            min={8}
            max={32}
            step={1}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Batch & Memory</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <SliderField
            label="Max Sequences"
            tooltip={TOOLTIPS.maxNumSeqs}
            value={options.maxNumSeqs}
            onChange={(val) => handleChange('maxNumSeqs', val)}
            min={1}
            max={512}
            step={1}
            format={(val) => `${val} sequences`}
          />

          <SliderField
            label="Swap Space (GB)"
            tooltip={TOOLTIPS.swapSpace}
            value={options.swapSpace}
            onChange={(val) => handleChange('swapSpace', val)}
            min={0}
            max={16}
            step={1}
            format={(val) => `${val} GB`}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Inference Parameters</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <SliderField
            label="Temperature"
            tooltip={TOOLTIPS.temperature}
            value={options.temperature}
            onChange={(val) => handleChange('temperature', val)}
            min={0.0}
            max={2.0}
            step={0.1}
            format={(val) => val.toFixed(1)}
          />

          <SliderField
            label="Top P"
            tooltip={TOOLTIPS.topP}
            value={options.topP}
            onChange={(val) => handleChange('topP', val)}
            min={0.0}
            max={1.0}
            step={0.05}
            format={(val) => val.toFixed(2)}
          />

          <SliderField
            label="Top K"
            tooltip={TOOLTIPS.topK}
            value={options.topK}
            onChange={(val) => handleChange('topK', val)}
            min={0}
            max={100}
            step={1}
          />
        </CardContent>
      </Card>
    </div>
  );
}
