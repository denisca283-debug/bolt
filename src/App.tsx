import { useEffect, useRef } from 'react';
import { RouterProvider, useRouter, getActorIdFromPath, getRouteParam } from './router';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { OrganizationProvider } from './hooks/useOrganization';
import { AuthModalProvider, useAuthModal } from './components/AuthModal';
import { AppShell } from './components/AppShell';
import { HomePage } from './pages/HomePage';
import { ActorsPage } from './pages/ActorsPage';
import { ActorProfilePage } from './pages/ActorProfilePage';
import { WorkPage } from './pages/WorkPage';
import { ResumesPage } from './pages/ResumesPage';
import { OrganizationsPage } from './pages/OrganizationsPage';
import { CompaniesPage, CompanyPage } from './pages/CompaniesPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { MessagesPage } from './pages/MessagesPage';
import { MarketplacePage } from './pages/MarketplacePage';
import { NotificationsPage } from './pages/NotificationsPage';
import { ProfilePage } from './pages/ProfilePage';
import { SettingsPage } from './pages/SettingsPage';
import { PulsePage } from './pages/PulsePage';
import { ProfessionalsPage } from './pages/ProfessionalsPage';
import { ListingPage } from './pages/ListingPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { PRIVATE_ROUTES } from './components/nav-config';
import { supabaseConfigurationError } from './lib/supabase';
import { AlertCircle, Loader2 } from 'lucide-react';

function isPrivatePath(path: string) {
  if (PRIVATE_ROUTES.has(path)) return true;
  return [...PRIVATE_ROUTES].some((p) => path.startsWith(`${p}/`));
}

const STANDALONE_AUTH_ROUTES = new Set(['/forgot-password', '/reset-password']);

const PRIVATE_ROUTE_MESSAGES: Record<string, string> = {
  '/messages': 'Чтобы читать сообщения, войдите в FilmVerse или создайте аккаунт.',
  '/notifications': 'Чтобы видеть уведомления, войдите в FilmVerse или создайте аккаунт.',
  '/settings': 'Чтобы изменить настройки, войдите в FilmVerse.',
  '/profile': 'Чтобы открыть профиль, войдите в FilmVerse или создайте аккаунт.',
  '/onboarding': 'Чтобы заполнить профиль, войдите в FilmVerse.',
};

function privateRouteMessage(path: string) {
  const base = Object.keys(PRIVATE_ROUTE_MESSAGES).find(
    (route) => path === route || path.startsWith(`${route}/`)
  );
  return base
    ? PRIVATE_ROUTE_MESSAGES[base]
    : 'Войдите в FilmVerse, чтобы продолжить.';
}

function PageRouter() {
  const { path } = useRouter();

  const actorId = getActorIdFromPath(path);
  if (actorId) return <ActorProfilePage actorId={actorId} />;

  const publicSlug = getRouteParam(path, '/u');
  const companySlug = getRouteParam(path, '/company');
  if (companySlug) return <CompanyPage key={companySlug} slug={companySlug} />;
  if (publicSlug) return <ProfilePage slug={publicSlug} />;

  const listingId = getRouteParam(path, '/listing');
  if (listingId) return <ListingPage listingId={listingId} />;

  const roomId = getRouteParam(path, '/messages');
  if (roomId) return <MessagesPage initialRoomId={roomId} />;

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
    case '/resumes':
      return <ResumesPage key="resumes" />;
    case '/organizations':
      return <OrganizationsPage />;
    case '/companies':
      return <CompaniesPage />;
    case '/resumes/new':
      return <ResumesPage key="new-resume" create />;
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
  const { isAuthenticated, authLoading } = useAuth();
  const { path, navigate } = useRouter();
  const { promptGuest } = useAuthModal();
  const handledRef = useRef<string | null>(null);

  useEffect(() => {
    if (authLoading || isAuthenticated || !isPrivatePath(path)) return;
    if (handledRef.current === path) return;

    handledRef.current = path;
    navigate('/');
    promptGuest({ message: privateRouteMessage(path) });
  }, [authLoading, isAuthenticated, path, navigate, promptGuest]);

  useEffect(() => {
    if (!isPrivatePath(path)) {
      handledRef.current = null;
    }
  }, [path]);

  return null;
}

function DeploymentConfigError() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-base-900 px-4">
      <div className="surface max-w-lg w-full p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-danger-600 shrink-0 mt-0.5" />
          <div>
            <h1 className="font-display text-xl font-semibold text-txt-primary">
              FilmVerse не подключён к базе
            </h1>
            <p className="mt-2 text-sm text-txt-secondary leading-relaxed">
              В этом deployment отсутствует конфигурация Supabase. Для Vercel нужны
              VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY, после их изменения нужен новый deploy.
            </p>
            {supabaseConfigurationError && (
              <p className="mt-3 text-xs text-danger-700">{supabaseConfigurationError}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function AppContent() {
  const { authLoading, isAuthenticated, supabaseReady } = useAuth();
  const { path } = useRouter();

  if (!supabaseReady) return <DeploymentConfigError />;

  if (STANDALONE_AUTH_ROUTES.has(path)) {
    if (path === '/forgot-password') return <ForgotPasswordPage />;
    if (path === '/reset-password') return <ResetPasswordPage />;
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-900">
        <Loader2 className="h-8 w-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated && isPrivatePath(path)) {
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
          <OrganizationProvider><AppContent /></OrganizationProvider>
        </AuthModalProvider>
      </AuthProvider>
    </RouterProvider>
  );
}

export default App;
