import { AlertCircle, CheckCircle, Shield, XCircle } from 'lucide-react';

import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from '@/components/ui/item';
import { Spinner } from '@/components/ui/spinner';
import type { ValidationStatus } from '@/features/production/types/hfModelModal.types';

const STATUS_VARIANT: Record<ValidationStatus, 'default' | 'outline' | 'muted'> = {
  idle: 'muted',
  validating: 'outline',
  success: 'outline',
  error: 'outline',
  warning: 'outline',
};

const STATUS_COLOR: Record<ValidationStatus, string> = {
  idle: 'text-muted-foreground',
  validating: 'text-primary',
  success: 'text-green-600',
  error: 'text-destructive',
  warning: 'text-yellow-600',
};

function StatusIcon({ status }: { status: ValidationStatus }) {
  switch (status) {
    case 'validating':
      return <Spinner />;
    case 'success':
      return <CheckCircle className="text-green-600" />;
    case 'error':
      return <XCircle className="text-destructive" />;
    case 'warning':
      return <AlertCircle className="text-yellow-600" />;
    default:
      return <Shield className="text-muted-foreground" />;
  }
}

interface ValidationItemProps {
  label: string;
  status: ValidationStatus;
  message?: string;
  icon?: React.ReactNode;
}

export function ValidationItem({ label, status, message, icon }: ValidationItemProps) {
  const color = STATUS_COLOR[status];

  return (
    <Item variant={STATUS_VARIANT[status]} size="sm">
      <ItemMedia variant="icon">{icon ?? <StatusIcon status={status} />}</ItemMedia>
      <ItemContent>
        <ItemTitle className={color}>{label}</ItemTitle>
        {message && <ItemDescription className={color}>{message}</ItemDescription>}
      </ItemContent>
    </Item>
  );
}
