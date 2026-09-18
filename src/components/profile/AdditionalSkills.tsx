import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

type Custom = { id: string; name: string; scope: string };
type Tag = { id: string; name: string };
export function AdditionalSkills({ userId, editable }: { userId: string; editable: boolean }) {
  const [skills, setSkills] = useState<Custom[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [scope, setScope] = useState('professional');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let stale = false;
    setSkills([]); setSelected([]); setLoading(true); setError('');
    void (async () => {
      try {
        const results = await Promise.all([
          supabase.from('user_custom_skills').select('id,name,scope').eq('user_id', userId).order('created_at'),
          supabase.from('experience_tags').select('id,name').order('sort_order'),
          supabase.from('user_experience_tags').select('tag_id').eq('user_id', userId),
        ]);
        if (results.some(r => r.error)) throw new Error('load');
        if (!stale) { setSkills(results[0].data || []); setTags(results[1].data || []); setSelected((results[2].data || []).map(t => t.tag_id)); }
      } catch { if (!stale) setError('Не удалось загрузить навыки и опыт.'); }
      finally { if (!stale) setLoading(false); }
    })();
    return () => { stale = true; };
  }, [userId, revision]);
  const mutate = async (operation: 'add' | 'remove' | 'tag', id?: string) => {
    setBusy(true); setError('');
    try {
      const query = operation === 'add' ? supabase.from('user_custom_skills').insert({ name: name.trim(), scope })
        : operation === 'remove' ? supabase.from('user_custom_skills').delete().eq('id', id!)
        : selected.includes(id!) ? supabase.from('user_experience_tags').delete().eq('user_id', userId).eq('tag_id', id!)
        : supabase.from('user_experience_tags').insert({ tag_id: id });
      const { error: failure } = await query;
      if (failure) throw failure;
      if (operation === 'add') setName('');
      setRevision(n => n + 1);
    } catch { setError('Не сохранено. Навык должен быть уникальным, от 2 до 80 символов; максимум 50 своих навыков.'); }
    finally { setBusy(false); }
  };
  return <section className="surface p-5 space-y-4">
    <h2 className="font-semibold">Свои навыки и опыт работы</h2>
    {loading && <p role="status">Загрузка…</p>}
    {error && <p role="alert">{error} <button onClick={() => setRevision(n => n + 1)}>Повторить</button></p>}
    <div className="flex flex-wrap gap-2">{skills.map(skill => <span key={skill.id} className="rounded-lg border border-line-soft px-3 py-2">{skill.name} <small>({skill.scope === 'actor' ? 'актёрский' : 'профессиональный'})</small>{editable && <button disabled={busy} type="button" aria-label={`Удалить навык ${skill.name}`} onClick={() => void mutate('remove', skill.id)} className="ml-2">×</button>}</span>)}</div>
    {editable && <form className="flex flex-wrap gap-2" onSubmit={e => { e.preventDefault(); void mutate('add'); }}>
      <label className="sr-only" htmlFor="custom-skill">Свой навык</label><input id="custom-skill" className="input-field flex-1 min-w-40" required minLength={2} maxLength={80} value={name} onChange={e => setName(e.target.value)} placeholder="Название своего навыка" />
      <select aria-label="Область навыка" className="input-field !w-auto" value={scope} onChange={e => setScope(e.target.value)}><option value="professional">Профессиональный</option><option value="actor">Актёрский</option></select>
      <button className="btn-secondary" disabled={busy || loading}>+ Добавить свой навык</button>
    </form>}
    <h3 className="text-sm font-medium">Опыт в форматах — это не навыки</h3>
    <div className="flex flex-wrap gap-2">{tags.filter(tag => editable || selected.includes(tag.id)).map(tag => editable ? <button key={tag.id} disabled={busy || loading} aria-pressed={selected.includes(tag.id)} className={`btn-secondary ${selected.includes(tag.id) ? 'text-emerald-500' : ''}`} onClick={() => void mutate('tag', tag.id)}>{tag.name}</button> : <span key={tag.id}>{tag.name}</span>)}</div>
    {editable && <p className="text-xs text-txt-muted">Изменения в этом блоке сохраняются сразу. Свои навыки не попадают в общий справочник.</p>}
  </section>;
}
