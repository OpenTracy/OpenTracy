export const getUserInfo = (email?: string) => {
  const userName = email?.split('@')[0] || 'User';
  const userInitials =
    userName
      .split(' ')
      .map((name) => name.charAt(0).toUpperCase())
      .join('')
      .slice(0, 2) || 'U';

  return {
    userName,
    userInitials,
    email: email || '',
  };
};
