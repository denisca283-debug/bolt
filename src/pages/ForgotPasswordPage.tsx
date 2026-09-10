import { useState } from 'react';
import { Mail, Loader2, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { AuthLayout } from '../components/AuthLayout';
import { useRouter } from '../router';

export function ForgotPasswordPage() {
  const { resetPassword, supabaseReady } = useAuth();
  const { navigate } = useRouter();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await resetPassword(email);
    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  };

  if (sent) {
    return (
      <AuthLayout title="Проверьте почту" subtitle="">
        <div className="text-center py-4">
          <div className="flex justify-center mb-4">
            <CheckCircle2 className="h-12 w-12 text-emerald-500" />
          </div>
          <p className="text-sm text-txt-secondary leading-relaxed mb-6">
            Если аккаунт с таким email существует,
            <br />
            мы отправили ссылку для восстановления пароля.
          </p>
          <button
            onClick={() => navigate('/')}
            className="btn-secondary"
          >
            Вернуться в FilmVerse
          </button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Восстановление пароля"
      subtitle="Введите email, который вы использовали при регистрации"
      error={error}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-txt-secondary mb-1.5">Email</label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-txt-muted" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ivan@example.com"
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
            <span>Отправить ссылку</span>
          )}
        </button>
      </form>

      <div className="mt-6 text-center">
        <button
          onClick={() => navigate('/')}
          className="text-sm text-txt-secondary hover:text-emerald-500 transition-colors"
        >
          Вернуться в FilmVerse
        </button>
      </div>
    </AuthLayout>
  );
}
