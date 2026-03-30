export type AuthTab = 'signin' | 'signup' | 'reset';
export type ResetStep = 'request' | 'confirm';

export interface AuthFormData {
  email: string;
  password: string;
  confirmPassword: string;
  username: string;
  confirmationCode: string;
  newPassword: string;
  confirmNewPassword: string;
}

export interface AuthState {
  activeTab: AuthTab;
  resetStep: ResetStep;
  showPassword: boolean;
  loading: boolean;
  error: string;
  success: string;
  needsConfirmation: boolean;
}

export interface LoginPageProps {
  onAuthSuccess: (user: any) => void;
}
