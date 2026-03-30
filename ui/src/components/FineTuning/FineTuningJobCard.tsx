import {
  Sparkles,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Trash2,
  TrendingUp,
  Database,
} from 'lucide-react';
import type { FineTuningJob, FineTuningStatus } from '../../types/fineTuningTypes';
import { getProviderIcon } from '../../utils/modelUtils';
import { Button } from '@/components/ui/button';

interface FineTuningJobCardProps {
  job: FineTuningJob;
  onDelete: (jobId: string) => void;
  isDeleting?: boolean;
}

const STATUS_CONFIG: Record<
  FineTuningStatus,
  {
    icon: typeof Clock;
    color: string;
    bgColor: string;
    borderColor: string;
    label: string;
  }
> = {
  pending: {
    icon: Clock,
    color: 'text-foreground-muted',
    bgColor: 'bg-background-secondary',
    borderColor: 'border-border',
    label: 'Pending',
  },
  running: {
    icon: Loader2,
    color: 'text-accent',
    bgColor: 'bg-accent/10',
    borderColor: 'border-accent/20',
    label: 'Running',
  },
  completed: {
    icon: CheckCircle2,
    color: 'text-success',
    bgColor: 'bg-success/10',
    borderColor: 'border-success/20',
    label: 'Completed',
  },
  failed: {
    icon: XCircle,
    color: 'text-error',
    bgColor: 'bg-error/10',
    borderColor: 'border-error/20',
    label: 'Failed',
  },
  cancelled: {
    icon: XCircle,
    color: 'text-warning',
    bgColor: 'bg-warning/10',
    borderColor: 'border-warning/20',
    label: 'Cancelled',
  },
};

export const FineTuningJobCard = ({
  job,
  onDelete,
  isDeleting = false,
}: FineTuningJobCardProps) => {
  const statusConfig = STATUS_CONFIG[job.status];
  const StatusIcon = statusConfig.icon;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getDuration = () => {
    if (!job.startedAt) return null;
    const start = new Date(job.startedAt).getTime();
    const end = job.completedAt ? new Date(job.completedAt).getTime() : Date.now();
    const durationMs = end - start;
    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="bg-surface border border-border rounded-lg p-6 hover:border-border-hover transition-all duration-200">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start gap-3 flex-1">
          <div className="w-10 h-10 bg-gradient-to-br from-accent/10 to-accent/20 rounded-lg flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-5 h-5 text-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-foreground truncate">{job.name}</h3>
            <p className="text-xs text-foreground-muted mt-1">
              Created {formatDate(job.createdAt)}
            </p>
          </div>
        </div>

        {/* Status Badge */}
        <div
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${statusConfig.bgColor} border ${statusConfig.borderColor}`}
        >
          <StatusIcon
            className={`w-3.5 h-3.5 ${statusConfig.color} ${
              job.status === 'running' ? 'animate-spin' : ''
            }`}
          />
          <span className={`text-xs font-medium ${statusConfig.color}`}>{statusConfig.label}</span>
        </div>
      </div>

      {/* Progress Bar (if running) */}
      {job.status === 'running' && job.progress !== undefined && (
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs text-foreground-secondary mb-1">
            <span>Training Progress</span>
            <span className="font-medium">{job.progress}%</span>
          </div>
          <div className="w-full bg-background-secondary rounded-full h-2 overflow-hidden">
            <div
              className="bg-gradient-to-r from-accent to-accent-hover h-full rounded-full transition-all duration-300"
              style={{ width: `${job.progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Model Info */}
      <div className="flex items-center gap-2 mb-4 p-3 bg-background-secondary rounded-lg">
        {getProviderIcon(job.baseModel, 'w-5 h-5')}
        <span className="text-sm font-mono text-foreground-secondary">{job.baseModel}</span>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {/* Dataset */}
        <div className="flex items-start gap-2">
          <Database className="w-4 h-4 text-foreground-muted mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-xs text-foreground-muted">Dataset</p>
            <p className="text-sm font-medium text-foreground truncate">{job.dataset.name}</p>
          </div>
        </div>

        {/* Duration */}
        {getDuration() && (
          <div className="flex items-start gap-2">
            <Clock className="w-4 h-4 text-foreground-muted mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs text-foreground-muted">Duration</p>
              <p className="text-sm font-medium text-foreground">{getDuration()}</p>
            </div>
          </div>
        )}

        {/* Training Metrics (if completed) */}
        {job.status === 'completed' && job.metrics && (
          <>
            <div className="flex items-start gap-2">
              <TrendingUp className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-foreground-muted">Loss</p>
                <p className="text-sm font-medium text-foreground">{job.metrics.loss.toFixed(4)}</p>
              </div>
            </div>
            {job.metrics.accuracy && (
              <div className="flex items-start gap-2">
                <TrendingUp className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-foreground-muted">Accuracy</p>
                  <p className="text-sm font-medium text-foreground">
                    {(job.metrics.accuracy * 100).toFixed(1)}%
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Config Summary */}
      <div className="mb-4 p-3 bg-background-secondary border border-border rounded-lg">
        <div className="grid grid-cols-3 gap-3 text-xs">
          <div>
            <p className="text-foreground-secondary font-medium">LR</p>
            <p className="text-foreground font-mono">{job.trainingConfig.learningRate}</p>
          </div>
          <div>
            <p className="text-foreground-secondary font-medium">Epochs</p>
            <p className="text-foreground font-mono">{job.trainingConfig.numEpochs}</p>
          </div>
          <div>
            <p className="text-foreground-secondary font-medium">Batch</p>
            <p className="text-foreground font-mono">
              {job.trainingConfig.perDeviceTrainBatchSize}
            </p>
          </div>
        </div>
        {job.loraConfig && (
          <div className="mt-2 pt-2 border-t border-border">
            <span className="text-xs font-medium text-foreground-secondary">
              LoRA: r={job.loraConfig.rank} α={job.loraConfig.alpha}
            </span>
          </div>
        )}
      </div>

      {/* Error Message (if failed) */}
      {job.status === 'failed' && job.error && (
        <div className="mb-4 p-3 bg-error/10 border border-error/20 rounded-lg">
          <p className="text-xs font-medium text-error mb-1">Error</p>
          <p className="text-xs text-error">{job.error}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-4 border-t border-border">
        <button
          onClick={() => onDelete(job.id)}
          disabled={isDeleting}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-error hover:bg-error/10 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isDeleting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Trash2 className="w-4 h-4" />
          )}
          {isDeleting ? 'Deleting...' : 'Delete'}
        </button>

        {job.status === 'completed' && (
          <Button variant="default" className="flex-1">
            Deploy Model
          </Button>
        )}
      </div>
    </div>
  );
};
