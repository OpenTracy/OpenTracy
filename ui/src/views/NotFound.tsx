import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import LunarLogo from '@/assets/lunar-logo.png';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="mb-12">
        <img src={LunarLogo} alt="Lunar" className="h-10 opacity-70 invert dark:invert-0" />
      </div>

      <Card className="w-full max-w-md border-border bg-surface shadow-lg">
        <div className="p-8 text-center">
          <div className="mb-6">
            <h1 className="text-7xl font-bold text-foreground">404</h1>
          </div>

          <h2 className="text-2xl font-semibold text-foreground mb-2">Page Not Found</h2>

          <p className="text-muted-foreground mb-8">
            The page you're looking for doesn't exist or has been moved.
          </p>

          <div className="flex flex-col gap-3">
            <Button onClick={() => navigate('/command-center')} size="lg" className="w-full">
              Back to Dashboard
            </Button>
            <Button
              onClick={() =>
                window.history.length > 1 ? navigate(-1) : navigate('/command-center')
              }
              variant="outline"
              size="lg"
              className="w-full"
            >
              Go Back
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
