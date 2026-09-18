import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
export type CompanyCard = { id: string; name: string; slug: string; logo_url: string | null; organization_type: string };
/** Batch only owners referenced by the current result set; never fetch a directory per card. */
export function useCompanyCards(rows: { organization_id?: string | null }[]) {
  const key = [...new Set(rows.map(r => r.organization_id).filter((id): id is string => !!id))].sort().join(',');
  const [result, setResult] = useState<{ key: string; rows: CompanyCard[]; error: boolean } | null>(null);
  useEffect(() => {
    let stale = false;
    if (!key) return;
    void (async () => {
      try {
        const ids = key.split(',');
        const batches = Array.from({ length: Math.ceil(ids.length / 100) }, (_, i) => ids.slice(i * 100, i * 100 + 100));
        const results = await Promise.all(batches.map(p_ids => supabase.rpc('company_cards', { p_ids })));
        if (results.some(r => r.error || !Array.isArray(r.data))) throw new Error('company cards');
        if (!stale) setResult({ key, rows: results.flatMap(r => r.data || []), error: false });
      } catch { if (!stale) setResult({ key, rows: [], error: true }); }
    })();
    return () => { stale = true; };
  }, [key]);
  const current = result?.key === key ? result : null;
  return { companies: new Map((current?.rows || []).map(c => [c.id, c])), error: !!key && !!current?.error };
}
