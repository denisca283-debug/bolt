import { createContext, useContext, useEffect, useState, useCallback, useMemo, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Profile } from '../types';

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  authLoading: boolean;
  profileLoading: boolean;
  profileError: string | null;
  supabaseReady: boolean;
  isAuthenticated: boolean;
  passwordRecoveryActive: boolean;
  signUp: (fullName: string, email: string, password: string) => Promise<{ error: string | null; needsEmailConfirm: boolean }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>;
  refreshProfile: () => Promise<void>;
};

type ProfileFetchResult =
  | { status: 'found'; profile: Profile }
  | { status: 'missing' }
  | { status: 'error'; message: string };

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
  const [profileError, setProfileError] = useState<string | null>(null);
  const [passwordRecoveryActive, setPasswordRecoveryActive] = useState(false);

  // Supabase session is the only authentication source of truth.
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setAuthLoading(false);
      return;
    }

    let mounted = true;

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!mounted) return;
        if (error) {
          console.error('getSession error:', error.message);
          setSession(null);
          setUser(null);
          return;
        }
        setSession(data.session);
        setUser(data.session?.user ?? null);
      })
      .catch((error: unknown) => {
        if (!mounted) return;
        console.error('getSession failed:', error);
        setSession(null);
        setUser(null);
      })
      .finally(() => {
        if (mounted) setAuthLoading(false);
      });

    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession((prev) => {
        if (!newSession) return null;
        if (
          prev?.access_token === newSession.access_token &&
          prev?.refresh_token === newSession.refresh_token
        ) {
          return prev;
        }
        return newSession;
      });

      setUser((prev) => {
        if (!newSession) return null;
        return prev?.id === newSession.user.id ? prev : newSession.user;
      });

      if (!newSession) {
        setProfile(null);
        setProfileError(null);
      }

      if (event === 'SIGNED_OUT') {
        setPasswordRecoveryActive(false);
      }

      if (event === 'PASSWORD_RECOVERY' && newSession) {
        setPasswordRecoveryActive(true);
        window.location.hash = '/reset-password';
      }

      setAuthLoading(false);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const userId = user?.id;

  // Profile state is separate from auth state. A profile/RLS/network failure
  // must never log the user out or be treated as "profile does not exist".
  useEffect(() => {
    if (!userId || !user) {
      setProfile(null);
      setProfileLoading(false);
      setProfileError(null);
      return;
    }

    let cancelled = false;
    setProfileLoading(true);
    setProfileError(null);

    (async () => {
      const result = await fetchProfile(userId);
      if (cancelled) return;

      if (result.status === 'found') {
        setProfile(result.profile);
        setProfileLoading(false);
        return;
      }

      if (result.status === 'error') {
        setProfileError(result.message);
        setProfileLoading(false);
        return;
      }

      // A confirmed NOT_FOUND is the only state in which we bootstrap a
      // profile row for an authenticated auth user.
      const fullName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Пользователь';
      const slug = generateUniqueSlug(fullName, userId);
      const { error: insertErr } = await supabase.from('profiles').insert({
        id: userId,
        full_name: fullName,
        public_slug: slug,
        onboarding_completed: false,
      });

      if (cancelled) return;

      if (insertErr && insertErr.code !== '23505') {
        setProfileError('Не удалось создать профиль. Обновите страницу или попробуйте позже.');
        setProfileLoading(false);
        return;
      }

      // A duplicate can happen when another tab created the row first.
      const retry = await fetchProfile(userId);
      if (cancelled) return;

      if (retry.status === 'found') {
        setProfile(retry.profile);
        setProfileError(null);
      } else if (retry.status === 'error') {
        setProfileError(retry.message);
      } else {
        setProfileError('Профиль не найден после входа. Попробуйте обновить страницу.');
      }
      setProfileLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, user]);

  const refreshProfile = useCallback(async () => {
    if (!userId) return;
    setProfileLoading(true);
    setProfileError(null);

    const result = await fetchProfile(userId);
    if (result.status === 'found') {
      setProfile(result.profile);
    } else if (result.status === 'error') {
      setProfileError(result.message);
    } else {
      setProfile(null);
      setProfileError('Профиль не найден.');
    }
    setProfileLoading(false);
  }, [userId]);

  const signUp = useCallback(async (fullName: string, email: string, password: string) => {
    if (!isSupabaseConfigured) {
      return { error: 'Supabase не настроен.', needsEmailConfirm: false };
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });

    if (error) {
      return { error: translateAuthError(error.message), needsEmailConfirm: false };
    }

    // Supabase intentionally does not always reveal whether an email already
    // exists. The UI therefore uses privacy-safe wording for this state.
    return {
      error: null,
      needsEmailConfirm: !data.session && !!data.user,
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!isSupabaseConfigured) return { error: 'Supabase не настроен.' };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: translateAuthError(error.message) };
    return { error: null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
    setProfileError(null);
    setPasswordRecoveryActive(false);
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    if (!isSupabaseConfigured) return { error: 'Supabase не настроен.' };
    // The recovery fragment is consumed by Supabase first; routing switches
    // to /reset-password only after PASSWORD_RECOVERY fires.
    const redirectTo = window.location.origin;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) return { error: translateAuthError(error.message) };
    return { error: null };
  }, []);

  const updatePassword = useCallback(async (newPassword: string) => {
    if (!isSupabaseConfigured) return { error: 'Supabase не настроен.' };
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { error: translateAuthError(error.message) };
    setPasswordRecoveryActive(false);
    return { error: null };
  }, []);

  const isAuthenticated = Boolean(session?.user?.id && user?.id === session.user.id);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      profile,
      authLoading,
      profileLoading,
      profileError,
      supabaseReady: isSupabaseConfigured,
      isAuthenticated,
      passwordRecoveryActive,
      signUp,
      signIn,
      signOut,
      resetPassword,
      updatePassword,
      refreshProfile,
    }),
    [
      user,
      session,
      profile,
      authLoading,
      profileLoading,
      profileError,
      isAuthenticated,
      passwordRecoveryActive,
      signUp,
      signIn,
      signOut,
      resetPassword,
      updatePassword,
      refreshProfile,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

async function fetchProfile(userId: string): Promise<ProfileFetchResult> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('fetchProfile error:', error.message);
    return {
      status: 'error',
      message: 'Не удалось загрузить профиль. Сессия сохранена — попробуйте обновить страницу.',
    };
  }

  if (!data) return { status: 'missing' };
  return { status: 'found', profile: data as Profile };
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
  if (msg.includes('Email not confirmed')) return 'Сначала подтвердите email.';
  if (msg.includes('For security purposes')) return 'Ссылка восстановления устарела. Запросите новую.';
  if (msg.includes('Token has expired or is invalid')) return 'Ссылка восстановления устарела. Запросите новую.';
  if (msg.includes('Password')) return 'Пароль слишком короткий — минимум 6 символов.';
  if (msg.includes('network') || msg.includes('fetch')) return 'Не удалось подключиться к FilmVerse.';
  return 'Произошла ошибка. Попробуйте ещё раз.';
}
