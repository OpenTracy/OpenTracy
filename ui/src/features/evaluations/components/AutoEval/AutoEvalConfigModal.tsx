import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import type { AutoEvalConfig, AutoEvalSchedule } from '../../types/evaluationsTypes';

interface DatasetOption {
  dataset_id: string;
  name: string;
}

interface AutoEvalConfigModalProps {
  open: boolean;
  onClose: () => void;
  config?: AutoEvalConfig | null;
  datasets?: DatasetOption[];
  onCreate: (
    data: Omit<
      AutoEvalConfig,
      'id' | 'created_at' | 'updated_at' | 'last_run_at' | 'last_run_score'
    >
  ) => void;
  onUpdate: (id: string, data: Partial<AutoEvalConfig>) => void;
}

const SCHEDULES: { id: AutoEvalSchedule; label: string }[] = [
  { id: 'hourly', label: 'Hourly' },
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'on_deploy', label: 'On Deploy' },
];

export function AutoEvalConfigModal({
  open,
  onClose,
  config,
  datasets = [],
  onCreate,
  onUpdate,
}: AutoEvalConfigModalProps) {
  const isEditing = !!config;

  const [name, setName] = useState('');
  const [schedule, setSchedule] = useState<AutoEvalSchedule>('daily');
  const [datasetId, setDatasetId] = useState('');
  const [models, setModels] = useState('');
  const [metrics, setMetrics] = useState('');
  const [topicFilter, setTopicFilter] = useState('');
  const [alertOnRegression, setAlertOnRegression] = useState(true);
  const [regressionThreshold, setRegressionThreshold] = useState(0.05);

  useEffect(() => {
    if (open) {
      if (config) {
        setName(config.name);
        setSchedule(config.schedule);
        setDatasetId(config.dataset_id);
        setModels(config.models.join(', '));
        setMetrics(config.metrics.join(', '));
        setTopicFilter(config.topic_filter || '');
        setAlertOnRegression(config.alert_on_regression);
        setRegressionThreshold(config.regression_threshold);
      } else {
        setName('');
        setSchedule('daily');
        setDatasetId(datasets.length === 1 ? datasets[0].dataset_id : '');
        setModels('');
        setMetrics('');
        setTopicFilter('');
        setAlertOnRegression(true);
        setRegressionThreshold(0.05);
      }
    }
  }, [open, config]);

  const handleSubmit = () => {
    const data = {
      name: name.trim(),
      enabled: config?.enabled ?? true,
      schedule,
      dataset_id: datasetId || config?.dataset_id || '',
      dataset_name: datasets.find((d) => d.dataset_id === datasetId)?.name || '',
      models: models
        .split(',')
        .map((m) => m.trim())
        .filter(Boolean),
      metrics: metrics
        .split(',')
        .map((m) => m.trim())
        .filter(Boolean),
      topic_filter: topicFilter.trim() || undefined,
      alert_on_regression: alertOnRegression,
      regression_threshold: regressionThreshold,
    };

    if (isEditing && config) {
      onUpdate(config.id, data);
    } else {
      onCreate(data);
    }
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl" showCloseButton={false}>
        <DialogHeader className="pb-4 border-b border-border">
          <DialogTitle>{isEditing ? 'Edit' : 'New'} Auto-Evaluation Config</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Name</label>
            <Input
              placeholder="e.g., Production Quality Monitor"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">Schedule</label>
            <div className="flex gap-2">
              {SCHEDULES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSchedule(s.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                    schedule === s.id
                      ? 'bg-foreground/10 text-foreground border-foreground/20'
                      : 'text-foreground-muted border-border hover:border-border-hover'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Dataset</label>
            <select
              value={datasetId}
              onChange={(e) => setDatasetId(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Select a dataset...</option>
              {datasets.map((d) => (
                <option key={d.dataset_id} value={d.dataset_id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">
              Models <span className="text-foreground-muted font-normal">(comma-separated)</span>
            </label>
            <Textarea
              placeholder="gpt-4o, claude-3.5-sonnet, gpt-4o-mini"
              value={models}
              onChange={(e) => setModels(e.target.value)}
              rows={2}
            />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">
              Metrics <span className="text-foreground-muted font-normal">(comma-separated)</span>
            </label>
            <Textarea
              placeholder="exact_match, llm_judge, latency, cost"
              value={metrics}
              onChange={(e) => setMetrics(e.target.value)}
              rows={2}
            />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">
              Topic Filter <span className="text-foreground-muted font-normal">(optional)</span>
            </label>
            <Input
              placeholder="e.g., customer_support"
              value={topicFilter}
              onChange={(e) => setTopicFilter(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-foreground">Alert on Regression</label>
              <p className="text-xs text-foreground-muted">
                Notify when scores drop below threshold
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAlertOnRegression(!alertOnRegression)}
              className={`w-9 h-5 rounded-full transition-colors flex items-center ${
                alertOnRegression ? 'bg-success justify-end' : 'bg-foreground/20 justify-start'
              }`}
            >
              <div className="w-4 h-4 rounded-full bg-white mx-0.5 shadow-sm" />
            </button>
          </div>

          {alertOnRegression && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-foreground">Regression Threshold</label>
                <span className="text-sm text-foreground-muted tabular-nums">
                  {(regressionThreshold * 100).toFixed(0)}%
                </span>
              </div>
              <Slider
                value={[regressionThreshold]}
                min={0.01}
                max={0.2}
                step={0.01}
                onValueChange={([val]) => setRegressionThreshold(val)}
              />
            </div>
          )}
        </div>

        <DialogFooter className="pt-4 border-t border-border">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>{isEditing ? 'Save' : 'Create'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
