// src/contexts/WorkspaceContext.tsx
import type { ReactNode } from 'react';
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import type { UserOrganization } from '../hooks/useOrganizations';
import { useOrganizations } from '../hooks/useOrganizations';
import { useUser } from './UserContext';

const LOG_PREFIX = '[WorkspaceProvider]';

export interface Workspace {
  id: string;
  name: string;
  type: 'personal' | 'organization';
  initials: string;
  color: string;
  isOwner?: boolean;
  role?: 'ADMIN' | 'MEMBER' | 'OWNER';
}

interface WorkspaceContextType {
  currentWorkspace: Workspace | null;
  workspaces: Workspace[];
  switchWorkspace: (workspace: Workspace) => void;
  loading: boolean;
  error: string | null;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

interface WorkspaceProviderProps {
  children: ReactNode;
}

function generateInitials(name?: string): string {
  const n = (name || '').trim();
  if (!n) return 'ME';
  return n
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}
function generateColor(name: string): string {
  const colors = [
    'bg-white/10',
    'bg-white/15',
    'bg-white/20',
    'bg-white/10',
    'bg-white/15',
    'bg-white/20',
    'bg-white/10',
    'bg-white/15',
  ];
  const hash = name.split('').reduce((acc, ch) => ch.charCodeAt(0) + ((acc << 5) - acc), 0);
  return colors[Math.abs(hash) % colors.length];
}
const WORKSPACE_STORAGE_KEY = 'currentWorkspaceId';
const DASH_PREFIX = '/';

// Assinatura leve para detectar alterações reais
const signature = (arr: Workspace[]) => arr.map((w) => `${w.id}|${w.name}|${w.type}`).join('||');

export function WorkspaceProvider({ children }: WorkspaceProviderProps) {
  const { user, loading: userLoading } = useUser();
  const { error: orgsError, getOrganizationsByStatus, loading: orgLoading } = useOrganizations();

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);

  const navigate = useNavigate();
  const location = useLocation();

  const isInitialized = useRef(false);
  const prevSigRef = useRef<string>('');
  const prevWorkspaceRef = useRef<Workspace | null>(null);

  const personalWorkspace = useMemo<Workspace | null>(() => {
    if (!user) return null;
    return {
      id: user.id,
      name: user.name || 'Personal',
      type: 'personal',
      initials: generateInitials(user.name),
      color: 'bg-white/10',
      isOwner: true,
    };
  }, [user]);

  // ⚠️ memoiza para não depender da identidade de getOrganizationsByStatus a cada render
  const pickActiveOrgs = useCallback(() => {
    try {
      return getOrganizationsByStatus('ACTIVE') as UserOrganization[];
    } catch {
      return [] as UserOrganization[];
    }
  }, [getOrganizationsByStatus]);

  const orgWorkspaces = useMemo<Workspace[]>(() => {
    if (!user || orgLoading) return [];
    const orgs = pickActiveOrgs();
    return orgs.map((org) => ({
      id: org.id,
      name: org.name,
      type: 'organization',
      initials: generateInitials(org.name),
      color: generateColor(org.name),
      isOwner: org.isOwner,
      role: org.memberRole,
    }));
  }, [user, orgLoading, pickActiveOrgs]);

  // Navegação com prefixo correto e guardas
  const handleNavigation = useCallback(
    (workspace: Workspace) => {
      const prevType = prevWorkspaceRef.current?.type;
      const newType = workspace.type;
      if (!prevType || prevType === newType) return;

      if (newType === 'organization') {
        if (!location.pathname.startsWith(`${DASH_PREFIX}/`)) {
          navigate(`${DASH_PREFIX}/members`, { replace: true });
        }
      } else {
        // vindo de org -> pessoal
        if (
          location.pathname.includes(`${DASH_PREFIX}/organizations`) ||
          location.pathname.includes(`${DASH_PREFIX}/members`)
        ) {
          navigate(`${DASH_PREFIX}/playground`, { replace: true });
        }
      }
    },
    [navigate, location.pathname]
  );

  const switchWorkspace = useCallback(
    (workspace: Workspace) => {
      if (workspace.id === currentWorkspace?.id) return;
      setCurrentWorkspace(workspace);
      sessionStorage.setItem(WORKSPACE_STORAGE_KEY, workspace.id);
      prevWorkspaceRef.current = workspace;
      handleNavigation(workspace);
    },
    [currentWorkspace?.id, handleNavigation]
  );

  // 1) Inicialização rápida: usa pessoal (se existir) e libera loading sem esperar orgs
  useEffect(() => {
    if (!user || isInitialized.current) return;

    const base: Workspace[] = personalWorkspace ? [personalWorkspace] : [];
    const baseSig = signature(base);

    setWorkspaces(base);
    const savedId = sessionStorage.getItem(WORKSPACE_STORAGE_KEY);
    const restored = savedId ? base.find((w) => w.id === savedId) : null;
    const def = restored || base[0] || null;

    if (def && def.id !== currentWorkspace?.id) {
      setCurrentWorkspace(def);
      prevWorkspaceRef.current = def;
    }

    prevSigRef.current = baseSig;
    setLoading(false);
    isInitialized.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, personalWorkspace]);

  // 2) Quando orgs chegarem, mescla com pessoal e só atualiza se mudou de fato
  useEffect(() => {
    if (!user || !isInitialized.current) return;
    if (orgLoading) return;

    const next = personalWorkspace ? [personalWorkspace, ...orgWorkspaces] : orgWorkspaces;
    const nextSig = signature(next);
    if (nextSig === prevSigRef.current) return; // nada mudou

    setWorkspaces(next);
    prevSigRef.current = nextSig;

    // se o workspace atual saiu, escolha fallback
    if (currentWorkspace && !next.some((w) => w.id === currentWorkspace.id)) {
      const fallback = personalWorkspace || next[0] || null;
      if (fallback && fallback.id !== currentWorkspace.id) {
        setCurrentWorkspace(fallback);
        sessionStorage.setItem(WORKSPACE_STORAGE_KEY, fallback.id);
        prevWorkspaceRef.current = fallback;
        handleNavigation(fallback);
      }
    }
  }, [user, orgLoading, orgWorkspaces, personalWorkspace, currentWorkspace, handleNavigation]);

  // 3) Reset limpo ao deslogar / handle null user after loading completes
  useEffect(() => {
    if (user) return;
    setWorkspaces([]);
    setCurrentWorkspace(null);
    isInitialized.current = false;
    prevSigRef.current = '';
    prevWorkspaceRef.current = null;
    sessionStorage.removeItem(WORKSPACE_STORAGE_KEY);

    // If UserContext is still loading, wait. Otherwise release loading to avoid infinite spinner.
    if (userLoading) {
      setLoading(true);
    } else {
      console.warn(
        `${LOG_PREFIX} UserContext finished loading but user record is null.`,
        'This may indicate a wrong AppSync URL or the user record does not exist in the database.'
      );
      setLoading(false);
    }
  }, [user, userLoading]);

  const value = useMemo<WorkspaceContextType>(
    () => ({
      currentWorkspace,
      workspaces,
      switchWorkspace,
      loading, // não bloqueie pela carga das orgs após init
      error: orgsError,
    }),
    [currentWorkspace, workspaces, switchWorkspace, loading, orgsError]
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used within a WorkspaceProvider');
  return ctx;
}
