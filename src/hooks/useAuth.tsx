import { createContext, useContext, useEffect, useState, useRef, useCallback, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Profile } from '../types';

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  authLoading: boolean;
  profileLoading: boolean;
  supabaseReady: boolean;
  isAuthenticated: boolean;
  // True once the user has successfully authenticated at least once in this
  // tab and hasn't explicitly signed out since. Used to avoid flashing a
  // "logged out" UI (nav, guards) during a transient/unexpected session gap
  // (e.g. a background token-refresh hiccup), while still resetting cleanly
  // on a real, user-initiated sign-out.
  hasBeenAuthenticated: boolean;
  signUp: (fullName: string, email: string, password: string) => Promise<{ error: string | null; needsEmailConfirm: boolean }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const profileEnsureRef = useRef<string | null>(null);
  const wasAuthenticatedRef = useRef(false);
  const explicitSignOutRef = useRef(false);

  // ── 1. Initial session (synchronous auth only — no profile queries) ──
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setAuthLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setAuthLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      // Only clear user/session on an explicit sign-out.
      // Transient null sessions during token refresh must not reset auth state.
      if (event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
        if (explicitSignOutRef.current) {
          // The user actually clicked "Выйти" — fully reset the grace flag so
          // nav/guards immediately treat this tab as a fresh guest.
          wasAuthenticatedRef.current = false;
          explicitSignOutRef.current = false;
        }
        // Otherwise this SIGNED_OUT came from Supabase itself (e.g. a failed
        // background token refresh) — keep wasAuthenticatedRef true so the UI
        // doesn't flicker into a half-guest state for what may be transient.
      } else if (newSession) {
        setSession(newSession);
        setUser(newSession.user);
      }
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  // ── 2. Profile loading (separate effect, keyed on user.id) ──
  useEffect(() => {
    if (!user) {
      setProfile(null);
      setProfileLoading(false);
      profileEnsureRef.current = null;
      return;
    }

    // Avoid duplicate ensure calls for the same user
    if (profileEnsureRef.current === user.id) return;
    profileEnsureRef.current = user.id;

    let cancelled = false;
    setProfileLoading(true);

    (async () => {
      const p = await fetchProfile(user.id);
      if (cancelled) return;

      if (p) {
        setProfile(p);
        setProfileLoading(false);
        return;
      }

      // No profile row — create one idempotently
      const fullName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Пользователь';
      const slug = generateUniqueSlug(fullName, user.id);
      const { error: insertErr } = await supabase.from('profiles').insert({
        id: user.id,
        full_name: fullName,
        public_slug: slug,
        onboarding_completed: false,
      });
      if (cancelled) return;

      if (insertErr) {
        // Likely a duplicate key — another tab or the signup path already created it.
        // Re-fetch instead of failing.
        const retry = await fetchProfile(user.id);
        if (!cancelled) {
          setProfile(retry);
          setProfileLoading(false);
        }
        return;
      }

      // Read back the freshly inserted row
      const fresh = await fetchProfile(user.id);
      if (!cancelled) {
        setProfile(fresh);
        setProfileLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Refresh helper (call from UI when profile was edited) ──
  const refreshProfile = useCallback(async () => {
    if (user) {
      const p = await fetchProfile(user.id);
      if (p) setProfile(p);
    }
  }, [user]);

  // ── Auth actions ──

  const signUp = useCallback(async (fullName: string, email: string, password: string) => {
    if (!isSupabaseConfigured) return { error: 'Supabase не настроен.', needsEmailConfirm: false };

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) return { error: translateAuthError(error.message), needsEmailConfirm: false };

    const needsEmailConfirm = !data.session && !!data.user;
    return { error: null, needsEmailConfirm };
    // Profile creation is handled by the user.id effect above,
    // which fires when onAuthStateChange delivers the session.
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!isSupabaseConfigured) return { error: 'Supabase не настроен.' };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: translateAuthError(error.message) };
    return { error: null };
  }, []);

  const signOut = useCallback(async () => {
    explicitSignOutRef.current = true;
    await supabase.auth.signOut();
    // onAuthStateChange will clear user/session (and the grace flag, since
    // explicitSignOutRef is set).
    // Clear profile synchronously so UI updates immediately.
    setProfile(null);
    profileEnsureRef.current = null;
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    if (!isSupabaseConfigured) return { error: 'Supabase не настроен.' };
    const redirectTo = `${window.location.origin}/#/reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) return { error: translateAuthError(error.message) };
    return { error: null };
  }, []);

  const updatePassword = useCallback(async (newPassword: string) => {
    if (!isSupabaseConfigured) return { error: 'Supabase не настроен.' };
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { error: translateAuthError(error.message) };
    return { error: null };
  }, []);

  const isAuthenticated = !!user && !!session;
  if (isAuthenticated) {
    wasAuthenticatedRef.current = true;
  }

  return (
    <AuthContext.Provider
      value={{
        user, session, profile,
        authLoading, profileLoading,
        supabaseReady: isSupabaseConfigured,
        isAuthenticated,
        hasBeenAuthenticated: wasAuthenticatedRef.current,
        signUp, signIn, signOut,
        resetPassword, updatePassword,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ── Helpers (module-private) ──

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) {
    console.error('fetchProfile error:', error.message);
    return null;
  }
  return data as Profile | null;
}

function generateUniqueSlug(name: string, id: string): string {
  const base = transliterate(name);
  const suffix = id.replace(/-/g, '').slice(0, 6);
  return base ? `${base}-${suffix}` : `user-${suffix}`;
}

function transliterate(name: string): string {
  const map: Record<string, string> = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e',
    'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
    'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
    'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch',
    'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
  };
  return name
    .toLowerCase()
    .trim()
    .replace(/[а-яё]/g, (ch) => map[ch] || ch)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function translateAuthError(msg: string): string {
  if (msg.includes('Invalid login credentials')) return 'Неверный email или пароль.';
  if (msg.includes('User already registered')) return 'Пользователь с таким email уже зарегистрирован.';
  if (msg.includes('Password should be at least')) return 'Пароль должен содержать минимум 6 символов.';
  if (msg.includes('Unable to validate email')) return 'Некорректный email.';
  if (msg.includes('Email not confirmed')) return 'Сначала подтвердите email. Мы отправляли вам письмо после регистрации.';
  if (msg.includes('For security purposes')) return 'Ссылка восстановления устарела. Запросите новую.';
  if (msg.includes('Token has expired or is invalid')) return 'Ссылка восстановления устарела. Запросите новую.';
  if (msg.includes('Password')) return 'Пароль слишком короткий — минимум 6 символов.';
  if (msg.includes('network') || msg.includes('fetch')) return 'Не удалось подключиться к FilmVerse.';
  return 'Произошла ошибка. Попробуйте ещё раз.';
}
