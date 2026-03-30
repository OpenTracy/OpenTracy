import { Mail, Inbox } from 'lucide-react';
import InvitationCard from './InvitationCard';
import { formatDate } from './helpers';
import type { OrganizationMember } from '../../hooks/useInvites';

interface Props {
  invites: OrganizationMember[];
  onAccept: (inviteId: string) => void;
  onReject: (inviteId: string) => void;
  loadingAccept: boolean;
  loadingReject: boolean;
}

export default function InvitationsList({
  invites,
  onAccept,
  onReject,
  loadingAccept,
  loadingReject,
}: Props) {
  if (invites.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-surface-hover flex items-center justify-center">
          <Inbox className="w-8 h-8 text-foreground-muted" />
        </div>
        <h3 className="text-lg font-medium text-foreground mb-2">No pending invitations</h3>
        <p className="text-foreground-secondary mb-6">
          When organizations invite you to join, you'll see the invitations here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-5 h-5 rounded bg-surface-hover flex items-center justify-center">
            <Mail className="w-3 h-3 text-foreground-secondary" />
          </div>
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
            Pending invitations ({invites.length})
          </h2>
        </div>
        <div className="bg-surface rounded-lg border border-border divide-y divide-border">
          {invites.map((invitation) => (
            <InvitationCard
              key={invitation.id}
              invitation={invitation}
              onAccept={onAccept}
              onReject={onReject}
              accepting={loadingAccept}
              rejecting={loadingReject}
              formatDate={formatDate}
            />
          ))}
        </div>
      </div>

      {invites.length > 0 && (
        <div className="bg-surface border border-border rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div>
              <h4 className="text-sm font-medium text-foreground mb-1">
                About organization invitations
              </h4>
              <p className="text-sm text-foreground-secondary">
                Accepting an invitation will give you access to the organization and its resources.
                You can always leave an organization later if needed.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
