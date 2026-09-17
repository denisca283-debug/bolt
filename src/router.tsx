import { createContext, useContext, useEffect, useState, useCallback, useMemo, type ReactNode } from 'react';

type RouterContextValue = {
  path: string;
  search: string;
  navigate: (to: string) => void;
};

const RouterContext = createContext<RouterContextValue | null>(null);

export function useRouter() {
  const ctx = useContext(RouterContext);
  if (!ctx) throw new Error('useRouter must be used within RouterProvider');
  return ctx;
}

function getInitialPath() {
  const hash = window.location.hash.replace(/^#/, '');
  return hash || '/';
}

export function RouterProvider({ children }: { children: ReactNode }) {
  const [location, setPath] = useState(getInitialPath);
  const separator = location.indexOf('?');
  const path = separator < 0 ? location : location.slice(0, separator);
  const search = separator < 0 ? '' : location.slice(separator + 1);

  useEffect(() => {
    const onHashChange = () => setPath(getInitialPath());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // `navigate` and the context value must keep a stable identity. Recreating
  // them on every render handed a new `navigate` to every consumer, which
  // re-ran any effect listing it as a dependency (App's private-route guard
  // does) on every single render — a constant re-navigate/reload churn.
  const navigate = useCallback((to: string) => {
    window.location.hash = to;
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, []);

  const value = useMemo<RouterContextValue>(() => ({ path, search, navigate }), [path, search, navigate]);

  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export function getRouteParam(path: string, prefix: string): string | null {
  const match = path.match(new RegExp(`^${prefix}/(.+)$`));
  return match ? match[1] : null;
}

export function getActorIdFromPath(path: string): string | null {
  return getRouteParam(path, '/actor');
}
