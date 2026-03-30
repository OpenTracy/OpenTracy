import { Trash, Key } from 'lucide-react';
import type { ApiKey } from '../../types/apiKeyType';

export default function ApiKeyItem({
  keyData,
  onDelete,
}: {
  keyData: ApiKey;
  onDelete?: () => void;
}) {
  return (
    <div className="flex items-center justify-between bg-surface border border-border rounded-lg px-4 py-3 shadow-sm hover:border-border-hover transition-all duration-200">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
          <Key className="w-4 h-4 text-accent" />
        </div>
        <div>
          <div className="text-sm font-medium text-foreground">{keyData.name}</div>
          <div className="text-xs text-foreground-muted">Key hidden for security</div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onDelete}
          title="Delete"
          aria-label="Delete API key"
          className="p-2 rounded-lg hover:bg-error/10 transition-all duration-200"
        >
          <Trash className="w-4 h-4 text-foreground-muted hover:text-error" />
        </button>
      </div>
    </div>
  );
}
