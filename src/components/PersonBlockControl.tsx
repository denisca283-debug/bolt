import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
export function PersonBlockControl({ userId }: { userId: string }) {
 const {user}=useAuth();const [blocked,setBlocked]=useState(false);const [busy,setBusy]=useState(true);const [error,setError]=useState('');
 useEffect(()=>{let stale=false;setBusy(true);setError('');setBlocked(false);if(!user||user.id===userId){setBusy(false);return;}void(async()=>{try{const r=await supabase.from('user_blocks').select('blocked_user_id').eq('user_id',user.id).eq('blocked_user_id',userId).maybeSingle();if(r.error)throw r.error;if(!stale)setBlocked(!!r.data);}catch{if(!stale)setError('Не удалось проверить блокировку.');}finally{if(!stale)setBusy(false);}})();return()=>{stale=true;};},[user,userId]);
 if(!user||user.id===userId)return null;
 return <div><button className="text-xs text-txt-muted" disabled={busy||!!error} onClick={()=>{setBusy(true);void(async()=>{try{const r=await(blocked?supabase.from('user_blocks').delete().eq('user_id',user.id).eq('blocked_user_id',userId):supabase.from('user_blocks').insert({blocked_user_id:userId}));if(r.error)throw r.error;setBlocked(!blocked);}catch{setError('Блокировка не изменена. Обновите страницу.');}finally{setBusy(false);}})();}}>{blocked?'Разблокировать пользователя':'Заблокировать пользователя'}</button>{error&&<p role="alert">{error}</p>}{blocked&&<p className="text-xs">Новые личные сообщения и приглашения запрещены. История сохранена.</p>}</div>;
}
