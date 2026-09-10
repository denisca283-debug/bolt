import { Settings, Bell, LogOut, LogIn, UserPlus } from 'lucide-react';
import { navItems } from './nav-config';
import { useRouter } from '../router';
import { Avatar } from './ui';
import { Logo } from './Logo';
import { useAuth } from '../hooks/useAuth';
import { useAuthModal } from './AuthModal';

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { path, navigate } = useRouter();
  const { profile, user, isAuthenticated, hasBeenAuthenticated, signOut } = useAuth();
  const { openLogin, openRegister } = useAuthModal();
  // See TopBar: avoid flashing guest UI during a transient session gap.
  const showAuthedUI = isAuthenticated || hasBeenAuthenticated;

  const go = (to: string) => {
    navigate(to);
    onNavigate?.();
  };

  const isActive = (itemPath: string) => {
    if (itemPath === '/') return path === '/';
    if (itemPath === '/actors') return path === '/actors' || path.startsWith('/actor/');
    if (itemPath === '/professionals') return path === '/professionals';
    if (itemPath === '/pulse') return path === '/pulse';
    return path === itemPath;
  };

  const displayName = profile?.full_name || user?.email || 'Гость';
  const initials = displayName
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="flex h-full flex-col bg-base-850">
      {/* Logo */}
      <button
        onClick={() => go('/')}
        className="flex items-center gap-2.5 px-5 h-16 shrink-0 border-b border-line-soft"
      >
        <Logo size={32} variant="emerald" showText />
      </button>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        <p className="px-3.5 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-wider text-txt-muted">
          Меню
        </p>
        {navItems.map((item) => {
          const active = isActive(item.path);
          const Icon = item.icon;
          // Show private items only when authenticated
          if (item.requiresAuth && !showAuthedUI) return null;
          return (
            <button
              key={item.path}
              onClick={() => go(item.path)}
              className={`nav-item ${active ? 'nav-item-active' : ''}`}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.8} />
              <span className="flex-1 text-left">{item.label}</span>
              {item.badge && (
                <span className="text-[10px] font-bold leading-none px-1.5 py-1 rounded-md bg-emerald-200/30 text-emerald-600">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}

        {showAuthedUI && (
          <div className="pt-4 pb-2">
            <p className="px-3.5 pb-2 text-[11px] font-semibold uppercase tracking-wider text-txt-muted">
              Личное
            </p>
            <button
              onClick={() => go('/notifications')}
              className={`nav-item ${path === '/notifications' ? 'nav-item-active' : ''}`}
            >
              <Bell className="h-[18px] w-[18px]" strokeWidth={1.8} />
              <span className="flex-1 text-left">Уведомления</span>
              <span className="text-[10px] font-bold leading-none px-1.5 py-1 rounded-md bg-surface-500 text-txt-secondary">5</span>
            </button>
          </div>
        )}
      </nav>

      {/* Bottom section */}
      <div className="border-t border-line-soft p-3 space-y-0.5">
        {showAuthedUI ? (
          <>
            <button
              onClick={() => go('/settings')}
              className={`nav-item ${path === '/settings' ? 'nav-item-active' : ''}`}
            >
              <Settings className="h-[18px] w-[18px]" strokeWidth={1.8} />
              <span>Настройки</span>
            </button>

            <button onClick={signOut} className="nav-item">
              <LogOut className="h-[18px] w-[18px]" strokeWidth={1.8} />
              <span>Выйти</span>
            </button>

            <button
              onClick={() => go('/profile')}
              className="flex items-center gap-3 w-full px-3.5 py-2.5 rounded-lg hover:bg-surface-600 transition-all duration-200 group"
            >
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" />
              ) : (
                <Avatar initials={initials} size="sm" />
              )}
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-medium text-txt-primary truncate group-hover:text-emerald-600 transition-colors">
                  {displayName}
                </p>
                <p className="text-xs text-txt-muted truncate">
                  {profile?.city || 'Город не указан'}
                </p>
              </div>
            </button>
          </>
        ) : (
          <>
            <button onClick={() => { onNavigate?.(); openLogin(); }} className="nav-item">
              <LogIn className="h-[18px] w-[18px]" strokeWidth={1.8} />
              <span>Войти</span>
            </button>
            <button onClick={() => { onNavigate?.(); openRegister(); }} className="nav-item">
              <UserPlus className="h-[18px] w-[18px]" strokeWidth={1.8} />
              <span>Регистрация</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
