import { AppProvider } from '@/app/Provider';
import { AppRoutes } from '@/app/Routes';
import { MetricsProvider } from '@/contexts/MetricsContext';

export default function App() {
  return (
    <AppProvider>
      <MetricsProvider>
        <AppRoutes />
      </MetricsProvider>
    </AppProvider>
  );
}
