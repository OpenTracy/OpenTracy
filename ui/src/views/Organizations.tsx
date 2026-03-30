import { useState, useCallback, useMemo } from 'react';
import { AnimatePresence } from 'framer-motion';

import type { UserOrganization } from '../hooks/useOrganizations';
import { useOrganizations } from '../hooks/useOrganizations';
import { useOrganizationInvites as useInvites } from '../hooks/useInvites';
import { useUser } from '../contexts/UserContext';

import CreateOrganizationModal from '../components/Organizations/Modals/CreateOrganizationModal';
import EditOrganizationModal from '../components/Organizations/Modals/EditOrganizationModal';
import DeleteOrganizationModal from '../components/Organizations/Modals/DeleteOrganizationModal';
import LeaveOrganizationModal from '../components/Organizations/Modals/LeaveOrganizationModal';

import OrganizationList from '../components/Organizations/OrganizationList';
import InvitationsList from '../components/Organizations/InvitationsList';
import Tabs from '../components/Organizations/Tabs';
import ErrorBox from '../components/Organizations/ErrorBox';
import OrganizationsHeader from '../components/Organizations/OrganizationHeader';
import { SearchBar } from '../components/shared/SearchBar';

function LoadingView({ message }: { message: string }) {
  return (
    <div className="p-12 text-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-border mx-auto mb-4" />
      <p className="text-foreground-muted">{message}</p>
    </div>
  );
}

type ModalState = {
  create: boolean;
  edit: UserOrganization | null;
  delete: UserOrganization | null;
  leave: UserOrganization | null;
};

type TabType = 'my-orgs' | 'invites';

