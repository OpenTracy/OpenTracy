import { useState } from 'react';
import { ChevronRight, FileCode, Settings, Trash2 } from 'lucide-react';
import Editor from '@monaco-editor/react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Item, ItemContent, ItemTitle, ItemDescription, ItemActions } from '@/components/ui/item';
import { cn } from '@/lib/utils';
import type { EvaluationMetric } from '../../types/evaluationsTypes';
import { METRIC_TYPE_INFO } from './constants';
import { handleEditorWillMount } from './monacoTheme';

interface MetricRowProps {
  metric: EvaluationMetric;
  onDelete: (id: string) => void;
}

export function MetricRow({ metric, onDelete }: MetricRowProps) {
  const [expanded, setExpanded] = useState(false);
  const typeInfo = METRIC_TYPE_INFO[metric.type];
  const config = metric.config ?? {};
  const hasConfig = Object.keys(config).length > 0;

  const configEntries: { label: string; value: React.ReactNode }[] = [];

  if (config.ignore_case !== undefined)
    configEntries.push({ label: 'Ignore Case', value: config.ignore_case ? 'Yes' : 'No' });
  if (config.ignore_whitespace !== undefined)
    configEntries.push({
      label: 'Ignore Whitespace',
      value: config.ignore_whitespace ? 'Yes' : 'No',
    });
  if (config.normalize !== undefined)
    configEntries.push({ label: 'Normalize Text', value: config.normalize ? 'Yes' : 'No' });
  if (config.all_must_match !== undefined)
    configEntries.push({ label: 'All Must Match', value: config.all_must_match ? 'Yes' : 'No' });
  if (config.model || config.embedding_model)
    configEntries.push({
      label: 'Embedding Model',
      value: (
        <Badge variant="outline" className="font-mono text-xs">
          {(config.model || config.embedding_model) as string}
        </Badge>
      ),
    });
  if (config.threshold || config.similarity_threshold)
    configEntries.push({
      label: 'Similarity Threshold',
      value: `${((config.threshold || config.similarity_threshold) as number) * 100}%`,
    });
  if (config.judge_model)
    configEntries.push({
      label: 'Judge Model',
      value: (
        <span className="font-mono text-xs text-foreground">{config.judge_model as string}</span>
      ),
    });
  if (config.scale) {
    const s = config.scale as { min: number; max: number };
    configEntries.push({ label: 'Rating Scale', value: `${s.min} – ${s.max}` });
  }
  if (config.max_acceptable !== undefined)
    configEntries.push({
      label: 'Max Acceptable',
      value: metric.type === 'latency' ? `${config.max_acceptable}s` : `$${config.max_acceptable}`,
    });

  return (
    <TooltipProvider delayDuration={150}>
      <Collapsible open={expanded} onOpenChange={setExpanded} asChild>
        <div className="rounded-lg border border-border bg-card">
          {/* Header row */}
          <CollapsibleTrigger asChild>
            <Item size="sm" className="cursor-pointer hover:bg-accent border-0 rounded-lg">
              <ChevronRight
                className={cn(
                  'size-4 text-muted-foreground shrink-0 transition-transform duration-200',
                  expanded && 'rotate-90'
                )}
              />

              <ItemContent>
                <ItemTitle>
                  {metric.name}
                  <Badge variant="outline" className="px-1.5 text-muted-foreground">
                    {typeInfo?.label ?? metric.type}
                  </Badge>
                  <Badge variant="outline" className="px-1.5 text-muted-foreground">
                    {metric.is_builtin ? 'Built-in' : 'Custom'}
                  </Badge>
                </ItemTitle>

                <ItemDescription className="text-xs">
                  <span className="text-muted-foreground">{metric.description}</span>
                </ItemDescription>
              </ItemContent>

              <ItemActions onClick={(e) => e.stopPropagation()}>
                {!metric.is_builtin && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 hover:text-destructive"
                        onClick={() => onDelete(metric.metric_id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Delete</TooltipContent>
                  </Tooltip>
                )}
              </ItemActions>
            </Item>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="px-5 pb-5 space-y-4">
              {/* How it works */}
              {typeInfo?.description && (
                <section className="space-y-1.5">
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    How it works
                  </h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {typeInfo.description}
                  </p>
                </section>
              )}

              {/* Metric ID */}
              <section className="space-y-1.5">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Metric ID
                </h4>
                <Badge variant="outline" className="font-mono text-xs">
                  {metric.metric_id}
                </Badge>
              </section>

              {/* Configuration */}
              {hasConfig && configEntries.length > 0 && (
                <section className="space-y-3">
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                    <Settings className="size-3.5" />
                    Configuration
                  </h4>

                  <div className="rounded-md border divide-y">
                    {configEntries.map(({ label, value }) => (
                      <div
                        key={label}
                        className="flex items-center justify-between px-3 py-2 text-xs"
                      >
                        <span className="text-muted-foreground font-medium">{label}</span>
                        <span className="tabular-nums font-medium text-foreground">{value}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Criteria */}
              {config.criteria && (config.criteria as string[]).length > 0 && (
                <section className="space-y-1.5">
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Evaluation Criteria
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {(config.criteria as string[]).map((c) => (
                      <Badge key={c} variant="secondary">
                        {c}
                      </Badge>
                    ))}
                  </div>
                </section>
              )}

              {/* Custom Prompt */}
              {config.prompt_template && (
                <section className="space-y-1.5">
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Prompt Template
                  </h4>
                  <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto whitespace-pre-wrap">
                    {config.prompt_template as string}
                  </pre>
                </section>
              )}

              {/* Python Script */}
              {metric.type === 'python' && metric.python_script && (
                <section className="space-y-1.5">
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                    <FileCode className="size-3.5" />
                    Python Script
                  </h4>
                  <div className="border rounded-lg overflow-hidden">
                    <Editor
                      height="250px"
                      defaultLanguage="python"
                      value={metric.python_script}
                      theme="lunar-dark"
                      beforeMount={handleEditorWillMount}
                      options={{
                        readOnly: true,
                        minimap: { enabled: false },
                        fontSize: 12,
                        lineNumbers: 'on',
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                        tabSize: 4,
                        wordWrap: 'on',
                        padding: { top: 8, bottom: 8 },
                      }}
                    />
                  </div>
                </section>
              )}

              {/* Timestamps */}
              <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
                <span>Created {new Date(metric.created_at).toLocaleString()}</span>
                {metric.updated_at && (
                  <>
                    <span className="text-border">&bull;</span>
                    <span>Updated {new Date(metric.updated_at).toLocaleString()}</span>
                  </>
                )}
              </div>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    </TooltipProvider>
  );
}
