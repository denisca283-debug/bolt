import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabaseConfigurationError = !supabaseUrl
  ? 'Не задан VITE_SUPABASE_URL.'
  : !supabaseAnonKey
  ? 'Не задан VITE_SUPABASE_ANON_KEY.'
  : null;

// Keep a syntactically valid client so the module can load and the app can show
// a useful deployment error. App.tsx blocks product data/auth flows when the
// real Vite variables are missing, so this fallback is never a backend.
export const supabase = createClient(
  supabaseUrl || 'https://example.invalid',
  supabaseAnonKey || 'missing-public-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);
