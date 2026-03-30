import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export interface RowAction {
  key: string;
  label: string;
  icon: ReactNode;
  visible: boolean;
  onClick: () => void;
  className?: string;
}

interface ListRowActionsProps {
  actions: RowAction[];
}

export function ListRowActions({ actions }: ListRowActionsProps) {
  return (
    <>
      {actions
        .filter((a) => a.visible)
        .map((action) => (
          <Tooltip key={action.key}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={`rounded-full size-8 hover:bg-muted ${action.className ?? ''}`}
                onClick={action.onClick}
              >
                {action.icon}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{action.label}</TooltipContent>
          </Tooltip>
        ))}
    </>
  );
}
