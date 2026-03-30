import { useState } from 'react';
import {
  Copy,
  Clock,
  Zap,
  DollarSign,
  Activity,
  BarChart2,
  Hash,
  AlertCircle,
  X,
  ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

import type { TraceItem } from '@/types/analyticsType';
import { getProviderIconByBackend } from '@/utils/modelUtils';
import { formatLatency, formatCost } from '@/utils/formatUtils';
import { TraceMessagesView } from '@/components/TraceMessages';

interface TraceDetailPanelProps {
  trace: TraceItem;
  onClose: () => void;
}

function formatCompactDate(dateStr: string): string {
  const d = new Date(dateStr);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${month}/${day} ${hours}:${minutes}`;
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2.5 flex items-center gap-2.5">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-muted-foreground leading-none mb-0.5">{label}</p>
        <p className="text-base font-semibold tabular-nums truncate leading-tight">{value}</p>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border last:border-b-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground truncate ml-4 max-w-[65%] text-right tabular-nums">
        {value}
      </span>
    </div>
  );
}

function ExpandableErrorRow({ errorCode }: { errorCode: string }) {
  const [open, setOpen] = useState(false);
  const truncated = errorCode.length > 30 ? errorCode.slice(0, 30) + '…' : errorCode;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="flex items-center justify-between py-2 border-b border-border last:border-b-0">
        <span className="text-sm text-muted-foreground">Error Code</span>
        <div className="flex items-center gap-1.5 ml-4 max-w-[65%] justify-end">
          <span className="text-sm font-medium text-destructive flex items-center gap-1 truncate">
            <AlertCircle className="size-3.5 shrink-0" />
            {truncated}
          </span>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="icon-xs" className="shrink-0 size-5">
              <ChevronDown
                className={`size-3 text-destructive transition-transform ${open ? 'rotate-180' : ''}`}
              />
            </Button>
          </CollapsibleTrigger>
        </div>
      </div>
      <CollapsibleContent>
        <div className="px-2.5 py-2 mb-1 rounded-md bg-destructive/5 border border-destructive/10">
          <p className="text-sm text-destructive/90 font-mono break-all leading-relaxed">
            {errorCode}
          </p>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function ContentBlock({
  label,
  tokenCount,
  content,
}: {
  label: string;
  tokenCount: number;
  content: string;
}) {
  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    toast.success(`${label} copied to clipboard`);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground tabular-nums">
          {tokenCount.toLocaleString()} tokens
        </span>
        <Button variant="ghost" size="sm" className="h-7 text-sm px-2" onClick={handleCopy}>
          <Copy className="size-3 mr-1" />
          Copy
        </Button>
      </div>
      <pre className="rounded-md border border-border bg-muted p-3 text-sm font-mono whitespace-pre-wrap overflow-x-auto leading-relaxed">
        {content || 'No content available'}
      </pre>
    </div>
  );
}

export function TraceDetailPanel({ trace, onClose }: TraceDetailPanelProps) {
  const providerIcon = getProviderIconByBackend(trace.backend, trace.model_id);
  const hasStructuredMessages = !!(trace.input_messages || trace.output_message);

  const handleCopyId = () => {
    navigator.clipboard.writeText(trace.id);
    toast.success('Trace ID copied');
  };

  const defaultAccordionValues = [
    ...(hasStructuredMessages ? ['messages'] : []),
    'input',
    'output',
  ];

  return (
    <Drawer open direction="right" onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="sm:max-w-xl h-full max-h-screen shadow-2xl">
        <DrawerHeader className="px-5 pt-4 pb-3 border-b border-border shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-white p-1">
                <img src={providerIcon} alt={trace.provider} className="size-full object-contain" />
              </div>
              <div className="min-w-0 flex-1">
                <DrawerTitle className="truncate text-lg">{trace.model_id}</DrawerTitle>
                <DrawerDescription className="flex items-center gap-1.5 mt-0.5">
                  {trace.provider}
                  <Badge variant={trace.status === 'Success' ? 'secondary' : 'destructive'}>
                    {trace.status}
                  </Badge>
                  {trace.finish_reason && trace.finish_reason !== 'stop' && (
                    <Badge variant="outline">{trace.finish_reason}</Badge>
                  )}
                </DrawerDescription>
              </div>
            </div>
            <DrawerClose asChild>
              <Button variant="ghost" size="icon-xs" className="shrink-0">
                <X className="size-4" />
              </Button>
            </DrawerClose>
          </div>
          <button
            onClick={handleCopyId}
            className="flex items-center gap-1.5 mt-1.5 group cursor-pointer"
          >
            <code className="text-sm text-muted-foreground font-mono truncate group-hover:text-foreground transition-colors">
              {trace.id}
            </code>
            <Copy className="size-2.5 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
          </button>
        </DrawerHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="p-5 space-y-4">
            <section>
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Performance
              </h3>
              <div className="grid grid-cols-3 gap-1.5">
                <MetricCard icon={Clock} label="Latency" value={formatLatency(trace.latency_s)} />
                <MetricCard icon={Zap} label="TTFT" value={formatLatency(trace.ttft_s)} />
                <MetricCard icon={Activity} label="Tok/s" value={trace.tokens_per_s.toFixed(1)} />
                <MetricCard
                  icon={BarChart2}
                  label="Tokens"
                  value={trace.total_tokens.toLocaleString()}
                />
                <MetricCard icon={DollarSign} label="Cost" value={formatCost(trace.cost_usd)} />
                <MetricCard
                  icon={Hash}
                  label="Created"
                  value={trace.created_at ? formatCompactDate(trace.created_at) : '—'}
                />
              </div>
            </section>

            <Separator />

            <section>
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Content
              </h3>
              <Accordion type="multiple" defaultValue={defaultAccordionValues}>
                {hasStructuredMessages && (
                  <AccordionItem value="messages">
                    <AccordionTrigger className="text-base py-2.5">
                      <span className="flex items-center gap-2">
                        Messages
                        <Badge variant="outline">
                          {(trace.input_messages?.length || 0) + (trace.output_message ? 1 : 0)}{' '}
                          msgs
                        </Badge>
                      </span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <TraceMessagesView
                        inputMessages={trace.input_messages}
                        outputMessage={trace.output_message}
                        finishReason={trace.finish_reason}
                        requestTools={trace.request_tools}
                      />
                    </AccordionContent>
                  </AccordionItem>
                )}

                <AccordionItem value="input">
                  <AccordionTrigger className="text-base py-2.5">
                    <span className="flex items-center gap-2">
                      Input
                      <Badge variant="outline">{trace.input_tokens.toLocaleString()} tok</Badge>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <ContentBlock
                      label="Input"
                      tokenCount={trace.input_tokens}
                      content={trace.input_preview}
                    />
                  </AccordionContent>
                </AccordionItem>

                {trace.history && (
                  <AccordionItem value="history">
                    <AccordionTrigger className="text-base py-2.5">Chat History</AccordionTrigger>
                    <AccordionContent>
                      <pre className="rounded-md border border-border bg-muted p-3 text-sm font-mono whitespace-pre-wrap overflow-x-auto leading-relaxed">
                        {trace.history}
                      </pre>
                    </AccordionContent>
                  </AccordionItem>
                )}

                <AccordionItem value="output">
                  <AccordionTrigger className="text-base py-2.5">
                    <span className="flex items-center gap-2">
                      Output
                      <Badge variant="outline">{trace.output_tokens.toLocaleString()} tok</Badge>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <ContentBlock
                      label="Output"
                      tokenCount={trace.output_tokens}
                      content={
                        trace.output_text || trace.output_message?.content || trace.output_preview
                      }
                    />
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </section>

            <Separator />

            <section>
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Metadata
              </h3>
              <div className="rounded-md border border-border bg-muted px-3">
                <InfoRow label="Model" value={trace.model_id} />
                <InfoRow label="Provider" value={trace.provider} />
                <InfoRow label="Backend" value={trace.backend} />
                <InfoRow
                  label="Created At"
                  value={trace.created_at ? formatCompactDate(trace.created_at) : '—'}
                />
                <InfoRow label="Input Tokens" value={trace.input_tokens.toLocaleString()} />
                <InfoRow label="Output Tokens" value={trace.output_tokens.toLocaleString()} />
                <InfoRow label="Total Tokens" value={trace.total_tokens.toLocaleString()} />
                <InfoRow label="Cost" value={formatCost(trace.cost_usd)} />
                <InfoRow label="Latency" value={formatLatency(trace.latency_s)} />
                <InfoRow label="TTFT" value={formatLatency(trace.ttft_s)} />
                <InfoRow label="Tok/s" value={trace.tokens_per_s.toFixed(2)} />
                <InfoRow label="Finish Reason" value={trace.finish_reason || 'stop'} />
                {trace.deployment_id && <InfoRow label="Deployment" value={trace.deployment_id} />}
                {trace.error_code && <ExpandableErrorRow errorCode={trace.error_code} />}
              </div>
            </section>
          </div>
        </ScrollArea>
      </DrawerContent>
    </Drawer>
  );
}
