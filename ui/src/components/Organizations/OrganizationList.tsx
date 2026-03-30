import { Building2, Users } from 'lucide-react';
import OrganizationCard from './OrganizationCard';
import type { UserOrganization } from '../../hooks/useOrganizations';

interface Props {
  organizations: UserOrganization[];
  onEdit: (org: UserOrganization) => void;
  onDelete: (org: UserOrganization) => void;
  onLeave: (org: UserOrganization) => void;
}

export default function OrganizationList({ organizations, onEdit, onDelete, onLeave }: Props) {
  if (organizations.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-surface-hover flex items-center justify-center">
          <Building2 className="w-8 h-8 text-foreground-muted" />
        </div>
        <h3 className="text-lg font-medium text-foreground mb-2">No organizations yet</h3>
        <p className="text-foreground-secondary mb-6">
          Create your first organization or wait for an invitation to get started.
        </p>
      </div>
    );
  }

  const ownedOrgs = organizations.filter((org) => org && org.isOwner);
  const memberOrgs = organizations.filter(
    (org) => org && !org.isOwner && org.memberStatus == 'ACTIVE'
  );

  const handleEdit = (id: string) => {
    const org = organizations.find((o) => o.id === id);
    if (org) onEdit(org);
  };

  const handleDelete = (id: string) => {
    const org = organizations.find((o) => o.id === id);
    if (org) onDelete(org);
  };

  const handleLeave = (id: string) => {
    const org = organizations.find((o) => o.id === id);
    if (org) onLeave(org);
  };

  return (
    <div className="space-y-6">
      {ownedOrgs.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-5 h-5 rounded bg-accent/10 flex items-center justify-center">
              <Building2 className="w-3 h-3 text-accent" />
            </div>
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
              Organizations you own ({ownedOrgs.length})
            </h2>
          </div>
          <div className="bg-surface rounded-lg border border-border divide-y divide-border">
            {ownedOrgs.map((org) => (
              <OrganizationCard
                key={org.id}
                org={org}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onLeave={handleLeave}
              />
            ))}
          </div>
        </div>
      )}

      {memberOrgs.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-5 h-5 rounded bg-surface-hover flex items-center justify-center">
              <Users className="w-3 h-3 text-foreground-secondary" />
            </div>
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
              Organizations you're a member of ({memberOrgs.length})
            </h2>
          </div>
          <div className="bg-surface rounded-lg border border-border divide-y divide-border">
            {memberOrgs.map((org) => (
              <OrganizationCard
                key={org.id}
                org={org}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onLeave={handleLeave}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
