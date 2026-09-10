import { useState } from 'react';
import { Lock, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { AuthLayout } from '../components/AuthLayout';
import { useRouter } from '../router';

export function ResetPasswordPage() {
  const { updatePassword, supabaseReady } = useAuth();
  const { navigate } = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('Пароль должен содержать минимум 6 символов');
      return;
    }
    if (password !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }

    setLoading(true);
    const result = await updatePassword(password);
    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }
    setSuccess(true);
    setLoading(false);
  };

  if (success) {
    return (
      <AuthLayout title="Готово" subtitle="">
        <div className="text-center py-4">
          <div className="flex justify-center mb-4">
            <CheckCircle2 className="h-12 w-12 text-emerald-500" />
          </div>
          <p className="text-sm text-txt-secondary leading-relaxed mb-6">
            Пароль успешно изменён
          </p>
          <button
            onClick={() => navigate('/')}
            className="btn-primary"
          >
            Войти в FilmVerse
          </button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Новый пароль"
      subtitle="Придумайте новый пароль для вашего аккаунта"
      error={error}
    >
      {/* Invalid/expired recovery link warning */}
      {!supabaseReady && (
        <div className="mb-4 p-3 rounded-lg bg-warn-200/30 border border-warn-600/30 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-warn-700 shrink-0 mt-0.5" />
          <p className="text-xs text-warn-700 leading-relaxed">
            Ссылка восстановления может быть устаревшей. Если не удаётся изменить пароль, запросите новую ссылку.
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-txt-secondary mb-1.5">Новый пароль</label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-txt-muted" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Минимум 6 символов"
              className="input-field pl-10"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-txt-secondary mb-1.5">Повторите пароль</label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-txt-muted" />
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Введите пароль ещё раз"
              className="input-field pl-10"
              required
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !supabaseReady}
          className="btn-primary w-full !py-3"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Подождите…</span>
            </>
          ) : (
            <span>Изменить пароль</span>
          )}
        </button>
      </form>

      <div className="mt-6 text-center">
        <button
          onClick={() => navigate('/forgot-password')}
          className="text-sm text-txt-secondary hover:text-emerald-500 transition-colors"
        >
          Запросить новую ссылку
        </button>
      </div>
    </AuthLayout>
  );
}
