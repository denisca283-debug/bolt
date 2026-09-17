import { useEffect, useState } from 'react';
import { Search, ArrowRight } from 'lucide-react';
import { professionals } from '../data/mock';
import { supabase } from '../lib/supabase';
import type { Actor, PersonCardData } from '../types';
import { ActorCard } from '../components/ActorCard';
import { ProfessionalCard } from '../components/ProfessionalCard';
import { useRouter } from '../router';

function getFeatured<T extends { featuredScore?: number }>(items: T[], count: number): T[] {
  return [...items]
    .sort((a, b) => (b.featuredScore ?? 0) - (a.featuredScore ?? 0))
    .slice(0, count);
}

const featuredProfessionals = getFeatured(professionals, 7);

const HERO_IMG = 'https://images.pexels.com/photos/8089650/pexels-photo-8089650.jpeg?auto=compress&cs=tinysrgb&w=1600&h=900&dpr=2';

const entryPanels = [
  {
    title: 'Работа в кино',
    copy: 'Актуальные роли, вакансии и съёмочные проекты',
    cta: 'Смотреть работу',
    path: '/work',
    image: 'https://images.pexels.com/photos/8088380/pexels-photo-8088380.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&dpr=2',
  },
  {
    title: 'Пульс индустрии',
    copy: 'Люди. Проекты. События. Всё, чем живёт кино сегодня.',
    cta: 'Смотреть Пульс',
    path: '/pulse',
    image: 'https://images.pexels.com/photos/7513459/pexels-photo-7513459.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&dpr=2',
  },
  {
    title: 'Кинобарахолка',
    copy: 'Техника, реквизит, аренда и услуги для съёмок',
    cta: 'Перейти',
    path: '/marketplace',
    image: 'https://images.pexels.com/photos/34516665/pexels-photo-34516665.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&dpr=2',
  },
];

