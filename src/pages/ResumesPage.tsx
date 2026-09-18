import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { ModalShell } from '../components/ModalShell';
import { useRouter } from '../router';
import { useSearchIndexing } from '../hooks/useSearchIndexing';
import { MessageButton } from '../components/MessageButton';

type Resume = { id: string; display_name?: string; headline: string; custom_professions: string[]; cities: string[]; travel_ready: boolean; availability: string | null; rate_text: string | null; description: string; visibility: string; status: string };
const statuses: Record<string, string> = { draft: 'Черновик', active: 'Опубликовано', paused: 'На паузе', closed: 'Закрыто', expired: 'Срок права на публикацию истёк' };
const split = (value: string) => [...new Set(value.split(',').map(s => s.trim()).filter(Boolean))].slice(0, 20);

export function ResumesPage({ create = false }: { create?: boolean }) {
  const { navigate } = useRouter();
  const { user, profile } = useAuth();
  const [rows, setRows] = useState<Resume[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [editing, setEditing] = useState<Resume | null>(() => create ? { id: '', display_name: profile?.full_name || '', headline: profile?.full_name ? `${profile.full_name} — ищу работу` : '', custom_professions: [], cities: profile?.city ? [profile.city] : [], travel_ready: false, availability: '', rate_text: '', description: '', visibility: 'public', status: 'draft' } : null);
  const [busy, setBusy] = useState(false);
  const [paywall, setPaywall] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const share = async (id: string, revoke = false) => {
    setBusy(true); setError(''); setShareLink('');
    try { const r = await supabase.rpc('resume_share', { p_id: id, p_revoke: revoke }); if (r.error) throw r.error;
      if (!revoke) setShareLink(`${window.location.origin}${window.location.pathname}#/resume-share/${id}/${r.data}`);
    } catch { setError('Не удалось изменить ссылку. Повторите попытку.'); } finally { setBusy(false); }
  };
  useEffect(() => {
    let stale = false;
    if (!user) return;
    setLoading(true); setError(''); setRows([]);
    void (async () => {
      try {
        const result = await supabase.from('resume_publications').select('id,display_name,headline,custom_professions,cities,travel_ready,availability,rate_text,description,visibility,status').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50);
        if (result.error) throw result.error;
        if (!stale) setRows(result.data || []);
      } catch { if (!stale) setError('Не удалось загрузить резюме. Повторите попытку.'); }
      finally { if (!stale) setLoading(false); }
    })();
    return () => { stale = true; };
  }, [user, revision]);
  const transition = async (row: Resume, status: string) => {
    setBusy(true); setError('');
    try {
      const { error: failure } = status === 'active'
        ? await supabase.rpc('resume_publish', { p_publication: row.id, p_request: crypto.randomUUID() })
        : await supabase.rpc('resume_transition', { p_publication: row.id, p_status: status });
      if (failure) {
        if (failure.message.includes('resume_entitlement_required')) { setPaywall(true); return; }
        throw failure;
      }
      setRevision(n => n + 1);
    } catch { setError('Изменение не сохранено. Проверьте соединение и повторите попытку.'); }
    finally { setBusy(false); }
  };
  return <section className="p-4 sm:p-8 max-w-4xl mx-auto space-y-5">
    <header><h1 className="text-2xl font-display">Мои резюме</h1><p className="text-txt-secondary mt-2">Резюме — отдельное объявление о поиске работы. Ваш личный профиль остаётся бесплатным.</p></header>
    <button className="btn-primary" disabled={busy} onClick={() => setEditing({ id: '', display_name: profile?.full_name || '', headline: profile?.full_name ? `${profile.full_name} — ищу работу` : '', custom_professions: [], cities: profile?.city ? [profile.city] : [], travel_ready: false, availability: '', rate_text: '', description: '', visibility: 'public', status: 'draft' })}>Создать резюме</button>
    {shareLink && <label className="block">Ссылка для выбранного получателя (доступна каждому, кому её передадут)<input readOnly className="input-field w-full" value={shareLink} onFocus={e => e.target.select()} /></label>}
    {error && <div role="alert" className="text-danger-600">{error} <button onClick={() => setRevision(n => n + 1)}>Повторить</button></div>}
    {loading ? <p role="status">Загружаем резюме…</p> : !rows.length && !error ? <p>Пока нет резюме. Сначала сохраните черновик, затем опубликуйте его.</p> : rows.map(row => <article key={row.id} className="surface p-5 space-y-3">
      <h2 className="font-semibold text-lg">{row.headline}</h2><p className="text-sm text-txt-muted">{statuses[row.status]} · {row.cities.join(', ')}</p>
      <p className="whitespace-pre-wrap">{row.description}</p>
      <div className="flex flex-wrap gap-3">
        <button className="btn-secondary" disabled={busy} onClick={() => setEditing(row)}>Редактировать</button>
        {row.status === 'active' && <button className="btn-secondary" onClick={() => navigate('/resume/' + row.id)}>Открыть публикацию</button>}
        {row.status === 'active' && row.visibility === 'link_only' && <><button className="btn-secondary" disabled={busy} onClick={() => void share(row.id)}>Создать новую ссылку</button><button className="btn-secondary" disabled={busy} onClick={() => void share(row.id, true)}>Отозвать ссылку</button></>}
        {row.status !== 'active' && <button className="btn-primary" disabled={busy} onClick={() => void transition(row, 'active')}>Опубликовать</button>}
        {row.status === 'active' && <button className="btn-secondary" disabled={busy} onClick={() => void transition(row, 'paused')}>Приостановить</button>}
        {row.status !== 'closed' && <button className="btn-secondary" disabled={busy} onClick={() => void transition(row, 'closed')}>Закрыть</button>}
      </div>
    </article>)}
    {editing && <ResumeEditor initial={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); setRevision(n => n + 1); }} />}
    {paywall && <ModalShell title="Публикация резюме" onClose={() => setPaywall(false)}>
      <p>Для публикации нужно действующее право PRO или разовое право публикации резюме. Черновик сохранён.</p>
      <p className="mt-3 text-txt-secondary">Оплата пока не подключена. Списания денег не было. Цена и срок будут показаны до покупки, когда платёжный сервис будет готов.</p>
      <button className="btn-secondary mt-4" onClick={() => setPaywall(false)}>Вернуться к черновику</button>
    </ModalShell>}
  </section>;
}

