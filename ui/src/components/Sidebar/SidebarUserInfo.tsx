import { memo, useCallback, useMemo } from 'react';
import { LogOut, Moon, Sun, BookOpen, MessageCircle, ChevronsUpDown } from 'lucide-react';
import { useUser } from '../../contexts/UserContext';
import { useTheme } from '../../components/ThemeProvider';
import { getUserInfo } from '../../utils/userInfo';

import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from '@/components/ui/sidebar';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuItem,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';

interface SidebarUserInfoProps {
  signOut: () => Promise<void>;
}

const EXTERNAL_LINKS = {
  docs: 'https://docs.puredocs.org/lunar/overview',
  community: 'https://discord.gg/thyZx5GkFV',
};

export const SidebarUserInfo = memo(({ signOut }: SidebarUserInfoProps) => {
  const { user } = useUser();
  const { isMobile } = useSidebar();
  const { theme, setTheme } = useTheme();
  const { userName, userInitials, email } = useMemo(() => getUserInfo(user?.email), [user?.email]);

  // Derive dark mode from theme
  const isDarkMode = useMemo(() => {
    if (theme === 'dark') return true;
    if (theme === 'light') return false;
    // system mode
    return (
      typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
    );
  }, [theme]);

  const handleSignOut = useCallback(async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  }, [signOut]);

  const handleToggleTheme = useCallback(() => {
    // Toggle between light and dark, not system
    setTheme(isDarkMode ? 'light' : 'dark');
  }, [isDarkMode, setTheme]);

  const openLink = useCallback((url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  }, []);

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          size="sm"
          onClick={handleToggleTheme}
          aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDarkMode ? (
            <>
              <Sun className="h-4 w-4" aria-hidden="true" />
              <span>Light mode</span>
            </>
          ) : (
            <>
              <Moon className="h-4 w-4" aria-hidden="true" />
              <span>Dark mode</span>
            </>
          )}
        </SidebarMenuButton>
      </SidebarMenuItem>

      <SidebarMenuItem>
        <SidebarMenuButton
          size="sm"
          onClick={() => openLink(EXTERNAL_LINKS.docs)}
          aria-label="Open documentation (opens in new tab)"
        >
          <BookOpen className="h-4 w-4" aria-hidden="true" />
          <span>Docs</span>
        </SidebarMenuButton>
      </SidebarMenuItem>

      <SidebarMenuItem>
        <SidebarMenuButton
          size="sm"
          onClick={() => openLink(EXTERNAL_LINKS.community)}
          aria-label="Join community Discord (opens in new tab)"
        >
          <MessageCircle className="h-4 w-4" aria-hidden="true" />
          <span>Community</span>
        </SidebarMenuButton>
      </SidebarMenuItem>

      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              aria-label="Open user menu"
            >
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarImage src="" alt={userName} />
                <AvatarFallback className="rounded-lg">{userInitials}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{userName}</span>
                <span className="truncate text-xs">{email}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" aria-hidden="true" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
            side={isMobile ? 'bottom' : 'right'}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src="" alt={userName} />
                  <AvatarFallback className="rounded-lg">{userInitials}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{userName}</span>
                  <span className="truncate text-xs">{email}</span>
                </div>
              </div>
            </DropdownMenuLabel>

            <DropdownMenuSeparator />

            <DropdownMenuItem onClick={handleSignOut} aria-label="Sign out of your account">
              <LogOut className="h-4 w-4" aria-hidden="true" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
});

SidebarUserInfo.displayName = 'SidebarUserInfo';
