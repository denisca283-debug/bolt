import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type RouterContextValue = {
  path: string;
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
  const [path, setPath] = useState(getInitialPath);

  useEffect(() => {
    const onHashChange = () => setPath(getInitialPath());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = (to: string) => {
    window.location.hash = to;
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  };

  return (
    <RouterContext.Provider value={{ path, navigate }}>
      {children}
    </RouterContext.Provider>
  );
}

export function getRouteParam(path: string, prefix: string): string | null {
  const match = path.match(new RegExp(`^${prefix}/(.+)$`));
  return match ? match[1] : null;
}

export function getActorIdFromPath(path: string): string | null {
  return getRouteParam(path, '/actor');
}
