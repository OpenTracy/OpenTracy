import { useState } from 'react';
import {
  Timer,
  Loader2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Play,
  Plus,
  Settings,
  ChevronDown,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useAutoEval } from '../../hooks/useAutoEval';
import { useDatasets } from '../../../../hooks/useDatasets';
import { AutoEvalConfigModal } from '../AutoEval/AutoEvalConfigModal';
import type { AutoEvalConfig } from '../../types';

function getScoreColor(score: number): string {
  if (score >= 0.8) return 'text-primary';
  if (score >= 0.6) return 'text-foreground';
  if (score >= 0.4) return 'text-muted-foreground';
  return 'text-destructive';
}

const SCHEDULE_LABELS: Record<string, string> = {
  hourly: 'Hourly',
  daily: 'Daily',
  weekly: 'Weekly',
  on_deploy: 'On Deploy',
};

export function AutoEvalPanel() {
  const { configs, runs, createConfig, updateConfig, triggerRun } = useAutoEval();
  const { datasets } = useDatasets();
  const [editingConfig, setEditingConfig] = useState<AutoEvalConfig | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [runsOpen, setRunsOpen] = useState(false);

  const recentRuns = runs.slice(0, 5);
  const isEmpty = configs.length === 0 && runs.length === 0;
  const enabledCount = configs.filter((c) => c.enabled).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Timer className="size-4 text-muted-foreground" />
            <CardTitle>Continuous Evaluation</CardTitle>
            {configs.length > 0 && (
              <Badge variant="secondary">
                {enabledCount}/{configs.length} active
              </Badge>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowCreate(true)}>
            <Plus />
            New Config
          </Button>
        </div>
        <CardDescription>
          Monitor model quality on a schedule or triggered by deploys
        </CardDescription>
      </CardHeader>

      <CardContent>
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2 rounded-lg border border-dashed">
            <Timer className="size-6 text-muted-foreground/20" />
            <p className="text-sm text-muted-foreground">No configurations</p>
            <p className="text-xs text-muted-foreground/60">
              Set up a schedule to continuously monitor model quality
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-1"
              onClick={() => setShowCreate(true)}
            >
              Create Config
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs h-8">Name</TableHead>
                <TableHead className="text-xs h-8">Schedule</TableHead>
                <TableHead className="text-xs h-8 text-center">Enabled</TableHead>
                <TableHead className="text-xs h-8 text-right">Last Score</TableHead>
                <TableHead className="text-xs h-8 text-right">Models</TableHead>
                <TableHead className="text-xs h-8 text-right">Metrics</TableHead>
                <TableHead className="text-xs h-8 w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {configs.map((config) => (
                <TableRow
                  key={config.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setEditingConfig(config)}
                >
                  <TableCell className="text-xs font-medium py-2.5 max-w-48 truncate">
                    {config.name}
                  </TableCell>
                  <TableCell className="py-2.5">
                    <Badge variant="secondary" className="text-xs">
                      {SCHEDULE_LABELS[config.schedule] ?? config.schedule}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center py-2.5">
                    <Switch
                      checked={config.enabled}
                      onCheckedChange={(checked) => updateConfig(config.id, { enabled: checked })}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </TableCell>
                  <TableCell className="text-right py-2.5">
                    {config.last_run_score != null ? (
                      <span
                        className={cn(
                          'text-xs font-semibold tabular-nums',
                          getScoreColor(config.last_run_score)
                        )}
                      >
                        {(config.last_run_score * 100).toFixed(0)}%
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground tabular-nums py-2.5">
                    {config.models.length}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground tabular-nums py-2.5">
                    {config.metrics.length}
                  </TableCell>
                  <TableCell className="py-2.5">
                    <div
                      className="flex items-center justify-end gap-0.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <TooltipProvider delayDuration={150}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              onClick={() => triggerRun(config.id)}
                            >
                              <Play className="size-3" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Run now</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              onClick={() => setEditingConfig(config)}
                            >
                              <Settings className="size-3" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Edit config</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {recentRuns.length > 0 && (
          <Collapsible open={runsOpen} onOpenChange={setRunsOpen}>
            <Separator />
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="w-full h-8 text-xs text-muted-foreground justify-between mt-1"
              >
                Recent Runs ({recentRuns.length})
                <ChevronDown
                  className={cn('size-3 transition-transform', runsOpen && 'rotate-180')}
                />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs h-7">Config</TableHead>
                    <TableHead className="text-xs h-7">Status</TableHead>
                    <TableHead className="text-xs h-7 text-right">Score</TableHead>
                    <TableHead className="text-xs h-7 text-right">Result</TableHead>
                    <TableHead className="text-xs h-7 text-right">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentRuns.map((run) => {
                    const config = configs.find((c) => c.id === run.config_id);
                    const scoreValues = Object.values(run.scores);
                    const avgScore =
                      scoreValues.length > 0
                        ? scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length
                        : null;

                    return (
                      <TableRow key={run.id}>
                        <TableCell className="text-xs truncate max-w-36 py-2">
                          {config?.name || run.config_id}
                        </TableCell>
                        <TableCell className="py-2">
                          <div className="flex items-center gap-1.5">
                            {run.status === 'running' && (
                              <Loader2 className="size-3 animate-spin text-primary" />
                            )}
                            {run.status === 'completed' && (
                              <CheckCircle className="size-3 text-primary" />
                            )}
                            {run.status === 'failed' && (
                              <XCircle className="size-3 text-destructive" />
                            )}
                            <span className="text-xs text-muted-foreground capitalize">
                              {run.status}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right py-2">
                          {avgScore != null ? (
                            <span
                              className={cn(
                                'text-xs font-medium tabular-nums',
                                getScoreColor(avgScore)
                              )}
                            >
                              {(avgScore * 100).toFixed(0)}%
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right py-2">
                          {run.regression_detected ? (
                            <Badge variant="destructive" className="text-xs">
                              <AlertTriangle className="size-2.5 mr-0.5" />
                              Regression
                            </Badge>
                          ) : run.status === 'completed' ? (
                            <Badge
                              variant="outline"
                              className="text-xs border-primary/30 text-primary"
                            >
                              OK
                            </Badge>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground py-2 tabular-nums">
                          {run.completed_at
                            ? new Date(run.completed_at).toLocaleDateString()
                            : run.status === 'running'
                              ? 'In progress'
                              : '—'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>

      <AutoEvalConfigModal
        open={showCreate || !!editingConfig}
        onClose={() => {
          setShowCreate(false);
          setEditingConfig(null);
        }}
        config={editingConfig}
        datasets={datasets.map((d) => ({ dataset_id: d.id, name: d.name }))}
        onCreate={createConfig}
        onUpdate={updateConfig}
      />
    </Card>
  );
}
