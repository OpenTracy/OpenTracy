import { Upload, FileText, Link2, X } from 'lucide-react';
import type { FineTuningJob } from '../../../types/fineTuningTypes';
import { useState } from 'react';

interface BasicInfoStepProps {
  jobData: Partial<FineTuningJob>;
  onUpdate: (updates: Partial<FineTuningJob>) => void;
}

export const BasicInfoStep = ({ jobData, onUpdate }: BasicInfoStepProps) => {
  const [datasetMethod, setDatasetMethod] = useState<'upload' | 'url'>(
    jobData.dataset?.type || 'upload'
  );

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onUpdate({
        dataset: {
          name: file.name,
          file,
          type: 'upload',
        },
      });
    }
  };

  return (
    <div className="space-y-8">
      {/* Job Name */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">Job Name</label>
        <input
          type="text"
          value={jobData.name || ''}
          onChange={(e) => onUpdate({ name: e.target.value })}
          placeholder="Enter a descriptive name for your fine-tuning job"
          className="w-full px-4 py-3 border border-border rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:border-transparent text-sm bg-surface text-foreground placeholder-foreground-muted hover:border-border-hover"
          required
        />
      </div>

      {/* Dataset Section */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-3">Training Dataset</label>

        {/* Method Selector */}
        <div className="flex gap-3 mb-4">
          <button
            type="button"
            onClick={() => {
              setDatasetMethod('upload');
              onUpdate({ dataset: undefined });
            }}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
              datasetMethod === 'upload'
                ? 'border-border bg-accent/10 text-accent'
                : 'border-border bg-surface text-foreground-secondary hover:border-border'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span className="font-medium text-sm">Upload File</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setDatasetMethod('url');
              onUpdate({ dataset: undefined });
            }}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
              datasetMethod === 'url'
                ? 'border-border bg-accent/10 text-accent'
                : 'border-border bg-surface text-foreground-secondary hover:border-border'
            }`}
          >
            <Link2 className="w-4 h-4" />
            <span className="font-medium text-sm">Use URL</span>
          </button>
        </div>

        {/* Upload Area */}
        {datasetMethod === 'upload' && (
          <div>
            {!jobData.dataset?.file ? (
              <div className="border-2 border-dashed border-border rounded-lg p-12 hover:border-border-hover hover:bg-background-secondary transition-all">
                <input
                  type="file"
                  id="dataset-upload"
                  accept=".jsonl,.json,.csv"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <label
                  htmlFor="dataset-upload"
                  className="flex flex-col items-center cursor-pointer"
                >
                  <div className="w-16 h-16 bg-background-secondary rounded-full flex items-center justify-center mb-4">
                    <FileText className="w-8 h-8 text-foreground-muted" />
                  </div>
                  <span className="text-sm font-medium text-foreground-secondary mb-1">
                    Click to upload or drag and drop
                  </span>
                  <span className="text-xs text-foreground-muted">
                    JSONL, JSON, or CSV (max 100MB)
                  </span>
                </label>
              </div>
            ) : (
              <div className="flex items-center justify-between p-4 bg-background-secondary border border-border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center">
                    <FileText className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{jobData.dataset.name}</p>
                    <p className="text-xs text-foreground-muted">Ready to use</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onUpdate({ dataset: undefined })}
                  className="p-2 hover:bg-surface-hover rounded-lg transition-colors"
                >
                  <X className="w-4 h-4 text-foreground-muted" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* URL Input */}
        {datasetMethod === 'url' && (
          <div>
            <div className="flex gap-2">
              <input
                type="url"
                value={jobData.dataset?.type === 'url' ? jobData.dataset.url : ''}
                onChange={(e) =>
                  onUpdate({
                    dataset: {
                      name: 'Remote dataset',
                      url: e.target.value,
                      type: 'url',
                    },
                  })
                }
                placeholder="https://example.com/dataset.jsonl"
                className="flex-1 px-4 py-3 border border-border rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:border-transparent text-sm bg-surface text-foreground placeholder-foreground-muted hover:border-border-hover"
              />
            </div>
            <p className="mt-2 text-xs text-foreground-muted">
              Enter a publicly accessible URL to your training dataset
            </p>
          </div>
        )}
      </div>

      {/* Dataset Format Info */}
      <div className="bg-background-secondary border border-border rounded-lg p-4">
        <h4 className="text-sm font-medium text-foreground mb-2">Expected Format</h4>
        <p className="text-xs text-foreground-secondary mb-3">
          Your dataset should be in JSONL format with messages:
        </p>
        <pre className="text-xs bg-surface p-3 rounded border border-border overflow-x-auto font-mono">
          {`{"messages": [
  {"role": "user", "content": "Hello"},
  {"role": "assistant", "content": "Hi there!"}
]}`}
        </pre>
      </div>
    </div>
  );
};
