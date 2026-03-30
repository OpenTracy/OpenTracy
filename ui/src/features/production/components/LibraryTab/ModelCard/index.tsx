import { useState } from 'react';
import type { SVGProps } from 'react';
import { Cpu, Download, Loader2, Rocket, Trash2, Eye } from 'lucide-react';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { DeploymentModel } from '@/types/deploymentTypes';
import type { AvailableModel } from '@/features/production/api/modelRegistryService';

import { ModelCardDeleteDialog } from './DeleteDialog';

interface ModelCardProps {
  model: DeploymentModel;
  apiModel: AvailableModel | undefined;
  isDeletingInProgress: boolean;
  onViewSpecs: (model: DeploymentModel) => void;
  onDeploy: (model: DeploymentModel) => void;
  onDelete: (modelId: string, modelName: string) => void;
}

interface ModelAvatarProps {
  icon: React.ComponentType<SVGProps<SVGSVGElement>> | null;
}

function ModelAvatar({ icon: IconComponent }: ModelAvatarProps) {
  return (
    <Avatar>
      <AvatarFallback className="bg-muted text-muted-foreground">
        {IconComponent ? <IconComponent className="size-5" /> : <Cpu className="size-5" />}
      </AvatarFallback>
    </Avatar>
  );
}

interface ModelCardProps {
  model: DeploymentModel;
  apiModel: AvailableModel | undefined;
  isDeletingInProgress: boolean;
  onViewSpecs: (model: DeploymentModel) => void;
  onDeploy: (model: DeploymentModel) => void;
  onDelete: (modelId: string, modelName: string) => void;
}

export function ModelCard({
  model,
  apiModel,
  isDeletingInProgress,
  onViewSpecs,
  onDeploy,
  onDelete,
}: ModelCardProps) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const isHuggingFaceModel = apiModel?.source === 'huggingface';
  const isReadyForDeployment = apiModel?.ready_for_deployment ?? true;
  const downloadStatus = apiModel?.download_status;

  return (
    <>
      <Card
        className="flex flex-col transition-all cursor-pointer hover:shadow-md"
        onClick={() => onViewSpecs(model)}
      >
        <CardContent className="flex-1 pt-5">
          <div className="flex items-start gap-3 mb-4">
            <ModelAvatar icon={typeof model.icon === 'string' ? null : model.icon} />

            <div className="flex-1 min-w-0">
              <h3 className="font-semibold truncate">{model.name}</h3>
              {!isReadyForDeployment && downloadStatus && (
                <Badge variant="outline" className="mt-1 text-xs">
                  {downloadStatus === 'downloading' ? 'Downloading...' : downloadStatus}
                </Badge>
              )}
            </div>

            {!isReadyForDeployment && (
              <Download className="w-4 h-4 shrink-0 mt-0.5 animate-pulse" />
            )}
          </div>

          <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{model.description}</p>

          <div className="flex flex-wrap gap-2">
            {model.features.map((feature) => (
              <Badge key={feature} variant="secondary" className="text-xs">
                {feature}
              </Badge>
            ))}
          </div>
        </CardContent>

        <CardFooter className="flex justify-between items-center gap-2 pt-4">
          <Button
            onClick={(e) => {
              e.stopPropagation();
              onViewSpecs(model);
            }}
            variant="ghost"
            size="sm"
          >
            <Eye className="w-4 h-4 mr-1" />
            Specs
          </Button>

          <div className="flex items-center gap-2">
            {isHuggingFaceModel && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsDeleteDialogOpen(true);
                      }}
                      disabled={isDeletingInProgress}
                      variant="ghost"
                      size="sm"
                    >
                      {isDeletingInProgress ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Remove model</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {isReadyForDeployment ? (
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeploy(model);
                }}
                size="sm"
              >
                <Rocket className="w-4 h-4 mr-1" />
                Deploy
              </Button>
            ) : (
              <span className="text-xs text-muted-foreground">Preparing...</span>
            )}
          </div>
        </CardFooter>
      </Card>

      <ModelCardDeleteDialog
        modelName={model.name}
        isOpen={isDeleteDialogOpen}
        onConfirm={() => {
          setIsDeleteDialogOpen(false);
          onDelete(model.id, model.name);
        }}
        onCancel={() => setIsDeleteDialogOpen(false)}
      />
    </>
  );
}
