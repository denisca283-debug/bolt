import {
  Award, Search, Users, Camera, CheckCircle2, Briefcase, FileImage,
} from 'lucide-react';
import { pulseFeed, type PulseItem } from '../data/mock';

const kindConfig: Record<PulseItem['kind'], { icon: typeof Award; label: string; color: string }> = {
  role: { icon: Award, label: 'Роль', color: 'bg-fern-100 text-fern-700' },
  'crew-search': { icon: Search, label: 'Поиск группы', color: 'bg-blue-100 text-blue-700' },
  portfolio: { icon: FileImage, label: 'Портфолио', color: 'bg-amber-100 text-amber-700' },
  join: { icon: Users, label: 'Команда', color: 'bg-purple-100 text-purple-700' },
  spots: { icon: Briefcase, label: 'Массовка', color: 'bg-stone-800 text-paper-100' },
  marketplace: { icon: Camera, label: 'Кинобарахолка', color: 'bg-cyan-100 text-cyan-700' },
  'team-complete': { icon: CheckCircle2, label: 'Команда готова', color: 'bg-fern-600 text-white' },
};

export function PulsePage() {
  return (
    <div className="animate-fade-in max-w-3xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-3xl sm:text-4xl font-semibold text-ink-900 tracking-tight">
          Пульс индустрии
        </h1>
        <p className="mt-2 text-base text-ink-500">
          Что происходит в киносообществе прямо сейчас
        </p>
      </div>

      {/* Feed */}
      <div className="space-y-4">
        {pulseFeed.map((item) => {
          const cfg = kindConfig[item.kind];
          const Icon = cfg.icon;
          return (
            <div
              key={item.id}
              className="surface p-5 flex items-start gap-4 hover:shadow-card transition-all duration-200 animate-fade-up"
            >
              {/* Avatar or icon */}
              {item.photo ? (
                <div className="relative shrink-0">
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-stone-200">
                    <img src={item.photo} alt={item.person} className="portrait-img" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-white border border-stone-300 flex items-center justify-center">
                    <Icon className="h-3 w-3 text-ink-600" strokeWidth={2} />
                  </div>
                </div>
              ) : (
                <div className="w-12 h-12 rounded-full bg-stone-800 flex items-center justify-center text-paper-100 font-semibold text-sm shrink-0">
                  {item.initials}
                </div>
              )}

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`chip ${cfg.color} !py-0.5`}>
                    <Icon className="h-3 w-3" />
                    {cfg.label}
                  </span>
                  <span className="text-xs text-ink-400">{item.time}</span>
                </div>
                <p className="text-sm text-ink-700 leading-relaxed">
                  <span className="font-semibold text-ink-900">{item.person}</span>{' '}
                  <span className="text-ink-500">{item.action}</span>{' '}
                  <span className="font-medium text-fern-700">{item.target}</span>
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer note */}
      <div className="mt-8 text-center">
        <p className="text-sm text-ink-400">Это начало ленты — больше активности появится по мере роста сообщества</p>
      </div>
    </div>
  );
}
