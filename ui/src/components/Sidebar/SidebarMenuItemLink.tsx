import { memo } from 'react';
import { NavLink } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';

import { SidebarMenuItem, SidebarMenuButton, SidebarMenuBadge } from '@/components/ui/sidebar';

import type { MenuItem } from './menuItems';

interface SidebarMenuItemLinkProps {
  item: MenuItem;
  isActive: boolean;
}

export const SidebarMenuItemLink = memo(({ item, isActive }: SidebarMenuItemLinkProps) => {
  const hasSubRoutes = item.path.startsWith('/distill-');

  return (
    <SidebarMenuItem key={item.value}>
      {item.external ? (
        <SidebarMenuButton
          tooltip={item.label}
          onClick={() => window.open(item.path, '_blank', 'noopener,noreferrer')}
          aria-label={`${item.label} (opens in new tab)`}
        >
          {item.icon}
          <span>{item.label}</span>
          <ExternalLink className="ml-auto size-3.5 opacity-40" aria-hidden="true" />
        </SidebarMenuButton>
      ) : (
        <SidebarMenuButton
          tooltip={item.label}
          asChild
          isActive={isActive}
          aria-current={isActive ? 'page' : undefined}
        >
          <NavLink to={item.path} end={!hasSubRoutes}>
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        </SidebarMenuButton>
      )}

      {item.badge && (
        <SidebarMenuBadge
          className="bg-accent/10 text-accent-light"
          aria-label={`${item.label}: ${item.badge}`}
        >
          {item.badge}
        </SidebarMenuBadge>
      )}
    </SidebarMenuItem>
  );
});

SidebarMenuItemLink.displayName = 'SidebarMenuItemLink';
