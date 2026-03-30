import { memo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sidebar as ShadcnSidebar,
  SidebarContent,
  SidebarHeader,
  SidebarRail,
  SidebarTrigger,
} from '@/components/ui/sidebar';

import { SidebarNavigation } from './SidebarNavigation';

function Sidebar() {
  const navigate = useNavigate();

  const handleLogoClick = useCallback(() => {
    navigate('/traces');
  }, [navigate]);

  return (
    <ShadcnSidebar
      collapsible="icon"
      className="border-r border-border"
      aria-label="Main navigation"
    >
      <SidebarHeader className="h-14 flex-row items-center justify-center px-4 group-data-[collapsible=icon]:px-2">
        <span
          className="text-lg font-semibold cursor-pointer hover:opacity-70 transition-opacity group-data-[collapsible=icon]:hidden"
          onClick={handleLogoClick}
          role="button"
          tabIndex={0}
          aria-label="Go to Traces"
          onKeyDown={(e) => e.key === 'Enter' && handleLogoClick()}
        >
          Lunar Router
        </span>
        <SidebarTrigger
          className="absolute right-2 group-data-[collapsible=icon]:static group-data-[collapsible=icon]:ml-0"
          aria-label="Toggle sidebar"
        />
      </SidebarHeader>

      <SidebarContent>
        <SidebarNavigation />
      </SidebarContent>

      <SidebarRail />
    </ShadcnSidebar>
  );
}

export default memo(Sidebar);
