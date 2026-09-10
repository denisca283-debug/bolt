import { Search, Plus, Bell, Menu, LogIn, UserPlus } from 'lucide-react';
import { useRouter } from '../router';
import { Avatar, IconButton } from './ui';
import { useAuth } from '../hooks/useAuth';
import { useAuthModal } from './AuthModal';

type TopBarProps = {
  onMenuClick: () => void;
};

export function TopBar({ onMenuClick }: TopBarProps) {
  const { navigate } = useRouter();
  const { profile, user, isAuthenticated, hasBeenAuthenticated } = useAuth();
  const { openLogin, openRegister } = useAuthModal();
  // Keep showing the authenticated chrome during a transient session gap
  // (e.g. a background token-refresh hiccup) instead of flashing guest UI
  // while the rest of the page still treats the user as logged in.
  const showAuthedUI = isAuthenticated || hasBeenAuthenticated;

  const displayName = profile?.full_name || user?.email || 'Гость';
  const initials = displayName
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 h-16 px-4 lg:px-6 bg-base-900/90 backdrop-blur-xl border-b border-line-soft">
      {/* Mobile menu */}
      <IconButton label="Меню" onClick={onMenuClick} className="lg:hidden">
        <Menu className="h-5 w-5" />
      </IconButton>

      {/* Search */}
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-txt-muted" />
        <input
          type="text"
          placeholder="Имя, профессия, типаж, проект…"
          className="w-full bg-surface-700 border border-line-soft rounded-lg pl-10 pr-3 py-2.5 text-sm text-txt-primary placeholder:text-txt-muted focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20 transition-all duration-200"
        />
      </div>

      <div className="flex-1" />

      {showAuthedUI ? (
        <>
          {/* Quick action */}
          <button
            onClick={() => navigate('/work')}
            className="btn-primary hidden sm:inline-flex"
          >
            <Plus className="h-4 w-4" />
            <span>Разместить</span>
          </button>
          <button onClick={() => navigate('/work')} className="btn-primary sm:hidden !px-2.5" aria-label="Разместить">
            <Plus className="h-4 w-4" />
          </button>

          {/* Notifications */}
          <div className="relative">
            <IconButton label="Уведомления" onClick={() => navigate('/notifications')}>
              <Bell className="h-[18px] w-[18px]" />
            </IconButton>
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-base-900" />
          </div>

          {/* Avatar */}
          <button onClick={() => navigate('/profile')} className="shrink-0" aria-label="Профиль">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover ring-2 ring-emerald-400/30 ring-offset-2 ring-offset-base-900" />
            ) : (
              <Avatar initials={initials} size="sm" className="ring-2 ring-emerald-400/30 ring-offset-2 ring-offset-base-900" />
            )}
          </button>
        </>
      ) : (
        <div className="flex items-center gap-2">
          <button
            onClick={openLogin}
            className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-txt-secondary hover:text-txt-primary hover:bg-surface-600 transition-all duration-200"
          >
            <LogIn className="h-4 w-4" />
            <span>Войти</span>
          </button>
          <button
            onClick={openRegister}
            className="btn-primary !py-2 !px-4"
          >
            <UserPlus className="h-4 w-4" />
            <span>Регистрация</span>
          </button>
        </div>
      )}
    </header>
  );
}
