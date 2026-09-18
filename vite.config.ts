import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { validatePublicSupabaseConfig } from './src/lib/deployment-config';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const url = env.VITE_SUPABASE_URL?.trim();
  const key = env.VITE_SUPABASE_ANON_KEY?.trim();
  // Reject supplied invalid/privileged keys before Vite embeds them in JS.
  // Missing variables deliberately build the explicit configuration-error screen.
  if (key && validatePublicSupabaseConfig(url || 'https://example.supabase.co', key)) {
    throw new Error('Invalid public Supabase configuration. Use only an anon or publishable key; never a server secret.');
  }
  return {
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  };
});
