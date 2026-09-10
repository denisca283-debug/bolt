import { useState } from 'react';
import { marketplaceListings } from '../data/mock';
import { MarketplaceCard } from '../components/MarketplaceCard';

const modes = ['Все', 'Аренда', 'Продажа', 'Услуги'];
const categories = ['Все', 'Камеры', 'Свет', 'Звук', 'Транспорт', 'Локации', 'Услуги'];

export function MarketplacePage() {
  const [mode, setMode] = useState('Все');
  const [category, setCategory] = useState('Все');

  const filtered = marketplaceListings.filter((l) => {
    if (mode !== 'Все' && l.mode !== mode) return false;
    if (category !== 'Все' && l.category !== category) return false;
    return true;
  });

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-3xl sm:text-4xl font-semibold text-ink-900 tracking-tight">
          Кинобарахолка
        </h1>
        <p className="mt-2 text-base text-ink-500">
          Аренда, продажа и услуги — всё для съёмок в одном месте
        </p>
      </div>

      {/* Mode tabs */}
      <div className="mb-4 flex items-center gap-2">
        {modes.map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all duration-200 ${
              mode === m
                ? 'bg-fern-600 text-white border-fern-600'
                : 'bg-white text-ink-600 border-stone-300 hover:border-stone-400'
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      {/* Category chips */}
      <div className="mb-6 flex items-center gap-2 flex-wrap">
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`px-3 py-1.5 rounded-lg text-sm border transition-all duration-200 ${
              category === c
                ? 'bg-stone-800 text-paper-100 border-stone-800'
                : 'bg-paper-100 text-ink-500 border-stone-300/60 hover:border-stone-400'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-5">
        {filtered.map((l) => (
          <MarketplaceCard key={l.id} listing={l} />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-20">
          <p className="text-ink-500 text-lg">Ничего не найдено</p>
          <p className="text-ink-400 text-sm mt-1">Попробуйте изменить фильтры</p>
        </div>
      )}
    </div>
  );
}
