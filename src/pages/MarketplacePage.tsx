import { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, Plus, Loader2, SlidersHorizontal, ShoppingBag } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useOrganization } from '../hooks/useOrganization';
import { useCompanyCards } from '../hooks/useCompanyCards';
import { useAuthModal } from '../components/AuthModal';
import { useRouter } from '../router';
import { MarketplaceCard } from '../components/MarketplaceCard';
import { CreateDialog } from '../components/create/CreateDialog';
import type { MarketplaceListing } from '../types';

const MODES = ['Все', 'Аренда', 'Продажа', 'Услуги'];
const CATEGORIES = ['Все', 'Камеры', 'Оптика', 'Свет', 'Звук', 'Грип', 'Транспорт', 'Реквизит', 'Костюмы', 'Локации', 'Услуги', 'Другое'];
const SORTS = [
  { key: 'new', label: 'Сначала новые' },
  { key: 'old', label: 'Сначала старые' },
  { key: 'title', label: 'По названию' },
] as const;

type SortKey = (typeof SORTS)[number]['key'];

export function MarketplacePage() {
  const organization = useOrganization();
  const { user } = useAuth();
  const { promptGuest } = useAuthModal();
  const { navigate } = useRouter();

  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const { companies } = useCompanyCards(listings);
  const [loading, setLoading] = useState(true);
  const [schemaMissing, setSchemaMissing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const [query, setQuery] = useState('');
  const [mode, setMode] = useState('Все');
  const [category, setCategory] = useState('Все');
  const [city, setCity] = useState('Все');
  const [sort, setSort] = useState<SortKey>('new');
  const [onlyMine, setOnlyMine] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('marketplace_listings')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(300);

    if (error) {
      setSchemaMissing(true);
      setLoading(false);
      return;
    }
    setSchemaMissing(false);
    setListings((data || []) as MarketplaceListing[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const cities = useMemo(() => {
    const set = new Set(listings.map((l) => l.city).filter(Boolean) as string[]);
    return ['Все', ...[...set].sort((a, b) => a.localeCompare(b, 'ru'))];
  }, [listings]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = listings.filter((l) => {
      if (mode !== 'Все' && l.mode !== mode) return false;
      if (category !== 'Все' && l.category !== category) return false;
      if (city !== 'Все' && l.city !== city) return false;
      if (onlyMine && (organization.selected ? l.organization_id !== organization.selected.id : !!l.organization_id || l.user_id !== user?.id)) return false;
      if (q) {
        const hay = `${l.title} ${l.description || ''} ${l.category || ''} ${l.city || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    return filtered.sort((a, b) => {
      if (sort === 'title') return a.title.localeCompare(b.title, 'ru');
      if (sort === 'old') return a.created_at.localeCompare(b.created_at);
      return b.created_at.localeCompare(a.created_at);
    });
  }, [listings, query, mode, category, city, sort, onlyMine, user?.id, organization.selected]);

  const openCreate = () => {
    if (!user) {
      promptGuest({ message: 'Чтобы разместить объявление, войдите в FilmVerse или создайте аккаунт.' });
      return;
    }
    setShowCreate(true);
  };

  const resetFilters = () => {
    setQuery(''); setMode('Все'); setCategory('Все'); setCity('Все'); setOnlyMine(false); setSort('new');
  };

  const filtersActive = query !== '' || mode !== 'Все' || category !== 'Все' || city !== 'Все' || onlyMine;

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold text-txt-primary tracking-tight">
            Кинобарахолка
          </h1>
          <p className="mt-2 text-base text-txt-secondary">
            Аренда, продажа и услуги — всё для съёмок в одном месте
          </p>
        </div>
        <button onClick={openCreate} className="btn-primary">
          <Plus className="h-4 w-4" />
          Разместить
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-txt-muted" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Камера, свет, гримваген, локация…"
          className="input-field pl-10"
        />
      </div>

      {/* Mode tabs */}
      <div className="mb-3 flex items-center gap-2 flex-wrap">
        {MODES.map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all duration-200 ${
              mode === m
                ? 'bg-emerald-500 text-white border-emerald-500'
                : 'bg-surface-600 text-txt-secondary border-line-soft hover:border-line'
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      {/* Category chips */}
      <div className="mb-3 flex items-center gap-2 flex-wrap">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`px-3 py-1.5 rounded-lg text-sm border transition-all duration-200 ${
              category === c
                ? 'bg-surface-400 text-txt-primary border-line-strong'
                : 'bg-surface-700 text-txt-secondary border-line-soft hover:border-line'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* City + sort + mine */}
      <div className="mb-6 flex items-center gap-2 flex-wrap">
        <SlidersHorizontal className="h-4 w-4 text-txt-muted" />
        <select value={city} onChange={(e) => setCity(e.target.value)} className="input-field !py-2 !w-auto text-sm">
          {cities.map((c) => <option key={c} value={c}>{c === 'Все' ? 'Все города' : c}</option>)}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="input-field !py-2 !w-auto text-sm">
          {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        {user && (
          <button
            onClick={() => setOnlyMine((v) => !v)}
            className={`px-3 py-2 rounded-lg text-sm border transition-all duration-200 ${
              onlyMine
                ? 'bg-emerald-200/30 text-emerald-600 border-emerald-400/50'
                : 'bg-surface-700 text-txt-secondary border-line-soft hover:border-line'
            }`}
          >
            {organization.selected ? 'Объявления компании' : 'Мои личные объявления'}
          </button>
        )}
        {filtersActive && (
          <button onClick={resetFilters} className="btn-ghost text-sm">Сбросить</button>
        )}
        <span className="ml-auto text-sm text-txt-muted">
          {loading ? '' : `${visible.length} ${visible.length === 1 ? 'объявление' : 'объявлений'}`}
        </span>
      </div>

      {/* Body */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 text-emerald-500 animate-spin" />
        </div>
      ) : schemaMissing ? (
        <div className="surface p-6 max-w-lg">
          <h2 className="text-sm font-semibold text-txt-primary mb-1">База ещё не обновлена</h2>
          <p className="text-sm text-txt-secondary leading-relaxed">
            Кинобарахолке нужна таблица <span className="text-txt-primary">marketplace_listings</span>.
            Выполните миграцию <span className="text-txt-primary">008_content_tables</span> в панели базы данных.
          </p>
        </div>
      ) : visible.length === 0 ? (
        <div className="surface p-12 text-center">
          <ShoppingBag className="h-8 w-8 text-txt-muted mx-auto mb-4" strokeWidth={1.5} />
          {listings.length === 0 ? (
            <>
              <p className="text-txt-primary text-lg font-medium">Объявлений пока нет</p>
              <p className="text-txt-secondary text-sm mt-2 max-w-md mx-auto leading-relaxed">
                Барахолка наполняется самими киношниками. Разместите первое объявление — камеру в аренду,
                свет на продажу или свою услугу — и его увидят все, включая незарегистрированных.
              </p>
              <button onClick={openCreate} className="mt-5 btn-primary">
                <Plus className="h-4 w-4" /> Разместить первое объявление
              </button>
            </>
          ) : (
            <>
              <p className="text-txt-primary text-lg font-medium">Ничего не найдено</p>
              <p className="text-txt-secondary text-sm mt-1">Попробуйте изменить фильтры</p>
              <button onClick={resetFilters} className="mt-4 btn-secondary">Сбросить фильтры</button>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-5">
          {visible.map((l) => (
            <MarketplaceCard key={l.id} listing={l} companyName={l.organization_id ? companies.get(l.organization_id)?.name : undefined} />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateDialog
          initialKind="listing"
          onClose={() => setShowCreate(false)}
          onCreated={(kind, id) => {
            setShowCreate(false);
            if (kind === 'listing') navigate(`/listing/${id}`);
            else load();
          }}
        />
      )}
    </div>
  );
}
