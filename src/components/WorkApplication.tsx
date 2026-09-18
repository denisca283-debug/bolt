import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useAuthModal } from './AuthModal';
import { supabase } from '../lib/supabase';
export function WorkApplication({workId}:{workId:string}){
 const {user}=useAuth();const {openLogin}=useAuthModal();const [row,setRow]=useState<{id:string;status:string}|null>(null);const [busy,setBusy]=useState(false);const [loading,setLoading]=useState(true);const [error,setError]=useState('');const [revision,setRevision]=useState(0);
 useEffect(()=>{let stale=false;setRow(null);setError('');if(!user){setLoading(false);return;}setLoading(true);void(async()=>{try{const r=await supabase.from('work_applications').select('id,status').eq('work_id',workId).eq('user_id',user.id).maybeSingle();if(r.error)throw r.error;if(!stale)setRow(r.data);}catch{if(!stale)setError('Не удалось проверить отклик.');}finally{if(!stale)setLoading(false);}})();return()=>{stale=true;};},[user,workId,revision]);
 const act=async()=>{if(!user){openLogin();return;}setBusy(true);setError('');try{const r=await(row?supabase.from('work_applications').update({status:'withdrawn'}).eq('id',row.id):supabase.from('work_applications').insert({work_id:workId})).select('id,status').single();if(r.error)throw r.error;setRow(r.data);}catch{setError('Отклик не сохранён. Повторите попытку.');}finally{setBusy(false);}};
 return <div className="space-y-2">{error?<p role="alert">{error} <button onClick={()=>setRevision(n=>n+1)}>Повторить</button></p>:<button className="btn-primary" disabled={busy||loading||row?.status==='withdrawn'} onClick={()=>void act()}>{loading?'Проверяем отклик…':row?.status==='withdrawn'?'Отклик отозван':row?'Отозвать отклик':'Откликнуться'}</button>}{row?.status==='applied'&&<p role="status">Отклик сохранён. Организатор может просмотреть ваш профиль и разрешённые рабочие данные.</p>}</div>;
}
