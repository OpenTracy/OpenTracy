import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AuthFooterProps {
  activeTab: 'signin' | 'signup' | 'reset';
  resetStep?: 'request' | 'confirm';
  onSwitchTab: (tab: 'signin' | 'signup' | 'reset') => void;
  onResetStepChange?: (step: 'request' | 'confirm') => void;
}

export function AuthFooter({
  activeTab,
  resetStep,
  onSwitchTab,
  onResetStepChange,
}: AuthFooterProps) {
  if (activeTab === 'reset') {
    return (
      <div className="mt-6 text-center space-y-3">
        <Button
          variant="link"
          onClick={() => {
            if (resetStep === 'confirm') {
              onResetStepChange?.('request');
            } else {
              onSwitchTab('signin');
            }
          }}
          className="text-foreground-secondary hover:text-foreground h-auto p-0 text-sm"
        >
          <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
          {resetStep === 'confirm' ? 'Change email' : 'Back to Sign In'}
        </Button>

        {resetStep === 'confirm' && (
          <div>
            <Button
              variant="link"
              onClick={() => onResetStepChange?.('request')}
              className="text-foreground-secondary hover:text-foreground h-auto p-0 text-sm"
            >
              Resend verification code
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mt-6 text-center space-y-3">
      {activeTab === 'signin' && (
        <Button
          variant="link"
          onClick={() => onSwitchTab('reset')}
          className="text-foreground-secondary hover:text-foreground h-auto p-0 text-sm"
        >
          Forgot your password?
        </Button>
      )}

      <p className="text-sm text-foreground-muted">
        {activeTab === 'signin' ? (
          <>
            Don't have an account?{' '}
            <Button
              variant="link"
              onClick={() => onSwitchTab('signup')}
              className="text-foreground hover:text-foreground/80 h-auto p-0 font-medium"
            >
              Sign up
            </Button>
          </>
        ) : (
          <>
            Already have an account?{' '}
            <Button
              variant="link"
              onClick={() => onSwitchTab('signin')}
              className="text-foreground hover:text-foreground/80 h-auto p-0 font-medium"
            >
              Sign in
            </Button>
          </>
        )}
      </p>
    </div>
  );
}
