import { CheckCircle, XCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface ResultStat {
  label: string;
  value: number;
  highlight?: boolean;
}

interface ResultCardProps {
  status: 'success' | 'error' | 'warning';
  title: string;
  description?: string;
  stats?: ResultStat[];
}

const STATUS_ICON = {
  success: <CheckCircle className="size-4 text-chart-2" />,
  error: <XCircle className="size-8 text-destructive mx-auto" />,
  warning: <XCircle className="size-8 text-muted-foreground mx-auto" />,
} as const;

export function ResultCard({ status, title, description, stats }: ResultCardProps) {
  if (status !== 'success') {
    return (
      <Card className={status === 'error' ? 'border-destructive' : undefined}>
        <CardContent className="text-center space-y-2 py-4">
          {STATUS_ICON[status]}
          <p className="text-sm font-medium">{title}</p>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-3 py-4">
        <div className="flex items-center gap-2">
          {STATUS_ICON.success}
          <span className="text-sm font-semibold">{title}</span>
        </div>
        {stats && stats.length > 0 && (
          <div className="grid grid-cols-2 gap-3 text-center">
            {stats.map((stat) => (
              <div key={stat.label}>
                <div
                  className={`text-xl font-bold tabular-nums ${stat.highlight ? 'text-primary' : ''}`}
                >
                  {stat.value}
                </div>
                <div className="text-xs text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        )}
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </CardContent>
    </Card>
  );
}
