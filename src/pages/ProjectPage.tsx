import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useSearchIndexing } from '../hooks/useSearchIndexing';
type Project = { title: string; city: string | null; logline: string | null; description: string | null; stage: string | null };
export function ProjectPage({ id }: { id: string }) {
  const [row, setRow] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useSearchIndexing(false);
  useEffect(() => {
    let stale = false;
    void (async () => {
      try { const r = await supabase.from('projects').select('title,city,logline,description,stage').eq('id', id).maybeSingle(); if (r.error) throw r.error; if (!stale) setRow(r.data); }
      catch { if (!stale) setError('Не удалось загрузить проект.'); }
      finally { if (!stale) setLoading(false); }
    })();
    return () => { stale = true; };
  }, [id]);
  if (loading) return <p className="p-8" role="status">Загружаем проект…</p>;
  if (!row) return <p className="p-8">{error || 'Проект недоступен.'}</p>;
  return <article className="surface p-6 max-w-4xl mx-auto space-y-4"><h1 className="text-2xl font-display">{row.title}</h1><p>{row.city} · {row.stage}</p><p>{row.logline}</p><p className="whitespace-pre-wrap">{row.description}</p></article>;
}
