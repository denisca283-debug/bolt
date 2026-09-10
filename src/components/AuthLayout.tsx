import type { ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';
import { Logo } from '../components/Logo';
import { useAuth } from '../hooks/useAuth';

type AuthLayoutProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
  error?: string | null;
};

export function AuthLayout({ title, subtitle, children, error }: AuthLayoutProps) {
  const { supabaseReady } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-900 px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Logo size={40} variant="emerald" />
        </div>

        {/* Card */}
        <div className="surface p-6 sm:p-8">
          <h1 className="font-display text-2xl font-semibold text-txt-primary text-center mb-2">
            {title}
          </h1>
          <p className="text-sm text-txt-secondary text-center mb-6">
            {subtitle}
          </p>

          {/* Supabase not configured warning */}
          {!supabaseReady && (
            <div className="mb-4 p-3 rounded-lg bg-warn-200/30 border border-warn-600/30 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-warn-700 shrink-0 mt-0.5" />
              <p className="text-xs text-warn-700 leading-relaxed">
                Supabase не настроен. Добавьте VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY в файл .env
              </p>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-danger-200/30 border border-danger-600/30 flex items-start gap-2 animate-fade-in">
              <AlertCircle className="h-4 w-4 text-danger-700 shrink-0 mt-0.5" />
              <p className="text-xs text-danger-700 leading-relaxed">{error}</p>
            </div>
          )}

          {children}
        </div>
      </div>
    </div>
  );
}
