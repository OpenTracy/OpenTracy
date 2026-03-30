import { Check, Mail } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { OrganizationMember } from '../../hooks/useInvites';
import { Button } from '@/components/ui/button';

interface Props {
  invitation: OrganizationMember;
  onAccept: (inviteId: string) => void;
  onReject: (inviteId: string) => void;
  accepting: boolean;
  rejecting: boolean;
  formatDate: (date: string) => string;
}

export default function InvitationCard({
  invitation,
  onAccept,
  onReject,
  accepting,
  rejecting,
  formatDate,
}: Props) {
  const [organizationName, setOrganizationName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadOrganizationName = async () => {
      try {
        setIsLoading(true);
        const orgData = await invitation.organization();
        setOrganizationName(orgData.data?.name || '');
      } catch (error) {
        console.error('Error loading organization:', error);
        setOrganizationName('Organization');
      } finally {
        setIsLoading(false);
      }
    };

    loadOrganizationName();
  }, [invitation.organization]);

  return (
    <div className="p-6 hover:bg-surface-hover transition-all duration-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-32 bg-surface-hover rounded animate-pulse"></div>
                  <div className="h-6 w-16 bg-surface-hover rounded-full animate-pulse"></div>
                </div>
              ) : (
                <>
                  <h3 className="font-semibold text-foreground">{organizationName}</h3>
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-surface-hover text-foreground-secondary">
                    <Mail className="w-3 h-3" />
                    Invitation
                  </span>
                </>
              )}
            </div>
            <p className="text-sm text-foreground-secondary">
              {isLoading ? (
                <div className="h-4 w-48 bg-surface-hover rounded animate-pulse"></div>
              ) : (
                "You've been invited to join this organization"
              )}
            </p>
            {invitation.invitedAt && (
              <p className="text-xs text-foreground-muted mt-1">
                Invited on {formatDate(invitation.invitedAt)}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="default"
            onClick={() => onAccept(invitation.id)}
            disabled={accepting || rejecting || isLoading}
            loading={accepting}
          >
            <Check className="w-4 h-4" />
            Accept
          </Button>
          <Button
            variant="ghost"
            onClick={() => onReject(invitation.id)}
            disabled={rejecting || accepting || isLoading}
            loading={rejecting}
          >
            Reject
          </Button>
        </div>
      </div>
    </div>
  );
}
