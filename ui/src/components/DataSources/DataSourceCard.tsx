import { Plus, Trash2, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type StatusType = 'loading' | 'deleting' | 'connected' | 'disconnected';

interface StatusConfig {
  readonly variant: 'default' | 'secondary' | 'destructive' | 'outline';
  readonly text: string;
  readonly className: string;
}

interface DataSourceCardProps {
  readonly name: string;
  /** Icon from @lobehub/icons — .color sub-component used automatically */
  readonly icon: React.ComponentType<any>;
  readonly isConfigured: boolean;
  readonly loading?: boolean;
  readonly deleting?: boolean;
  readonly onEdit: () => void;
  readonly onRemove?: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<StatusType, StatusConfig> = {
  loading: { variant: 'secondary', text: 'Connecting…', className: 'text-muted-foreground' },
  deleting: { variant: 'destructive', text: 'Removing…', className: '' },
  connected: {
    variant: 'outline',
    text: 'Connected',
    className: 'border-emerald-500/30 text-emerald-600 dark:text-emerald-400',
  },
  disconnected: { variant: 'secondary', text: 'Not connected', className: 'text-muted-foreground' },
};

function getStatusType(loading: boolean, deleting: boolean, isConfigured: boolean): StatusType {
  if (loading) return 'loading';
  if (deleting) return 'deleting';
  if (isConfigured) return 'connected';
  return 'disconnected';
}

// ---------------------------------------------------------------------------
// IconContainer
//
// Connected:    bg-primary/10 + border-2 border-primary/35
//               Tinted bg is clearly distinct from muted in both themes —
//               no white-bg hacks needed.
// Disconnected: bg-muted + opacity-70 — communicates "inactive".
// ---------------------------------------------------------------------------

function IconContainer({
  IconComponent,
  isConfigured,
  loading,
  deleting,
}: {
  IconComponent: React.ComponentType<any>;
  isConfigured: boolean;
  loading: boolean;
  deleting: boolean;
}) {
  const ColorIcon: React.ComponentType<any> = (IconComponent as any).color ?? IconComponent;
  const active = isConfigured && !loading && !deleting;

  return (
    <div
      className={cn(
        'w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200 shrink-0',
        active
          ? 'bg-primary/10 border border-primary/50'
          : 'bg-muted border border-border opacity-70 group-hover:opacity-100'
      )}
    >
      <ColorIcon size={26} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// DataSourceCard
// ---------------------------------------------------------------------------

export function DataSourceCard({
  name,
  icon: IconComponent,
  isConfigured,
  loading = false,
  deleting = false,
  onEdit,
  onRemove,
}: DataSourceCardProps) {
  const statusType = getStatusType(loading, deleting, isConfigured);
  const status = STATUS_CONFIG[statusType];
  const isDisabled = loading || deleting;

  return (
    <Card
      className={cn(
        'group transition-all duration-200 hover:shadow-md hover:-translate-y-px',
        isConfigured
          ? 'border-emerald-500/25 dark:border-emerald-500/20 bg-card'
          : 'border-dashed border-border/60 hover:border-border bg-card/50'
      )}
    >
      <CardContent className="p-5">
        {/* Header */}
        <div className="flex items-start gap-3 mb-4">
          <IconContainer
            IconComponent={IconComponent}
            isConfigured={isConfigured}
            loading={loading}
            deleting={deleting}
          />
          <div className="min-w-0 pt-0.5">
            <p className="text-sm font-semibold text-foreground leading-tight mb-1.5">{name}</p>
            <Badge
              variant={status.variant}
              className={cn(
                'text-[10px] h-4 px-1.5 rounded-sm uppercase tracking-wide font-medium',
                status.className
              )}
            >
              {status.text}
            </Badge>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {isConfigured ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={onEdit}
                disabled={isDisabled}
                className="flex-1 h-8 text-xs"
              >
                <Settings className="w-3.5 h-3.5 mr-1.5" />
                Reconfigure
              </Button>
              {onRemove && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onRemove}
                  disabled={isDisabled}
                  className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              )}
            </>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={onEdit}
              disabled={isDisabled}
              className="flex-1 h-8 text-xs border-dashed hover:border-solid"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              {loading ? 'Connecting…' : 'Connect'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