export function PublicResumePage({ id, token }: { id: string; token?: string }) {
  useSearchIndexing(false);
  const [row, setRow] = useState<(Resume & { user_id: string }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => { let stale = false; setRow(null); setError(''); setLoading(true); void (async () => {
    try { const r = await supabase.rpc('resume_read', { p_id: id, p_token: token || null }); if (r.error) throw r.error; if (!stale) setRow(r.data); }
    catch { if (!stale) setError('Не удалось загрузить публикацию.'); }
    finally { if (!stale) setLoading(false); }
  })(); return () => { stale = true; }; }, [id, token]);
  if (loading) return <p className="p-8" role="status">Загружаем резюме…</p>;
  if (!row) return <p className="p-8">{error || 'Резюме не опубликовано или недоступно.'}</p>;
  return <article className="surface max-w-3xl mx-auto p-6 space-y-4"><h1 className="font-display text-2xl">{row.headline}</h1><p>{row.display_name}</p><p>{row.custom_professions.join(' · ')}</p><p>{row.cities.join(', ')}{row.travel_ready ? ' · Готовность к командировкам' : ''}</p><p>{row.availability}</p><p>{row.rate_text}</p><p className="whitespace-pre-wrap">{row.description}</p><MessageButton targetUserId={row.user_id} /></article>;
}

function ResumeEditor({ initial, onClose, onSaved }: { initial: Resume; onClose: () => void; onSaved: () => void }) {
  const [draft, setDraft] = useState(initial);
  const [cities, setCities] = useState(initial.cities.join(', '));
  const [professions, setProfessions] = useState(initial.custom_professions.join(', '));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return <ModalShell title={initial.id ? 'Редактировать резюме' : 'Новое резюме'} onClose={() => { if (!busy) onClose(); }}>
    <form className="space-y-4" onSubmit={event => {
      event.preventDefault(); setBusy(true); setError('');
      const values = { display_name: draft.display_name || '', headline: draft.headline.trim(), description: draft.description, custom_professions: split(professions), cities: split(cities), travel_ready: draft.travel_ready, availability: draft.availability, rate_text: draft.rate_text, visibility: draft.visibility };
      void (async () => {
        try {
          const query = initial.id ? supabase.from('profile_publications').update(values).eq('id', initial.id) : supabase.from('profile_publications').insert(values);
          const result = await query.select('id').single();
          if (result.error) throw result.error;
          onSaved();
        } catch { setError('Резюме не сохранено. Проверьте поля и подключение.'); }
        finally { setBusy(false); }
      })();
    }}>
      <label className="block">Имя в резюме<input className="input-field w-full" maxLength={160} value={draft.display_name || ''} onChange={e => setDraft({ ...draft, display_name: e.target.value })} /></label>
      <label className="block">Заголовок<input className="input-field w-full" required minLength={2} maxLength={160} value={draft.headline} onChange={e => setDraft({ ...draft, headline: e.target.value })} /></label>
      <label className="block">Желаемые профессии, через запятую<input className="input-field w-full" maxLength={1000} value={professions} onChange={e => setProfessions(e.target.value)} /></label>
      <label className="block">Города, через запятую<input className="input-field w-full" maxLength={1000} value={cities} onChange={e => setCities(e.target.value)} /></label>
      <label className="block"><input type="checkbox" checked={draft.travel_ready} onChange={e => setDraft({ ...draft, travel_ready: e.target.checked })} /> Готовность к командировкам</label>
      <label className="block">Когда можете начать<input className="input-field w-full" maxLength={200} value={draft.availability || ''} onChange={e => setDraft({ ...draft, availability: e.target.value })} /></label>
      <label className="block">Условия и ставка<input className="input-field w-full" maxLength={200} value={draft.rate_text || ''} onChange={e => setDraft({ ...draft, rate_text: e.target.value })} /></label>
      <label className="block">О работе, которую ищете<textarea className="input-field w-full" maxLength={10000} rows={5} value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} /></label>
      <label className="block">Кто видит<select className="input-field w-full" value={draft.visibility} onChange={e => setDraft({ ...draft, visibility: e.target.value })}><option value="public">Публичное резюме — независимо от профиля</option><option value="hiring_members">Только участники с правом найма</option><option value="link_only">Только по специальной ссылке</option></select></label>
      <p className="text-xs text-txt-muted">Сохранение не публикует черновик и не расходует право публикации. Изменения уже опубликованного резюме видны сразу.</p>
      {error && <p role="alert" className="text-danger-600">{error}</p>}
      <button className="btn-primary" disabled={busy}>{busy ? 'Сохраняем…' : 'Сохранить'}</button>
    </form>
  </ModalShell>;
}
