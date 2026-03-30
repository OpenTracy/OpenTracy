import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type { DatasetSample } from '../../types';

interface ManualModeProps {
  samples: Partial<DatasetSample>[];
  disabled: boolean;
  onAddSample: () => void;
  onRemoveSample: (index: number) => void;
  onUpdateSample: (index: number, field: 'input' | 'expected_output', value: string) => void;
}

export function ManualMode({
  samples,
  disabled,
  onAddSample,
  onRemoveSample,
  onUpdateSample,
}: ManualModeProps) {
  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Label className="text-sm font-medium">Samples</Label>
          <Badge
            variant="secondary"
            className="h-5 min-w-5 justify-center rounded-full px-1.5 text-[10px] tabular-nums font-medium"
          >
            {samples.length}
          </Badge>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onAddSample}
          disabled={disabled}
          className="h-7 gap-1 text-xs"
        >
          <Plus className="size-3" />
          Add
        </Button>
      </div>

      {/* Scrollable sample list — capped so footer stays visible */}
      {samples.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-6 text-center">
          <p className="text-xs text-muted-foreground">No samples yet</p>
          <Button
            variant="outline"
            size="sm"
            onClick={onAddSample}
            disabled={disabled}
            className="h-7 gap-1 text-xs"
          >
            <Plus className="size-3" />
            Add first sample
          </Button>
        </div>
      ) : (
        <ScrollArea className="max-h-64">
          <div className="space-y-0 pr-3">
            {samples.map((sample, index) => (
              <div key={index}>
                {index > 0 && <Separator />}
                <div className="group relative rounded-md px-1 py-2 transition-colors hover:bg-muted/50">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-[11px] font-medium tabular-nums text-muted-foreground">
                      #{index + 1}
                    </span>
                    {samples.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                          'size-5 shrink-0 text-muted-foreground/50',
                          'opacity-0 transition-opacity group-hover:opacity-100',
                          'hover:text-destructive hover:bg-destructive/10'
                        )}
                        onClick={() => onRemoveSample(index)}
                        disabled={disabled}
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    )}
                  </div>
                  <div className="grid gap-1.5">
                    <Textarea
                      rows={2}
                      value={sample.input ?? ''}
                      onChange={(e) => onUpdateSample(index, 'input', e.target.value)}
                      placeholder="Input *"
                      disabled={disabled}
                      className="min-h-11 resize-y text-xs leading-relaxed"
                    />
                    <Textarea
                      rows={2}
                      value={sample.expected_output ?? ''}
                      onChange={(e) => onUpdateSample(index, 'expected_output', e.target.value)}
                      placeholder="Expected output (optional)"
                      disabled={disabled}
                      className="min-h-11 resize-y text-xs leading-relaxed"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
