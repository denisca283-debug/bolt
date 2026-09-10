import { MapPin, Calendar, Users, Wallet, ArrowRight } from 'lucide-react';
import type { WorkOpportunity } from '../data/mock';
import { useRouter } from '../router';
import { ShareButton } from './ui';

const typeStyles: Record<string, string> = {
  'Массовка': 'bg-stone-800 text-paper-100',
  'Главная роль': 'bg-fern-600 text-white',
  'Вторая роль': 'bg-fern-100 text-fern-700',
  'Реклама': 'bg-amber-100 text-amber-700',
  'Эпизод': 'bg-paper-200 text-ink-600',
  'Оператор': 'bg-blue-100 text-blue-700',
  'Режиссёр': 'bg-purple-100 text-purple-700',
  'Художник': 'bg-rose-100 text-rose-700',
  'Звук': 'bg-cyan-100 text-cyan-700',
  'Свет': 'bg-amber-100 text-amber-700',
  'Грим': 'bg-pink-100 text-pink-700',
  'Костюм': 'bg-indigo-100 text-indigo-700',
  'Монтаж': 'bg-teal-100 text-teal-700',
  'Продакшн': 'bg-orange-100 text-orange-700',
};

export function WorkCard({ opportunity }: { opportunity: WorkOpportunity }) {
  const { navigate } = useRouter();

  return (
    <div
      onClick={() => navigate('/work')}
      className="group surface p-5 hover:shadow-card hover:border-stone-400/40 transition-all duration-300 cursor-pointer animate-fade-up"
    >
      {/* Type label */}
      <div className="flex items-center justify-between mb-3">
        <span className={`chip ${typeStyles[opportunity.type]}`}>
          {opportunity.type}
        </span>
        <ShareButton label="" className="!px-2 !py-1.5 opacity-0 group-hover:opacity-100" />
      </div>

      <h3 className="text-base font-semibold text-ink-900 leading-snug group-hover:text-fern-700 transition-colors">
        {opportunity.title}
      </h3>
      <p className="mt-1 text-xs text-ink-400">{opportunity.project}</p>

      {/* Meta grid */}
      <div className="mt-4 grid grid-cols-2 gap-y-2.5 gap-x-3 text-sm">
        <div className="flex items-center gap-1.5 text-ink-600">
          <MapPin className="h-3.5 w-3.5 text-ink-400" />
          {opportunity.city}
        </div>
        <div className="flex items-center gap-1.5 text-ink-600">
          <Calendar className="h-3.5 w-3.5 text-ink-400" />
          {opportunity.date}
        </div>
        <div className="flex items-center gap-1.5 text-ink-600">
          <Users className="h-3.5 w-3.5 text-ink-400" />
          {opportunity.ageRange}
        </div>
        <div className="flex items-center gap-1.5 text-ink-600">
          <Wallet className="h-3.5 w-3.5 text-ink-400" />
          {opportunity.pay}
        </div>
      </div>

      {/* Spots indicator */}
      {opportunity.spotsLeft !== undefined && (
        <div className="mt-4 flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-paper-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-fern-500 rounded-full"
              style={{ width: `${((opportunity.spots! - opportunity.spotsLeft) / opportunity.spots!) * 100}%` }}
            />
          </div>
          <span className="text-xs text-ink-500 whitespace-nowrap">
            Осталось {opportunity.spotsLeft} из {opportunity.spots} мест
          </span>
        </div>
      )}

      {/* Actions */}
      <div className="mt-4 flex items-center gap-2">
        <button
          onClick={(e) => { e.stopPropagation(); navigate('/work'); }}
          className="flex-1 btn-primary !py-2.5"
        >
          Откликнуться
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); navigate('/work'); }}
          className="btn-ghost !py-2.5"
        >
          Подробнее
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      <p className="mt-3 text-xs text-ink-400">
        {opportunity.applicants} откликов · {opportunity.postedDaysAgo} дн. назад
      </p>
    </div>
  );
}
