import { RefreshCw } from 'lucide-react';

export function AutoRefillCard({ enabled, toggle }: { enabled: boolean; toggle: () => void }) {
  return (
    <div className="bg-surface border border-border rounded-lg p-5 flex justify-between items-center">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 bg-accent/10 rounded-lg">
          <RefreshCw className="w-5 h-5 text-accent" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">Auto Refill</p>
          <p className="text-xs text-foreground-muted">
            {enabled ? 'Automatically add credits when low' : 'Manual refill only'}
          </p>
        </div>
      </div>
      <button
        onClick={toggle}
        role="switch"
        aria-checked={enabled}
        className={`relative w-12 h-7 flex items-center rounded-full p-0.5 transition-colors duration-200 ${
          enabled ? 'bg-accent' : 'bg-border'
        }`}
      >
        <div
          className={`bg-foreground w-6 h-6 rounded-full shadow-sm transform transition-transform duration-200 ${
            enabled ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}
