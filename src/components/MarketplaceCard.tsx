import { MapPin } from 'lucide-react';
import type { MarketplaceListing } from '../data/mock';
import { ShareButton } from './ui';

const modeStyles: Record<MarketplaceListing['mode'], string> = {
  'Аренда': 'bg-fern-100 text-fern-700',
  'Продажа': 'bg-stone-800 text-paper-100',
  'Услуги': 'bg-amber-100 text-amber-700',
};

export function MarketplaceCard({ listing }: { listing: MarketplaceListing }) {
  return (
    <div className="group surface overflow-hidden hover:shadow-card hover:border-stone-400/40 transition-all duration-300 cursor-pointer animate-fade-up">
      {/* Image */}
      <div className="relative aspect-[4/3] overflow-hidden bg-stone-200">
        <img
          src={listing.image}
          alt={listing.title}
          className="portrait-img transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />
        <div className="absolute top-3 left-3">
          <span className={`chip ${modeStyles[listing.mode]}`}>{listing.mode}</span>
        </div>
        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-all duration-200">
          <ShareButton label="" dark className="!bg-stone-900/60 !backdrop-blur-sm" />
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <p className="text-xs text-ink-400 mb-1">{listing.category}</p>
        <h3 className="text-sm font-semibold text-ink-900 leading-snug group-hover:text-fern-700 transition-colors">
          {listing.title}
        </h3>
        <p className="mt-2 text-sm font-semibold text-fern-700">{listing.price}</p>
        <div className="mt-2 flex items-center justify-between">
          <span className="flex items-center gap-1 text-xs text-ink-500">
            <MapPin className="h-3.5 w-3.5" />
            {listing.city}
          </span>
          <span className="text-xs text-ink-400">{listing.postedDaysAgo} дн. назад</span>
        </div>
      </div>
    </div>
  );
}
