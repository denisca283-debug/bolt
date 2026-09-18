import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ChevronLeft, Search, Plus, Loader2, MapPin, Calendar, Users, Wallet, Briefcase, Trash2,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useRouter } from '../router';
import { ShareButton, Badge, Avatar } from '../components/ui';
import { MessageButton } from '../components/MessageButton';
import { CreateDialog } from '../components/create/CreateDialog';
import { useAuthModal } from '../components/AuthModal';
import type { WorkOpportunity, Department, AuthorLite } from '../types';

const AUDIENCES = ['Все', 'Актёрам', 'Специалистам'] as const;

function daysAgo(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (d <= 0) return 'сегодня';
  if (d === 1) return 'вчера';
  return `${d} дн. назад`;
}

export function WorkPage() {
  const { user } = useAuth();
  const { promptGuest } = useAuthModal();
  const { navigate } = useRouter();
  const [showCreate, setShowCreate] = useState(false);

  const [items, setItems] = useState<WorkOpportunity[]>([]);
  const [authors, setAuthors] = useState<Map<string, AuthorLite>>(new Map());
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [schemaMissing, setSchemaMissing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [audience, setAudience] = useState<(typeof AUDIENCES)[number]>('Все');
  const [deptId, setDeptId] = useState('Все');
  const [city, setCity] = useState('Все');

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('work_opportunities')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(300);

    if (error) {
      setSchemaMissing(true);
      setLoading(false);
      return;
    }
    setSchemaMissing(false);
    const rows = (data || []) as WorkOpportunity[];
    setItems(rows);

    const ids = [...new Set(rows.map((r) => r.user_id))];
    if (ids.length > 0) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, full_name, public_slug, avatar_url, city')
        .in('id', ids);
      setAuthors(new Map(
        ((profs || []) as { id: string; full_name: string | null; public_slug: string | null; avatar_url: string | null; city: string | null }[])
          .map((p) => [p.id, {
            id: p.id,
            name: p.full_name || 'Пользователь FilmVerse',
            slug: p.public_slug,
            avatarUrl: p.avatar_url,
            city: p.city,
          }])
      ));
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from('departments').select('*').order('sort_order');
      if (!cancelled && data) setDepartments(data as Department[]);
    })();
    return () => { cancelled = true; };
  }, []);

  const cities = useMemo(() => {
    const set = new Set(items.map((i) => i.city).filter(Boolean) as string[]);
    return ['Все', ...[...set].sort((a, b) => a.localeCompare(b, 'ru'))];
  }, [items]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((w) => {
      if (audience === 'Актёрам' && w.audience !== 'Актёры') return false;
      if (audience === 'Специалистам' && w.audience !== 'Специалисты') return false;
      if (deptId !== 'Все' && w.department_id !== deptId) return false;
      if (city !== 'Все' && w.city !== city) return false;
      if (q) {
        const hay = `${w.title} ${w.type} ${w.project_name || ''} ${w.description || ''} ${w.city || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, query, audience, deptId, city]);

  const selected = items.find((i) => i.id === selectedId) || null;
  const selectedAuthor = selected ? authors.get(selected.user_id) || null : null;

  const removeOwn = async (id: string) => {
    const { data } = await supabase.from('work_opportunities').delete().eq('id', id).select('id');
    if (data && data.length > 0) {
      setSelectedId(null);
      load();
    }
  };

  // ── Detail ────────────────────────────────────────────────────────
  if (selected) {
    const meta = [
      { icon: MapPin, label: 'Город', value: selected.city || '—' },
      { icon: Calendar, label: 'Смены', value: selected.shoot_date || '—' },
      { icon: Users, label: 'Мест', value: selected.spots_total ? String(selected.spots_total) : '—' },
      { icon: Wallet, label: 'Оплата', value: selected.pay || 'По договорённости' },
    ];

    return (
      <div className="animate-fade-in max-w-3xl">
        <button
          onClick={() => setSelectedId(null)}
          className="mb-5 inline-flex items-center gap-1.5 text-sm text-txt-secondary hover:text-txt-primary transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          К списку работ
        </button>

        <div className="surface p-6 mb-5">
          <div className="flex items-center justify-between mb-3">
            <Badge variant="fern">{selected.type}</Badge>
            <ShareButton />
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-txt-primary tracking-tight">
            {selected.title}
          </h1>
          {selected.project_name && (
            <p className="mt-2 text-sm text-txt-secondary">Проект: {selected.project_name}</p>
          )}
          {selected.age_range && (
            <p className="mt-1 text-sm text-txt-secondary">Возраст: {selected.age_range}</p>
          )}

          <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-4 py-5 border-y border-line-soft">
            {meta.map((m) => (
              <div key={m.label}>
                <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-txt-muted">
                  <m.icon className="h-3.5 w-3.5" /> {m.label}
                </p>
                <p className="mt-1 text-sm text-txt-primary">{m.value}</p>
              </div>
            ))}
          </div>

          {selected.description && (
            <p className="mt-5 text-sm text-txt-secondary leading-relaxed whitespace-pre-line">
              {selected.description}
            </p>
          )}

          <div className="mt-6 flex flex-wrap gap-2">
            {selectedAuthor && user?.id !== selected.user_id && (
              <MessageButton
                targetUserId={selectedAuthor.id}
                targetName={selectedAuthor.name}
                label="Откликнуться"
                variant="primary"
              />
            )}
            {user?.id === selected.user_id && (
              <button onClick={() => removeOwn(selected.id)} className="btn-secondary">
                <Trash2 className="h-4 w-4" /> Снять с публикации
              </button>
            )}
          </div>
        </div>

        {selectedAuthor && (
          <div className="surface p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-txt-muted mb-3">Кто ищет</p>
            <button
              onClick={() => selectedAuthor.slug && navigate(`/u/${selectedAuthor.slug}`)}
              disabled={!selectedAuthor.slug}
              className="flex items-center gap-3 text-left disabled:cursor-default"
            >
              {selectedAuthor.avatarUrl ? (
                <img src={selectedAuthor.avatarUrl} alt="" className="h-11 w-11 rounded-full object-cover" />
              ) : (
                <Avatar initials={selectedAuthor.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()} />
              )}
              <div>
                <p className="text-sm font-medium text-txt-primary">{selectedAuthor.name}</p>
                {selectedAuthor.city && <p className="text-xs text-txt-muted">{selectedAuthor.city}</p>}
              </div>
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── List ──────────────────────────────────────────────────────────
  return (
    <div className="animate-fade-in">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold text-txt-primary tracking-tight">Работа</h1>
          <p className="mt-2 text-base text-txt-secondary">Роли, смены и места в съёмочных группах</p>
        </div>
        <button
          onClick={() => {
            if (!user) {
              promptGuest({ message: 'Чтобы разместить вакансию, войдите в FilmVerse или создайте аккаунт.' });
              return;
            }
            setShowCreate(true);
          }}
          className="btn-primary"
        >
          <Plus className="h-4 w-4" /> Разместить вакансию
        </button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-txt-muted" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Роль, профессия, проект…"
          className="input-field pl-10"
        />
      </div>

      <div className="mb-3 flex items-center gap-2 flex-wrap">
        {AUDIENCES.map((a) => (
          <button
            key={a}
            onClick={() => { setAudience(a); if (a !== 'Специалистам') setDeptId('Все'); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all duration-200 ${
              audience === a
                ? 'bg-emerald-500 text-white border-emerald-500'
                : 'bg-surface-600 text-txt-secondary border-line-soft hover:border-line'
            }`}
          >
            {a}
          </button>
        ))}
      </div>

      <div className="mb-6 flex items-center gap-2 flex-wrap">
        {audience === 'Специалистам' && (
          <select value={deptId} onChange={(e) => setDeptId(e.target.value)} className="input-field !py-2 !w-auto text-sm">
            <option value="Все">Все департаменты</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        )}
        <select value={city} onChange={(e) => setCity(e.target.value)} className="input-field !py-2 !w-auto text-sm">
          {cities.map((c) => <option key={c} value={c}>{c === 'Все' ? 'Все города' : c}</option>)}
        </select>
        <span className="ml-auto text-sm text-txt-muted">
          {loading ? '' : `${visible.length} ${visible.length === 1 ? 'объявление' : 'объявлений'}`}
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
            Разделу «Работа» нужна таблица <span className="text-txt-primary">work_opportunities</span>.
            Выполните миграцию <span className="text-txt-primary">008_content_tables</span>.
          </p>
        </div>
      ) : visible.length === 0 ? (
        <div className="surface p-12 text-center">
          <Briefcase className="h-8 w-8 text-txt-muted mx-auto mb-4" strokeWidth={1.5} />
          {items.length === 0 ? (
            <>
              <p className="text-txt-primary text-lg font-medium">Пока никто не ищет людей</p>
              <p className="text-txt-secondary text-sm mt-2 max-w-md mx-auto leading-relaxed">
                Разместите первую вакансию — роль, смену массовки или место в группе.
                Её увидят все, включая незарегистрированных.
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
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {visible.map((w) => {
            const author = authors.get(w.user_id);
            return (
              <button
                key={w.id}
                onClick={() => setSelectedId(w.id)}
                className="group surface p-5 text-left hover:border-line-strong transition-all duration-300 animate-fade-up flex flex-col"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="chip chip-fern">{w.type}</span>
                  <span className="text-[11px] text-txt-muted">{daysAgo(w.created_at)}</span>
                </div>
                <h3 className="text-base font-semibold text-txt-primary leading-snug group-hover:text-emerald-600 transition-colors">
                  {w.title}
                </h3>
                {w.project_name && <p className="mt-1 text-xs text-txt-muted">{w.project_name}</p>}

                <div className="mt-3 space-y-1.5 text-xs text-txt-secondary">
                  <p className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-txt-muted" />{w.city || 'Город не указан'}</p>
                  {w.shoot_date && <p className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5 text-txt-muted" />{w.shoot_date}</p>}
                  <p className="flex items-center gap-1.5"><Wallet className="h-3.5 w-3.5 text-txt-muted" />{w.pay || 'По договорённости'}</p>
                </div>

                {author && (
                  <p className="mt-3 pt-3 border-t border-line-soft text-xs text-txt-muted truncate">
                    {author.name}
                  </p>
                )}
              </button>
            );
          })}
        </div>
      )}

      {showCreate && (
        <CreateDialog
          initialKind="work"
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); load(); }}
        />
      )}
    </div>
  );
}
