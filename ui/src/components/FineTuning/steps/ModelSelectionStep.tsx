import { useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import type { FineTuningJob } from '../../../types/fineTuningTypes';
import { getProviderIcon } from '../../../utils/modelUtils';

// Models that support fine-tuning
const FINE_TUNABLE_MODELS = [
  'gpt-4o-mini-2024-07-18',
  'gpt-4o-2024-08-06',
  'gpt-3.5-turbo-0125',
  'claude-3-haiku-20240307',
  'claude-3-5-sonnet-20241022',
  'meta-llama/Meta-Llama-3.1-8B-Instruct',
  'meta-llama/Meta-Llama-3.1-70B-Instruct',
  'mistralai/Mistral-7B-Instruct-v0.3',
  'mistralai/Mixtral-8x7B-Instruct-v0.1',
] as const;

interface ModelSelectionStepProps {
  jobData: Partial<FineTuningJob>;
  onUpdate: (updates: Partial<FineTuningJob>) => void;
}

export const ModelSelectionStep = ({ jobData, onUpdate }: ModelSelectionStepProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const filteredModels = FINE_TUNABLE_MODELS.filter((model) =>
    model.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectModel = (model: string) => {
    onUpdate({ baseModel: model });
    setIsDropdownOpen(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-1">Select Base Model</h3>
        <p className="text-sm text-foreground-muted">
          Choose the foundation model you want to fine-tune
        </p>
      </div>

      <div className="space-y-4">
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="w-full px-4 py-3 border border-border rounded-lg flex items-center justify-between hover:border-accent/20 transition-all focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <div className="flex items-center gap-3">
              {jobData.baseModel ? (
                <>
                  {getProviderIcon(jobData.baseModel, 'w-5 h-5')}
                  <span className="text-sm font-medium text-foreground">{jobData.baseModel}</span>
                </>
              ) : (
                <span className="text-sm text-foreground-muted">Select a base model...</span>
              )}
            </div>
            <ChevronDown
              className={`w-5 h-5 text-foreground-muted transition-transform ${
                isDropdownOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {isDropdownOpen && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-surface border border-border rounded-lg shadow-lg z-10 max-h-96 overflow-hidden flex flex-col">
              {/* Search */}
              <div className="p-3 border-b border-border">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search models..."
                    className="w-full pl-10 pr-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                    autoFocus
                  />
                </div>
              </div>

              {/* Models list */}
              <div className="overflow-y-auto">
                {filteredModels.length > 0 ? (
                  filteredModels.map((model) => (
                    <button
                      key={model}
                      type="button"
                      onClick={() => handleSelectModel(model)}
                      className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-accent/5 transition-colors text-left ${
                        jobData.baseModel === model ? 'bg-accent/5 border-l-2 border-accent' : ''
                      }`}
                    >
                      {getProviderIcon(model, 'w-5 h-5')}
                      <span className="text-sm font-medium text-foreground">{model}</span>
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-8 text-center text-sm text-foreground-muted">
                    No models found
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {jobData.baseModel && (
          <div className="bg-accent/5 border border-accent/20 rounded-lg p-4">
            <h4 className="text-sm font-medium text-accent mb-2">Selected Model</h4>
            <div className="flex items-center gap-2">
              {getProviderIcon(jobData.baseModel, 'w-5 h-5')}
              <span className="text-sm text-accent">{jobData.baseModel}</span>
            </div>
            <p className="text-xs text-foreground-secondary mt-2">
              This model will be fine-tuned with your custom dataset
            </p>
          </div>
        )}
      </div>

      <div className="bg-accent/10 border border-accent/20 rounded-lg p-4">
        <h4 className="text-sm font-medium text-accent mb-2">Model Compatibility</h4>
        <ul className="text-xs text-accent space-y-1">
          <li>• GPT models support full fine-tuning</li>
          <li>• Claude models use parameter-efficient methods</li>
          <li>• Open-source models support LoRA fine-tuning</li>
        </ul>
      </div>
    </div>
  );
};
