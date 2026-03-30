import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface AuthTabsProps {
  activeTab: 'signin' | 'signup' | 'reset';
  setActiveTab: (tab: 'signin' | 'signup' | 'reset') => void;
}

export function AuthTabs({ activeTab, setActiveTab }: AuthTabsProps) {
  if (activeTab === 'reset') return null;

  return (
    <div className="mb-6">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'signin' | 'signup')}>
        <TabsList variant="line" className="w-full h-9">
          <TabsTrigger value="signin" className="text-sm">
            Sign In
          </TabsTrigger>
          <TabsTrigger value="signup" className="text-sm">
            Create Account
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );
}
