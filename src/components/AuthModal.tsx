import { useState, useEffect, createContext, useContext, useCallback, type ReactNode } from 'react';
import { X, Mail, Lock, User, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useRouter } from '../router';

type AuthMode = 'login' | 'register';

type GuestPromptOptions = {
  message: string;
};

type AuthModalContextValue = {
  openAuth: (mode?: AuthMode) => void;
  openLogin: () => void;
  openRegister: () => void;
  promptGuest: (options: GuestPromptOptions) => void;
  closeAuth: () => void;
};

const AuthModalContext = createContext<AuthModalContextValue | null>(null);

export function useAuthModal() {
  const ctx = useContext(AuthModalContext);
  if (!ctx) throw new Error('useAuthModal must be used within AuthModalProvider');
  return ctx;
}

export function AuthModalProvider({ children }: { children: ReactNode }) {
  const { navigate } = useRouter();
  const { signIn, signUp, supabaseReady, isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<AuthMode>('login');
  const [guestMessage, setGuestMessage] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [emailConfirmSent, setEmailConfirmSent] = useState(false);

  // Close modal via useEffect when auth state flips to authenticated
  useEffect(() => {
    if (isAuthenticated && open) {
      setOpen(false);
      setError(null);
      setLoading(false);
      setGuestMessage(null);
    }
  }, [isAuthenticated, open]);

  const openLogin = useCallback(() => {
    setMode('login');
    setGuestMessage(null);
    setError(null);
    setEmailConfirmSent(false);
    setOpen(true);
  }, []);

  const openRegister = useCallback(() => {
    setMode('register');
    setGuestMessage(null);
    setError(null);
    setEmailConfirmSent(false);
    setOpen(true);
  }, []);

  const openAuth = useCallback((m: AuthMode = 'login') => {
    if (m === 'register') openRegister();
    else openLogin();
  }, [openLogin, openRegister]);

  const promptGuest = useCallback((opts: GuestPromptOptions) => {
    setGuestMessage(opts.message);
    setMode('login');
    setError(null);
    setEmailConfirmSent(false);
    setOpen(true);
  }, []);

  const closeAuth = useCallback(() => {
    setOpen(false);
    setGuestMessage(null);
    setError(null);
    setLoading(false);
  }, []);

  const switchMode = (m: AuthMode) => {
    setMode(m);
    setError(null);
    setGuestMessage(null);
    setEmailConfirmSent(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (mode === 'register' && fullName.trim().length < 2) {
      setError('Введите ваше имя');
      setLoading(false);
      return;
    }
    if (password.length < 6) {
      setError('Пароль должен содержать минимум 6 символов');
      setLoading(false);
      return;
    }

    try {
      if (mode === 'login') {
        const result = await signIn(email, password);
        if (result.error) {
          setError(result.error);
          setLoading(false);
          return;
        }
      } else {
        const result = await signUp(fullName, email, password);
        if (result.error) {
          setError(result.error);
          setLoading(false);
          return;
        }
        if (result.needsEmailConfirm) {
          setEmailConfirmSent(true);
          setLoading(false);
          return;
        }
      }
    } catch {
      setError('Не удалось подключиться к FilmVerse. Попробуйте ещё раз.');
      setLoading(false);
    }

    // Safety timeout — loading will be cleared by the useEffect above
    // when isAuthenticated flips, but if that never happens:
    setTimeout(() => {
      setLoading((prev) => {
        if (prev) {
          setError('Не удалось подключиться к FilmVerse. Попробуйте ещё раз.');
          return false;
        }
        return prev;
      });
    }, 8000);
  };

  const title = emailConfirmSent
    ? 'Подтвердите email'
    : guestMessage
    ? null
    : mode === 'login' ? 'Вход' : 'Регистрация';

  return (
    <AuthModalContext.Provider value={{ openAuth, openLogin, openRegister, promptGuest, closeAuth }}>
      {children}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 animate-fade-in">
          <div className="absolute inset-0 bg-base-950/70 backdrop-blur-sm" onClick={closeAuth} />
          <div className="relative w-full max-w-sm surface p-6 animate-scale-in">
            <button
              onClick={closeAuth}
              className="absolute top-3 right-3 text-txt-muted hover:text-txt-primary transition-colors"
              aria-label="Закрыть"
            >
              <X className="h-5 w-5" />
            </button>

            {emailConfirmSent ? (
              <div className="text-center py-4">
                <div className="flex justify-center mb-4">
                  <CheckCircle2 className="h-12 w-12 text-emerald-500" />
                </div>
                <p className="text-sm text-txt-secondary leading-relaxed mb-2">
                  Мы отправили письмо на <span className="text-txt-primary font-medium">{email}</span>
                </p>
                <p className="text-sm text-txt-secondary leading-relaxed mb-4">
                  Перейдите по ссылке в письме, чтобы активировать аккаунт.
                </p>
                <p className="text-xs text-txt-muted mb-6">
                  Не пришло письмо? Проверьте папку «Спам».
                </p>
                <button onClick={closeAuth} className="text-sm text-txt-secondary hover:text-emerald-500 transition-colors">
                  Продолжить просмотр
                </button>
              </div>
            ) : (
              <>
                {title && (
                  <h2 className="font-display text-xl font-semibold text-txt-primary text-center mb-2">
                    {title}
                  </h2>
                )}

                {guestMessage && (
                  <div className="mb-4 p-3 rounded-lg bg-emerald-200/20 border border-emerald-400/30 flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                    <p className="text-sm text-txt-secondary leading-relaxed">{guestMessage}</p>
                  </div>
                )}

                {!guestMessage && (
                  <p className="text-sm text-txt-secondary text-center mb-6">
                    {mode === 'login' ? 'Рады видеть вас снова' : 'Создайте аккаунт за 30 секунд'}
                  </p>
                )}

                {!supabaseReady && (
                  <div className="mb-4 p-3 rounded-lg bg-warn-200/30 border border-warn-600/30 flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-warn-700 shrink-0 mt-0.5" />
                    <p className="text-xs text-warn-700 leading-relaxed">
                      Supabase не настроен. Проверьте .env
                    </p>
                  </div>
                )}

                {error && (
                  <div className="mb-4 p-3 rounded-lg bg-danger-200/30 border border-danger-600/30 flex items-start gap-2 animate-fade-in">
                    <AlertCircle className="h-4 w-4 text-danger-700 shrink-0 mt-0.5" />
                    <p className="text-xs text-danger-700 leading-relaxed">{error}</p>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  {mode === 'register' && (
                    <div>
                      <label className="block text-xs font-medium text-txt-secondary mb-1.5">Имя</label>
                      <div className="relative">
                        <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-txt-muted" />
                        <input
                          type="text"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="Иван Иванов"
                          className="input-field pl-10"
                          required
                        />
                      </div>
                    </div>
                  )}

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

                  <div>
                    <label className="block text-xs font-medium text-txt-secondary mb-1.5">Пароль</label>
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

                  {mode === 'login' && (
                    <div className="text-right">
                      <button
                        type="button"
                        onClick={() => { closeAuth(); navigate('/forgot-password'); }}
                        className="text-xs text-txt-secondary hover:text-emerald-500 transition-colors"
                      >
                        Забыли пароль?
                      </button>
                    </div>
                  )}

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
                      <span>{mode === 'login' ? 'Войти' : 'Создать аккаунт'}</span>
                    )}
                  </button>
                </form>

                <div className="mt-5 text-center">
                  <button
                    onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
                    className="text-sm text-txt-secondary hover:text-emerald-500 transition-colors"
                  >
                    {mode === 'login' ? 'Нет аккаунта? Зарегистрироваться' : 'Уже есть аккаунт? Войти'}
                  </button>
                </div>

                <div className="mt-3 text-center">
                  <button
                    onClick={closeAuth}
                    className="text-sm text-txt-muted hover:text-txt-secondary transition-colors"
                  >
                    Продолжить просмотр
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </AuthModalContext.Provider>
  );
}
