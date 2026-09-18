export function validatePublicSupabaseConfig(url: string | undefined, key: string | undefined): string | null {
  if (!url?.trim()) return 'Не задан VITE_SUPABASE_URL.';
  if (!key?.trim()) return 'Не задан VITE_SUPABASE_ANON_KEY.';
  try {
    const parsed = new URL(url);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
    if ((parsed.protocol !== 'https:' && !(local && parsed.protocol === 'http:')) ||
      parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') {
      return 'Некорректный VITE_SUPABASE_URL.';
    }
  } catch { return 'Некорректный VITE_SUPABASE_URL.'; }
  if (key.startsWith('sb_publishable_')) return null;
  if (key.startsWith('sb_secret_')) return 'Серверный ключ запрещён в браузерной конфигурации.';
  try {
    const parts = key.split('.');
    if (parts.length !== 3) return 'Нужен публичный ключ Supabase.';
    const claims = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    // Decode only to reject privileged credentials; this is not JWT authentication.
    if (claims.role !== 'anon') return 'Нужен публичный ключ Supabase с ролью anon.';
    return null;
  } catch { return 'Нужен публичный ключ Supabase.'; }
}
