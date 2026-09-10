import { MapPin } from 'lucide-react';
import type { Professional } from '../data/mock';
import { useRouter } from '../router';

export function ProfessionalCard({ professional }: { professional: Professional }) {
  const { navigate } = useRouter();

  return (
    <div
      onClick={() => navigate('/professionals')}
      className="group cursor-pointer animate-fade-up flex-shrink-0"
    >
      <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-surface-700 shadow-portrait">
        <img
          src={professional.photo}
          alt={professional.name}
          className="portrait-img transition-transform duration-700 group-hover:scale-105"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h3 className="font-display text-lg font-semibold text-white leading-tight tracking-tight">
            {professional.name}
          </h3>
          <p className="mt-1 text-sm text-white/70">{professional.profession}</p>
          <div className="mt-1.5 flex items-center gap-1 text-xs text-white/50">
            <MapPin className="h-3 w-3" />
            <span>{professional.city}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
