import type { FC, ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import LunarLogo from '@/assets/lunar-logo.png';

interface LoginLayoutProps {
  children: ReactNode;
}

export const LoginLayout: FC<LoginLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      {/* Subtle gradient background */}
      <div className="absolute inset-0 bg-linear-to-br from-background via-background to-surface pointer-events-none" />

      {/* Grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.02] pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(rgba(237, 237, 237, 0.1) 1px, transparent 1px),
                           linear-gradient(90deg, rgba(237, 237, 237, 0.1) 1px, transparent 1px)`,
          backgroundSize: '64px 64px',
        }}
      />

      <div className="w-full max-w-105 mx-auto px-6 relative z-10">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <img src={LunarLogo} alt="Lunar" className="h-8 w-auto invert dark:invert-0" />
        </div>

        {/* Main card */}
        <Card className="shadow-2xl shadow-black/10">
          <CardContent className="pt-6">{children}</CardContent>
        </Card>

        {/* Footer links */}
        <div className="mt-6 text-center">
          <p className="text-xs text-foreground-muted">
            By continuing, you agree to our{' '}
            <a
              href="https://www.lunar-sys.com/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground-secondary hover:text-foreground underline underline-offset-4 transition-colors"
            >
              Terms of Service
            </a>{' '}
            and{' '}
            <a
              href="https://www.lunar-sys.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground-secondary hover:text-foreground underline underline-offset-4 transition-colors"
            >
              Privacy Policy
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};
