import { useState, useCallback, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';

import type { OrganizationMember } from '../hooks/useOrganizationMembers';
import { useOrganizationMembers } from '../hooks/useOrganizationMembers';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useUser } from '../contexts/UserContext';

import InviteMemberModal from '../components/Members/Modals/InviteMemberModal';
import RemoveMemberModal from '../components/Members/Modals/RemoveMemberModal';

import MembersHeader from '../components/Members/MembersHeader';
import Tabs from '../components/Members/Tabs';
import MembersList from '../components/Members/MembersList';
import InvitationsList from '../components/Members/InvitationsList';
import ErrorBox from '../components/Members/ErrorBox';
import { SearchBar } from '../components/shared/SearchBar';

type ActiveTab = 'members' | 'invitations';

type ModalState = {
  invite: boolean;
  deleteInvite: OrganizationMember | null;
  removeMember: OrganizationMember | null;
};

export default function Members() {
  const { user } = useUser();
  const { currentWorkspace } = useWorkspace();

  const [orgMembers, setOrgMembers] = useState<{
    activeMembers: OrganizationMember[];
    pendingInvites: OrganizationMember[];
  }>({ activeMembers: [], pendingInvites: [] });

  const [modalState, setModalState] = useState<ModalState>({
    invite: false,
    deleteInvite: null,
    removeMember: null,
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<ActiveTab>('members');

  const {
    members,
    owner,
    getMembersByStatus,
    loading,
    error,
    searchMembers,
    addMemberToOrganization,
    deleteMember,
    creating,
    deleting,
    clearError,
  } = useOrganizationMembers();

  useEffect(() => {
    if (!loading) {
      const activeMembers = getMembersByStatus('ACTIVE');
      const pendingInvites = getMembersByStatus('PENDING');
      setOrgMembers({ activeMembers, pendingInvites });
    }
  }, [loading, members]);

  const isOrganization = currentWorkspace?.type === 'organization';
  const organizationId = isOrganization ? currentWorkspace.id : null;

  const filteredActiveMembers = searchQuery
    ? searchMembers(searchQuery, 'ACTIVE')
    : orgMembers.activeMembers;

  const filteredInvites = searchQuery
    ? searchMembers(searchQuery, 'PENDING')
    : orgMembers.pendingInvites;

  const closeModal = (key: keyof ModalState) => {
    setModalState((prev) => ({ ...prev, [key]: key === 'invite' ? false : null }));
  };

  const handleMemberAction = async (modalKey: keyof ModalState, action: () => Promise<boolean>) => {
    try {
      const success = await action();
      if (success) closeModal(modalKey);
    } catch (err) {
      console.error(`Error in ${modalKey} action, err`);
    }
  };

  const handleInvite = useCallback(
    (email: string, role: 'ADMIN' | 'MEMBER') => {
      if (!organizationId || !user) return Promise.resolve(false);
      return handleMemberAction('invite', () => addMemberToOrganization(email, role, user.id));
    },
    [addMemberToOrganization, organizationId, user]
  );

  const handleDeleteInvite = useCallback(() => {
    const invite = modalState.deleteInvite;
    if (!invite || !organizationId) return;
    return handleMemberAction('deleteInvite', () => deleteMember(invite.id));
  }, [modalState.deleteInvite, deleteMember, organizationId]);

  const handleRemoveMember = useCallback(() => {
    const member = modalState.removeMember;
    if (!member || !organizationId) return;
    return handleMemberAction('removeMember', () => deleteMember(member.id));
  }, [modalState.removeMember, deleteMember, organizationId]);

  if (!isOrganization) {
    return (
      <div className="w-full px-4 sm:px-8 py-8">
        <div className="bg-surface border border-border rounded-xl p-8 text-center">
          <h3 className="text-lg font-semibold text-foreground mb-2">Personal Workspace</h3>
          <p className="text-foreground-secondary">
            Team management is only available for organization workspaces.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <MembersHeader
        workspaceName={currentWorkspace?.name}
        userRole={currentWorkspace?.role}
        isOwner={currentWorkspace?.isOwner}
        canInvite={currentWorkspace?.isOwner || currentWorkspace?.role === 'ADMIN'}
        onInviteClick={() => setModalState((prev) => ({ ...prev, invite: true }))}
        inviting={creating}
      />

      <div className="w-full px-4 sm:px-8 py-8">
        <ErrorBox errors={[error]} onClear={clearError} />

        <Tabs
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          membersCount={filteredActiveMembers.length + (owner ? 1 : 0)}
          invitationsCount={filteredInvites.length}
          canInvite={currentWorkspace?.isOwner || currentWorkspace?.role === 'ADMIN'}
        />

        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder={activeTab === 'members' ? 'Search members...' : 'Search invitations...'}
          aria-label="Search organizations or invitations"
        />

        <AnimatePresence>
          {modalState.invite && (
            <InviteMemberModal
              visible
              onClose={() => closeModal('invite')}
              onSubmit={handleInvite}
              loading={creating}
            />
          )}
          {modalState.deleteInvite && (
            <RemoveMemberModal
              memberName={modalState.deleteInvite.email}
              type="INVITE"
              orgName={currentWorkspace?.name || ''}
              visible
              onCancel={() => closeModal('deleteInvite')}
              onConfirm={handleDeleteInvite}
              loading={deleting}
            />
          )}
          {modalState.removeMember && (
            <RemoveMemberModal
              memberName={modalState.removeMember.email}
              type="MEMBER"
              orgName={currentWorkspace?.name || ''}
              visible
              onCancel={() => closeModal('removeMember')}
              onConfirm={handleRemoveMember}
              loading={deleting}
            />
          )}
        </AnimatePresence>

        {activeTab === 'members' ? (
          <MembersList
            members={filteredActiveMembers}
            owner={owner}
            loading={loading}
            isOwner={currentWorkspace?.isOwner}
            currentUserId={user?.id}
            onDelete={(member) => setModalState((prev) => ({ ...prev, removeMember: member }))}
          />
        ) : (
          <InvitationsList
            invites={filteredInvites}
            loading={loading}
            rejecting={deleting}
            onDelete={(invite) => setModalState((prev) => ({ ...prev, deleteInvite: invite }))}
          />
        )}
      </div>
    </div>
  );
}
