import { memo, useMemo } from 'react';
import { useLocation } from 'react-router-dom';

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
} from '@/components/ui/sidebar';

import { MENU_SECTIONS } from './menuItems';
import { SidebarMenuItemLink } from './SidebarMenuItemLink';

export const SidebarNavigation = memo(() => {
  const location = useLocation();

  const sectionsWithActiveStates = useMemo(() => {
    return MENU_SECTIONS.map((section) => ({
      ...section,
      items: section.items.map((item) => {
        const hasSubRoutes = item.path.startsWith('/distill-');
        const isActive =
          !item.external &&
          (hasSubRoutes
            ? location.pathname.startsWith(item.path)
            : location.pathname === item.path);

        return { ...item, isActive };
      }),
    }));
  }, [location.pathname]);

  return (
    <>
      {sectionsWithActiveStates.map((section) => (
        <SidebarGroup key={section.id} className="py-1 px-2">
          {section.label && <SidebarGroupLabel>{section.label}</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {section.items.map((item) => (
                <SidebarMenuItemLink key={item.value} item={item} isActive={item.isActive} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </>
  );
});

SidebarNavigation.displayName = 'SidebarNavigation';
