import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '../shared/PageHeader';

interface OrganizationsHeaderProps {
  onCreateClick: () => void;
  isCreating: boolean;
}

export default function OrganizationsHeader({
  onCreateClick,
  isCreating,
}: OrganizationsHeaderProps) {
  return (
    <PageHeader
      title="Organizations"
      action={
        <Button variant="default" onClick={onCreateClick} loading={isCreating}>
          <Plus className="w-5 h-5" />
          New Organization
        </Button>
      }
    />
  );
}
