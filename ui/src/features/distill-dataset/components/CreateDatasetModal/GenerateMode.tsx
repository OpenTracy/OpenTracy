import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { GeneratePhase } from '../../types';
import { GENERATE_PHASES, GENERATE_COUNT } from '../../constants';
import { AgentLog } from './AgentLog';
import { PhaseProgress } from './PhaseProgress';
import { ResultCard } from './ResultCard';
import { DatasetNameFields } from './DatasetNameFields';

interface GenerateModeProps {
  name: string;
  description: string;
  instruction: string;
  count: number;
  generatePhase: GeneratePhase;
  isProcessing: boolean;
  generateLog: string[];
  generateResult: { count: number; requested: number } | null;
  error: string | null;
  disabled: boolean;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onInstructionChange: (value: string) => void;
  onCountChange: (value: number) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}

const clampCount = (value: number) =>
  Math.max(GENERATE_COUNT.min, Math.min(GENERATE_COUNT.max, value || GENERATE_COUNT.min));

export function GenerateMode({
  name,
  description,
  instruction,
  count,
  generatePhase,
  isProcessing,
  generateLog,
  generateResult,
  error,
  disabled,
  onNameChange,
  onDescriptionChange,
  onInstructionChange,
  onCountChange,
  inputRef,
}: GenerateModeProps) {
  const phaseIndex = GENERATE_PHASES.findIndex((p) => p.id === generatePhase);

  if (generatePhase === 'idle') {
    return (
      <div className="space-y-4">
        <DatasetNameFields
          name={name}
          description={description}
          disabled={disabled}
          onNameChange={onNameChange}
          onDescriptionChange={onDescriptionChange}
          inputRef={inputRef}
          namePlaceholder="Auto-generated from instruction if empty"
        />

        <div className="space-y-1.5">
          <Label>Instruction *</Label>
          <Textarea
            rows={3}
            value={instruction}
            onChange={(e) => onInstructionChange(e.target.value)}
            placeholder="e.g. Generate Q&A pairs about Python programming, covering basics to advanced topics..."
            disabled={disabled}
          />
          <p className="text-xs text-muted-foreground">
            Describe the type of training data you want. AI will generate input/output pairs from
            scratch.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label>Number of samples</Label>
          <Input
            type="number"
            min={GENERATE_COUNT.min}
            max={GENERATE_COUNT.max}
            value={count}
            onChange={(e) => onCountChange(clampCount(Number(e.target.value)))}
            disabled={disabled}
          />
          <p className="text-xs text-muted-foreground">
            Each sample will have an input and expected output. Range: {GENERATE_COUNT.min}-
            {GENERATE_COUNT.max}.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PhaseProgress
        phases={GENERATE_PHASES}
        currentPhase={generatePhase}
        phaseIndex={phaseIndex}
        isProcessing={isProcessing}
        isDone={generatePhase === 'done'}
      />

      <AgentLog lines={generateLog} processing={isProcessing} />

      {generatePhase === 'done' && generateResult && (
        <ResultCard
          status="success"
          title="Dataset Ready"
          stats={[
            { label: 'Requested', value: generateResult.requested },
            { label: 'Generated', value: generateResult.count, highlight: true },
          ]}
        />
      )}

      {generatePhase === 'error' && (
        <ResultCard status="error" title="Generation failed" description={error ?? undefined} />
      )}
    </div>
  );
}
