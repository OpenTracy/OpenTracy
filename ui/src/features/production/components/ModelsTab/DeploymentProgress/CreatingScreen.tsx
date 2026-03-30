import { Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export function CreatingScreen() {
  return (
    <Card className="border-0 shadow-none bg-linear-to-br from-background to-muted/30">
      <CardContent className="pt-12 pb-12">
        <div className="flex flex-col items-center text-center mb-10">
          <div className="relative mb-6 w-16 h-16">
            <div className="absolute inset-0 rounded-full border-2 border-primary/10" />
            <div className="absolute inset-0 rounded-full border-2 border-t-primary border-r-primary/30 border-b-transparent border-l-transparent animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="w-5 h-5 text-primary animate-spin direction-[reverse] animation-duration-[1.5s]" />
            </div>
          </div>

          <h3 className="text-lg font-semibold mb-1">Creating Your Deployment</h3>
          <p className="text-sm text-muted-foreground">Setting up your AI model endpoint...</p>
        </div>
      </CardContent>
    </Card>
  );
}
