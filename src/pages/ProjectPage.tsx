import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useSearchIndexing } from '../hooks/useSearchIndexing';
import { useAuth } from '../hooks/useAuth';
import { useOrganization } from '../hooks/useOrganization';
import { CreateDialog } from '../components/create/CreateDialog';
import { CastingWorkspace } from '../components/CastingWorkspace';
import { ProjectSupport } from '../components/StudentSupport';
type Project = { title: string; city: string | null; logline: string | null; description: string | null; stage: string | null; user_id: string | null; organization_id: string | null; visibility: string; student_project: boolean; thesis_project: boolean };
export function ProjectPage({ id }: { id: string }) {
  const { user } = useAuth(); const organization = useOrganization();
  const [verified, setVerified] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hiring, setHiring] = useState(false);
  const [row, setRow] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useSearchIndexing(false);
  useEffect(() => {
    let stale = false; setLoading(true); setError(''); setRow(null); setVerified(false);
    void (async () => {
      try { const [r,b] = await Promise.all([supabase.from('projects').select('title,city,logline,description,stage,user_id,organization_id,visibility,student_project,thesis_project').eq('id', id).maybeSingle(),supabase.rpc('student_project_badge',{p_id:id})]); if (r.error || b.error) throw r.error || b.error; if (!stale) {setRow(r.data);setVerified(b.data===true);} }
      catch { if (!stale) setError('Не удалось загрузить проект.'); }
      finally { if (!stale) setLoading(false); }
    })();
    return () => { stale = true; };
  }, [id]);
  if (loading) return <p className="p-8" role="status">Загружаем проект…</p>;
  if (!row) return <p className="p-8">{error || 'Проект недоступен.'}</p>;
  const canManage = !!user && (row.organization_id ? organization.can('manage_projects',row.organization_id) : row.user_id===user.id);
  return <article className="surface p-6 max-w-4xl mx-auto space-y-4"><h1 className="text-2xl font-display">{row.title}</h1>{row.student_project&&<p className="text-sky-400">{verified?'Подтверждённый студенческий проект':'Студенческий проект — самоописание'}{row.thesis_project?' · Дипломный проект':''}</p>}<p>{row.city} · {row.stage}</p><p>{row.logline}</p><p className="whitespace-pre-wrap">{row.description}</p>
  {canManage&&<form className="space-y-3 border-t border-line-soft pt-4" onSubmit={e=>{e.preventDefault();const d=new FormData(e.currentTarget);setSaving(true);setError('');void(async()=>{try{const values={title:String(d.get('title')),description:String(d.get('description')),visibility:String(d.get('visibility'))};const r=await supabase.from('projects').update(values).eq('id',id).select('id').single();if(r.error)throw r.error;setRow({...row,...values});}catch{setError('Изменения не сохранены.');}finally{setSaving(false);}})();}}><h2 className="font-semibold">Управление проектом</h2><label className="block">Название<input name="title" className="input-field w-full" required minLength={2} maxLength={200} defaultValue={row.title}/></label><label className="block">Описание<textarea name="description" className="input-field w-full" maxLength={5000} defaultValue={row.description||''}/></label><label className="block">Видимость<select name="visibility" className="input-field" defaultValue={row.visibility}><option value="private">Приватный</option><option value="unlisted">По прямой ссылке</option><option value="public">Публичный</option></select></label><button className="btn-secondary" disabled={saving}>Сохранить проект</button>{error&&<p role="alert">{error}</p>}</form>}
  {canManage&&<button className="btn-secondary" onClick={()=>setHiring(true)}>Найти модель / актёра / специалиста</button>}
  {hiring&&<CreateDialog initialKind="work" allowKindSwitch={false} projectSource={{id,title:row.title,city:row.city||'',visibility:row.visibility}} onClose={()=>setHiring(false)} onCreated={()=>setHiring(false)}/>}
  {canManage&&<CastingWorkspace projectId={id}/>}
  {row.student_project&&<ProjectSupport projectId={id} verified={verified} canManage={canManage}/>}</article>;
}