export function HomePage() {
  const { navigate } = useRouter();
  const [query, setQuery] = useState('');
  const [featuredActors, setFeaturedActors] = useState<PersonCardData[]>([]);
  const [actorsLoading, setActorsLoading] = useState(true);
  const [actorsError, setActorsError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadActors() {
      try {
        const { data, error } = await supabase.from('actors').select('*')
          .order('featured_score', { ascending: false, nullsFirst: false })
          .order('created_at', { ascending: false });
        if (error) throw error;
        const actors = (data || []) as Actor[];
        const userIds = [...new Set(actors.map((a) => a.user_id).filter(Boolean))] as string[];
        const profiles = new Map<string, { public_slug: string | null; avatar_url: string | null }>();
        if (userIds.length) {
          const { data: rows, error: profileError } = await supabase.from('profiles')
            .select('id, public_slug, avatar_url').in('id', userIds);
          if (profileError) throw profileError;
          for (const row of rows || []) profiles.set(row.id, row);
        }
        if (cancelled) return;
        // Only feature cards with a real public profile destination.
        setFeaturedActors(actors.filter((a) => a.user_id && profiles.get(a.user_id)?.public_slug)
          .slice(0, 7).map((a) => ({
            id: a.id,
            slug: profiles.get(a.user_id!)!.public_slug,
            name: a.full_name,
            subtitle: a.category,
            city: a.city,
            photo: a.photo_url || a.gallery?.[0] || profiles.get(a.user_id!)?.avatar_url || null,
            availability: a.availability,
          })));
      } catch {
        if (!cancelled) setActorsError(true);
      } finally {
        if (!cancelled) setActorsLoading(false);
      }
    }
    void loadActors();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="animate-fade-in">
      {/* ── HERO ── */}
      <section className="relative min-h-[480px] sm:min-h-[540px] lg:min-h-[600px] flex items-end overflow-hidden">
        <img
          src={HERO_IMG}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Controlled gradient — left/bottom only, image stays visible */}
        <div className="absolute inset-0 bg-gradient-to-r from-base-900/90 via-base-900/50 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-base-900 via-base-900/30 to-transparent" />

        <div className="relative w-full max-w-3xl px-6 lg:px-12 pb-10 lg:pb-14 pt-24">
          <p className="text-xs sm:text-sm font-semibold uppercase tracking-[0.2em] text-emerald-400 mb-4">
            Люди &middot; Проекты &middot; Возможности
          </p>
          <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl xl:text-[3.4rem] font-bold text-white leading-[1.12] tracking-tight">
            Найдите людей для&nbsp;съёмки.<br />
            Или свою следующую работу.
          </h1>
          <p className="mt-4 text-base sm:text-lg text-white/70 leading-relaxed max-w-lg">
            Актёры, массовка и специалисты кино&nbsp;—
            в&nbsp;одном профессиональном пространстве.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => navigate('/actors')}
              className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-lg text-base font-semibold text-white bg-emerald-500 hover:bg-emerald-600 transition-all duration-200 shadow-soft"
            >
              Найти актёра / специалиста
            </button>
            <button
              onClick={() => navigate('/work')}
              className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-lg text-base font-semibold text-white bg-white/10 hover:bg-white/15 border border-white/20 backdrop-blur-sm transition-all duration-200"
            >
              Найти работу
            </button>
          </div>

          <form className="mt-6 relative max-w-xl" onSubmit={(event) => {
            event.preventDefault();
            navigate(query.trim() ? `/actors?q=${encodeURIComponent(query.trim())}` : '/actors');
          }}>
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-txt-muted" />
            <input
              type="text"
              placeholder="Имя, категория, город, навык…"
              aria-label="Поиск актёров"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="w-full bg-surface-700/80 backdrop-blur-md border border-white/10 rounded-xl pl-12 pr-4 py-4 text-base text-txt-primary placeholder:text-txt-muted focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20 transition-all duration-200"
            />
          </form>
        </div>
      </section>

      {/* ── ACTORS ── */}
      <section className="px-4 lg:px-8 mt-12 lg:mt-16">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-txt-primary tracking-tight">
              Актёры
            </h2>
            <p className="mt-1 text-sm text-txt-secondary">
              Люди для ваших историй
            </p>
          </div>
          <button
            onClick={() => navigate('/actors')}
            className="flex items-center gap-1.5 text-sm font-medium text-emerald-500 hover:text-emerald-600 transition-colors shrink-0"
          >
            Смотреть всех
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-4">
          {actorsLoading && <p role="status" className="col-span-full text-sm text-txt-secondary">Загрузка актёров…</p>}
          {actorsError && <p role="alert" className="col-span-full text-sm text-txt-secondary">Не удалось загрузить актёров. Попробуйте обновить страницу.</p>}
          {!actorsLoading && !actorsError && featuredActors.length === 0 && <p className="col-span-full text-sm text-txt-secondary">Публичные анкеты актёров пока не добавлены.</p>}
          {featuredActors.map((actor) => (
            <ActorCard
              key={actor.id}
              person={actor}
            />
          ))}
        </div>
      </section>

      {/* ── PROFESSIONALS ── */}
      <section className="px-4 lg:px-8 mt-12 lg:mt-16">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-txt-primary tracking-tight">
              Специалисты
            </h2>
            <p className="mt-1 text-sm text-txt-secondary">
              Профессионалы, которые создают кино
            </p>
          </div>
          <button
            onClick={() => navigate('/professionals')}
            className="flex items-center gap-1.5 text-sm font-medium text-emerald-500 hover:text-emerald-600 transition-colors shrink-0"
          >
            Смотреть всех
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-4">
          {featuredProfessionals.map((pro) => (
            <ProfessionalCard key={pro.id} professional={pro} />
          ))}
        </div>
      </section>

      {/* ── THREE ENTRY PANELS ── */}
      <section className="px-4 lg:px-8 mt-12 lg:mt-16 pb-12 lg:pb-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-5">
          {entryPanels.map((panel) => (
            <button
              key={panel.path}
              onClick={() => navigate(panel.path)}
              className="group relative aspect-[4/3] rounded-xl overflow-hidden text-left"
            >
              <img
                src={panel.image}
                alt=""
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10 group-hover:from-black/85 transition-colors duration-300" />
              <div className="absolute bottom-0 left-0 right-0 p-5 lg:p-6">
                <h3 className="font-display text-xl lg:text-2xl font-bold text-white tracking-tight">
                  {panel.title}
                </h3>
                <p className="mt-2 text-sm text-white/60 leading-relaxed max-w-xs">
                  {panel.copy}
                </p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-emerald-400 group-hover:text-emerald-300 transition-colors">
                  {panel.cta}
                  <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                </span>
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
