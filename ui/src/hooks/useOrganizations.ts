import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useUser } from '../contexts/UserContext';
import type { Schema } from '../../amplify/data/resource';
import { getAmplifyClient } from '@/lib/amplifyClient';

type Organization = NonNullable<Schema['Organizations']['type']>;
type OrganizationMember = NonNullable<Schema['OrganizationMembers']['type']>;
type CreateOrganizationInput = Schema['Organizations']['createType'];

type MembershipRole = 'ADMIN' | 'MEMBER' | 'OWNER';
type MembershipStatus = 'PENDING' | 'ACTIVE' | 'INACTIVE';
export interface UserOrganization extends Organization {
  id: string;
  name: string;
  isOwner: boolean;
  membershipId?: string;
  joinedAt?: Date;
  memberRole?: MembershipRole;
  memberStatus: MembershipStatus;
}

interface UseOrganizationState {
  organizations: UserOrganization[];
  loading: boolean;
  creating: boolean;
  updating: boolean;
  deleting: boolean;
  leaving: boolean;
  error: string | null;
}

export const useOrganizations = () => {
  const { user, loading: userLoading } = useUser();
  const subscriptionsRef = useRef<{ org?: any; member?: any }>({});
  const isInitializedRef = useRef(false);

  const organizationsMapRef = useRef<Map<string, Organization>>(new Map());
  const membershipsMapRef = useRef<Map<string, OrganizationMember>>(new Map());

  const [state, setState] = useState<UseOrganizationState>({
    organizations: [],
    loading: true,
    creating: false,
    updating: false,
    deleting: false,
    leaving: false,
    error: null,
  });

  const setPartialState = useCallback((partial: Partial<UseOrganizationState>) => {
    setState((prev) => ({ ...prev, ...partial }));
  }, []);

  const createUserOrganizations = useCallback((): UserOrganization[] => {
    if (!user) return [];

    const orgsMap = organizationsMapRef.current;
    const membershipsMap = membershipsMapRef.current;
    const userOrgs: UserOrganization[] = [];

    orgsMap.forEach((org) => {
      if (org.ownerId === user.id) {
        userOrgs.push({
          ...org,
          isOwner: true,
          joinedAt: new Date(org.createdAt),
          memberRole: 'OWNER',
          memberStatus: 'ACTIVE',
        });
      }
    });

    membershipsMap.forEach((membership) => {
      if (membership.userId === user.id) {
        const org = orgsMap.get(membership.organizationId!);
        if (org?.name) {
          userOrgs.push({
            ...org,
            isOwner: false,
            membershipId: membership.id,
            joinedAt: membership.joinedAt ? new Date(membership.joinedAt) : undefined,
            memberRole: membership.role as MembershipRole,
            memberStatus: membership.status as MembershipStatus,
            name: org.name,
          });
        }
      }
    });

    return userOrgs;
  }, [user]);

  const loadInitialData = useCallback(async () => {
    if (!user || isInitializedRef.current) return;

    try {
      setPartialState({ loading: true, error: null });

      type ObservableSubscribe<T> = {
        subscribe: (handlers: {
          next: (data: { items: T[]; isSynced: boolean }) => void;
          error: (err: Error) => void;
        }) => { unsubscribe: () => void };
      };

      const orgSub = (
        getAmplifyClient().models.Organizations.observeQuery(
          {}
        ) as unknown as ObservableSubscribe<Organization>
      ).subscribe({
        next: ({ items, isSynced }: { items: Organization[]; isSynced: boolean }) => {
          organizationsMapRef.current.clear();
          items.forEach((org: Organization) => {
            organizationsMapRef.current.set(org.id, org);
          });

          if (isSynced) {
            const userOrgs = createUserOrganizations();
            setPartialState({ organizations: userOrgs, loading: false });
          }
        },
        error: (err: Error) => {
          console.error('Error observing Organizations:', err);
          setPartialState({ error: 'Error loading organizations', loading: false });
        },
      });

      const memberSub = (
        getAmplifyClient().models.OrganizationMembers.observeQuery({
          filter: { userId: { eq: user.id } },
        }) as unknown as ObservableSubscribe<OrganizationMember>
      ).subscribe({
        next: ({ items, isSynced }: { items: OrganizationMember[]; isSynced: boolean }) => {
          membershipsMapRef.current.clear();
          items.forEach((member: OrganizationMember) => {
            membershipsMapRef.current.set(member.id, member);
          });

          if (isSynced) {
            const userOrgs = createUserOrganizations();
            setPartialState({ organizations: userOrgs });
          }
        },
        error: (err: Error) => {
          console.error('Error observing OrganizationMembers:', err);
          setPartialState({ error: 'Error loading memberships' });
        },
      });

      subscriptionsRef.current = { org: orgSub, member: memberSub };
      isInitializedRef.current = true;
    } catch (err) {
      console.error('Error setting up subscriptions:', err);
      setPartialState({
        error: 'Error loading organizations',
        loading: false,
      });
    }
  }, [user, createUserOrganizations, setPartialState]);

  useEffect(() => {
    if (userLoading || !user) return;

    if (subscriptionsRef.current.org) {
      subscriptionsRef.current.org.unsubscribe();
    }
    if (subscriptionsRef.current.member) {
      subscriptionsRef.current.member.unsubscribe();
    }

    organizationsMapRef.current.clear();
    membershipsMapRef.current.clear();
    isInitializedRef.current = false;

    loadInitialData();

    return () => {
      if (subscriptionsRef.current.org) {
        subscriptionsRef.current.org.unsubscribe();
      }
      if (subscriptionsRef.current.member) {
        subscriptionsRef.current.member.unsubscribe();
      }
    };
  }, [userLoading, user, loadInitialData]);

  useEffect(() => {
    if (!user) {
      setState({
        organizations: [],
        loading: true,
        creating: false,
        updating: false,
        deleting: false,
        leaving: false,
        error: null,
      });
      organizationsMapRef.current.clear();
      membershipsMapRef.current.clear();
      isInitializedRef.current = false;
    }
  }, [user]);

  const createOrganization = useCallback(
    async (data: Omit<CreateOrganizationInput, 'ownerId'>) => {
      if (!user) return null;

      setPartialState({ creating: true, error: null });

      try {
        const response = await getAmplifyClient().models.Organizations.create({
          ...data,
          ownerId: user.id,
        });

        if (response.data) {
          setPartialState({ creating: false });
          return response.data;
        }
      } catch (err) {
        setPartialState({
          creating: false,
          error: err instanceof Error ? err.message : 'Failed to create organization',
        });
      }

      return null;
    },
    [user, setPartialState]
  );

  const updateOrganization = useCallback(
    async (id: string, name: string) => {
      setPartialState({ updating: true, error: null });

      try {
        const response = await getAmplifyClient().models.Organizations.update({ id, name });

        if (response.data) {
          setPartialState({ updating: false });
          return response.data;
        }
      } catch (err) {
        setPartialState({
          updating: false,
          error: err instanceof Error ? err.message : 'Failed to update organization',
        });
      }

      return null;
    },
    [setPartialState]
  );

  const deleteOrganization = useCallback(
    async (id: string) => {
      setPartialState({ deleting: true, error: null });

      try {
        const response = await getAmplifyClient().models.Organizations.delete({ id });

        if (response.data) {
          setPartialState({ deleting: false });
          return true;
        }
      } catch (err) {
        setPartialState({
          deleting: false,
          error: err instanceof Error ? err.message : 'Failed to delete organization',
        });
      }

      return false;
    },
    [setPartialState]
  );

  const leaveOrganization = useCallback(
    async (membershipId: string) => {
      setPartialState({ leaving: true, error: null });

      try {
        const response = await getAmplifyClient().models.OrganizationMembers.delete({
          id: membershipId,
        });

        if (response.errors) {
          setPartialState({
            error: 'Error leaving organization: ' + JSON.stringify(response.errors),
            leaving: false,
          });
          return false;
        }

        if (response.data) {
          setPartialState({ leaving: false });
          return true;
        }

        return false;
      } catch (err) {
        setPartialState({
          leaving: false,
          error: err instanceof Error ? err.message : 'Error leaving organization',
        });
        return false;
      }
    },
    [setPartialState]
  );

  const getOwnedOrganizations = useMemo(
    () => state.organizations.filter((org) => org.isOwner),
    [state.organizations]
  );

  const getMemberOrganizations = useMemo(
    () => state.organizations.filter((org) => !org.isOwner),
    [state.organizations]
  );

  const getOrganizationsByRole = useCallback(
    (role: 'ADMIN' | 'MEMBER') => state.organizations.filter((org) => org.memberRole === role),
    [state.organizations]
  );

  const getOrganizationsByStatus = useCallback(
    (status: 'PENDING' | 'ACTIVE' | 'INACTIVE') =>
      state.organizations.filter((org) => org.memberStatus === status),
    [state.organizations]
  );

  const searchOrganizations = useCallback(
    (query: string) => {
      const q = query.toLowerCase().trim();
      if (!q) return state.organizations;

      return state.organizations.filter((org) => org.name.toLowerCase().includes(q));
    },
    [state.organizations]
  );

  const clearError = useCallback(() => {
    setPartialState({ error: null });
  }, [setPartialState]);

  return {
    ...state,
    createOrganization,
    updateOrganization,
    deleteOrganization,
    leaveOrganization,
    getOwnedOrganizations,
    getMemberOrganizations,
    getOrganizationsByRole,
    getOrganizationsByStatus,
    searchOrganizations,
    clearError,
  };
};
