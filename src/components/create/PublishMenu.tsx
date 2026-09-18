import { useState, useEffect, useRef } from 'react';
import { Plus, ChevronDown, ShoppingBag, Briefcase, Clapperboard } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useAuthModal } from '../AuthModal';
import { CreateDialog, type CreateKind } from './CreateDialog';

type PublishMenuProps = {
  onCreated: (kind: CreateKind, id: string) => void;
  /** Compact icon-only trigger for narrow screens. */
  compact?: boolean;
};

const OPTIONS: { kind: CreateKind; title: string; hint: string; icon: typeof ShoppingBag }[] = [
  { kind: 'work', title: 'Вакансию или кастинг', hint: 'Актёр, массовка, человек в группу', icon: Briefcase },
  { kind: 'listing', title: 'Объявление', hint: 'Аренда, продажа, услуга', icon: ShoppingBag },
  { kind: 'project', title: 'Проект', hint: 'Фильм, реклама, клип', icon: Clapperboard },
];

/**
 * The global publish entry point.
 *
 * A bare "+ Разместить" told nobody what it would do. This opens a short menu
 * that names each thing you can publish, so the choice is made before the form
 * and the form opens already on the right type.
 */
export function PublishMenu({ onCreated, compact = false }: PublishMenuProps) {
  const { user } = useAuth();
  const { promptGuest } = useAuthModal();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState<CreateKind | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const handleTrigger = () => {
    if (!user) {
      promptGuest({ message: 'Чтобы что-то опубликовать, войдите в FilmVerse или создайте аккаунт.' });
      return;
    }
    setOpen((v) => !v);
  };

  const pick = (kind: CreateKind) => {
    setOpen(false);
    setCreating(kind);
  };

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={handleTrigger}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`btn-primary ${compact ? '!px-2.5' : ''}`}
      >
        <Plus className="h-4 w-4" />
        {!compact && (
          <>
            <span>Разместить</span>
            <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
          </>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-[19rem] bg-surface-500 border border-line rounded-xl shadow-soft-lg p-1.5 z-50 animate-scale-in"
        >
          <p className="px-2.5 pt-1.5 pb-2 text-[11px] font-medium uppercase tracking-wider text-txt-muted">
            Что разместить
          </p>
          {OPTIONS.map((o) => {
            const Icon = o.icon;
            return (
              <button
                key={o.kind}
                role="menuitem"
                onClick={() => pick(o.kind)}
                className="w-full flex items-start gap-3 p-2.5 rounded-lg text-left hover:bg-surface-400 transition-colors duration-150"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-700 border border-line-soft shrink-0">
                  <Icon className="h-4 w-4 text-emerald-500" strokeWidth={1.8} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-txt-primary">{o.title}</span>
                  <span className="block text-[11px] text-txt-muted leading-snug mt-0.5">{o.hint}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      {creating && (
        <CreateDialog
          initialKind={creating}
          onClose={() => setCreating(null)}
          onCreated={(kind, id) => {
            setCreating(null);
            onCreated(kind, id);
          }}
        />
      )}
    </div>
  );
}
