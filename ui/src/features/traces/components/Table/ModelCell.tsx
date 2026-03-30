import { getProviderIconByBackend } from '@/utils/modelUtils';

interface ModelCellProps {
  modelId: string;
  backend: string;
  provider: string;
}

export function ModelCell({ modelId, backend, provider }: ModelCellProps) {
  const providerIcon = getProviderIconByBackend(backend, modelId);

  return (
    <div className="flex items-center min-w-0 gap-2.5">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-white p-1.5">
        <img src={providerIcon} alt={provider} className="size-full object-contain" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground truncate">{modelId || 'Unknown'}</p>
        <p className="text-xs text-muted-foreground truncate">{provider}</p>
      </div>
    </div>
  );
}
