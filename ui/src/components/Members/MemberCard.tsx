import { Trash2, Crown } from 'lucide-react';
import type { OrganizationMember, User } from '../../hooks/useOrganizationMembers';

interface MemberCardProps {
  member: OrganizationMember | User;
  isOwner: boolean;
  isCurrentUser: boolean;
  canRemove: boolean;
  onRemove?: () => void;
}

export function MemberCard({
  member,
  isOwner,
  isCurrentUser,
  canRemove,
  onRemove,
}: MemberCardProps) {
  return (
    <div className="p-6 hover:bg-surface-hover transition-all duration-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
            <span className="text-accent font-semibold text-sm">
              {member.email.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              {isOwner ? (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-accent/10 text-accent">
                  <Crown className="w-3 h-3" />
                  Owner
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-surface border border-border text-foreground-secondary">
                  {'role' in member && member.role === 'ADMIN' ? 'Admin' : 'Member'}
                </span>
              )}
              {isCurrentUser && <span className="text-xs text-accent font-medium">You</span>}
            </div>
            <p className="text-sm text-foreground-secondary">{member.email}</p>
            {'joinedAt' in member && member.joinedAt && (
              <p className="text-xs text-foreground-muted mt-1">
                Member since {new Date(member.joinedAt).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canRemove && (
            <button
              onClick={onRemove}
              className="p-2 text-foreground-muted hover:text-error hover:bg-error/10 rounded-lg transition-all duration-200"
              title="Remove member"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
