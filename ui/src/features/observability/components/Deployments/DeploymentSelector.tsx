import { Server, ChevronRight } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

import type { DeploymentWithMetrics } from '../../types';

interface DeploymentSelectorProps {
  deployments: DeploymentWithMetrics[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function DeploymentSelector({ deployments, selectedId, onSelect }: DeploymentSelectorProps) {
  if (deployments.length === 0) return null;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="flex size-6 items-center justify-center rounded-md bg-primary/10">
            <Server className="size-3.5 text-primary" />
          </div>
          <CardTitle className="text-sm font-medium">Select Deployment</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {deployments.map((d) => {
          const isSelected = selectedId === d.id;
          const statusLower = d.status.toLowerCase();
          const isActive = statusLower === 'active' || statusLower === 'in_service';
          return (
            <button
              key={d.id}
              onClick={() => onSelect(d.id)}
              className={cn(
                'group flex items-center gap-3 rounded-lg border p-3 text-left transition-all',
                isSelected
                  ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                  : 'hover:border-muted-foreground/30 hover:bg-muted/50'
              )}
            >
              <div
                className={cn(
                  'flex size-8 shrink-0 items-center justify-center rounded-lg',
                  isSelected ? 'bg-primary/10' : 'bg-muted'
                )}
              >
                <Server
                  className={cn('size-4', isSelected ? 'text-primary' : 'text-muted-foreground')}
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{d.name}</p>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <div
                    className={cn(
                      'size-1.5 rounded-full',
                      isActive ? 'bg-chart-2' : 'bg-muted-foreground'
                    )}
                  />
                  <span className="text-[11px] text-muted-foreground">{d.model}</span>
                </div>
              </div>
              <ChevronRight
                className={cn(
                  'size-4 shrink-0 transition-opacity',
                  isSelected
                    ? 'text-primary opacity-100'
                    : 'text-muted-foreground opacity-0 group-hover:opacity-50'
                )}
              />
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}
