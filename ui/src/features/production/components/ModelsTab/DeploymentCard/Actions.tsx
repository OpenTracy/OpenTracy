import { Pause, Play, Trash2, Code, Eye } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { DeploymentData } from '@/types/deploymentTypes';
import { getDeploymentStatus } from '@/features/production/utils/deploymentStatusConfig';

type Props = {
  deployment: DeploymentData;
  onPause?: (d: DeploymentData) => void;
  onResume?: (d: DeploymentData) => void;
  onDelete?: (d: DeploymentData) => void;
  isDeleting?: boolean;
  isPausing?: boolean;
  isResuming?: boolean;
  onShowDetails: () => void;
  onShowAPI: () => void;
};

export const Actions = ({
  deployment,
  onPause,
  onResume,
  onDelete,
  isDeleting,
  isPausing,
  isResuming,
  onShowDetails,
  onShowAPI,
}: Props) => {
  const { isActive, isPaused, isDeletable, isTransitioning } = getDeploymentStatus(
    deployment.status
  );

  return (
    <div className="flex w-full items-center gap-1.5">
      <Button variant="outline" size="sm" onClick={onShowDetails} className="flex-1">
        <Eye className="size-4" />
        Details
      </Button>

      {isActive && (
        <>
          <Button variant="outline" size="sm" onClick={onShowAPI} className="flex-1">
            <Code className="size-4" />
            API
          </Button>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => onPause?.(deployment)}
                disabled={isPausing || isTransitioning}
                className="text-muted-foreground hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-500/10"
              >
                {isPausing ? <Spinner /> : <Pause className="size-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Pause</TooltipContent>
          </Tooltip>
        </>
      )}

      {isPaused && (
        <Button
          variant="default"
          size="sm"
          onClick={() => onResume?.(deployment)}
          disabled={isResuming || isTransitioning}
          className="flex-1"
        >
          {isResuming ? <Spinner /> : <Play className="size-4" />}
          Resume
        </Button>
      )}

      {isDeletable && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onDelete?.(deployment)}
              disabled={isDeleting}
              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              aria-label="Delete deployment"
            >
              {isDeleting ? <Spinner /> : <Trash2 className="size-4" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Delete</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
};
