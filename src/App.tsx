import { useEffect, useRef } from 'react';
import { RouterProvider, useRouter, getActorIdFromPath, getRouteParam } from './router';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { AuthModalProvider, useAuthModal } from './components/AuthModal';
import { AppShell } from './components/AppShell';
import { HomePage } from './pages/HomePage';
import { ActorsPage } from './pages/ActorsPage';
import { ActorProfilePage } from './pages/ActorProfilePage';
import { WorkPage } from './pages/WorkPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { MessagesPage } from './pages/MessagesPage';
import { MarketplacePage } from './pages/MarketplacePage';
import { NotificationsPage } from './pages/NotificationsPage';
import { ProfilePage } from './pages/ProfilePage';
import { SettingsPage } from './pages/SettingsPage';
import { PulsePage } from './pages/PulsePage';
import { ProfessionalsPage } from './pages/ProfessionalsPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { PRIVATE_ROUTES } from './components/nav-config';
import { Loader2 } from 'lucide-react';

const STANDALONE_AUTH_ROUTES = new Set(['/forgot-password', '/reset-password']);

const PRIVATE_ROUTE_MESSAGES: Record<string, string> = {
  '/messages': 'Чтобы читать сообщения, войдите в FilmVerse или создайте аккаунт.',
  '/notifications': 'Чтобы видеть уведомления, войдите в FilmVerse или создайте аккаунт.',
  '/settings': 'Чтобы изменить настройки, войдите в FilmVerse.',
  '/profile': 'Чтобы открыть профиль, войдите в FilmVerse или создайте аккаунт.',
  '/onboarding': 'Чтобы заполнить профиль, войдите в FilmVerse.',
};

function PageRouter() {
  const { path } = useRouter();

  const actorId = getActorIdFromPath(path);
  if (actorId) return <ActorProfilePage actorId={actorId} />;

  const publicSlug = getRouteParam(path, '/u');
  if (publicSlug) return <ProfilePage slug={publicSlug} />;

  switch (path) {
    case '/':
      return <HomePage />;
    case '/pulse':
      return <PulsePage />;
    case '/actors':
      return <ActorsPage />;
    case '/professionals':
      return <ProfessionalsPage />;
    case '/work':
      return <WorkPage />;
    case '/projects':
      return <ProjectsPage />;
    case '/messages':
      return <MessagesPage />;
    case '/marketplace':
      return <MarketplacePage />;
    case '/notifications':
      return <NotificationsPage />;
    case '/profile':
      return <ProfilePage />;
    case '/settings':
      return <SettingsPage />;
    case '/onboarding':
      return <OnboardingPage />;
    default:
      return <HomePage />;
  }
}

function PrivateRouteGuard() {
  const { isAuthenticated, authLoading, hasBeenAuthenticated } = useAuth();
  const { path, navigate } = useRouter();
  const { promptGuest } = useAuthModal();
  const handledRef = useRef<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (isAuthenticated) return;
    // Don't redirect a previously-authenticated user on a transient session gap
    if (hasBeenAuthenticated) return;
    if (!PRIVATE_ROUTES.has(path)) return;
    if (handledRef.current === path) return;

    handledRef.current = path;
    const msg = PRIVATE_ROUTE_MESSAGES[path] || 'Войдите в FilmVerse, чтобы продолжить.';
    navigate('/');
    promptGuest({ message: msg });
  }, [authLoading, isAuthenticated, hasBeenAuthenticated, path, navigate, promptGuest]);

  // Reset handled ref when path changes to a non-private route
  useEffect(() => {
    if (!PRIVATE_ROUTES.has(path)) {
      handledRef.current = null;
    }
  }, [path]);

  return null;
}

function AppContent() {
  const { authLoading, isAuthenticated, hasBeenAuthenticated } = useAuth();
  const { path } = useRouter();

  // Standalone auth pages (forgot/reset password) — no AppShell
  if (STANDALONE_AUTH_ROUTES.has(path)) {
    if (path === '/forgot-password') return <ForgotPasswordPage />;
    if (path === '/reset-password') return <ResetPasswordPage />;
  }

  // Loading state only on first mount before session is resolved
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-900">
        <Loader2 className="h-8 w-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  // Guest hitting a private route — guard handles redirect + modal via effect.
  // Only show the blocking spinner for users who were NEVER authenticated in this
  // session. If a previously-authenticated user's session flickers (token refresh,
  // transient null), keep the page mounted so edit state is not destroyed.
  if (!isAuthenticated && PRIVATE_ROUTES.has(path) && !hasBeenAuthenticated) {
    return (
      <>
        <PrivateRouteGuard />
        <div className="min-h-screen flex items-center justify-center bg-base-900">
          <Loader2 className="h-8 w-8 text-emerald-500 animate-spin" />
        </div>
      </>
    );
  }

  return (
    <>
      <PrivateRouteGuard />
      <AppShell>
        <PageRouter />
      </AppShell>
    </>
  );
}

function App() {
  return (
    <RouterProvider>
      <AuthProvider>
        <AuthModalProvider>
          <AppContent />
        </AuthModalProvider>
      </AuthProvider>
    </RouterProvider>
  );
}

export default App;
