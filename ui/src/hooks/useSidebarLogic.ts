import { useLocation } from 'react-router-dom';
import { useCallback, useMemo } from 'react';

/**
 * Hook para verificar se uma rota está ativa
 * Suporta rotas exatas e rotas com sub-rotas (prefix matching)
 */
export const useIsPathActive = (path: string, hasSubRoutes: boolean = false) => {
  const location = useLocation();

  return useMemo(() => {
    if (hasSubRoutes) {
      return location.pathname.startsWith(path);
    }
    return location.pathname === path;
  }, [location.pathname, path, hasSubRoutes]);
};

/**
 * Hook para verificar se é uma rota estruturada como /distill-*
 */
export const useHasRouteSubPaths = (path: string) => {
  return useCallback(() => path.startsWith('/distill-'), [path]);
};

/**
 * Hook para processar e normalizar items de menu
 */
export const useMenuItemsWithActive = (items: any[], currentPath: string) => {
  return useMemo(() => {
    return items.map((item) => {
      const hasSubRoutes = item.path.startsWith('/distill-');
      const isActive =
        !item.external &&
        (hasSubRoutes ? currentPath.startsWith(item.path) : currentPath === item.path);

      return {
        ...item,
        isActive,
        hasSubRoutes,
      };
    });
  }, [items, currentPath]);
};
