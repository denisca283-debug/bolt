export type AuthSession = { user: { id: string }; access_token: string; expires_at?: number };
export function liveSession<T extends AuthSession>(session: T | null, now = Date.now()): T | null {
  return session?.user?.id && session.access_token &&
    (!session.expires_at || session.expires_at * 1000 > now) ? session : null;
}
export type SignupOutcome = 'AUTHENTICATED' | 'CHECK_EMAIL' | 'ERROR';
export function classifySignup(
  data: { session: AuthSession | null; user?: unknown },
  error: { code?: string; message: string } | null,
): SignupOutcome {
  // Never inspect identities or the returned user to discover account existence.
  if (error) {
    return error.code === 'user_already_exists' || error.code === 'email_exists' ||
      /already registered|already been registered/i.test(error.message) ? 'CHECK_EMAIL' : 'ERROR';
  }
  return liveSession(data.session) ? 'AUTHENTICATED' : 'CHECK_EMAIL';
}
export type ProfileResult<T> =
  | { status: 'FOUND'; profile: T }
  | { status: 'NOT_FOUND' }
  | { status: 'ERROR'; message: string };
export function classifyProfile<T>(data: T | null, error: unknown): ProfileResult<T> {
  if (error) return { status: 'ERROR', message: 'Не удалось загрузить профиль. Вход сохранён. Попробуйте ещё раз.' };
  return data === null ? { status: 'NOT_FOUND' } : { status: 'FOUND', profile: data };
}
export async function ensureProfile<T>(
  read: () => Promise<ProfileResult<T>>,
  insert: () => Promise<{ error: { code?: string } | null }>,
  current: () => boolean,
): Promise<ProfileResult<T>> {
  try {
    const result = await read();
    if (result.status !== 'NOT_FOUND' || !current()) return result;
    const { error } = await insert();
    if (error && error.code !== '23505') {
      return { status: 'ERROR', message: 'Не удалось сохранить профиль. Вход сохранён. Попробуйте ещё раз.' };
    }
    if (!current()) return { status: 'NOT_FOUND' };
    const fresh = await read();
    return fresh.status === 'NOT_FOUND'
      ? { status: 'ERROR', message: 'Профиль недоступен после сохранения. Попробуйте ещё раз.' }
      : fresh;
  } catch {
    return classifyProfile<T>(null, new Error('Request failed'));
  }
}
