import { Beaker, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  hasSearchTerm: boolean;
  onCreateNew: () => void;
}

export function EmptyState({ hasSearchTerm, onCreateNew }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <div className="size-16 rounded-2xl bg-muted flex items-center justify-center">
        <Beaker className="size-8 text-muted-foreground" />
      </div>
      <div className="text-center space-y-1">
        <p className="text-sm font-medium text-foreground">
          {hasSearchTerm ? 'No jobs match your search' : 'Start your first distillation'}
        </p>
        <p className="text-xs text-muted-foreground max-w-md">
          Distill a large teacher model into a smaller, faster, cheaper student model using the BOND
          pipeline.
        </p>
      </div>
      {!hasSearchTerm && (
        <Button size="sm" onClick={onCreateNew} className="mt-2">
          <Plus className="size-4" />
          New Distillation
        </Button>
      )}
    </div>
  );
}
