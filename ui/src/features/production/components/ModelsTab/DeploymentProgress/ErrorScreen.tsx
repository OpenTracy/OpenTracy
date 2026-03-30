import {
  AlertCircle,
  RefreshCw,
  CloudOff,
  HardDrive,
  WifiOff,
  ServerCrash,
  Download,
} from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  getErrorDisplay,
  type DeploymentError,
} from '@/features/production/utils/deploymentErrorHandling';

import { InstanceSuggestions } from './InstanceSuggestions';

const ERROR_ICON_MAP: Record<string, React.ReactNode> = {
  'cloud-off': <CloudOff className="w-6 h-6" />,
  'hard-drive': <HardDrive className="w-6 h-6" />,
  'alert-circle': <AlertCircle className="w-6 h-6" />,
  'wifi-off': <WifiOff className="w-6 h-6" />,
  'server-crash': <ServerCrash className="w-6 h-6" />,
  download: <Download className="w-6 h-6" />,
} as const;

const FALLBACK_ICON = <AlertCircle className="w-6 h-6" />;

const CAPACITY_ERROR_CODES = new Set(['no_spot_capacity', 'gpu_unavailable', 'model_too_large']);

interface ErrorScreenProps {
  error: DeploymentError;
  selectedInstanceId?: string;
  availableInstanceIds?: string[];
  onRetry?: () => void;
  onSelectAlternative?: (instanceId: string) => void;
  onChangeInstance?: () => void;
  onClose: () => void;
}

function MalformedErrorFallback({ onClose }: { onClose: () => void }) {
  return (
    <Card className="border-destructive/50 bg-destructive/5">
      <CardContent className="pt-6 pb-6 space-y-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Unexpected Error</AlertTitle>
          <AlertDescription>
            Something went wrong, but we couldn't retrieve the error details. Please try again or
            contact support if the issue persists.
          </AlertDescription>
        </Alert>
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function ErrorScreen({
  error,
  selectedInstanceId,
  availableInstanceIds = [],
  onRetry,
  onSelectAlternative,
  onChangeInstance,
  onClose,
}: ErrorScreenProps) {
  if (!error?.error_code) {
    return <MalformedErrorFallback onClose={onClose} />;
  }

  const display = getErrorDisplay(error.error_code);
  const errorIcon = ERROR_ICON_MAP[display.icon] ?? FALLBACK_ICON;

  const showAlternativeInstances =
    CAPACITY_ERROR_CODES.has(error.error_code) && typeof onSelectAlternative === 'function';

  const hasTechnicalDetails = error.error_message && error.error_message !== error.user_message;

  const isRetryable = error.retryable === true && typeof onRetry === 'function';
  const canChangeInstance = typeof onChangeInstance === 'function';

  return (
    <Card className="border-destructive/50 bg-linear-to-br from-destructive/5 to-background">
      <CardHeader className="pb-4">
        <div className="flex items-start gap-4">
          {/* Error icon with contextual background */}
          <div
            className={`w-12 h-12 ${display.bgClass} rounded-lg flex items-center justify-center shrink-0 ${display.colorClass}`}
          >
            {errorIcon}
          </div>

          <div className="flex-1 min-w-0">
            <CardTitle className="text-base mb-1">{display.title}</CardTitle>
            <CardDescription className="text-sm">
              {error.user_message ?? 'An unexpected error occurred'}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {hasTechnicalDetails && (
          <>
            <Separator />
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle className="text-sm font-medium">Technical Details</AlertTitle>
              <AlertDescription>
                <code className="block text-xs mt-2 font-mono bg-muted/60 p-2.5 rounded leading-relaxed break-all">
                  {error.error_message}
                </code>
              </AlertDescription>
            </Alert>
          </>
        )}

        {showAlternativeInstances && (
          <>
            <Separator />
            <InstanceSuggestions
              selectedInstanceId={selectedInstanceId}
              availableInstanceIds={availableInstanceIds}
              onSelectAlternative={onSelectAlternative!}
            />
          </>
        )}

        <div className="flex items-center justify-end gap-2 flex-wrap pt-1">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Dismiss
          </Button>
          {canChangeInstance && (
            <Button variant="outline" size="sm" onClick={onChangeInstance}>
              Change Instance
            </Button>
          )}
          {isRetryable && (
            <Button size="sm" onClick={onRetry} className="gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" />
              Retry
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
