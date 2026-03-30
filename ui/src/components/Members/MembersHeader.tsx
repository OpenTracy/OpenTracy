import { Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '../shared/PageHeader';

interface MembersHeaderProps {
  workspaceName?: string;
  userRole?: string;
  isOwner?: boolean;
  canInvite?: boolean;
  inviting?: boolean;
  onInviteClick: () => void;
}

export default function MembersHeader({ canInvite, inviting, onInviteClick }: MembersHeaderProps) {
  return (
    <PageHeader
      title="Team Management"
      action={
        canInvite ? (
          <Button variant="default" onClick={onInviteClick} loading={inviting}>
            <Mail className="w-4 h-4" />
            Send Invitation
          </Button>
        ) : undefined
      }
    />
  );
}
