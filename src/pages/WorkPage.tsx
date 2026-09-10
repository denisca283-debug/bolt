import { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { workOpportunities, type WorkOpportunity } from '../data/mock';
import { WorkCard } from '../components/WorkCard';
import { ShareButton, Badge } from '../components/ui';
import { useRouter } from '../router';

const audienceFilters: ('Все' | WorkOpportunity['audience'])[] = ['Все', 'Актёрам', 'Массовка', 'Специалистам'];

const typeFiltersByAudience: Record<string, string[]> = {
  'Все': ['Все'],
  'Актёрам': ['Все', 'Главная роль', 'Вторая роль', 'Эпизод', 'Реклама'],
  'Массовка': ['Все'],
  'Специалистам': ['Все', 'Оператор', 'Режиссёр', 'Художник', 'Звук', 'Свет', 'Грим', 'Костюм', 'Монтаж', 'Продакшн'],
};

export function WorkPage() {
  const { navigate } = useRouter();
  const [audience, setAudience] = useState<'Все' | WorkOpportunity['audience']>('Все');
  const [typeFilter, setTypeFilter] = useState('Все');
  const [selected, setSelected] = useState<WorkOpportunity | null>(null);

  const filtered = workOpportunities.filter((w) => {
    if (audience !== 'Все' && w.audience !== audience) return false;
    if (typeFilter !== 'Все' && w.type !== typeFilter) return false;
    return true;
  });

  const currentTypeFilters = typeFiltersByAudience[audience] || ['Все'];

  const handleAudienceChange = (newAudience: 'Все' | WorkOpportunity['audience']) => {
    setAudience(newAudience);
    setTypeFilter('Все');
  };

  if (selected) {
    return (
      <div className="animate-fade-in max-w-3xl">
        <button
          onClick={() => setSelected(null)}
          className="mb-5 inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          К списку работ
        </button>

        {/* Detail header */}
        <div className="surface p-6 mb-6">
          <div className="flex items-center justify-between mb-3">
            <Badge variant="dark">{selected.type}</Badge>
            <ShareButton />
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-ink-900 tracking-tight">
            {selected.title}
          </h1>
          <p className="mt-2 text-sm text-ink-500">Проект: {selected.project}</p>

          {/* Meta */}
          <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-4 py-5 border-y border-stone-300/50">
            {[
              { label: 'Город', value: selected.city },
              { label: 'Дата', value: selected.date },
              { label: selected.audience === 'Специалистам' ? 'Опыт' : 'Возраст', value: selected.ageRange },
              { label: 'Оплата', value: selected.pay },
            ].map((d) => (
              <div key={d.label}>
                <p className="text-xs text-ink-400 mb-0.5">{d.label}</p>
                <p className="text-sm font-medium text-ink-900">{d.value}</p>
              </div>
            ))}
          </div>

          {/* Description */}
          <div className="mt-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-400 mb-2">Описание</p>
            <p className="text-sm text-ink-600 leading-relaxed">{selected.description}</p>
          </div>

          {/* Spots */}
          {selected.spotsLeft !== undefined && (
            <div className="mt-5 pt-5 border-t border-stone-300/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-ink-600">Свободные места</span>
                <span className="text-sm font-semibold text-fern-700">
                  {selected.spotsLeft} из {selected.spots}
                </span>
              </div>
              <div className="h-2 bg-paper-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-fern-500 rounded-full"
                  style={{ width: `${((selected.spots! - selected.spotsLeft) / selected.spots!) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="mt-6 flex flex-wrap gap-3">
            <button onClick={() => navigate('/messages')} className="btn-primary flex-1">
              Откликнуться
            </button>
            <ShareButton className="btn-secondary" />
          </div>

          <p className="mt-3 text-xs text-ink-400">
            {selected.applicants} откликов · Размещено {selected.postedDaysAgo} дн. назад
          </p>
        </div>

        {/* Shareable card */}
        <div className="surface-stone p-6">
          <p className="text-xs text-paper-400 mb-3">Карточка для отправки коллегам</p>
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="chip bg-fern-600 text-white">
                {selected.audience === 'Специалистам' ? 'ИЩУТ СПЕЦИАЛИСТА' : 'ИЩУТ АКТЁРОВ'}
              </span>
              <h3 className="mt-2 font-display text-lg font-semibold text-paper-50">{selected.project}</h3>
              <p className="text-sm text-paper-300 mt-1">{selected.city} · {selected.ageRange}</p>
              <p className="text-sm text-paper-300">{selected.pay}</p>
            </div>
            <ShareButton dark />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-3xl sm:text-4xl font-semibold text-ink-900 tracking-tight">
          Работа в кино
        </h1>
        <p className="mt-2 text-base text-ink-500">
          {filtered.length} свежих возможностей — роли, массовка, специалисты
        </p>
      </div>

      {/* Audience filter tabs */}
      <div className="mb-4 flex items-center gap-2 overflow-x-auto pb-1">
        {audienceFilters.map((a) => (
          <button
            key={a}
            onClick={() => handleAudienceChange(a)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold border whitespace-nowrap transition-all duration-200 ${
              audience === a
                ? 'bg-stone-800 text-paper-100 border-stone-800'
                : 'bg-white text-ink-600 border-stone-300 hover:border-stone-400'
            }`}
          >
            {a}
          </button>
        ))}
      </div>

      {/* Type sub-filters */}
      {currentTypeFilters.length > 1 && (
        <div className="mb-6 flex items-center gap-2 overflow-x-auto pb-1">
          {currentTypeFilters.map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border whitespace-nowrap transition-all duration-200 ${
                typeFilter === t
                  ? 'bg-fern-600 text-white border-fern-600'
                  : 'bg-paper-100 text-ink-500 border-stone-300/60 hover:border-stone-400'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {/* Cards */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5">
          {filtered.map((w) => (
            <div key={w.id} onClick={() => setSelected(w)}>
              <WorkCard opportunity={w} />
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20">
          <p className="text-ink-500 text-lg">Пока нет возможностей в этой категории</p>
          <p className="text-ink-400 text-sm mt-1">Попробуйте другую категорию</p>
        </div>
      )}
    </div>
  );
}
