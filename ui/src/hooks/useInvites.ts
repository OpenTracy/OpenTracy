import { useState, useCallback, useEffect } from 'react';
import type { Schema } from '../../amplify/data/resource';
import { useUser } from '../contexts/UserContext';
import { getAmplifyClient } from '@/lib/amplifyClient';
export type OrganizationMember = NonNullable<Schema['OrganizationMembers']['type']>;

interface UseOrganizationInvitesReturn {
  pendingInvites: OrganizationMember[];
  loading: boolean;
  accepting: boolean;
  rejecting: boolean;
  error: string | null;
  acceptError: string | null;
  rejectError: string | null;
  acceptInvite: (inviteId: string) => Promise<boolean>;
  rejectInvite: (inviteId: string) => Promise<boolean>;
  refresh: () => Promise<void>;
  clearErrors: () => void;
}

export const useOrganizationInvites = (): UseOrganizationInvitesReturn => {
  const { user, loading: userLoading } = useUser();

  const [state, setState] = useState({
    pendingInvites: [] as OrganizationMember[],
    loading: true,
    accepting: false,
    rejecting: false,
    error: null as string | null,
    acceptError: null as string | null,
    rejectError: null as string | null,
  });

  const setPartialState = useCallback((partial: Partial<typeof state>) => {
    setState((prev) => ({ ...prev, ...partial }));
  }, []);

  const fetchPendingInvites = useCallback(async () => {
    if (!user?.id) {
      setPartialState({ loading: false });
      return;
    }

    setPartialState({ loading: true, error: null });

    try {
      const { data } = await getAmplifyClient().models.OrganizationMembers.list({
        filter: {
          userId: { eq: user.id },
          status: { eq: 'PENDING' },
        },
      });

      setPartialState({ pendingInvites: data ?? [], loading: false });
    } catch (err) {
      setPartialState({
        loading: false,
        error: err instanceof Error ? err.message : 'Error loading invites',
      });
    }
  }, [user?.id]);

  const acceptInvite = useCallback(
    async (inviteId: string): Promise<boolean> => {
      if (!user?.email) {
        setPartialState({ acceptError: 'User email is required' });
        return false;
      }

      setPartialState({ accepting: true, acceptError: null });

      try {
        await getAmplifyClient().models.OrganizationMembers.update({
          id: inviteId,
          email: user.email,
          status: 'ACTIVE',
          joinedAt: new Date().toISOString(),
        });

        setPartialState({
          accepting: false,
          pendingInvites: state.pendingInvites.filter((invite) => invite.id !== inviteId),
        });

        return true;
      } catch (err) {
        setPartialState({
          accepting: false,
          acceptError: err instanceof Error ? err.message : 'Error accepting invite',
        });
        return false;
      }
    },
    [user?.email]
  );

  const rejectInvite = useCallback(
    async (inviteId: string): Promise<boolean> => {
      if (!user?.id) {
        setPartialState({ rejectError: 'User ID is required' });
        return false;
      }

      setPartialState({ rejecting: true, rejectError: null });

      try {
        await getAmplifyClient().models.OrganizationMembers.update({
          id: inviteId,
          status: 'INACTIVE',
        });

        setPartialState({
          rejecting: false,
          pendingInvites: state.pendingInvites.filter((invite) => invite.id !== inviteId),
        });

        return true;
      } catch (err) {
        setPartialState({
          rejecting: false,
          rejectError: err instanceof Error ? err.message : 'Error rejecting invite',
        });
        return false;
      }
    },
    [user?.id]
  );

  useEffect(() => {
    if (!user?.email) return;

    const observable = getAmplifyClient().models.OrganizationMembers.observeQuery({
      filter: {
        email: { eq: user.email },
        status: { eq: 'PENDING' },
      },
    }) as unknown as {
      subscribe: (handlers: { next: () => void; error: (err: Error) => void }) => {
        unsubscribe: () => void;
      };
    };
    const subscription = observable.subscribe({
      next: () => fetchPendingInvites(),
      error: (err: Error) => console.error('Invites subscription error:', err),
    });

    return () => subscription.unsubscribe();
  }, [user?.email, fetchPendingInvites]);

  useEffect(() => {
    if (!userLoading && user?.id) {
      fetchPendingInvites();
    }
  }, [userLoading, user?.id, fetchPendingInvites]);

  const clearErrors = useCallback(() => {
    setPartialState({
      error: null,
      acceptError: null,
      rejectError: null,
    });
  }, []);

  return {
    ...state,
    acceptInvite,
    rejectInvite,
    refresh: fetchPendingInvites,
    clearErrors,
  };
};
