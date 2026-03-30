interface UrlParams {
  action?: string;
  code?: string;
  email?: string;
}

export const parseUrlParams = (): UrlParams => {
  const urlParams = new URLSearchParams(window.location.search);

  return {
    action: urlParams.get('action') || undefined,
    code: urlParams.get('code') || undefined,
    email: urlParams.get('email') || undefined,
  };
};

export const clearUrlParams = (): void => {
  window.history.replaceState({}, document.title, window.location.pathname);
};

export const isVerificationUrl = (params: UrlParams): boolean => {
  return params.action === 'verify' && !!params.email;
};
