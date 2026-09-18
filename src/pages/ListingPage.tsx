import { useState, useEffect, useCallback } from 'react';
import { MapPin, Calendar, Loader2, ArrowLeft, Trash2, ImageOff, ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useRouter } from '../router';
import { Avatar, ShareButton } from '../components/ui';
import { MessageButton } from '../components/MessageButton';
import type { MarketplaceListing, AuthorLite } from '../types';

const MODE_STYLES: Record<string, string> = {
  'Аренда': 'bg-emerald-200/40 text-emerald-700 border border-emerald-300/30',
  'Продажа': 'bg-surface-700 text-txt-primary border border-line',
  'Услуги': 'bg-warn-200/50 text-warn-700 border border-warn-600/30',
};

export function ListingPage({ listingId }: { listingId: string }) {
  const { user } = useAuth();
  const { navigate } = useRouter();

  const [listing, setListing] = useState<MarketplaceListing | null>(null);
  const [author, setAuthor] = useState<AuthorLite | null>(null);
  const [authorVerified, setAuthorVerified] = useState(0);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('marketplace_listings')
      .select('*')
      .eq('id', listingId)
      .maybeSingle();

    if (error || !data) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    const row = data as MarketplaceListing;
    setListing(row);

    const { data: profileRow } = await supabase
      .from('profiles')
      .select('id, full_name, public_slug, avatar_url, city')
      .eq('id', row.user_id)
      .maybeSingle();

    if (profileRow) {
      const p = profileRow as { id: string; full_name: string | null; public_slug: string | null; avatar_url: string | null; city: string | null };
      setAuthor({
        id: p.id,
        name: p.full_name || 'Пользователь FilmVerse',
        slug: p.public_slug,
        avatarUrl: p.avatar_url,
        city: p.city,
      });
    }

    setLoading(false);
  }, [listingId]);

  useEffect(() => { load(); }, [load]);

  // A seller's verification is public trust information, but the records
  // table is owner-read only — so this count is shown only on your own
  // listing, where the read is allowed.
  useEffect(() => {
    if (!user || !listing || listing.user_id !== user.id) { setAuthorVerified(0); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('verification_records')
        .select('verification_type')
        .eq('user_id', user.id)
        .eq('status', 'approved');
      if (cancelled) return;
      setAuthorVerified(new Set(((data || []) as { verification_type: string }[]).map((v) => v.verification_type)).size);
    })();
    return () => { cancelled = true; };
  }, [user, listing]);

  const handleDelete = async () => {
    if (!listing || !user) return;
    setDeleting(true);
    const { data, error } = await supabase
      .from('marketplace_listings')
      .delete()
      .eq('id', listing.id)
      .select('id');
    setDeleting(false);
    // A delete blocked by a policy returns no error and no rows — check rows.
    if (error || !data || data.length === 0) return;
    navigate('/marketplace');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 text-emerald-500 animate-spin" />
      </div>
    );
  }

  if (notFound || !listing) {
    return (
      <div className="animate-fade-in max-w-lg mx-auto text-center py-20">
        <h1 className="font-display text-2xl font-semibold text-txt-primary">Объявление не найдено</h1>
        <p className="mt-2 text-sm text-txt-secondary">Возможно, его уже сняли с публикации.</p>
        <button onClick={() => navigate('/marketplace')} className="mt-5 btn-primary">
          <ArrowLeft className="h-4 w-4" /> В Кинобарахолку
        </button>
      </div>
    );
  }

  const isMine = user?.id === listing.user_id;

  return (
    <div className="animate-fade-in max-w-5xl">
      <button onClick={() => navigate('/marketplace')} className="btn-ghost mb-4 !px-0">
        <ArrowLeft className="h-4 w-4" /> Кинобарахолка
      </button>

      <div className="grid lg:grid-cols-[1.2fr_1fr] gap-5">
        {/* Photo */}
        <div className="surface overflow-hidden">
          <div className="relative aspect-[4/3] bg-surface-700">
            {listing.image_url ? (
              <img src={listing.image_url} alt={listing.title} className="portrait-img" />
            ) : (
              <div className="h-full w-full flex flex-col items-center justify-center gap-2">
                <ImageOff className="h-7 w-7 text-txt-muted" />
                <p className="text-xs text-txt-muted">Без фото</p>
              </div>
            )}
            <div className="absolute top-4 left-4">
              <span className={`chip ${MODE_STYLES[listing.mode] || 'chip-neutral'}`}>{listing.mode}</span>
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="space-y-4">
          <div className="surface p-6">
            {listing.category && <p className="text-xs text-txt-muted mb-1.5">{listing.category}</p>}
            <h1 className="font-display text-2xl font-semibold text-txt-primary leading-tight">{listing.title}</h1>
            <p className="mt-3 text-2xl font-semibold text-emerald-600">
              {listing.price || 'Цена по запросу'}
            </p>

            <div className="mt-4 space-y-2 text-sm text-txt-secondary">
              <p className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-txt-muted" />
                {listing.city || 'Город не указан'}
              </p>
              <p className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-txt-muted" />
                {new Date(listing.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {!isMine && author && (
                <MessageButton
                  targetUserId={author.id}
                  targetName={author.name}
                  label="Написать продавцу"
                  variant="primary"
                />
              )}
              <ShareButton />
              {isMine && (
                <button onClick={handleDelete} disabled={deleting} className="btn-secondary">
                  {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  Снять с публикации
                </button>
              )}
            </div>
          </div>

          {/* Seller */}
          {author && (
            <div className="surface p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-txt-muted mb-3">
                {listing.mode === 'Услуги' ? 'Исполнитель' : 'Продавец'}
              </p>
              <button
                onClick={() => author.slug && navigate(`/u/${author.slug}`)}
                disabled={!author.slug}
                className="flex items-center gap-3 text-left w-full disabled:cursor-default"
              >
                {author.avatarUrl ? (
                  <img src={author.avatarUrl} alt="" className="h-11 w-11 rounded-full object-cover" />
                ) : (
                  <Avatar initials={author.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()} />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-txt-primary truncate">{author.name}</p>
                  {author.city && <p className="text-xs text-txt-muted truncate">{author.city}</p>}
                </div>
              </button>
              {isMine && authorVerified > 0 && (
                <p className="mt-3 flex items-center gap-1.5 text-xs text-emerald-600">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {authorVerified === 1 ? 'Одна пройденная верификация' : 'Двойная верификация пройдена'}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Description */}
      {listing.description && (
        <div className="surface p-6 mt-5">
          <h2 className="text-sm font-semibold text-txt-primary mb-3">Описание</h2>
          <p className="text-sm text-txt-secondary leading-relaxed whitespace-pre-line">{listing.description}</p>
        </div>
      )}
    </div>
  );
}
