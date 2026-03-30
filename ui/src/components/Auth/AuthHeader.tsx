interface AuthHeaderProps {
  activeTab: 'signin' | 'signup' | 'reset';
  resetStep?: 'request' | 'confirm';
  needsConfirmation?: boolean;
  userEmail?: string;
}

export function AuthHeader({
  activeTab,
  resetStep,
  needsConfirmation,
  userEmail,
}: AuthHeaderProps) {
  const getTitle = () => {
    if (needsConfirmation) return 'Confirm Your Account';
    if (activeTab === 'reset') {
      return resetStep === 'request' ? 'Reset Password' : 'Enter New Password';
    }
    return 'Welcome';
  };

  const getSubtitle = () => {
    if (needsConfirmation) {
      return `We've sent a confirmation code to ${userEmail}`;
    }
    if (activeTab === 'reset') {
      return resetStep === 'request'
        ? "Enter your email address and we'll send you a reset code"
        : `Enter the code sent to ${userEmail} and your new password`;
    }
    return null;
  };

  return (
    <div className="mb-6">
      <h1 className="text-xl font-semibold text-foreground tracking-tight mb-1.5">{getTitle()}</h1>
      {getSubtitle() && (
        <p className="text-sm text-foreground-muted leading-relaxed">{getSubtitle()}</p>
      )}
    </div>
  );
}
