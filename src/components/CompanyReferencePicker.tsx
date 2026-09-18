import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
/** Public directory only; choosing an organization never grants membership or verification. */
export function CompanyReferencePicker(){
 const [query,setQuery]=useState('');const [id,setId]=useState('');const [rows,setRows]=useState<{id:string;name:string}[]>([]);const [error,setError]=useState('');
 useEffect(()=>{let stale=false;const timer=setTimeout(()=>{void(async()=>{const r=await supabase.rpc('company_search',{p_query:query,p_type:'',p_city:'',p_offset:0});if(!stale){setError(r.error?'Каталог компаний недоступен. Можно указать представителя вручную.':'');setRows(r.error?[]:r.data||[]);}})();},250);return()=>{stale=true;clearTimeout(timer);};},[query]);
 return <div className="space-y-2"><label className="block">Найти компанию представителя<input className="input-field" value={query} maxLength={160} onChange={e=>{setQuery(e.target.value);setId('');}}/></label><label className="block">Связь с компанией<select name="organization_id" className="input-field" value={id} onChange={e=>setId(e.target.value)}><option value="">Без связи — представитель указан вручную</option>{rows.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label>{error&&<p role="alert">{error}</p>}<p className="text-xs text-txt-muted">Связь заявлена вами; она не подтверждает полномочия агентства или вашу верификацию.</p></div>;
}
