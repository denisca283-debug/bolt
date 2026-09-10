import { useState } from 'react';
import { useRouter } from '../router';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { MobileNav } from './MobileNav';

type AppShellProps = {
  children: React.ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { path } = useRouter();

  const isHomepage = path === '/';

  return (
    <div className="flex h-screen overflow-hidden bg-base-900">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 border-r border-line-soft bg-base-850">
        <Sidebar />
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col min-w-0">
        <TopBar onMenuClick={() => setMobileNavOpen(true)} />
        <main key={path} className="flex-1 overflow-y-auto">
          {isHomepage ? (
            children
          ) : (
            <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8 lg:py-8">
              {children}
            </div>
          )}
        </main>
      </div>

      {/* Mobile drawer */}
      <MobileNav open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
    </div>
  );
}
