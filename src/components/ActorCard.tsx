import { MapPin } from 'lucide-react';
import type { PersonCardData } from '../types';
import { useRouter } from '../router';

const AVAILABILITY_CHIP: Record<string, string> = {
  'Свободен': 'bg-emerald-500/90 text-white',
  'Занят': 'bg-danger-600/90 text-white',
  'Ограниченно': 'bg-warn-600/90 text-white',
};

function initialsOf(name: string) {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

/**
 * One person in a grid. Real people carry a public slug and open their
 * profile at /u/:slug; the demo entries still on the home page fall back
 * to the old /actor/:id route.
 */
export function ActorCard({ person }: { person: PersonCardData }) {
  const { navigate } = useRouter();

  const go = () => navigate(person.slug ? `/u/${person.slug}` : `/actor/${person.id}`);

  return (
    <div onClick={go} className="group cursor-pointer animate-fade-up flex-shrink-0">
      <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-surface-700 shadow-portrait">
        {person.photo ? (
          <img
            src={person.photo}
            alt={person.name}
            className="portrait-img transition-transform duration-700 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center bg-surface-600">
            <span className="font-display text-3xl font-semibold text-txt-muted">
              {initialsOf(person.name)}
            </span>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

        {person.availability && (
          <span
            className={`absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md text-[11px] font-medium ${
              AVAILABILITY_CHIP[person.availability] || 'bg-black/60 text-white'
            }`}
          >
            {person.availability}
          </span>
        )}

        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h3 className="font-display text-lg font-semibold text-white leading-tight tracking-tight">
            {person.name}
          </h3>
          {person.subtitle && <p className="mt-1 text-sm text-white/70">{person.subtitle}</p>}
          {person.city && (
            <div className="mt-1.5 flex items-center gap-1 text-xs text-white/50">
              <MapPin className="h-3 w-3" />
              <span>{person.city}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
