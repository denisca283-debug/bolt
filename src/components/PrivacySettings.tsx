import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
type Privacy = {
  profile_visibility: string; search_discoverable: boolean; search_engine_indexable: boolean;
  message_permission: string; invite_permission: string;
};
const defaults: Privacy = { profile_visibility: 'public', search_discoverable: true, search_engine_indexable: false, message_permission: 'members', invite_permission: 'members' };
export function PrivacySettings({ userId }: { userId: string }) {
  const [value, setValue] = useState<Privacy>(defaults);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false; setReady(false); setNotice('');
    void (async () => {
      const { data, error } = await supabase.from('profile_privacy_settings')
        .select('profile_visibility,search_discoverable,search_engine_indexable,message_permission,invite_permission').eq('user_id', userId).maybeSingle();
      if (cancelled) return;
      if (error) { setNotice('Не удалось загрузить конфиденциальность. Изменения не отправлены.'); return; }
      setValue(data || defaults); setReady(true);
    })().catch(() => { if (!cancelled) setNotice('Нет соединения. Повторите загрузку.'); });
    return () => { cancelled = true; };
  }, [userId, attempt]);
  const save = async () => {
    setBusy(true); setNotice('');
    try {
      const { error } = await supabase.from('profile_privacy_settings').upsert({ user_id: userId, ...value }, { onConflict: 'user_id' });
      setNotice(error ? 'Не удалось сохранить настройки.' : 'Конфиденциальность сохранена.');
    } catch { setNotice('Нет соединения. Настройки не сохранены.'); }
    finally { setBusy(false); }
  };
  return <section className="surface p-5 space-y-4">
    <h2 className="font-display text-lg">Профиль и конфиденциальность</h2>
    <p className="text-sm text-txt-muted">Работодатель по вашему активному отклику и участники принятого проекта видят профессиональные данные даже закрытого профиля. Телефон и email входа автоматически не публикуются.</p>
    {notice && <p role="status" className="text-sm">{notice}</p>}
    {!ready ? <button className="btn-secondary" onClick={() => setAttempt(x => x + 1)}>Повторить загрузку настроек</button> : <>
      <label className="block text-sm">Кто видит профиль
        <select className="input-field mt-1 w-full" value={value.profile_visibility} onChange={e => setValue({ ...value, profile_visibility: e.target.value })}>
          <option value="public">Все</option><option value="members">Участники FilmVerse</option><option value="private">Только я и рабочий контекст</option>
        </select>
      </label>
      {(['search_discoverable', 'search_engine_indexable'] as const).map(key => <label key={key} className="flex gap-3 text-sm">
        <input type="checkbox" checked={value[key]} onChange={e => setValue({ ...value, [key]: e.target.checked })} />
        {key === 'search_discoverable' ? 'Показывать в поиске FilmVerse' : 'Разрешить индексацию публичного профиля поисковиками'}
      </label>)}
      {(['message_permission', 'invite_permission'] as const).map(key => <label key={key} className="block text-sm">
        {key === 'message_permission' ? 'Кто может начать переписку' : 'Кто может приглашать'}
        <select className="input-field mt-1 w-full" value={value[key]} onChange={e => setValue({ ...value, [key]: e.target.value })}>
          <option value="members">Участники FilmVerse с доступом к профилю</option><option value="work_context">Только рабочий контекст</option><option value="none">Никто</option>
        </select>
      </label>)}
      <p className="text-xs text-txt-muted">Существующие диалоги сохраняются. Уже опубликованные фотографии и копии поисковиков не удаляются этой настройкой.</p>
      <button className="btn-primary" disabled={busy} onClick={() => void save()}>{busy ? 'Сохраняем…' : 'Сохранить конфиденциальность'}</button>
    </>}
  </section>;
}
