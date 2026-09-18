import { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, ShieldAlert, Clock, Loader2, BadgeCheck, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import type { VerificationRecord } from '../types';

type TypeDef = {
  key: string;
  title: string;
  what: string;
  how: string;
};

/**
 * Verification status is independent of payment and discussion permissions.
 */
const TYPES: TypeDef[] = [
  {
    key: 'identity',
    title: 'Личность',
    what: 'Подтверждает, что аккаунт принадлежит реальному человеку.',
    how: 'Модератор сверяет имя в профиле с документом. Документ нигде не публикуется.',
  },
  {
    key: 'professional',
    title: 'Профессия',
    what: 'Подтверждает, что вы действительно работаете в этой профессии.',
    how: 'Подойдут ссылки на проекты, титры, портфолио или рекомендация коллеги.',
  },
];

const STATUS_LABEL: Record<string, string> = {
  pending: 'На проверке',
  approved: 'Пройдена',
  rejected: 'Отклонена',
  revoked: 'Отозвана',
};

export function VerificationPanel() {
  const { user } = useAuth();
  const [records, setRecords] = useState<VerificationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyType, setBusyType] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notesFor, setNotesFor] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  const userId = user?.id;

  const load = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    const { data, error: err } = await supabase
      .from('verification_records')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (err) {
      setError('Не удалось загрузить статус верификации.');
      setLoading(false);
      return;
    }
    setRecords((data || []) as VerificationRecord[]);
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const latestFor = (type: string) => records.find((r) => r.verification_type === type) || null;
  const approvedTypes = new Set(
    records.filter((r) => r.status === 'approved').map((r) => r.verification_type)
  );
  const doubleVerified = approvedTypes.size >= 2;

  const submit = async (type: string) => {
    if (!userId) return;
    setBusyType(type);
    setError(null);

    // The policy requires status='pending' with no reviewer — a user cannot
    // approve themselves, here or by calling the API directly.
    const { data, error: err } = await supabase
      .from('verification_records')
      .insert({ user_id: userId, verification_type: type, status: 'pending', notes: notes.trim() || null })
      .select('id')
      .single();

    setBusyType(null);

    if (err || !data) {
      setError('Не удалось отправить заявку. Попробуйте ещё раз.');
      return;
    }
    setNotesFor(null);
    setNotes('');
    await load();
  };

  if (!user) return null;

  return (
    <div className="surface p-6">
      <div className="flex items-start gap-3 mb-5">
        <ShieldCheck className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" strokeWidth={1.8} />
        <div>
          <h2 className="text-sm font-semibold text-txt-primary">Верификация</h2>
          <p className="text-xs text-txt-secondary mt-1 leading-relaxed">
            Верификация — это проверка модератором, а не подписка и не заполненность профиля.
            Подтвердить себя самому нельзя: заявка уходит на проверку.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 text-emerald-500 animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {TYPES.map((t) => {
            const rec = latestFor(t.key);
            const status = rec?.status;
            const canApply = !rec || status === 'rejected' || status === 'revoked';

            return (
              <div key={t.key} className="p-4 rounded-lg bg-surface-700 border border-line-soft">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-txt-primary">{t.title}</p>
                      {status && (
                        <span className={`chip !py-0.5 ${
                          status === 'approved' ? 'chip-fern'
                            : status === 'pending' ? 'chip-stone'
                            : 'bg-danger-200/40 text-danger-700 border border-danger-600/30'
                        }`}>
                          {status === 'approved' && <BadgeCheck className="h-3 w-3" />}
                          {status === 'pending' && <Clock className="h-3 w-3" />}
                          {(status === 'rejected' || status === 'revoked') && <ShieldAlert className="h-3 w-3" />}
                          {STATUS_LABEL[status] || status}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-txt-secondary mt-1 leading-relaxed">{t.what}</p>
                    <p className="text-xs text-txt-muted mt-1 leading-relaxed">{t.how}</p>
                    {rec?.notes && status === 'rejected' && (
                      <p className="text-xs text-danger-700 mt-1.5">Причина: {rec.notes}</p>
                    )}
                  </div>

                  {canApply && notesFor !== t.key && (
                    <button onClick={() => { setNotesFor(t.key); setNotes(''); }} className="btn-secondary shrink-0 !py-2 !px-3 text-xs">
                      Подать заявку
                    </button>
                  )}
                </div>

                {notesFor === t.key && (
                  <div className="mt-3 pt-3 border-t border-line-soft">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-medium text-txt-secondary">
                        Что приложить к заявке
                      </label>
                      <button onClick={() => setNotesFor(null)} className="text-txt-muted hover:text-txt-primary" aria-label="Отмена">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                      placeholder={
                        t.key === 'identity'
                          ? 'Как с вами связаться для сверки документа'
                          : 'Ссылки на проекты, титры, портфолио'
                      }
                      className="input-field resize-none text-sm"
                    />
                    <button
                      onClick={() => submit(t.key)}
                      disabled={busyType === t.key}
                      className="btn-primary mt-2 !py-2 text-xs"
                    >
                      {busyType === t.key ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Отправляем…</> : 'Отправить на проверку'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 rounded-lg bg-danger-200/30 border border-danger-600/30">
          <p className="text-xs text-danger-700">{error}</p>
        </div>
      )}

      {/* Double verification */}
      <div className={`mt-4 p-4 rounded-lg border ${
        doubleVerified ? 'bg-emerald-200/20 border-emerald-400/40' : 'bg-surface-700 border-line-soft'
      }`}>
        <div className="flex items-center gap-2 mb-1.5">
          <BadgeCheck className={`h-4 w-4 ${doubleVerified ? 'text-emerald-600' : 'text-txt-muted'}`} />
          <p className={`text-sm font-medium ${doubleVerified ? 'text-emerald-600' : 'text-txt-primary'}`}>
            Двойная верификация {doubleVerified ? '— пройдена' : `— ${approvedTypes.size} из 2`}
          </p>
        </div>
        <p className="text-xs text-txt-secondary leading-relaxed">
          Верификация подтверждает личность и профессиональный опыт. Создание обсуждений
          департамента требует отдельного разрешения FilmVerse. Подписка PRO не покупает
          верификацию и не предоставляет это разрешение.
        </p>
      </div>
    </div>
  );
}
