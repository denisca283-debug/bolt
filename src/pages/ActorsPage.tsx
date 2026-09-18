import { useState, useMemo, useEffect } from 'react';
import { SlidersHorizontal, X, Loader2, UserPlus } from 'lucide-react';
import { ActorCard } from '../components/ActorCard';
import { supabase } from '../lib/supabase';
import { useRouter } from '../router';
import { useAuth } from '../hooks/useAuth';
import { useAuthModal } from '../components/AuthModal';
import type { Actor, PersonCardData } from '../types';

const ALL = 'Все';
const ALL_CITIES = 'Все города';

const categories = [ALL, 'Актёр', 'Актриса', 'Массовка', 'Студент', 'Модель'];
const genders = [ALL, 'Мужчины', 'Женщины'];
// Availability is FilmVerse's own angle: Backstage can't answer
// "who is free in this city right now".
const availabilities = [ALL, 'Свободен', 'Ограниченно', 'Занят'];

type ActorWithSlug = Actor & { slug: string | null; avatarUrl: string | null };

export function ActorsPage() {
  const { navigate } = useRouter();
  const { isAuthenticated } = useAuth();
  const { openRegister } = useAuthModal();

  const [rows, setRows] = useState<ActorWithSlug[]>([]);
  const [loading, setLoading] = useState(true);

  const [city, setCity] = useState(ALL_CITIES);
  const [category, setCategory] = useState(ALL);
  const [gender, setGender] = useState(ALL);
  const [availability, setAvailability] = useState(ALL);
  const [showFilters, setShowFilters] = useState(false);

  const [offset, setOffset] = useState(0);
  const [error, setError] = useState('');
  useEffect(() => { setOffset(0); }, [city, category, gender, availability]);
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError('');
    void (async () => {
      const { data, error } = await supabase.rpc('actor_directory', {
        p_city: city === ALL_CITIES ? '' : city, p_category: category === ALL ? '' : category,
        p_gender: gender === ALL ? '' : gender === 'Мужчины' ? 'М' : 'Ж',
        p_availability: availability === ALL ? '' : availability, p_offset: offset,
      });
      if (cancelled) return;
      setRows(error ? [] : data || []); setError(error ? 'Не удалось загрузить актёров.' : ''); setLoading(false);
    })().catch(() => { if (!cancelled) { setError('Нет соединения. Повторите загрузку.'); setLoading(false); } });
    return () => { cancelled = true; };
  }, [city, category, gender, availability, offset, isAuthenticated]);

  // Offer only cities that actually have someone in them.
  const cities = useMemo(() => {
    const found = [...new Set(rows.map((r) => r.city).filter(Boolean))] as string[];
    return [ALL_CITIES, ...found.sort((a, b) => a.localeCompare(b, 'ru'))];
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((a) => {
      if (city !== ALL_CITIES && a.city !== city) return false;
      if (category !== ALL && a.category !== category) return false;
      if (gender === 'Мужчины' && a.gender !== 'М') return false;
      if (gender === 'Женщины' && a.gender !== 'Ж') return false;
      if (availability !== ALL && a.availability !== availability) return false;
      return true;
    });
  }, [rows, city, category, gender, availability]);

  const cards: PersonCardData[] = filtered.map((a) => ({
    id: a.id,
    slug: a.slug,
    name: a.full_name,
    subtitle: a.category,
    city: a.city,
    photo: a.photo_url || a.gallery?.[0] || a.avatarUrl,
    availability: a.availability,
  }));

  const activeFilterCount = [
    city !== ALL_CITIES,
    category !== ALL,
    gender !== ALL,
    availability !== ALL,
  ].filter(Boolean).length;

  const resetFilters = () => {
    setCity(ALL_CITIES);
    setCategory(ALL);
    setGender(ALL);
    setAvailability(ALL);
  };

  const FilterSection = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-ink-400 mb-2.5">{title}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );

  const FilterChip = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all duration-200 ${
        active
          ? 'bg-fern-600 text-white border-fern-600'
          : 'bg-white text-ink-600 border-stone-300 hover:border-stone-400'
      }`}
    >
      {children}
    </button>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 text-emerald-500 animate-spin" />
      </div>
    );
  }

  // Nobody has filled in an actor profile yet. Say so plainly rather than
  // padding the page with invented people.
  if (error) return <p role="alert">{error}</p>;
  if (rows.length === 0 && activeFilterCount === 0 && offset === 0) {
    return (
      <div className="animate-fade-in">
        <div className="mb-6">
          <h1 className="font-display text-3xl sm:text-4xl font-semibold text-ink-900 tracking-tight">
            Актёры
          </h1>
        </div>
        <div className="surface p-10 text-center">
          <p className="text-ink-900 text-lg font-medium">Здесь пока никого нет</p>
          <p className="text-ink-500 text-sm mt-2 max-w-md mx-auto leading-relaxed">
            FilmVerse только открылся. Заполните анкету актёра — и вас увидят первым,
            когда сюда придут кастинг-директора.
          </p>
          <button
            onClick={() => (isAuthenticated ? navigate('/profile') : openRegister())}
            className="mt-5 btn-primary"
          >
            <UserPlus className="h-4 w-4" />
            {isAuthenticated ? 'Заполнить анкету актёра' : 'Создать анкету'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-3xl sm:text-4xl font-semibold text-ink-900 tracking-tight">
          Актёры
        </h1>
        <p className="mt-2 text-base text-ink-500">
          {filtered.length} {filtered.length === 1 ? 'человек' : 'человек'} · Профессионалы, студенты и массовка
        </p>
      </div>

      {/* Filter bar */}
      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-ink-700 bg-white border border-stone-300 hover:border-stone-400 transition-all duration-200"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Фильтры
          {activeFilterCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-md bg-fern-100 text-fern-700 text-xs font-semibold">
              {activeFilterCount}
            </span>
          )}
        </button>
        {activeFilterCount > 0 && (
          <button
            onClick={resetFilters}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-ink-500 hover:text-ink-900 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
            Сбросить
          </button>
        )}
      </div>

      {/* Filters panel */}
      {showFilters && (
        <div className="mb-6 surface p-5 space-y-5 animate-scale-in">
          <FilterSection title="Категория">
            {categories.map((c) => (
              <FilterChip key={c} active={category === c} onClick={() => setCategory(c)}>
                {c}
              </FilterChip>
            ))}
          </FilterSection>
          <FilterSection title="Доступность">
            {availabilities.map((a) => (
              <FilterChip key={a} active={availability === a} onClick={() => setAvailability(a)}>
                {a}
              </FilterChip>
            ))}
          </FilterSection>
          <FilterSection title="Город">
            {cities.map((c) => (
              <FilterChip key={c} active={city === c} onClick={() => setCity(c)}>
                {c}
              </FilterChip>
            ))}
          </FilterSection>
          <FilterSection title="Пол">
            {genders.map((g) => (
              <FilterChip key={g} active={gender === g} onClick={() => setGender(g)}>
                {g}
              </FilterChip>
            ))}
          </FilterSection>
        </div>
      )}

      {/* Actor grid */}
      <div className="flex gap-3 mb-4">
        <button className="btn-secondary" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 24))}>Назад</button>
        <button className="btn-secondary" disabled={rows.length < 24} onClick={() => setOffset(offset + 24)}>Далее</button>
      </div>
      {cards.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 lg:gap-5">
          {cards.map((person) => (
            <ActorCard key={person.id} person={person} />
          ))}
        </div>
      ) : (
        <div className="text-center py-20">
          <p className="text-ink-500 text-lg">Никого не найдено</p>
          <p className="text-ink-400 text-sm mt-1">Попробуйте изменить фильтры</p>
          <button onClick={resetFilters} className="mt-4 btn-secondary">
            Сбросить фильтры
          </button>
        </div>
      )}
    </div>
  );
}
