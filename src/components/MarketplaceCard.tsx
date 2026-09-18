import { MapPin, ImageOff } from 'lucide-react';
import type { MarketplaceListing } from '../types';
import { useRouter } from '../router';

const MODE_STYLES: Record<string, string> = {
  'Аренда': 'bg-emerald-200/40 text-emerald-700 border border-emerald-300/30',
  'Продажа': 'bg-surface-700 text-txt-primary border border-line',
  'Услуги': 'bg-warn-200/50 text-warn-700 border border-warn-600/30',
};

function daysAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86_400_000);
  if (d <= 0) {
    const h = Math.floor(diff / 3_600_000);
    return h <= 0 ? 'только что' : `${h} ч назад`;
  }
  if (d === 1) return 'вчера';
  return `${d} дн. назад`;
}

export function MarketplaceCard({ listing, companyName }: { listing: MarketplaceListing; companyName?: string }) {
  const { navigate } = useRouter();

  return (
    <button
      onClick={() => navigate(`/listing/${listing.id}`)}
      className="group surface overflow-hidden text-left hover:border-line-strong transition-all duration-300 animate-fade-up flex flex-col"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-surface-700">
        {listing.image_url ? (
          <img
            src={listing.image_url}
            alt={listing.title}
            className="portrait-img transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center">
            <ImageOff className="h-6 w-6 text-txt-muted" />
          </div>
        )}
        <div className="absolute top-3 left-3">
          <span className={`chip ${MODE_STYLES[listing.mode] || 'chip-neutral'}`}>{listing.mode}</span>
        </div>
      </div>

      <div className="p-4 flex-1 flex flex-col">
        {listing.category && <p className="text-xs text-txt-muted mb-1">{listing.category}</p>}
        {listing.organization_id && <p className="text-xs text-emerald-500 mb-2">{companyName || 'Компания'}</p>}
        <h3 className="text-sm font-semibold text-txt-primary leading-snug group-hover:text-emerald-600 transition-colors line-clamp-2">
          {listing.title}
        </h3>
        <p className="mt-2 text-sm font-semibold text-emerald-600">
          {listing.price || 'Цена по запросу'}
        </p>
        <div className="mt-2 pt-2 flex items-center justify-between gap-2">
          <span className="flex items-center gap-1 text-xs text-txt-secondary min-w-0">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{listing.city || 'Город не указан'}</span>
          </span>
          <span className="text-xs text-txt-muted shrink-0">{daysAgo(listing.created_at)}</span>
        </div>
      </div>
    </button>
  );
}
