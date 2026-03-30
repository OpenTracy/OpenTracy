import { useCallback, useEffect, useRef, useState } from 'react';
import type { Schema } from '../../amplify/data/resource';
import { useWorkspace } from '../contexts/WorkspaceContext';
import type { MemberStatus } from '../types/memberStatus';
import { getAmplifyClient } from '@/lib/amplifyClient';

export type OrganizationMember = NonNullable<Schema['OrganizationMembers']['type']>;
export type User = NonNullable<Schema['Users']['type']>;
export type Organization = NonNullable<Schema['Organizations']['type']>;
type UpdateInput = Schema['OrganizationMembers']['updateType'];

interface UseOrganizationMembersState {
  members: OrganizationMember[];
  owner: User | null;
  loading: boolean;
  creating: boolean;
  updating: boolean;
  deleting: boolean;
  error: string | null;
}

export const useOrganizationMembers = () => {
  const { currentWorkspace, loading: workspaceLoading } = useWorkspace();
  const organizationId = currentWorkspace?.type === 'organization' ? currentWorkspace.id : null;

  const subscriptionsRef = useRef<{ members?: any; organization?: any }>({});
  const isInitializedRef = useRef(false);

  const membersMapRef = useRef<Map<string, OrganizationMember>>(new Map());
  const organizationRef = useRef<Organization | null>(null);
  const ownerRef = useRef<User | null>(null);

  const [state, setState] = useState<UseOrganizationMembersState>({
    members: [],
    owner: null,
    loading: true,
    creating: false,
    updating: false,
    deleting: false,
    error: null,
  });

  const setPartialState = useCallback((partial: Partial<UseOrganizationMembersState>) => {
    setState((prev) => ({ ...prev, ...partial }));
  }, []);

  const createMembersList = useCallback((): OrganizationMember[] => {
    return Array.from(membersMapRef.current.values());
  }, []);

  const loadOwnerData = useCallback(
    async (organization: Organization) => {
      if (!organization.ownerId) return;

      try {
        const ownerResponse = await getAmplifyClient().models.Users.get({
          id: organization.ownerId,
        });
        if (ownerResponse.data) {
          ownerRef.current = ownerResponse.data;
          setPartialState({ owner: ownerResponse.data });
        }
      } catch (err) {
        console.error('Error loading organization owner:', err);
        setPartialState({ error: 'Error loading organization owner' });
      }
    },
    [setPartialState]
  );

  const loadInitialData = useCallback(async () => {
    if (!organizationId || workspaceLoading || isInitializedRef.current) return;

    try {
      setPartialState({ loading: true, error: null });

      type ObservableSubscribe<T> = {
        subscribe: (handlers: {
          next: (data: { items: T[]; isSynced: boolean }) => void;
          error: (err: Error) => void;
        }) => { unsubscribe: () => void };
      };

      const membersSub = (
        getAmplifyClient().models.OrganizationMembers.observeQuery({
          filter: { organizationId: { eq: organizationId } },
        }) as unknown as ObservableSubscribe<OrganizationMember>
      ).subscribe({
        next: ({ items, isSynced }: { items: OrganizationMember[]; isSynced: boolean }) => {
          membersMapRef.current.clear();
          items.forEach((member: OrganizationMember) => {
            membersMapRef.current.set(member.id, member);
          });

          if (isSynced) {
            const membersList = createMembersList();
            setPartialState({ members: membersList, loading: false });
          }
        },
        error: (err: Error) => {
          console.error('Error observing organization members:', err);
          setPartialState({ error: 'Error loading organization members', loading: false });
        },
      });

      const organizationSub = (
        getAmplifyClient().models.Organizations.observeQuery({
          filter: { id: { eq: organizationId } },
        }) as unknown as ObservableSubscribe<Organization>
      ).subscribe({
        next: ({ items }: { items: Organization[] }) => {
          const organization = items[0];
          if (organization) {
            organizationRef.current = organization;

            if (organization.ownerId && organization.ownerId !== ownerRef.current?.id) {
              loadOwnerData(organization);
            }
          }
        },
        error: (err: Error) => {
          console.error('Error observing organization:', err);
          setPartialState({ error: 'Error loading organization data' });
        },
      });

      subscriptionsRef.current = {
        members: membersSub,
        organization: organizationSub,
      };
      isInitializedRef.current = true;
    } catch (err) {
      console.error('Error setting up organization members subscriptions:', err);
      setPartialState({
        error: 'Error loading organization members',
        loading: false,
      });
    }
  }, [organizationId, workspaceLoading, createMembersList, loadOwnerData, setPartialState]);

  useEffect(() => {
    if (workspaceLoading || !organizationId) return;

    if (subscriptionsRef.current.members) {
      subscriptionsRef.current.members.unsubscribe();
    }
    if (subscriptionsRef.current.organization) {
      subscriptionsRef.current.organization.unsubscribe();
    }

    membersMapRef.current.clear();
    organizationRef.current = null;
    ownerRef.current = null;
    isInitializedRef.current = false;

    loadInitialData();

    return () => {
      if (subscriptionsRef.current.members) {
        subscriptionsRef.current.members.unsubscribe();
      }
      if (subscriptionsRef.current.organization) {
        subscriptionsRef.current.organization.unsubscribe();
      }
    };
  }, [workspaceLoading, organizationId, loadInitialData]);

  useEffect(() => {
    if (!organizationId) {
      setState({
        members: [],
        owner: null,
        loading: true,
        creating: false,
        updating: false,
        deleting: false,
        error: null,
      });
      membersMapRef.current.clear();
      organizationRef.current = null;
      ownerRef.current = null;
      isInitializedRef.current = false;
    }
  }, [organizationId]);

  const addMemberToOrganization = useCallback(
    async (
      userEmail: string,
      role: 'ADMIN' | 'MEMBER' = 'MEMBER',
      requesterId: string
    ): Promise<boolean> => {
      if (!organizationId) return false;

      setPartialState({ creating: true, error: null });

      try {
        const response = (await getAmplifyClient().mutations.addUserToOrganization({
          organizationId,
          requesterId,
          userEmail,
          role,
        })) as { data?: any; errors?: any[] };

        if (response.errors) {
          throw new Error(JSON.stringify(response.errors));
        }

        if (response.data) {
          setPartialState({ creating: false });
          return true;
        }

        return false;
      } catch (err) {
        setPartialState({
          creating: false,
          error: err instanceof Error ? err.message : 'Failed to add member to organization',
        });
        return false;
      }
    },
    [organizationId, setPartialState]
  );

  const updateMember = useCallback(
    async (id: string, updates: Partial<UpdateInput>): Promise<boolean> => {
      setPartialState({ updating: true, error: null });

      try {
        const response = await getAmplifyClient().models.OrganizationMembers.update({
          id,
          ...updates,
        });

        if (response.errors) {
          throw new Error(JSON.stringify(response.errors));
        }

        if (response.data) {
          setPartialState({ updating: false });
          return true;
        }

        return false;
      } catch (err) {
        setPartialState({
          updating: false,
          error: err instanceof Error ? err.message : 'Failed to update member',
        });
        return false;
      }
    },
    [setPartialState]
  );

  const deleteMember = useCallback(
    async (id: string): Promise<boolean> => {
      setPartialState({ deleting: true, error: null });

      try {
        const response = await getAmplifyClient().models.OrganizationMembers.delete({ id });

        if (response.errors) {
          throw new Error(JSON.stringify(response.errors));
        }

        if (response.data) {
          setPartialState({ deleting: false });
          return true;
        }

        return false;
      } catch (err) {
        setPartialState({
          deleting: false,
          error: err instanceof Error ? err.message : 'Failed to delete member',
        });
        return false;
      }
    },
    [setPartialState]
  );

  const getMembersByStatus = useCallback(
    (status: keyof typeof MemberStatus) =>
      state.members.filter((member) => member.status === status),
    [state.members]
  );

  const getMembersByRole = useCallback(
    (role: 'ADMIN' | 'MEMBER') => state.members.filter((member) => member.role === role),
    [state.members]
  );

  const searchMembers = useCallback(
    (query: string, status?: keyof typeof MemberStatus) => {
      const q = query.toLowerCase().trim();
      if (!q && !status) return state.members;

      return state.members.filter((member) => {
        const matchesQuery =
          !q || member.email.toLowerCase().includes(q) || member.role?.toLowerCase().includes(q);
        const matchesStatus = !status || member.status === status;

        return matchesQuery && matchesStatus;
      });
    },
    [state.members]
  );

  const getMemberByEmail = useCallback(
    (email: string) => state.members.find((member) => member.email === email),
    [state.members]
  );

  const getMemberById = useCallback((id: string) => membersMapRef.current.get(id), []);

  const clearError = useCallback(() => {
    setPartialState({ error: null });
  }, [setPartialState]);

  return {
    ...state,
    addMemberToOrganization,
    updateMember,
    deleteMember,
    clearError,
    getMembersByStatus,
    getMembersByRole,
    getMemberByEmail,
    getMemberById,
    searchMembers,
  };
};
