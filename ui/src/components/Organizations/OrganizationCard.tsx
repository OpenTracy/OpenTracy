import { Building2, Crown, Edit, Trash2, Users } from 'lucide-react';
import type { UserOrganization } from '../../hooks/useOrganizations';

interface Props {
  org: UserOrganization;
  onEdit: (id: string, name: string) => void;
  onDelete: (id: string, name: string) => void;
  onLeave: (id: string, name: string, membershipId: string) => void;
}

export default function OrganizationCard({ org, onEdit, onDelete, onLeave }: Props) {
  return (
    <div className="p-6 hover:bg-surface-hover transition-all duration-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-accent" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h3 className="font-semibold text-foreground">{org.name}</h3>
              {org.isOwner ? (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-accent/10 text-accent">
                  <Crown className="w-3 h-3" />
                  Owner
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-surface border border-border text-foreground-secondary">
                  <Users className="w-3 h-3" />
                  {org.memberRole || 'Member'}
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 mt-1">
              {org.joinedAt && (
                <p className="text-xs text-foreground-muted">
                  Member since {new Date(org.joinedAt).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {org.isOwner ? (
            <>
              <button
                onClick={() => onEdit(org.id, org.name)}
                className="p-2 text-foreground-secondary hover:text-foreground hover:bg-surface-hover rounded-lg transition-all duration-200"
                title="Edit organization"
              >
                <Edit className="w-4 h-4" />
              </button>
              <button
                onClick={() => onDelete(org.id, org.name)}
                className="p-2 text-foreground-muted hover:text-error hover:bg-error/10 rounded-lg transition-all duration-200"
                title="Delete organization"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          ) : (
            <button
              onClick={() => org.membershipId && onLeave(org.id, org.name, org.membershipId)}
              className="px-3 py-1 text-sm text-foreground-muted hover:text-error hover:bg-error/10 rounded-lg transition-all duration-200 font-medium"
            >
              Leave
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
