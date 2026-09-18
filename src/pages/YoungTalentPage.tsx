import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useSearchIndexing } from '../hooks/useSearchIndexing';
import { supabase } from '../lib/supabase';
import { useRouter } from '../router';
type Talent={id:string;casting_subject_id:string;display_name:string;city:string|null;bio:string;actor_enabled:boolean;model_enabled:boolean};
export function YoungTalentPage(){
 const {user}=useAuth();const {navigate}=useRouter();useSearchIndexing(false);
 const [rows,setRows]=useState<Talent[]>([]);const [city,setCity]=useState('');const [kind,setKind]=useState('');const [page,setPage]=useState(0);const [loading,setLoading]=useState(true);const [error,setError]=useState('');const [busy,setBusy]=useState('');
 useEffect(()=>{let stale=false;setRows([]);setError('');setLoading(true);if(!user){setLoading(false);return;}
 const timer=setTimeout(()=>{void(async()=>{try{const r=await supabase.rpc('young_talent_search',{p_city:city.trim(),p_kind:kind,p_offset:page*24});if(r.error)throw r.error;if(!stale)setRows(r.data||[]);}catch{if(!stale)setError('Доступ требует отдельного проверенного профессионального разрешения. PRO не открывает детские профили. Если доступ уже выдан, повторите позже.');}finally{if(!stale)setLoading(false);}})();},250);return()=>{stale=true;clearTimeout(timer);};},[user,city,kind,page]);
 return <section className="p-4 sm:p-8 space-y-5"><h1 className="text-3xl font-display">Young Talent</h1><p>Дети-актёры и дети-модели. Общение — только с подтверждённым представителем.</p><div className="flex flex-wrap gap-3"><input className="input-field" aria-label="Город Young Talent" placeholder="Город" value={city} onChange={e=>{setCity(e.target.value);setPage(0);}}/><select className="input-field" aria-label="Специализация Young Talent" value={kind} onChange={e=>{setKind(e.target.value);setPage(0);}}><option value="">Все специализации</option><option value="actor">Дети-актёры</option><option value="model">Дети-модели</option></select></div>
 {!user&&<p>Войдите для проверки прав доступа.</p>}{loading&&<p role="status">Проверяем доступ…</p>}{error&&<p role="alert">{error}</p>}{!loading&&!error&&user&&!rows.length&&<p>Доступных профилей по этим условиям нет.</p>}
 <div className="grid sm:grid-cols-2 gap-4">{rows.map(row=><article className="surface p-5 space-y-3" key={row.id}><h2 className="text-xl">{row.display_name}</h2><p>{row.city}</p><p>{row.bio}</p><p className="text-sm text-txt-secondary">Профиль управляется подтверждённым родителем / законным представителем.</p><button className="btn-primary" disabled={!!busy} onClick={()=>{setBusy(row.id);void(async()=>{try{const r=await supabase.rpc('minor_contact',{p_subject:row.casting_subject_id});if(r.error||!r.data)throw new Error();navigate('/messages/'+r.data);}catch{setError('Связаться с представителем сейчас невозможно.');}finally{setBusy('');}})();}}>Связаться с представителем</button></article>)}</div>
 <div className="flex gap-4"><button disabled={!page||loading} onClick={()=>setPage(p=>p-1)}>Назад</button><span>{page+1}</span><button disabled={rows.length<24||loading} onClick={()=>setPage(p=>p+1)}>Далее</button></div></section>;
}
