import { useState, useEffect, useRef, createContext, useContext, useCallback, useMemo, type ReactNode } from 'react';
import { X, Mail, Lock, User, Loader2, AlertCircle } from 'lucide-react';
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
  const [signupNotice, setSignupNotice] = useState(false);
  const attemptRef = useRef(0);
  const submittingRef = useRef(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Close modal via useEffect when auth state flips to authenticated
  useEffect(() => {
    if (isAuthenticated && open) {
      setOpen(false);
      setPassword('');
      setError(null);
      setLoading(false);
      setGuestMessage(null);
    }
  }, [isAuthenticated, open]);

  const openLogin = useCallback(() => {
    attemptRef.current++;
    submittingRef.current = false;
    setLoading(false);
    setMode('login');
    setGuestMessage(null);
    setError(null);
    setSignupNotice(false);
    setOpen(true);
  }, []);

  const openRegister = useCallback(() => {
    attemptRef.current++;
    submittingRef.current = false;
    setLoading(false);
    setMode('register');
    setGuestMessage(null);
    setError(null);
    setSignupNotice(false);
    setOpen(true);
  }, []);

  const openAuth = useCallback((m: AuthMode = 'login') => {
    if (m === 'register') openRegister();
    else openLogin();
  }, [openLogin, openRegister]);

  const promptGuest = useCallback((opts: GuestPromptOptions) => {
    attemptRef.current++;
    submittingRef.current = false;
    setLoading(false);
    setGuestMessage(opts.message);
    setMode('login');
    setError(null);
    setSignupNotice(false);
    setOpen(true);
  }, []);

  const closeAuth = useCallback(() => {
    attemptRef.current++;
    submittingRef.current = false;
    setLoading(false);
    setOpen(false);
    setGuestMessage(null);
    setError(null);
    setLoading(false);
    setPassword('');
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    const focusable = () => Array.from(dialog?.querySelectorAll<HTMLElement>(
      'button:not(:disabled), input:not(:disabled), a[href], [tabindex="0"]'
    ) || []).filter((element) => element.getClientRects().length > 0);
    (dialog?.querySelector<HTMLElement>('input') || focusable()[0] || dialog)?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        closeAuth();
      }
      if (event.key === 'Tab') {
        const elements = focusable();
        const first = elements[0];
        const last = elements[elements.length - 1];
        if (!first) { event.preventDefault(); dialog?.focus(); return; }
        if (!dialog?.contains(document.activeElement) || (event.shiftKey && document.activeElement === first)) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault(); first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [open, closeAuth]);

  const switchMode = (m: AuthMode) => {
    attemptRef.current++;
    submittingRef.current = false;
    setLoading(false);
    setMode(m);
    setError(null);
    setGuestMessage(null);
    setSignupNotice(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;
    const attempt = ++attemptRef.current;
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

    submittingRef.current = true;
    try {
      if (mode === 'login') {
        const result = await signIn(email, password);
        if (attemptRef.current !== attempt) return;
        if (result.error) {
          setError(result.error);
          setLoading(false);
          return;
        }
      } else {
        const result = await signUp(fullName, email, password);
        if (attemptRef.current !== attempt) return;
        if (result.error) {
          setError(result.error);
          setLoading(false);
          return;
        }
        if (result.outcome === 'CHECK_EMAIL') {
          setPassword('');
          setSignupNotice(true);
          setLoading(false);
          return;
        }
      }
    } catch {
      if (attemptRef.current === attempt) setError('Не удалось подключиться к FilmVerse. Попробуйте ещё раз.');
    } finally {
      if (attemptRef.current === attempt) {
        submittingRef.current = false;
        setLoading(false);
      }
    }
  };

  const title = signupNotice
    ? 'Проверьте почту или войдите'
    : guestMessage
    ? null
    : mode === 'login' ? 'Вход' : 'Регистрация';

  // Memoised for the same reason as the router/auth contexts: a fresh object
  // literal here re-renders every consumer on each render of this provider.
  const modalValue = useMemo(
    () => ({ openAuth, openLogin, openRegister, promptGuest, closeAuth }),
    [openAuth, openLogin, openRegister, promptGuest, closeAuth]
  );

  return (
    <AuthModalContext.Provider value={modalValue}>
      {children}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 animate-fade-in">
          <div className="absolute inset-0 bg-base-950/70 backdrop-blur-sm" onClick={closeAuth} />
          <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={title || 'Вход в FilmVerse'} tabIndex={-1} className="relative w-full max-w-sm surface p-6 animate-scale-in">
            <button
              onClick={closeAuth}
              className="absolute top-3 right-3 text-txt-muted hover:text-txt-primary transition-colors"
              aria-label="Закрыть"
            >
              <X className="h-5 w-5" />
            </button>

            {signupNotice ? (
              <div className="text-center py-4">
                <div className="flex justify-center mb-4">
                  <Mail className="h-12 w-12 text-emerald-500" />
                </div>
                <p className="text-sm text-txt-secondary leading-relaxed mb-2">
                  Если это новый адрес, проверьте почту: там может быть ссылка для подтверждения.
                </p>
                <p className="text-sm text-txt-secondary leading-relaxed mb-4">
                  Если у вас уже есть аккаунт FilmVerse, войдите или восстановите пароль.
                </p>
                <p className="text-xs text-txt-muted mb-6">
                  Не пришло письмо? Проверьте папку «Спам».
                </p>
                <div className="flex flex-col gap-3 mb-4">
                  <button onClick={() => switchMode('login')} className="btn-primary">Войти</button>
                  <button onClick={() => { closeAuth(); navigate('/forgot-password'); }} className="text-sm text-txt-secondary">Забыли пароль?</button>
                </div>
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
