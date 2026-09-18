import { useState, useEffect, useCallback, useMemo } from 'react';
import { Loader2, MapPin, Users, Clapperboard, Search, ImageOff, Plus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { CreateDialog } from '../components/create/CreateDialog';
import { useAuth } from '../hooks/useAuth';
import { useCompanyCards } from '../hooks/useCompanyCards';
import { useRouter } from '../router';
import { useAuthModal } from '../components/AuthModal';
import type { ProjectRow } from '../types';

const STAGES = ['Все', 'Разработка', 'Препродакшн', 'Съёмки', 'Постпродакшн', 'Завершён'];

export function ProjectsPage() {
  const { navigate } = useRouter();
  const { user } = useAuth();
  const { promptGuest } = useAuthModal();
  const [showCreate, setShowCreate] = useState(false);

  const [items, setItems] = useState<ProjectRow[]>([]);
  const { companies } = useCompanyCards(items);
  const [loading, setLoading] = useState(true);
  const [schemaMissing, setSchemaMissing] = useState(false);
  const [query, setQuery] = useState('');
  const [stage, setStage] = useState('Все');

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      setSchemaMissing(true);
      setLoading(false);
      return;
    }
    setSchemaMissing(false);
    setItems((data || []) as ProjectRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((p) => {
      if (stage !== 'Все' && p.stage !== stage) return false;
      if (q) {
        const hay = `${p.title} ${p.logline || ''} ${p.genre || ''} ${p.city || ''} ${p.director || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, query, stage]);

  return (
    <div className="animate-fade-in">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold text-txt-primary tracking-tight">Проекты</h1>
          <p className="mt-2 text-base text-txt-secondary">Что снимается и кто это делает</p>
        </div>
        <button
          onClick={() => {
            if (!user) {
              promptGuest({ message: 'Чтобы открыть проект, войдите в FilmVerse или создайте аккаунт.' });
              return;
            }
            setShowCreate(true);
          }}
          className="btn-primary"
        >
          <Plus className="h-4 w-4" /> Создать проект
        </button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-txt-muted" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Название, жанр, режиссёр, город…"
          className="input-field pl-10"
        />
      </div>

      <div className="mb-6 flex items-center gap-2 flex-wrap">
        {STAGES.map((s) => (
          <button
            key={s}
            onClick={() => setStage(s)}
            className={`px-3 py-1.5 rounded-lg text-sm border transition-all duration-200 ${
              stage === s
                ? 'bg-surface-400 text-txt-primary border-line-strong'
                : 'bg-surface-700 text-txt-secondary border-line-soft hover:border-line'
            }`}
          >
            {s}
          </button>
        ))}
        <span className="ml-auto text-sm text-txt-muted">
          {loading ? '' : `${visible.length} ${visible.length === 1 ? 'проект' : 'проектов'}`}
        </span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 text-emerald-500 animate-spin" />
        </div>
      ) : schemaMissing ? (
        <div className="surface p-6 max-w-lg">
          <h2 className="text-sm font-semibold text-txt-primary mb-1">База ещё не обновлена</h2>
          <p className="text-sm text-txt-secondary leading-relaxed">
            Разделу «Проекты» нужна таблица <span className="text-txt-primary">projects</span>.
            Выполните миграцию <span className="text-txt-primary">008_content_tables</span>.
          </p>
        </div>
      ) : visible.length === 0 ? (
        <div className="surface p-12 text-center">
          <Clapperboard className="h-8 w-8 text-txt-muted mx-auto mb-4" strokeWidth={1.5} />
          {items.length === 0 ? (
            <>
              <p className="text-txt-primary text-lg font-medium">Проектов пока нет</p>
              <p className="text-txt-secondary text-sm mt-2 max-w-md mx-auto leading-relaxed">
                Откройте проект — и под него можно будет искать людей, а команда увидит,
                на какой он стадии.
              </p>
            </>
          ) : (
            <>
              <p className="text-txt-primary text-lg font-medium">Ничего не найдено</p>
              <p className="text-txt-secondary text-sm mt-1">Попробуйте изменить фильтры</p>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5">
          {visible.map((p) => (
            <div key={p.id} className="group surface overflow-hidden animate-fade-up flex flex-col">
              <div className="relative aspect-[16/9] bg-surface-700 overflow-hidden">
                {p.image_url ? (
                  <img src={p.image_url} alt={p.title} className="portrait-img transition-transform duration-500 group-hover:scale-105" loading="lazy" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center">
                    <ImageOff className="h-6 w-6 text-txt-muted" />
                  </div>
                )}
                {p.stage && (
                  <span className="absolute top-3 left-3 chip chip-fern">{p.stage}</span>
                )}
              </div>
              <div className="p-5 flex-1 flex flex-col">
                {p.genre && <p className="text-xs text-txt-muted mb-1">{p.genre}</p>}
                <h3 className="text-base font-semibold text-txt-primary leading-snug">{p.title}</h3>
                {p.organization_id && <button className="text-xs text-emerald-500 mt-2" disabled={!companies.has(p.organization_id)} onClick={() => navigate('/company/' + companies.get(p.organization_id!)!.slug)}>{companies.get(p.organization_id)?.name || 'Компания'}</button>}
                {p.logline && (
                  <p className="mt-2 text-sm text-txt-secondary leading-relaxed line-clamp-3">{p.logline}</p>
                )}
                <div className="mt-3 pt-3 border-t border-line-soft flex items-center gap-4 text-xs text-txt-secondary">
                  <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-txt-muted" />{p.city || '—'}</span>
                  {p.team_size != null && (
                    <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-txt-muted" />{p.team_size}</span>
                  )}
                </div>
                {p.director && <p className="mt-2 text-xs text-txt-muted">Режиссёр: {p.director}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <CreateDialog
          initialKind="project"
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); load(); }}
        />
      )}
    </div>
  );
}
