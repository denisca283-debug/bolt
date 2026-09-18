import { Settings, Globe, Share2, Mail, LogOut, Star, Check } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { VerificationPanel } from '../components/VerificationPanel';
import { useEntitlements } from '../hooks/useEntitlements';
import { PrivacySettings } from '../components/PrivacySettings';
import { ProfileContacts } from '../components/profile/ProfileContacts';
import { ProfileMedia } from '../components/profile/ProfileMedia';
import { useRouter } from '../router';

export function SettingsPage() {
  const { navigate } = useRouter();
  const { user, profile, signOut } = useAuth();
  const [copied, setCopied] = useState(false);

  const publicUrl = profile?.public_slug
    ? `${window.location.origin}/#/u/${profile.public_slug}`
    : null;

  const copyLink = () => {
    if (!publicUrl) return;
    navigator.clipboard?.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const { isPro, loading: entitlementLoading, error: entitlementError } = useEntitlements(user?.id);

  return (
    <div className="animate-fade-in max-w-2xl">
      <div className="mb-6 flex items-center gap-3">
        <Settings className="h-6 w-6 text-emerald-500" strokeWidth={1.6} />
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-txt-primary tracking-tight">Настройки</h1>
          <p className="mt-0.5 text-sm text-txt-secondary">Аккаунт, доверие и доступ</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Verification — the real trust layer */}
      {user && <PrivacySettings key={user.id} userId={user.id} />}
      {user && <ProfileContacts key={`contacts-${user.id}`} userId={user.id} editable />}
      {user && <ProfileMedia key={`media-${user.id}`} userId={user.id} editable />}
      <div className="surface p-5 flex flex-wrap gap-3"><button className="btn-secondary" onClick={() => navigate('/resumes')}>Мои резюме</button><button className="btn-secondary" onClick={() => navigate('/organizations')}>Мои компании</button><button className="btn-secondary" onClick={() => navigate('/forgot-password')}>Сбросить пароль</button></div>
      <VerificationPanel />

        {/* Account */}
        <div className="surface p-6 space-y-4">
          <h2 className="text-sm font-semibold text-txt-primary">Аккаунт</h2>

          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-700 border border-line-soft shrink-0">
              <Mail className="h-4 w-4 text-txt-secondary" strokeWidth={1.6} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-txt-primary truncate">{user?.email || '—'}</p>
              <p className="text-xs text-txt-muted mt-0.5">Почта входа</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-700 border border-line-soft shrink-0">
              <Star className={`h-4 w-4 ${isPro ? 'text-emerald-500' : 'text-txt-secondary'}`} strokeWidth={1.6} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-txt-primary">{entitlementLoading ? 'Проверяем доступ…' : entitlementError ? 'Статус доступа недоступен' : isPro ? 'Про' : 'Бесплатный'}</p>
              <p className="text-xs text-txt-muted mt-0.5">
                {entitlementError ? 'Обновите страницу, чтобы повторить проверку. Вход сохранён.' : 'Оплата подписки пока не подключена. PRO не предоставляет модераторские права.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-700 border border-line-soft shrink-0">
              <Share2 className="h-4 w-4 text-txt-secondary" strokeWidth={1.6} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-txt-primary truncate">
                {publicUrl ? publicUrl.replace(`${window.location.origin}/#`, '') : 'Ссылка появится после заполнения профиля'}
              </p>
              <p className="text-xs text-txt-muted mt-0.5">Доступ по ссылке зависит от настроек видимости</p>
            </div>
            {publicUrl && (
              <button onClick={copyLink} className="btn-secondary shrink-0 !py-2 !px-3 text-xs">
                {copied ? <><Check className="h-3.5 w-3.5 text-emerald-500" /> Скопировано</> : 'Копировать'}
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-700 border border-line-soft shrink-0">
              <Globe className="h-4 w-4 text-txt-secondary" strokeWidth={1.6} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-txt-primary">Русский</p>
              <p className="text-xs text-txt-muted mt-0.5">Язык интерфейса</p>
            </div>
          </div>
        </div>

        {/* Exit */}
        <div className="surface p-6 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-txt-primary">Выйти из аккаунта</p>
            <p className="text-xs text-txt-muted mt-0.5">Профиль и переписка сохранятся</p>
          </div>
          <button onClick={signOut} className="btn-secondary shrink-0">
            <LogOut className="h-4 w-4" /> Выйти
          </button>
        </div>
      </div>
    </div>
  );
}
