import type { FC } from 'react';

interface MessageProps {
  type: 'error' | 'success';
  message: string;
}

export const Message: FC<MessageProps> = ({ type, message }) => {
  if (!message) return null;

  const role = type === 'error' ? 'alert' : 'status';

  return (
    <div className="mb-4 p-3 bg-foreground/5 border border-foreground/10 rounded-md">
      <p className="text-xs text-foreground-secondary" role={role}>
        {message}
      </p>
    </div>
  );
};
