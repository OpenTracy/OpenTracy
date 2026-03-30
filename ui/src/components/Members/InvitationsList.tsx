import { Mail, X } from 'lucide-react';
import type { OrganizationMember } from '../../hooks/useOrganizationMembers';

interface InvitationsListProps {
  invites: OrganizationMember[];
  loading: boolean;
  rejecting: boolean;
  onDelete: (member: OrganizationMember) => void;
}

export default function InvitationsList({
  invites,
  loading,
  rejecting,
  onDelete,
}: InvitationsListProps) {
  if (loading) {
    return (
      <div className="p-12 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent mx-auto mb-4" />
        <p className="text-foreground-secondary">Loading invitations...</p>
      </div>
    );
  }

  if (invites.length === 0) {
    return (
      <div className="p-12 text-center">
        <Mail className="w-12 h-12 text-foreground-muted mx-auto mb-4" />
        <p className="text-foreground-secondary font-medium">No pending invitations.</p>
        <p className="text-foreground-muted text-sm mt-1">
          Send an invitation to add new members to your team.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-lg shadow-sm border border-border divide-y divide-border">
      {invites.map((invite) => (
        <div key={invite.id} className="p-6 hover:bg-surface-hover transition-all duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="font-semibold text-foreground">{invite.email}</h3>
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-surface-hover text-foreground-secondary">
                    Pending
                  </span>
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-surface border border-border text-foreground-secondary">
                    {invite.role === 'ADMIN' ? 'Admin' : 'Member'}
                  </span>
                </div>
                <p className="text-sm text-foreground-secondary">
                  Invited: {new Date(invite.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
            <button
              onClick={() => onDelete(invite)}
              disabled={rejecting}
              className="p-2 text-foreground-muted hover:text-error hover:bg-error/10 rounded-lg transition-all duration-200 disabled:opacity-50"
              title="Cancel invitation"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
