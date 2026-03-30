import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Props {
  activeTab: 'my-orgs' | 'invites';
  setActiveTab: (tab: 'my-orgs' | 'invites') => void;
  totalOrganizations: number;
  pendingInvitesCount: number;
  hasPendingInvites: boolean;
}

export default function OrganizationsTabs({
  activeTab,
  setActiveTab,
  totalOrganizations,
  pendingInvitesCount,
  hasPendingInvites,
}: Props) {
  return (
    <div className="mb-6">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'my-orgs' | 'invites')}>
        <TabsList>
          <TabsTrigger value="my-orgs">My Organizations ({totalOrganizations})</TabsTrigger>
          <TabsTrigger value="invites" className="relative">
            Invitations ({pendingInvitesCount})
            {hasPendingInvites && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-error rounded-full"></span>
            )}
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );
}
