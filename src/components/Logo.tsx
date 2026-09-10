type LogoVariant = 'emerald' | 'white' | 'dark';

type LogoMarkProps = {
  size?: number;
  variant?: LogoVariant;
  className?: string;
};

/**
 * Portal FV — FilmVerse brand mark.
 * FV monogram inside a subtle portal ring (entry/opportunity concept).
 * Flat, minimal, readable at favicon size.
 */
export function LogoMark({ size = 32, variant = 'emerald', className = '' }: LogoMarkProps) {
  const ring = variant === 'emerald' ? '#0D8F70' : variant === 'white' ? '#F2F3F1' : '#3E4643';
  const letters = variant === 'emerald' ? '#F2F3F1' : variant === 'white' ? '#121515' : '#F2F3F1';
  const portal = variant === 'emerald' ? '#16372F' : variant === 'white' ? '#E0E2DF' : '#1C2120';

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className={className}
      aria-label="FilmVerse"
    >
      {/* Portal ring */}
      <circle cx="16" cy="16" r="15" fill="none" stroke={ring} strokeWidth="2" />
      {/* Portal interior */}
      <circle cx="16" cy="16" r="12.5" fill={portal} />
      {/* FV monogram — F and V sharing a vertical stroke */}
      <path
        d="M11 9.5h6M11 9.5v13M11 15.5h4.5"
        fill="none"
        stroke={letters}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M17.5 9.5l2.5 7 2.5-7"
        fill="none"
        stroke={letters}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type LogoProps = {
  size?: number;
  showText?: boolean;
  variant?: LogoVariant;
  className?: string;
};

export function Logo({ size = 32, showText = true, variant = 'emerald', className = '' }: LogoProps) {
  const textColor = variant === 'white' ? 'text-white' : 'text-txt-primary';
  const verseColor = 'text-emerald-500';

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <LogoMark size={size} variant={variant} />
      {showText && (
        <span className={`font-display text-xl font-semibold tracking-tight ${textColor}`}>
          Film<span className={verseColor}>Verse</span>
        </span>
      )}
    </div>
  );
}

export function VerifiedBadge({ size = 14 }: { size?: number }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-200/30 text-emerald-500 border border-emerald-300/30"
      title="Проверено FilmVerse"
    >
      <LogoMark size={size} variant="emerald" />
      Проверено
    </span>
  );
}
