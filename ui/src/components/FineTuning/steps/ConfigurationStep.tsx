import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { FineTuningJob } from '../../../types/fineTuningTypes';

interface ConfigurationStepProps {
  jobData: Partial<FineTuningJob>;
  onUpdate: (updates: Partial<FineTuningJob>) => void;
}

export const ConfigurationStep = ({ jobData, onUpdate }: ConfigurationStepProps) => {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [useLoRA, setUseLoRA] = useState(!!jobData.loraConfig);

  const trainingConfig = jobData.trainingConfig || {
    learningRate: 0.0002,
    numEpochs: 1,
    perDeviceTrainBatchSize: 2,
    gradientAccumulationSteps: 4,
    warmupSteps: 5,
    maxGradNorm: 0.3,
    weightDecay: 0.01,
    optimizer: 'adamw_8bit' as const,
    lrSchedulerType: 'linear' as const,
    maxSeqLength: 2048,
    seed: 3407,
    loggingSteps: 1,
    fp16: false,
    bf16: true,
    packing: false,
    useGradientCheckpointing: true,
  };

  const loraConfig = jobData.loraConfig || {
    rank: 16,
    alpha: 16,
    dropout: 0,
    targetModules: ['q_proj', 'k_proj', 'v_proj', 'o_proj', 'gate_proj', 'up_proj', 'down_proj'],
  };

  const updateTrainingConfig = (updates: Partial<typeof trainingConfig>) => {
    onUpdate({
      trainingConfig: { ...trainingConfig, ...updates },
    });
  };

  const updateLoRAConfig = (updates: Partial<typeof loraConfig>) => {
    onUpdate({
      loraConfig: { ...loraConfig, ...updates },
    });
  };

  const toggleLoRA = (enabled: boolean) => {
    setUseLoRA(enabled);
    if (enabled) {
      onUpdate({ loraConfig });
    } else {
      onUpdate({ loraConfig: undefined });
    }
  };

  return (
    <div className="space-y-6">
      {/* LoRA Toggle */}
      <div className="flex items-center justify-between p-4 bg-background-secondary border border-border rounded-lg">
        <div>
          <h3 className="text-sm font-medium text-foreground">Use LoRA (Recommended)</h3>
          <p className="text-xs text-foreground-muted mt-1">
            Parameter-efficient fine-tuning for faster training
          </p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={useLoRA}
            onChange={(e) => toggleLoRA(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-border peer-focus-visible:outline-none peer-focus-visible:ring-4 peer-focus-visible:ring-accent/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-surface after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-foreground after:border-surface after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent"></div>
        </label>
      </div>

      {/* Core Training Parameters */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2">
          Training Parameters
        </h3>

        <div className="grid grid-cols-2 gap-6">
          {/* Learning Rate */}
          <div>
            <label className="block text-sm font-medium text-foreground-secondary mb-2">
              Learning Rate
            </label>
            <input
              type="number"
              step="0.00001"
              value={trainingConfig.learningRate}
              onChange={(e) => updateTrainingConfig({ learningRate: parseFloat(e.target.value) })}
              className="w-full px-3 py-2 border border-border rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent text-sm bg-surface text-foreground placeholder-foreground-muted hover:border-border-hover"
            />
            <p className="text-xs text-foreground-muted mt-1">Default: 2e-4</p>
          </div>

          {/* Number of Epochs */}
          <div>
            <label className="block text-sm font-medium text-foreground-secondary mb-2">
              Number of Epochs
            </label>
            <input
              type="number"
              min="1"
              max="10"
              value={trainingConfig.numEpochs}
              onChange={(e) => updateTrainingConfig({ numEpochs: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-border rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent text-sm bg-surface text-foreground placeholder-foreground-muted hover:border-border-hover"
            />
            <p className="text-xs text-foreground-muted mt-1">Full passes through data</p>
          </div>

          {/* Batch Size */}
          <div>
            <label className="block text-sm font-medium text-foreground-secondary mb-2">
              Batch Size (per device)
            </label>
            <input
              type="number"
              min="1"
              max="32"
              value={trainingConfig.perDeviceTrainBatchSize}
              onChange={(e) =>
                updateTrainingConfig({
                  perDeviceTrainBatchSize: parseInt(e.target.value),
                })
              }
              className="w-full px-3 py-2 border border-border rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent text-sm bg-surface text-foreground placeholder-foreground-muted hover:border-border-hover"
            />
            <p className="text-xs text-foreground-muted mt-1">Samples per GPU</p>
          </div>

          {/* Gradient Accumulation Steps */}
          <div>
            <label className="block text-sm font-medium text-foreground-secondary mb-2">
              Gradient Accumulation Steps
            </label>
            <input
              type="number"
              min="1"
              max="32"
              value={trainingConfig.gradientAccumulationSteps}
              onChange={(e) =>
                updateTrainingConfig({
                  gradientAccumulationSteps: parseInt(e.target.value),
                })
              }
              className="w-full px-3 py-2 border border-border rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent text-sm bg-surface text-foreground placeholder-foreground-muted hover:border-border-hover"
            />
            <p className="text-xs text-foreground-muted mt-1">Effective batch = batch × this</p>
          </div>

          {/* Warmup Steps */}
          <div>
            <label className="block text-sm font-medium text-foreground-secondary mb-2">
              Warmup Steps
            </label>
            <input
              type="number"
              min="0"
              value={trainingConfig.warmupSteps}
              onChange={(e) => updateTrainingConfig({ warmupSteps: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-border rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent text-sm bg-surface text-foreground placeholder-foreground-muted hover:border-border-hover"
            />
            <p className="text-xs text-foreground-muted mt-1">LR warmup steps</p>
          </div>

          {/* Max Sequence Length */}
          <div>
            <label className="block text-sm font-medium text-foreground-secondary mb-2">
              Max Sequence Length
            </label>
            <select
              value={trainingConfig.maxSeqLength}
              onChange={(e) => updateTrainingConfig({ maxSeqLength: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-border rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent text-sm bg-surface text-foreground placeholder-foreground-muted hover:border-border-hover"
            >
              <option value="512">512</option>
              <option value="1024">1024</option>
              <option value="2048">2048</option>
              <option value="4096">4096</option>
              <option value="8192">8192</option>
            </select>
            <p className="text-xs text-foreground-muted mt-1">Max context length</p>
          </div>
        </div>
      </div>

      {/* LoRA Configuration */}
      {useLoRA && (
        <div className="space-y-4 p-4 bg-accent/10 border border-accent/20 rounded-lg">
          <h3 className="text-sm font-semibold text-foreground">LoRA Configuration</h3>

          <div className="grid grid-cols-2 gap-6">
            {/* LoRA Rank */}
            <div>
              <label className="block text-sm font-medium text-foreground-secondary mb-2">
                LoRA Rank (r)
              </label>
              <select
                value={loraConfig.rank}
                onChange={(e) => updateLoRAConfig({ rank: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-border rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent text-sm bg-surface text-foreground hover:border-border-hover"
              >
                <option value="8">8</option>
                <option value="16">16</option>
                <option value="32">32</option>
                <option value="64">64</option>
                <option value="128">128</option>
              </select>
              <p className="text-xs text-foreground-muted mt-1">Higher = more capacity</p>
            </div>

            {/* LoRA Alpha */}
            <div>
              <label className="block text-sm font-medium text-foreground-secondary mb-2">
                LoRA Alpha
              </label>
              <input
                type="number"
                min="1"
                value={loraConfig.alpha}
                onChange={(e) => updateLoRAConfig({ alpha: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-border rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent text-sm bg-surface text-foreground hover:border-border-hover"
              />
              <p className="text-xs text-foreground-muted mt-1">Scaling parameter</p>
            </div>

            {/* LoRA Dropout */}
            <div className="col-span-2">
              <label className="block text-sm font-medium text-foreground-secondary mb-2">
                LoRA Dropout
              </label>
              <input
                type="number"
                step="0.05"
                min="0"
                max="0.5"
                value={loraConfig.dropout}
                onChange={(e) => updateLoRAConfig({ dropout: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border border-border rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent text-sm bg-surface text-foreground hover:border-border-hover"
              />
              <p className="text-xs text-foreground-muted mt-1">
                0 = no dropout (recommended for Unsloth)
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Advanced Settings Toggle */}
      <button
        type="button"
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="w-full flex items-center justify-between p-3 bg-background-secondary hover:bg-surface-hover border border-border rounded-lg transition-colors"
      >
        <span className="text-sm font-medium text-foreground-secondary">Advanced Settings</span>
        {showAdvanced ? (
          <ChevronUp className="w-4 h-4 text-foreground-muted" />
        ) : (
          <ChevronDown className="w-4 h-4 text-foreground-muted" />
        )}
      </button>

      {/* Advanced Settings */}
      {showAdvanced && (
        <div className="space-y-4 p-4 border border-border rounded-lg">
          <div className="grid grid-cols-2 gap-6">
            {/* Optimizer */}
            <div>
              <label className="block text-sm font-medium text-foreground-secondary mb-2">
                Optimizer
              </label>
              <select
                value={trainingConfig.optimizer}
                onChange={(e) =>
                  updateTrainingConfig({
                    optimizer: e.target.value as any,
                  })
                }
                className="w-full px-3 py-2 border border-border rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent text-sm bg-surface text-foreground placeholder-foreground-muted hover:border-border-hover"
              >
                <option value="adamw_8bit">AdamW 8-bit (Memory efficient)</option>
                <option value="adamw">AdamW</option>
                <option value="sgd">SGD</option>
              </select>
            </div>

            {/* LR Scheduler */}
            <div>
              <label className="block text-sm font-medium text-foreground-secondary mb-2">
                LR Scheduler
              </label>
              <select
                value={trainingConfig.lrSchedulerType}
                onChange={(e) =>
                  updateTrainingConfig({
                    lrSchedulerType: e.target.value as any,
                  })
                }
                className="w-full px-3 py-2 border border-border rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent text-sm bg-surface text-foreground placeholder-foreground-muted hover:border-border-hover"
              >
                <option value="linear">Linear</option>
                <option value="cosine">Cosine</option>
                <option value="constant">Constant</option>
              </select>
            </div>

            {/* Weight Decay */}
            <div>
              <label className="block text-sm font-medium text-foreground-secondary mb-2">
                Weight Decay
              </label>
              <input
                type="number"
                step="0.001"
                value={trainingConfig.weightDecay}
                onChange={(e) => updateTrainingConfig({ weightDecay: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border border-border rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent text-sm bg-surface text-foreground placeholder-foreground-muted hover:border-border-hover"
              />
            </div>

            {/* Max Grad Norm */}
            <div>
              <label className="block text-sm font-medium text-foreground-secondary mb-2">
                Max Gradient Norm
              </label>
              <input
                type="number"
                step="0.1"
                value={trainingConfig.maxGradNorm}
                onChange={(e) => updateTrainingConfig({ maxGradNorm: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border border-border rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent text-sm bg-surface text-foreground placeholder-foreground-muted hover:border-border-hover"
              />
            </div>

            {/* Logging Steps */}
            <div>
              <label className="block text-sm font-medium text-foreground-secondary mb-2">
                Logging Steps
              </label>
              <input
                type="number"
                min="1"
                value={trainingConfig.loggingSteps}
                onChange={(e) => updateTrainingConfig({ loggingSteps: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-border rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent text-sm bg-surface text-foreground placeholder-foreground-muted hover:border-border-hover"
              />
            </div>

            {/* Random Seed */}
            <div>
              <label className="block text-sm font-medium text-foreground-secondary mb-2">
                Random Seed
              </label>
              <input
                type="number"
                value={trainingConfig.seed}
                onChange={(e) => updateTrainingConfig({ seed: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-border rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent text-sm bg-surface text-foreground placeholder-foreground-muted hover:border-border-hover"
              />
            </div>
          </div>

          {/* Precision Options */}
          <div className="pt-4 border-t border-border">
            <h4 className="text-sm font-medium text-foreground-secondary mb-3">Precision</h4>
            <div className="flex gap-6">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={trainingConfig.bf16}
                  onChange={() => updateTrainingConfig({ bf16: true, fp16: false })}
                  className="w-4 h-4 text-accent focus-visible:ring-2 focus-visible:ring-accent"
                />
                <span className="text-sm text-foreground-secondary">BF16 (Recommended)</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={trainingConfig.fp16}
                  onChange={() => updateTrainingConfig({ fp16: true, bf16: false })}
                  className="w-4 h-4 text-accent focus-visible:ring-2 focus-visible:ring-accent"
                />
                <span className="text-sm text-foreground-secondary">FP16</span>
              </label>
            </div>
          </div>

          {/* Optimization Toggles */}
          <div className="pt-4 border-t border-border space-y-3">
            <label className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-foreground-secondary">
                  Gradient Checkpointing
                </span>
                <p className="text-xs text-foreground-muted">Reduces memory usage</p>
              </div>
              <input
                type="checkbox"
                checked={trainingConfig.useGradientCheckpointing}
                onChange={(e) =>
                  updateTrainingConfig({
                    useGradientCheckpointing: e.target.checked,
                  })
                }
                className="w-4 h-4 text-accent focus-visible:ring-2 focus-visible:ring-accent rounded"
              />
            </label>

            <label className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-foreground-secondary">Packing</span>
                <p className="text-xs text-foreground-muted">Combine sequences for efficiency</p>
              </div>
              <input
                type="checkbox"
                checked={trainingConfig.packing}
                onChange={(e) => updateTrainingConfig({ packing: e.target.checked })}
                className="w-4 h-4 text-accent focus-visible:ring-2 focus-visible:ring-accent rounded"
              />
            </label>
          </div>
        </div>
      )}
    </div>
  );
};
