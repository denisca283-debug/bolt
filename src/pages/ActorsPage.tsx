import { useState, useMemo } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { actors, type ActorCategory } from '../data/mock';
import { ActorCard } from '../components/ActorCard';

const cities = ['Все города', 'Москва', 'Санкт-Петербург', 'Казань', 'Екатеринбург', 'Новосибирск', 'Владивосток'];
const categories: (ActorCategory | 'Все')[] = ['Все', 'Актёр', 'Актриса', 'Массовка', 'Студент', 'Модель'];
const genders = ['Все', 'Мужчины', 'Женщины'];
const statuses = ['Все', 'Профессиональный', 'Начинающий', 'Студент', 'Массовка'];

export function ActorsPage() {
  const [city, setCity] = useState('Все города');
  const [category, setCategory] = useState<(ActorCategory | 'Все')>('Все');
  const [gender, setGender] = useState('Все');
  const [status, setStatus] = useState('Все');
  const [showFilters, setShowFilters] = useState(false);

  const filtered = useMemo(() => {
    return actors.filter((a) => {
      if (city !== 'Все города' && a.city !== city) return false;
      if (category !== 'Все' && a.category !== category) return false;
      if (gender === 'Мужчины' && a.gender !== 'М') return false;
      if (gender === 'Женщины' && a.gender !== 'Ж') return false;
      if (status !== 'Все' && a.status !== status) return false;
      return true;
    });
  }, [city, category, gender, status]);

  const activeFilterCount = [city !== 'Все города', category !== 'Все', gender !== 'Все', status !== 'Все'].filter(Boolean).length;

  const resetFilters = () => {
    setCity('Все города');
    setCategory('Все');
    setGender('Все');
    setStatus('Все');
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

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-3xl sm:text-4xl font-semibold text-ink-900 tracking-tight">
          Актёры
        </h1>
        <p className="mt-2 text-base text-ink-500">
          {filtered.length} человек · Профессионалы, студенты и массовка
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
          <FilterSection title="Опыт">
            {statuses.map((s) => (
              <FilterChip key={s} active={status === s} onClick={() => setStatus(s)}>
                {s}
              </FilterChip>
            ))}
          </FilterSection>
        </div>
      )}

      {/* Actor grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 lg:gap-5">
          {filtered.map((actor) => (
            <ActorCard key={actor.id} actor={actor} />
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
