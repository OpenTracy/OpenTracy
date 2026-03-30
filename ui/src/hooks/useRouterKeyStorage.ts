import { useState, useEffect, useCallback } from 'react';

const ROUTER_KEY_STORAGE_KEY = 'lunar_router_key';

export interface RouterKeyStorage {
  routerKey: string | null;
  saveRouterKey: (key: string) => void;
  clearRouterKey: () => void;
  hasRouterKey: boolean;
}

export function useRouterKeyStorage(): RouterKeyStorage {
  const [routerKey, setRouterKey] = useState<string | null>(null);

  // Carregar a chave do localStorage na inicialização
  useEffect(() => {
    try {
      const savedKey = localStorage.getItem(ROUTER_KEY_STORAGE_KEY);
      if (savedKey && savedKey.startsWith('sk_')) {
        setRouterKey(savedKey);
        console.log('[RouterKeyStorage] Router key loaded from localStorage');
      }
    } catch (error) {
      console.warn('[RouterKeyStorage] Error loading router key from localStorage:', error);
    }
  }, []);

  // Salvar uma nova chave no localStorage
  const saveRouterKey = useCallback((key: string) => {
    if (!key || !key.startsWith('sk_')) {
      console.warn('[RouterKeyStorage] Invalid router key format:', key);
      return;
    }

    try {
      localStorage.setItem(ROUTER_KEY_STORAGE_KEY, key);
      setRouterKey(key);
      console.log('[RouterKeyStorage] Router key saved to localStorage');
    } catch (error) {
      console.error('[RouterKeyStorage] Error saving router key to localStorage:', error);
    }
  }, []);

  // Limpar a chave do localStorage
  const clearRouterKey = useCallback(() => {
    try {
      localStorage.removeItem(ROUTER_KEY_STORAGE_KEY);
      setRouterKey(null);
      console.log('[RouterKeyStorage] Router key cleared from localStorage');
    } catch (error) {
      console.error('[RouterKeyStorage] Error clearing router key from localStorage:', error);
    }
  }, []);

  const hasRouterKey = Boolean(routerKey);

  return {
    routerKey,
    saveRouterKey,
    clearRouterKey,
    hasRouterKey,
  };
}
