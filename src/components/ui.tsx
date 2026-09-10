import { useState, type ReactNode } from 'react';
import { Share2, Check, Link2 } from 'lucide-react';

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg';

const sizeMap: Record<AvatarSize, string> = {
  xs: 'h-7 w-7 text-[10px]',
  sm: 'h-9 w-9 text-xs',
  md: 'h-11 w-11 text-sm',
  lg: 'h-14 w-14 text-base',
};

type AvatarProps = {
  initials: string;
  size?: AvatarSize;
  className?: string;
};

export function Avatar({ initials, size = 'md', className = '' }: AvatarProps) {
  return (
    <div className={`relative shrink-0 rounded-full bg-surface-500 border border-line flex items-center justify-center font-semibold text-txt-primary tracking-wide ${sizeMap[size]} ${className}`}>
      {initials}
    </div>
  );
}

type CardProps = {
  children: ReactNode;
  className?: string;
  raised?: boolean;
  onClick?: () => void;
};

export function Card({ children, className = '', raised = false, onClick }: CardProps) {
  return (
    <div onClick={onClick} className={`bg-white border border-stone-300/60 rounded-xl ${raised ? 'shadow-soft-lg' : 'shadow-soft'} ${onClick ? 'cursor-pointer' : ''} ${className}`}>
      {children}
    </div>
  );
}

type BadgeVariant = 'fern' | 'neutral' | 'stone' | 'dark';

const badgeVariants: Record<BadgeVariant, string> = {
  fern: 'chip-fern',
  neutral: 'chip-neutral',
  stone: 'chip-stone',
  dark: 'chip-dark',
};

export function Badge({ children, variant = 'neutral', className = '' }: { children: ReactNode; variant?: BadgeVariant; className?: string }) {
  return <span className={`chip ${badgeVariants[variant]} ${className}`}>{children}</span>;
}

type IconButtonProps = {
  children: ReactNode;
  onClick?: () => void;
  label: string;
  className?: string;
};

export function IconButton({ children, onClick, label, className = '' }: IconButtonProps) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={`relative inline-flex items-center justify-center h-9 w-9 rounded-lg text-ink-500 hover:text-ink-900 hover:bg-paper-200 transition-all duration-200 ${className}`}
    >
      {children}
    </button>
  );
}

export function ShareButton({ label = 'Поделиться', className = '', dark = false }: { label?: string; className?: string; dark?: boolean }) {
  const [copied, setCopied] = useState(false);

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const url = window.location.href;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleShare}
      className={`inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
        dark
          ? 'text-txt-secondary hover:text-txt-primary hover:bg-white/5 border border-line'
          : 'text-txt-secondary hover:text-emerald-600 hover:bg-emerald-200/20 border border-line'
      } ${className}`}
    >
      {copied ? (
        <>
          <Check className="h-4 w-4 text-fern-500" />
          <span>Ссылка скопирована</span>
        </>
      ) : (
        <>
          <Share2 className="h-4 w-4" />
          <span>{label}</span>
        </>
      )}
    </button>
  );
}

export function SectionHeader({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex items-center justify-between mb-5">
      <h2 className="font-display text-2xl font-semibold text-ink-900 tracking-tight">{title}</h2>
      {action && (
        <button
          onClick={onAction}
          className="text-sm font-medium text-fern-600 hover:text-fern-700 transition-colors flex items-center gap-1"
        >
          {action}
        </button>
      )}
    </div>
  );
}
