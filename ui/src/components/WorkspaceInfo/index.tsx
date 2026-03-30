import { cn } from '@/lib/utils';
import { ChevronDown, Check, Plus } from 'lucide-react';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useNavigate } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function WorkspaceInfo() {
  const { currentWorkspace, workspaces, switchWorkspace, loading } = useWorkspace();
  const navigate = useNavigate();

  if (workspaces.length <= 1 || !currentWorkspace || loading) return null;

  return (
    <div className="px-3 pb-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={cn(
              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg',
              'bg-surface border border-border',
              'hover:bg-surface-hover hover:border-border-hover',
              'transition-colors duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'
            )}
          >
            <div
              className={`w-6 h-6 rounded-md ${currentWorkspace.color} flex items-center justify-center text-white text-[10px] font-semibold`}
            >
              {currentWorkspace.initials}
            </div>
            <span className="flex-1 text-left text-[13px] font-medium text-foreground truncate">
              {currentWorkspace.name}
            </span>
            <ChevronDown className="w-4 h-4 text-foreground-muted transition-transform" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="start"
          className="w-[var(--radix-dropdown-menu-trigger-width)] bg-surface border-border p-1.5"
        >
          {workspaces.map((workspace) => (
            <DropdownMenuItem
              key={workspace.id}
              onClick={() => switchWorkspace(workspace)}
              className={cn(
                'flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] cursor-pointer',
                currentWorkspace.id === workspace.id && 'bg-surface-hover'
              )}
            >
              <div
                className={`w-6 h-6 rounded-md ${workspace.color} flex items-center justify-center text-white text-[10px] font-semibold`}
              >
                {workspace.initials}
              </div>
              <span className="flex-1 text-left text-foreground truncate" title={workspace.name}>
                {workspace.name}
              </span>
              {currentWorkspace.id === workspace.id && (
                <Check className="w-4 h-4 text-foreground-muted" />
              )}
            </DropdownMenuItem>
          ))}

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={() => navigate('/organizations')}
            className="flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] text-foreground-secondary cursor-pointer"
          >
            <div className="w-6 h-6 rounded-md border border-dashed border-border flex items-center justify-center">
              <Plus className="w-3.5 h-3.5 text-foreground-muted" />
            </div>
            <span>New organization</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
