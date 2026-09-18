import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

type Entitlement = { entitlement_code: string; starts_at: string; expires_at: string | null; remaining_uses: number | null };
// The server enforces own + effective visibility; profile.plan is never consulted.
export function useEntitlements(userId: string | undefined) {
  const [result, setResult] = useState<{ userId: string; rows: Entitlement[]; error: boolean } | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!userId) return;
    setResult(null);
    void (async () => {
      try {
        const { data, error } = await supabase.from('account_entitlements')
          .select('entitlement_code,starts_at,expires_at,remaining_uses').eq('user_id', userId);
        if (!cancelled) setResult({ userId, rows: error ? [] : (data || []), error: !!error });
      } catch { if (!cancelled) setResult({ userId, rows: [], error: true }); }
    })();
    return () => { cancelled = true; };
  }, [userId]);
  const current = result?.userId === userId ? result : null;
  return { loading: !!userId && !current, error: current?.error ?? false,
    isPro: !!current?.rows.some(e => e.entitlement_code === 'pro' && Date.parse(e.starts_at) <= Date.now()
      && (!e.expires_at || Date.parse(e.expires_at) > Date.now())) };
}
