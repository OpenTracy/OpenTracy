import { Zap, FileSpreadsheet, FileText, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

type SourceType = 'instruction' | 'auto_collected' | 'imported' | 'manual' | 'synthetic';

const SOURCE_CONFIG: Record<
  SourceType,
  {
    icon: typeof Zap;
    label: string;
    variant: 'default' | 'secondary' | 'outline' | 'destructive';
  }
> = {
  instruction: { icon: Zap, label: 'Auto Collect', variant: 'default' },
  auto_collected: { icon: Zap, label: 'Teacher Traces', variant: 'secondary' },
  imported: { icon: FileSpreadsheet, label: 'Imported', variant: 'secondary' },
  manual: { icon: FileText, label: 'Manual', variant: 'outline' },
  synthetic: { icon: Sparkles, label: 'Generated', variant: 'default' },
};

interface SourceBadgeProps {
  source?: string | null;
}

export function SourceBadge({ source }: SourceBadgeProps) {
  const config = SOURCE_CONFIG[(source as SourceType) ?? 'manual'] ?? SOURCE_CONFIG.manual;
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className="gap-1 font-medium">
      <Icon className="size-3" />
      {config.label}
    </Badge>
  );
}