export default function Organizations() {
  const { loading: userLoading } = useUser();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('my-orgs');
  const [modalState, setModalState] = useState<ModalState>({
    create: false,
    edit: null,
    delete: null,
    leave: null,
  });

  const {
    organizations,
    creating,
    updating,
    deleting,
    leaving,
    loading: orgsLoading,
    error: orgsError,
    searchOrganizations,
    createOrganization,
    updateOrganization,
    deleteOrganization,
    leaveOrganization,
    clearError,
  } = useOrganizations();

  const {
    pendingInvites,
    accepting,
    rejecting,
    acceptInvite,
    acceptError,
    rejectInvite,
    rejectError,
    clearErrors: clearInviteErrors,
  } = useInvites();

  const filteredOrgs = useMemo(
    () => searchOrganizations(searchQuery),
    [searchOrganizations, searchQuery]
  );

  const filteredInvites = useMemo(
    () =>
      searchQuery
        ? pendingInvites.filter((invite) =>
            invite.organization.name.toLowerCase().includes(searchQuery.toLowerCase())
          )
        : pendingInvites,
    [pendingInvites, searchQuery]
  );

  const hasPendingInvites = filteredInvites.length > 0;

  const allErrors = useMemo(
    () => [orgsError, acceptError, rejectError].filter(Boolean),
    [orgsError, acceptError, rejectError]
  );

  const closeModal = useCallback((key: keyof ModalState) => {
    setModalState((prev) => ({
      ...prev,
      [key]: key === 'create' ? false : null,
    }));
  }, []);

  const openModal = useCallback((key: keyof ModalState, value?: UserOrganization) => {
    setModalState((prev) => ({
      ...prev,
      [key]: key === 'create' ? true : value || null,
    }));
  }, []);

  const handleOrgAction = useCallback(
    async (modalKey: keyof ModalState, action: () => Promise<any>) => {
      try {
        await action();
        closeModal(modalKey);
      } catch (err) {
        console.error('Error handling organization action:', err);
      }
    },
    [closeModal]
  );

  const handleCreate = useCallback(
    async (name: string) => {
      return handleOrgAction('create', () => createOrganization({ name }));
    },
    [handleOrgAction, createOrganization]
  );

  const handleEdit = useCallback(
    async (id: string, name: string) => {
      return handleOrgAction('edit', () => updateOrganization(id, name));
    },
    [handleOrgAction, updateOrganization]
  );

  const handleDelete = useCallback(async () => {
    const org = modalState.delete;
    if (!org) return;
    return handleOrgAction('delete', () => deleteOrganization(org.id));
  }, [modalState.delete, handleOrgAction, deleteOrganization]);

  const handleLeave = useCallback(async () => {
    const org = modalState.leave;
    if (!org?.membershipId) return;
    return handleOrgAction('leave', () => leaveOrganization(org.membershipId!));
  }, [modalState.leave, handleOrgAction, leaveOrganization]);

  const handleAcceptInvite = useCallback(
    async (inviteId: string) => {
      try {
        await acceptInvite(inviteId);
        setActiveTab('my-orgs');
      } catch (err) {
        console.error('Error accepting invite:', err);
      }
    },
    [acceptInvite]
  );

  const handleRejectInvite = useCallback(
    async (inviteId: string) => {
      try {
        await rejectInvite(inviteId);
        setActiveTab('my-orgs');
      } catch (err) {
        console.error('Error rejecting invite:', err);
      }
    },
    [rejectInvite]
  );

  const clearAllErrors = useCallback(() => {
    clearError();
    clearInviteErrors();
  }, [clearError, clearInviteErrors]);

  const handleCreateClick = useCallback(() => {
    openModal('create');
  }, [openModal]);

  const handleEditClick = useCallback(
    (org: UserOrganization) => {
      openModal('edit', org);
    },
    [openModal]
  );

  const handleDeleteClick = useCallback(
    (org: UserOrganization) => {
      openModal('delete', org);
    },
    [openModal]
  );

  const handleLeaveClick = useCallback(
    (org: UserOrganization) => {
      openModal('leave', org);
    },
    [openModal]
  );

  const handleTabChange = useCallback((tab: TabType) => {
    setActiveTab(tab);
  }, []);

  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  if (userLoading) {
    return <LoadingView message="Loading user data..." />;
  }

  return (
    <div className="min-h-screen bg-background">
      <OrganizationsHeader onCreateClick={handleCreateClick} isCreating={creating} />

      <div className="w-full px-4 sm:px-8 py-8">
        {allErrors.length > 0 && <ErrorBox errors={allErrors} onClear={clearAllErrors} />}

        <Tabs
          activeTab={activeTab}
          setActiveTab={handleTabChange}
          totalOrganizations={organizations.length}
          pendingInvitesCount={pendingInvites.length}
          hasPendingInvites={hasPendingInvites}
        />

        <SearchBar
          value={searchQuery}
          onChange={handleSearchChange}
          placeholder={
            activeTab === 'my-orgs' ? 'Search organizations...' : 'Search invitations...'
          }
          aria-label="Search organizations or invitations"
        />

        <AnimatePresence mode="wait">
          {modalState.create && (
            <CreateOrganizationModal
              key="create"
              visible
              onClose={() => closeModal('create')}
              onSubmit={handleCreate}
              loading={creating}
            />
          )}
          {modalState.edit && (
            <EditOrganizationModal
              key="edit"
              org={modalState.edit}
              onClose={() => closeModal('edit')}
              onSubmit={handleEdit}
              loading={updating}
            />
          )}
          {modalState.delete && (
            <DeleteOrganizationModal
              key="delete"
              orgName={modalState.delete.name}
              visible
              onCancel={() => closeModal('delete')}
              onConfirm={handleDelete}
              loading={deleting}
            />
          )}
          {modalState.leave && (
            <LeaveOrganizationModal
              key="leave"
              orgName={modalState.leave.name}
              visible
              onCancel={() => closeModal('leave')}
              onConfirm={handleLeave}
              loading={leaving}
            />
          )}
        </AnimatePresence>

        {orgsLoading ? (
          <LoadingView message="Loading organizations..." />
        ) : activeTab === 'my-orgs' ? (
          <OrganizationList
            organizations={filteredOrgs}
            onEdit={handleEditClick}
            onDelete={handleDeleteClick}
            onLeave={handleLeaveClick}
          />
        ) : (
          <InvitationsList
            invites={filteredInvites}
            onAccept={handleAcceptInvite}
            onReject={handleRejectInvite}
            loadingAccept={accepting}
            loadingReject={rejecting}
          />
        )}
      </div>
    </div>
  );
}
