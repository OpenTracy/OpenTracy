import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface MembersTabsProps {
  activeTab: 'members' | 'invitations';
  setActiveTab: (tab: 'members' | 'invitations') => void;
  membersCount: number;
  invitationsCount: number;
  canInvite: boolean;
}

export default function MembersTabs({
  activeTab,
  setActiveTab,
  membersCount,
  invitationsCount,
  canInvite,
}: MembersTabsProps) {
  return (
    <div className="mb-6">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'members' | 'invitations')}>
        <TabsList variant="line">
          <TabsTrigger value="members">Members ({membersCount})</TabsTrigger>
          {canInvite && (
            <TabsTrigger value="invitations">Invitations ({invitationsCount})</TabsTrigger>
          )}
        </TabsList>
      </Tabs>
    </div>
  );
}
