// Local-only replacement for `aws-amplify/auth`.
// The UI was originally written against Cognito; for self-hosted installs we
// hand back a static "local" user and empty tokens so all auth-aware hooks
// keep compiling and run as if the user is already signed in.

const LOCAL_USER = {
  userId: 'local-user',
  username: 'local@opentracy',
  signInDetails: { loginId: 'local@opentracy' },
};

export type AuthUser = typeof LOCAL_USER;

export async function getCurrentUser(): Promise<AuthUser> {
  return LOCAL_USER;
}

export async function fetchAuthSession() {
  return {
    tokens: {
      idToken: {
        toString: () => '',
        payload: {
          sub: LOCAL_USER.userId,
          email: LOCAL_USER.username,
          preferred_username: LOCAL_USER.username,
        } as Record<string, unknown>,
      },
      accessToken: {
        toString: () => '',
        payload: {} as Record<string, unknown>,
      },
    },
    credentials: undefined,
    identityId: LOCAL_USER.userId,
    userSub: LOCAL_USER.userId,
  };
}

export async function signOut(): Promise<void> {}

export async function signIn(_args: unknown): Promise<{ isSignedIn: boolean }> {
  return { isSignedIn: true };
}

export async function signUp(_args: unknown): Promise<{ isSignUpComplete: boolean }> {
  return { isSignUpComplete: true };
}

export async function confirmSignUp(_args: unknown): Promise<{ isSignUpComplete: boolean }> {
  return { isSignUpComplete: true };
}

export async function resetPassword(_args: unknown): Promise<void> {}

export async function confirmResetPassword(_args: unknown): Promise<void> {}

export async function signInWithRedirect(_args?: unknown): Promise<void> {}

export async function resendSignUpCode(_args: unknown): Promise<void> {}
