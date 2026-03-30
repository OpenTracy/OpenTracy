import { CheckCircle2, Upload, Settings, Sparkles, Cpu } from 'lucide-react';
import type { FineTuningJob } from '../../../types/fineTuningTypes';
import { getProviderIcon } from '../../../utils/modelUtils';

interface ReviewStepProps {
  jobData: Partial<FineTuningJob>;
}

export const ReviewStep = ({ jobData }: ReviewStepProps) => {
  const { name, baseModel, dataset, trainingConfig, loraConfig } = jobData;

  return (
    <div className="space-y-6">
      <div className="text-center pb-4 border-b border-border">
        <h3 className="text-lg font-semibold text-foreground">Review Configuration</h3>
        <p className="text-sm text-foreground-muted mt-1">
          Verify all settings before launching your fine-tuning job
        </p>
      </div>

      {/* Job Name */}
      <div className="bg-surface border border-border rounded-lg p-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 bg-accent/10 rounded-lg flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5 text-accent" />
          </div>
          <h4 className="font-semibold text-foreground">{name || 'Untitled Job'}</h4>
        </div>
      </div>

      {/* Base Model */}
      <div className="bg-surface border border-border rounded-lg p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 bg-accent/10 rounded-lg flex items-center justify-center">
            <Cpu className="w-5 h-5 text-foreground-secondary" />
          </div>
          <h5 className="text-sm font-semibold text-foreground">Base Model</h5>
        </div>
        <div className="flex items-center gap-2 pl-11">
          {baseModel && getProviderIcon(baseModel, 'w-4 h-4')}
          <span className="text-sm text-foreground-secondary font-mono">
            {baseModel || 'Not selected'}
          </span>
        </div>
      </div>

      {/* Dataset */}
      <div className="bg-surface border border-border rounded-lg p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 bg-success/10 rounded-lg flex items-center justify-center">
            <Upload className="w-5 h-5 text-success" />
          </div>
          <h5 className="text-sm font-semibold text-foreground">Training Dataset</h5>
        </div>
        <div className="pl-11">
          <p className="text-sm text-foreground-secondary">{dataset?.name || 'Not uploaded'}</p>
          <p className="text-xs text-foreground-muted mt-1">
            {dataset?.type === 'upload' ? 'Local file' : 'Remote URL'}
          </p>
        </div>
      </div>

      {/* Training Configuration */}
      <div className="bg-surface border border-border rounded-lg p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 bg-warning/10 rounded-lg flex items-center justify-center">
            <Settings className="w-5 h-5 text-warning" />
          </div>
          <h5 className="text-sm font-semibold text-foreground">Training Parameters</h5>
        </div>
        {trainingConfig ? (
          <div className="pl-11 space-y-3">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-foreground-muted">Learning Rate</p>
                <p className="text-sm font-mono text-foreground">{trainingConfig.learningRate}</p>
              </div>
              <div>
                <p className="text-xs text-foreground-muted">Epochs</p>
                <p className="text-sm font-mono text-foreground">{trainingConfig.numEpochs}</p>
              </div>
              <div>
                <p className="text-xs text-foreground-muted">Batch Size</p>
                <p className="text-sm font-mono text-foreground">
                  {trainingConfig.perDeviceTrainBatchSize}
                </p>
              </div>
              <div>
                <p className="text-xs text-foreground-muted">Grad Accum Steps</p>
                <p className="text-sm font-mono text-foreground">
                  {trainingConfig.gradientAccumulationSteps}
                </p>
              </div>
              <div>
                <p className="text-xs text-foreground-muted">Max Seq Length</p>
                <p className="text-sm font-mono text-foreground">{trainingConfig.maxSeqLength}</p>
              </div>
              <div>
                <p className="text-xs text-foreground-muted">Optimizer</p>
                <p className="text-sm font-mono text-foreground">{trainingConfig.optimizer}</p>
              </div>
            </div>

            <div className="pt-3 border-t border-border">
              <div className="flex gap-4 text-xs">
                <span
                  className={`px-2 py-1 rounded ${trainingConfig.bf16 ? 'bg-accent/10 text-accent' : 'bg-background-secondary text-foreground-muted'}`}
                >
                  {trainingConfig.bf16 ? 'BF16' : 'FP16'}
                </span>
                {trainingConfig.useGradientCheckpointing && (
                  <span className="px-2 py-1 rounded bg-surface-hover text-foreground-secondary">
                    Gradient Checkpointing
                  </span>
                )}
                {trainingConfig.packing && (
                  <span className="px-2 py-1 rounded bg-accent/10 text-accent">Packing</span>
                )}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-foreground-muted pl-11">Using default configuration</p>
        )}
      </div>

      {/* LoRA Configuration */}
      {loraConfig && (
        <div className="bg-accent/10 border border-accent/20 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-accent/10 rounded-lg flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-accent" />
            </div>
            <h5 className="text-sm font-semibold text-foreground">LoRA Configuration</h5>
          </div>
          <div className="pl-11 grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-foreground-secondary">Rank</p>
              <p className="text-sm font-mono text-foreground">{loraConfig.rank}</p>
            </div>
            <div>
              <p className="text-xs text-foreground-secondary">Alpha</p>
              <p className="text-sm font-mono text-foreground">{loraConfig.alpha}</p>
            </div>
            <div>
              <p className="text-xs text-foreground-secondary">Dropout</p>
              <p className="text-sm font-mono text-foreground">{loraConfig.dropout}</p>
            </div>
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-background-secondary border border-border rounded-lg p-4">
        <h4 className="text-sm font-medium text-foreground mb-2">What happens next?</h4>
        <ul className="text-sm text-foreground-secondary space-y-1.5">
          <li className="flex items-start gap-2">
            <span className="text-accent mt-0.5">•</span>
            <span>Dataset will be validated and preprocessed</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-accent mt-0.5">•</span>
            <span>Training will start on GPU instances</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-accent mt-0.5">•</span>
            <span>Progress updates will be available in real-time</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-accent mt-0.5">•</span>
            <span>Fine-tuned model will be ready for deployment</span>
          </li>
        </ul>
      </div>
    </div>
  );
};
