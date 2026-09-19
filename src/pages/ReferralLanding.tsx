import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useAuthModal } from '../components/AuthModal';
import { useRouter } from '../router';
import { useSearchIndexing } from '../hooks/useSearchIndexing';
export function ReferralLanding({code}:{code:string}){
 const {user}=useAuth();const {openRegister}=useAuthModal();const {navigate}=useRouter();useSearchIndexing(false);
 const [info,setInfo]=useState<{destination_path:string;campaign_name:string}|null>(null);const [loading,setLoading]=useState(true);const [error,setError]=useState('');const [busy,setBusy]=useState(false);
 useEffect(()=>{let stale=false;setInfo(null);setLoading(true);setError('');void(async()=>{try{const r=await supabase.rpc('referral_resolve',{p_code:code});if(r.error)throw r.error;if(!stale)setInfo(r.data);}catch{if(!stale)setError('Приглашение недоступно.');}finally{if(!stale)setLoading(false);}})();return()=>{stale=true;};},[code]);
 const proceed=()=>{if(!info)return;if(!user){openRegister();return;}setBusy(true);setError('');void(async()=>{try{const r=await supabase.rpc('referral_attribute',{p_code:code});if(r.error)throw r.error;navigate(info.destination_path);}catch{setError('Не удалось применить приглашение. Можно продолжить без него.');}finally{setBusy(false);}})();};
 return <section className="max-w-xl mx-auto p-6 space-y-4"><h1 className="text-3xl font-display">Приглашение в FilmVerse</h1>{loading&&<p role="status">Проверяем приглашение…</p>}{error&&<p role="alert">{error}</p>}{!loading&&!info&&!error&&<p>Приглашение завершено или недоступно.</p>}{info&&<><h2>{info.campaign_name}</h2><p>Приглашение не подтверждает статус студента, профессиональные связи или личность. Бонус не гарантируется за регистрацию.</p><button className="btn-primary" disabled={busy} onClick={proceed}>{user?'Продолжить по приглашению':'Создать аккаунт'}</button><button className="btn-secondary" onClick={()=>navigate(info.destination_path)}>Продолжить без приглашения</button></>}</section>;
}
