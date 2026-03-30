import { useState } from 'react';
import { Sparkles, CheckCircle, XCircle, Loader2, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useProposals } from '../../hooks/useProposals';
import type { Proposal, ProposalType, ProposalStatus, ProposalPriority } from '../../types';

const TYPE_LABELS: Record<ProposalType, string> = {
  create_evaluation: 'Run Eval',
  setup_auto_eval: 'Auto Eval',
  create_experiment: 'Compare',
};

const PRIORITY_COLORS: Record<ProposalPriority, string> = {
  high: 'bg-destructive',
  medium: 'bg-amber-500',
  low: 'bg-muted-foreground/40',
};

function StatusBadge({ status }: { status: ProposalStatus }) {
  switch (status) {
    case 'executed':
      return <Badge variant="outline">Executed</Badge>;
    case 'rejected':
      return <Badge variant="secondary">Rejected</Badge>;
    case 'failed':
      return <Badge variant="destructive">Failed</Badge>;
    case 'expired':
      return <Badge variant="secondary">Expired</Badge>;
    default:
      return null;
  }
}

function ProposalRow({
  proposal,
  onApprove,
  onReject,
  isApproving,
}: {
  proposal: Proposal;
  onApprove: () => void;
  onReject: () => void;
  isApproving: boolean;
}) {
  const isPending = proposal.status === 'pending';

  return (
    <div className="flex items-start gap-3 py-2.5 px-1">
      <div className="relative mt-0.5 shrink-0">
        <Sparkles className="size-4 text-muted-foreground" />
        <span
          className={cn(
            'absolute -top-0.5 -right-0.5 size-1.5 rounded-full',
            PRIORITY_COLORS[proposal.priority]
          )}
        />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
          <span className="text-xs font-medium">{proposal.title}</span>
          <Badge variant="secondary">{TYPE_LABELS[proposal.proposal_type]}</Badge>
          {!isPending && <StatusBadge status={proposal.status} />}
        </div>
        <p className="text-xs text-muted-foreground line-clamp-1">{proposal.description}</p>
      </div>

      {isPending && (
        <TooltipProvider delayDuration={150}>
          <div className="flex items-center gap-0.5 shrink-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-primary hover:text-primary hover:bg-primary/10"
                  onClick={onApprove}
                  disabled={isApproving}
                >
                  {isApproving ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <CheckCircle className="size-3.5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Approve</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={onReject} disabled={isApproving}>
                  <XCircle className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Dismiss</TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      )}
    </div>
  );
}

export function ProposalsPanel() {
  const { proposals, loading, pendingCount, approveProposal, rejectProposal, refresh } =
    useProposals();
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const sorted = [...proposals].sort((a, b) => {
    if (a.status === 'pending' && b.status !== 'pending') return -1;
    if (a.status !== 'pending' && b.status === 'pending') return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const handleApprove = async (proposal: Proposal) => {
    setApprovingId(proposal.id);
    try {
      await approveProposal(proposal.id);
    } finally {
      setApprovingId(null);
    }
  };

  if (proposals.length === 0 && !loading) return null;

  return (
    <Card className="gap-2">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-muted-foreground" />
            <CardTitle>AI Proposals</CardTitle>
            {pendingCount > 0 && <Badge className="text-xs px-1.5 h-4">{pendingCount}</Badge>}
          </div>
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={refresh} disabled={loading}>
                  <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>

      <CardContent>
        {sorted.map((proposal) => (
          <div key={proposal.id} className="rounded-lg border bg-muted/30 px-3 py-2.5">
            <ProposalRow
              proposal={proposal}
              onApprove={() => handleApprove(proposal)}
              onReject={() => rejectProposal(proposal.id)}
              isApproving={approvingId === proposal.id}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
