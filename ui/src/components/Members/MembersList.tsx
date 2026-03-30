import { User as UserIcon, Users } from 'lucide-react';
import type { OrganizationMember, User } from '../../hooks/useOrganizationMembers';
import { MemberCard } from './MemberCard';

interface MembersListProps {
  members: OrganizationMember[];
  owner: User | null;
  loading: boolean;
  isOwner?: boolean;
  currentUserId?: string;
  onDelete: (member: OrganizationMember) => void;
}

export default function MembersList({
  members,
  owner,
  loading,
  isOwner,
  currentUserId,
  onDelete,
}: MembersListProps) {
  if (loading) {
    return (
      <div className="p-12 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent mx-auto mb-4" />
        <p className="text-foreground-secondary">Loading members...</p>
      </div>
    );
  }

  if (members.length === 0 && !owner) {
    return (
      <div className="p-12 text-center">
        <UserIcon className="w-12 h-12 text-foreground-muted mx-auto mb-4" />
        <p className="text-foreground-secondary font-medium">No members found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {members && owner && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-5 h-5 rounded bg-surface-hover flex items-center justify-center">
              <Users className="w-3 h-3 text-foreground-secondary" />
            </div>
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
              Members ({members.length + 1})
            </h2>
          </div>
          <div className="bg-surface rounded-lg border border-border divide-y divide-border">
            <MemberCard
              member={owner}
              isOwner={true}
              isCurrentUser={owner.id === currentUserId}
              canRemove={false}
            />
            {members.map((member) => {
              const isCurrentUser = member.userId === currentUserId;
              const canRemove = (isOwner || member.role === 'ADMIN') && !isCurrentUser;

              return (
                <MemberCard
                  key={member.id}
                  member={member}
                  isOwner={false}
                  isCurrentUser={isCurrentUser}
                  canRemove={canRemove}
                  onRemove={() => {
                    if (canRemove && member.id) onDelete(member);
                  }}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
