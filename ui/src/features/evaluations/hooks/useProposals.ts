import { useState, useCallback, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { useUser } from '@/contexts/UserContext';
import { useEvaluationsService } from '../api/evaluationsService';
import type { Proposal } from '../types/evaluationsTypes';

function normalizeProposal(p: Record<string, unknown>): Proposal {
  return { ...p, id: (p.proposal_id as string) || (p.id as string) } as Proposal;
}

export function useProposals() {
  const { accessToken } = useUser();
  const service = useEvaluationsService();

  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const res = await service.listProposals(accessToken);
      setProposals((res.proposals || []).map(normalizeProposal));
    } catch (err) {
      console.error('[useProposals] refresh failed:', err);
    } finally {
      setLoading(false);
    }
  }, [accessToken, service]);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;

    setLoading(true);
    service
      .listProposals(accessToken)
      .then((res) => {
        if (!cancelled) setProposals((res.proposals || []).map(normalizeProposal));
      })
      .catch((err) => console.error('[useProposals] load failed:', err))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [accessToken, service]);

  const approveProposal = useCallback(
    async (id: string) => {
      if (!accessToken) return null;
      setProposals((prev) => prev.filter((p) => p.id !== id)); // optimistic
      try {
        const result = await service.approveProposal(accessToken, id);
        toast.success('Proposal approved');
        return result.execution_result;
      } catch (err) {
        console.error('[useProposals] approve failed:', err);
        toast.error('Failed to approve proposal');
        refresh();
        return null;
      }
    },
    [accessToken, service, refresh]
  );

  const rejectProposal = useCallback(
    async (id: string, reason?: string) => {
      if (!accessToken) return;
      setProposals((prev) => prev.filter((p) => p.id !== id)); // optimistic
      try {
        await service.rejectProposal(accessToken, id, reason);
        toast.success('Proposal dismissed');
      } catch (err) {
        console.error('[useProposals] reject failed:', err);
        toast.error('Failed to dismiss proposal');
        refresh();
      }
    },
    [accessToken, service, refresh]
  );

  const pendingCount = useMemo(
    () => proposals.filter((p) => p.status === 'pending').length,
    [proposals]
  );

  return { proposals, loading, pendingCount, approveProposal, rejectProposal, refresh };
}
