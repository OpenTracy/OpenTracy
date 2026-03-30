import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { TopicPhase } from '../../types';
import { TOPIC_PHASES } from '../../constants';
import { AgentLog } from './AgentLog';
import { PhaseProgress } from './PhaseProgress';
import { ResultCard } from './ResultCard';
import { DatasetNameFields } from './DatasetNameFields';

interface TopicModeProps {
  name: string;
  description: string;
  topic: string;
  topicPhase: TopicPhase;
  isProcessing: boolean;
  agentLog: string[];
  topicResult: { matched: number; scanned: number } | null;
  error: string | null;
  disabled: boolean;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onTopicChange: (value: string) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}

export function TopicMode({
  name,
  description,
  topic,
  topicPhase,
  isProcessing,
  agentLog,
  topicResult,
  error,
  disabled,
  onNameChange,
  onDescriptionChange,
  onTopicChange,
  inputRef,
}: TopicModeProps) {
  const phaseIndex = TOPIC_PHASES.findIndex((p) => p.id === topicPhase);

  if (topicPhase === 'idle') {
    return (
      <div className="space-y-4">
        <DatasetNameFields
          name={name}
          description={description}
          disabled={disabled}
          onNameChange={onNameChange}
          onDescriptionChange={onDescriptionChange}
          inputRef={inputRef}
          namePlaceholder="Auto-generated from topic if empty"
        />

        <div className="space-y-1.5">
          <Label>Topic or instruction *</Label>
          <Textarea
            rows={3}
            value={topic}
            onChange={(e) => onTopicChange(e.target.value)}
            placeholder="e.g. customer support conversations, Python coding questions, medical terminology..."
            disabled={disabled}
          />
          <p className="text-xs text-muted-foreground">
            We&apos;ll scan your recent traces and find the ones that match this topic.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PhaseProgress
        phases={TOPIC_PHASES}
        currentPhase={topicPhase}
        phaseIndex={phaseIndex}
        isProcessing={isProcessing}
        isDone={topicPhase === 'done'}
      />

      <AgentLog lines={agentLog} processing={isProcessing} />

      {topicPhase === 'done' && topicResult && (
        <ResultCard
          status="success"
          title="Dataset Ready"
          stats={[
            { label: 'Traces Scanned', value: topicResult.scanned },
            { label: 'Samples Added', value: topicResult.matched, highlight: true },
          ]}
        />
      )}

      {topicPhase === 'no-match' && (
        <ResultCard
          status="warning"
          title="No matches found"
          description={`Your production traces don't have conversations about "${topic}" yet. Try a different topic or wait for more traces.`}
        />
      )}

      {topicPhase === 'error' && (
        <ResultCard status="error" title="Something went wrong" description={error ?? undefined} />
      )}
    </div>
  );
}
