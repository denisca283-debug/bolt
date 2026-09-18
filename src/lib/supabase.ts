import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { validatePublicSupabaseConfig } from './deployment-config';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();

export const supabaseConfigurationError = validatePublicSupabaseConfig(supabaseUrl, supabaseAnonKey);
export const isSupabaseConfigured = supabaseConfigurationError === null;

// A missing configuration never constructs a client, starts auth or makes requests.
// App renders the deployment failure; accidental calls elsewhere fail immediately.
export const supabase: SupabaseClient = isSupabaseConfigured ? createClient(
  supabaseUrl!,
  supabaseAnonKey!,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
) : new Proxy({} as SupabaseClient, {
  get() { throw new Error(supabaseConfigurationError || 'Supabase configuration unavailable'); },
});
