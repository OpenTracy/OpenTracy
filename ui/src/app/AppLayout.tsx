import { Outlet } from 'react-router-dom';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import Sidebar from '@/components/Sidebar/Sidebar';

export function AppLayout() {
  return (
    <SidebarProvider defaultOpen>
      <Sidebar />
      <SidebarInset>
        <main className="flex-1 min-w-0 bg-background p-0 overflow-auto">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
