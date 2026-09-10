import { Clapperboard, MapPin, Users, ArrowUpRight } from 'lucide-react';
import { projects } from '../data/mock';
import { Card, Badge } from '../components/ui';
import { useRouter } from '../router';

export function ProjectsPage() {
  const { navigate } = useRouter();

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="font-display text-3xl sm:text-4xl font-semibold text-ink-900 tracking-tight">
          Проекты
        </h1>
        <p className="mt-2 text-base text-ink-500">
          {projects.length} активных проектов — от сценария до постпродакшна
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5">
        {projects.map((p) => (
          <Card key={p.id} className="group overflow-hidden cursor-pointer hover:shadow-card transition-all duration-300" onClick={() => navigate('/projects')}>
            <div className="relative aspect-[16/10] overflow-hidden bg-stone-200">
              <img
                src={p.image}
                alt={p.title}
                className="portrait-img transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
              />
              <div className="absolute top-3 left-3">
                <span className="chip chip-dark bg-stone-900/80 backdrop-blur-sm text-paper-100">
                  {p.stage}
                </span>
              </div>
            </div>
            <div className="p-5">
              <h3 className="font-display text-lg font-semibold text-ink-900 group-hover:text-fern-700 transition-colors">
                {p.title}
              </h3>
              <p className="mt-2 text-sm text-ink-500 leading-relaxed line-clamp-2">
                {p.logline}
              </p>
              <div className="mt-4 flex items-center gap-4 text-xs text-ink-400">
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  {p.city}
                </span>
                <span className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" />
                  {p.teamSize} в команде
                </span>
              </div>
              {p.castingRoles.length > 0 && (
                <div className="mt-4 pt-4 border-t border-stone-300/50">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400 mb-2">
                    Открытый кастинг
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {p.castingRoles.map((role) => (
                      <Badge key={role} variant="fern">{role}</Badge>
                    ))}
                  </div>
                </div>
              )}
              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs text-ink-400">
                  Реж. <span className="text-ink-600">{p.director}</span>
                </span>
                <ArrowUpRight className="h-4 w-4 text-ink-400 group-hover:text-fern-600 transition-colors" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-10">
        <div className="flex items-center gap-2 mb-4">
          <Clapperboard className="h-5 w-5 text-ink-500" />
          <h2 className="font-display text-xl font-semibold text-ink-900">Фильтры и создание проектов</h2>
        </div>
        <Card className="p-6 text-center">
          <p className="text-sm text-ink-500">
            Скоро: фильтрация по жанру, стадии и бюджету, а также возможность создать собственный проект и открыть кастинг.
          </p>
        </Card>
      </div>
    </div>
  );
}
