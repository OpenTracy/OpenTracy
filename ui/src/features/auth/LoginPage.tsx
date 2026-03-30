import type { FC, ChangeEvent } from 'react';

import { Button } from '@/components/ui/button';

import { AuthTabs } from '@/components/Auth/AuthTabs';
import { AuthFields } from '@/components/Auth/AuthFields';
import { ResetPasswordFields } from '@/components/Auth/ResetPasswordFields';
import { ConfirmationCodeInput } from '@/components/Auth/ConfirmationCode';
import { AuthFooter } from '@/components/Auth/AuthFooter';
import { AuthHeader } from '@/components/Auth/AuthHeader';
import { LoginLayout } from '@/components/Auth/LoginLayout';
import { Message } from '@/components/Auth/Message';
import { GitHubSignIn } from '@/components/Auth/GithubSignin';
import { ConfirmationActions } from '@/components/Auth/ConfirmationActions';

import { useAuthState } from '@/hooks/login/useAuthState';
import { useAuthHandlers } from '@/hooks/login/useAuthHandlers';
import { useUrlInitialization } from '@/hooks/login/useUrlInitialization';

import type { LoginPageProps, AuthTab, ResetStep } from '@/types/auth.types';
import { getButtonText } from '@/utils/button.utils';
import { clearUrlParams } from '@/utils/url.utils';

export const LoginPage: FC<LoginPageProps> = ({ onAuthSuccess }) => {
  const {
    activeTab,
    resetStep,
    showPassword,
    loading,
    error,
    success,
    needsConfirmation,
    formData,
    setActiveTab,
    setResetStep,
    setShowPassword,
    setLoading,
    setError,
    setSuccess,
    setNeedsConfirmation,
    updateFormData,
    resetFormData,
    resetAuthState,
    resetToSignIn,
    setFormDataBulk,
  } = useAuthState();

  const {
    handleSignIn,
    handleSignUp,
    handleConfirmSignUp,
    handleResetRequest,
    handleResetConfirm,
    handleAuth0SignIn,
    handleResendCode,
  } = useAuthHandlers({
    formData,
    setLoading,
    setError,
    setSuccess,
    setNeedsConfirmation,
    setResetStep,
    setActiveTab,
    resetFormData,
    setFormDataBulk,
    onAuthSuccess,
  });

  useUrlInitialization({
    setFormDataBulk,
    setNeedsConfirmation,
    handleConfirmSignUp,
  });

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    updateFormData(e.target.name as keyof typeof formData, e.target.value);
  };

  const handleSubmit = () => {
    if (needsConfirmation) return handleConfirmSignUp();

    if (activeTab === 'reset') {
      return resetStep === 'request' ? handleResetRequest() : handleResetConfirm();
    }

    return activeTab === 'signin' ? handleSignIn() : handleSignUp();
  };

  const handleTabChange = (tab: AuthTab) => {
    setActiveTab(tab);
    resetAuthState();
    setNeedsConfirmation(false);
    setResetStep('request');
    clearUrlParams();

    if (tab !== 'reset') {
      resetFormData();
    }
  };

  const handleResetStepChange = (step: ResetStep) => {
    setResetStep(step);
    resetAuthState();

    if (step === 'request') {
      setFormDataBulk({
        confirmationCode: '',
        newPassword: '',
        confirmNewPassword: '',
      });
    }
  };

  const handleBackToSignIn = () => {
    clearUrlParams();
    resetToSignIn();
  };

  const togglePassword = () => {
    setShowPassword(!showPassword);
  };

  return (
    <LoginLayout>
      <AuthHeader
        activeTab={activeTab}
        resetStep={resetStep}
        needsConfirmation={needsConfirmation}
        userEmail={formData.email}
      />

      {!needsConfirmation && <AuthTabs activeTab={activeTab} setActiveTab={handleTabChange} />}

      {!needsConfirmation && activeTab !== 'reset' && (
        <GitHubSignIn onGitHubSignIn={handleAuth0SignIn} />
      )}

      <Message type="error" message={error} />
      <Message type="success" message={success} />

      <div className="space-y-4">
        {needsConfirmation ? (
          <ConfirmationCodeInput value={formData.confirmationCode} onChange={handleInputChange} />
        ) : activeTab === 'reset' ? (
          <ResetPasswordFields
            formData={formData}
            showPassword={showPassword}
            resetStep={resetStep}
            onChange={handleInputChange}
            onTogglePassword={togglePassword}
          />
        ) : (
          <AuthFields
            formData={formData}
            showPassword={showPassword}
            activeTab={activeTab}
            onChange={handleInputChange}
            onTogglePassword={togglePassword}
          />
        )}

        <Button
          type="button"
          onClick={handleSubmit}
          disabled={loading}
          loading={loading}
          size="lg"
          className="w-full bg-foreground text-background hover:bg-foreground/90"
        >
          {getButtonText(needsConfirmation, activeTab, resetStep)}
        </Button>
      </div>

      {!needsConfirmation ? (
        <AuthFooter
          activeTab={activeTab}
          resetStep={resetStep}
          onSwitchTab={handleTabChange}
          onResetStepChange={handleResetStepChange}
        />
      ) : (
        <ConfirmationActions
          loading={loading}
          onBackToSignIn={handleBackToSignIn}
          onResendCode={handleResendCode}
        />
      )}
    </LoginLayout>
  );
};
