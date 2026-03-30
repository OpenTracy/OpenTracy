import type { AuthTab, ResetStep } from '@/types/auth.types';

export const getButtonText = (
  needsConfirmation: boolean,
  activeTab: AuthTab,
  resetStep: ResetStep
): string => {
  if (needsConfirmation) {
    return 'Confirm Account';
  }

  if (activeTab === 'reset') {
    return resetStep === 'request' ? 'Send Reset Code' : 'Reset Password';
  }

  return activeTab === 'signin' ? 'Sign In' : 'Create Account';
};
