import { createContext, useContext, useEffect, useState, useRef, useCallback, useMemo, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { classifySignup, classifyProfile, ensureProfile, liveSession, type SignupOutcome, type ProfileResult } from '../lib/auth-state';
import type { Profile } from '../types';
import { PROFILE_FIELDS } from '../lib/profile-fields';

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  authLoading: boolean;
  profileLoading: boolean;
  profileStatus: ProfileResult<Profile>['status'] | 'LOADING' | 'IDLE';
  profileError: string | null;
  authError: string | null;
  supabaseReady: boolean;
  isAuthenticated: boolean;
  passwordRecoveryActive: boolean;
  signUp: (fullName: string, email: string, password: string) => Promise<{ error: string | null; outcome: SignupOutcome }>;
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
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [passwordRecoveryActive, setPasswordRecoveryActive] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [profileState, setProfileState] = useState<{
    userId: string | null; result: ProfileResult<Profile> | null; loading: boolean;
  }>({ userId: null, result: null, loading: false });
  const requestRef = useRef(0);
  const activeUserRef = useRef<string | null>(null);
  const user = session?.user ?? null;
  const userId = user?.id;

  useEffect(() => {
    if (!isSupabaseConfigured) { setAuthLoading(false); return; }
    let disposed = false;
    let revision = 0;
    const apply = (next: Session | null) => {
      if (disposed) return;
      const valid = liveSession(next);
      activeUserRef.current = valid?.user.id ?? null;
      setSession(valid);
      setAuthLoading(false);
    };
    // Subscribe first. An older hydration result must never resurrect a signed-out session.
    const { data: listener } = supabase.auth.onAuthStateChange((event, next) => {
      // Initial storage hydration is validated by getSession/getUser below.
      // Ignore its duplicate event so it cannot override a newer sign-in/out.
      if (event === 'INITIAL_SESSION') return;
      revision++;
      if (event === 'SIGNED_OUT' || !next) setPasswordRecoveryActive(false);
      if (event === 'PASSWORD_RECOVERY' && liveSession(next)) {
        setPasswordRecoveryActive(true);
        window.location.hash = '/reset-password';
      }
      apply(event === 'SIGNED_OUT' ? null : next);
    });
    const initialRevision = revision;
    void (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (disposed || revision !== initialRevision) return;
        if (error) throw error;
        if (data.session) {
          const validated = await supabase.auth.getUser();
          if (disposed || revision !== initialRevision) return;
          if (validated.error || !validated.data.user) { apply(null); return; }
        }
        apply(data.session);
      } catch {
        if (!disposed && revision === initialRevision) {
          setAuthError('Не удалось проверить вход. Попробуйте обновить страницу.');
          apply(null);
        }
      }
    })();
    return () => { disposed = true; listener.subscription.unsubscribe(); };
  }, []);

  // Expiry cannot leave authenticated chrome indefinitely if refresh fails/offline.
  useEffect(() => {
    if (!session?.expires_at) return;
    const delay = Math.max(0, session.expires_at * 1000 - Date.now());
    const timer = window.setTimeout(() => {
      activeUserRef.current = null;
      setSession(null);
    }, Math.min(delay, 2147483647));
    return () => window.clearTimeout(timer);
  }, [session]);

  const loadProfile = useCallback(async () => {
    if (!userId) return;
    const request = ++requestRef.current;
    const current = () => activeUserRef.current === userId && requestRef.current === request;
    setProfileState({ userId, result: null, loading: true });
    const result = await ensureProfile(
      () => fetchProfile(userId),
      async () => {
        const fullName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Пользователь';
        return await supabase.from('profiles').insert({
          id: userId, full_name: fullName,
          public_slug: generateUniqueSlug(fullName, userId), onboarding_completed: false,
        });
      },
      current,
    );
    if (current()) setProfileState({ userId, result, loading: false });
  }, [userId, user?.user_metadata?.full_name, user?.email]);
  useEffect(() => {
    const requests = requestRef;
    if (!userId) {
      requestRef.current++;
      setProfileState({ userId: null, result: null, loading: false });
      return;
    }
    void loadProfile();
    return () => { requests.current++; };
  }, [userId, loadProfile]);
  const refreshProfile = loadProfile;

  const signUp = useCallback(async (fullName: string, email: string, password: string) => {
    if (!isSupabaseConfigured) return { error: 'Supabase не настроен.', outcome: 'ERROR' as const };
    const { data, error } = await supabase.auth.signUp({
      email, password, options: { data: { full_name: fullName } },
    });
    const outcome = classifySignup(data, error);
    return { outcome, error: outcome === 'ERROR' ? translateAuthError(error?.message || '') : null };
  }, []);
  const signIn = useCallback(async (email: string, password: string) => {
    setAuthError(null);
    if (!isSupabaseConfigured) return { error: 'Supabase не настроен.' };
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: translateAuthError(error.message) };
    return { error: liveSession(data.session) ? null : 'Не удалось подтвердить вход. Попробуйте ещё раз.' };
  }, []);
  const signOut = useCallback(async () => {
    setAuthError(null);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      // SDK sign-out succeeded; clear even if an event is delayed.
      activeUserRef.current = null;
      requestRef.current++;
      setSession(null);
      setPasswordRecoveryActive(false);
      setProfileState({ userId: null, result: null, loading: false });
    } catch {
      setAuthError('Не удалось выйти. Проверьте соединение и повторите выход.');
    }
  }, []);
  const resetPassword = useCallback(async (email: string) => {
    if (!isSupabaseConfigured) return { error: 'Supabase не настроен.' };
    const redirectTo = window.location.origin;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    return { error: error ? translateAuthError(error.message) : null };
  }, []);
  const updatePassword = useCallback(async (newPassword: string) => {
    if (!isSupabaseConfigured) return { error: 'Supabase не настроен.' };
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (!error) setPasswordRecoveryActive(false);
    return { error: error ? translateAuthError(error.message) : null };
  }, []);

  const result = profileState.userId === userId ? profileState.result : null;
  const profile = result?.status === 'FOUND' ? result.profile : null;
  const profileError = result?.status === 'ERROR' ? result.message : null;
  const profileLoading = !!userId && (profileState.userId !== userId || profileState.loading);
  const profileStatus = profileLoading ? 'LOADING' : result?.status ?? 'IDLE';
  const isAuthenticated = !!liveSession(session);
  const value = useMemo<AuthContextValue>(() => ({
    user, session, profile, authLoading, profileLoading, profileStatus, profileError, authError,
    supabaseReady: isSupabaseConfigured, isAuthenticated, passwordRecoveryActive,
    signUp, signIn, signOut, resetPassword, updatePassword, refreshProfile,
  }), [user, session, profile, authLoading, profileLoading, profileStatus, profileError, authError,
    isAuthenticated, passwordRecoveryActive, signUp, signIn, signOut, resetPassword, updatePassword, refreshProfile]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
async function fetchProfile(userId: string): Promise<ProfileResult<Profile>> {
  try {
    const { data, error } = await supabase.from('profiles').select(PROFILE_FIELDS).eq('id', userId).maybeSingle();
    return classifyProfile(data as Profile | null, error);
  } catch (error) {
    return classifyProfile<Profile>(null, error);
  }
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
  if (msg.includes('Password should be at least')) return 'Пароль должен содержать минимум 6 символов.';
  if (msg.includes('Unable to validate email')) return 'Некорректный email.';
  if (msg.includes('Email not confirmed')) return 'Сначала подтвердите email. Мы отправляли вам письмо после регистрации.';
  if (msg.includes('For security purposes')) return 'Ссылка восстановления устарела. Запросите новую.';
  if (msg.includes('Token has expired or is invalid')) return 'Ссылка восстановления устарела. Запросите новую.';
  if (msg.includes('Password')) return 'Пароль слишком короткий — минимум 6 символов.';
  if (msg.includes('network') || msg.includes('fetch')) return 'Не удалось подключиться к FilmVerse.';
  return 'Произошла ошибка. Попробуйте ещё раз.';
}
