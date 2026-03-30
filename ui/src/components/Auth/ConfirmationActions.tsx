import type { FC } from 'react';
import { Button } from '@/components/ui/button';

interface ConfirmationActionsProps {
  loading: boolean;
  onBackToSignIn: () => void;
  onResendCode: () => void;
}

export const ConfirmationActions: FC<ConfirmationActionsProps> = ({
  loading,
  onBackToSignIn,
  onResendCode,
}) => {
  return (
    <div className="mt-6 text-center space-y-3">
      <Button
        variant="link"
        onClick={onBackToSignIn}
        className="text-foreground-secondary hover:text-foreground h-auto p-0 text-sm"
      >
        ← Back to Sign In
      </Button>

      <div>
        <Button
          variant="link"
          onClick={onResendCode}
          disabled={loading}
          className="text-foreground-secondary hover:text-foreground h-auto p-0 text-sm"
        >
          Resend verification code
        </Button>
      </div>
    </div>
  );
};
