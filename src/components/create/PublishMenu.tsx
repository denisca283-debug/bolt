import { useState, useEffect } from 'react';
import { Plus, X, Briefcase, FileText, Clapperboard } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useAuthModal } from '../AuthModal';
import { useRouter } from '../../router';
import { CreateDialog, type CreateKind } from './CreateDialog';

type PublishMenuProps = {
  onCreated: (kind: CreateKind, id: string) => void;
  /** Compact icon-only trigger for narrow screens. */
  compact?: boolean;
};

/**
 * Global publish entry (TopBar).
 * Opens a clear modal: Vacancy or Resume (and optionally Project).
 * Marketplace has its own button — do not change that flow.
 */
export function PublishMenu({ onCreated, compact = false }: PublishMenuProps) {
  const { user } = useAuth();
  const { promptGuest } = useAuthModal();
  const { navigate } = useRouter();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [creating, setCreating] = useState<CreateKind | null>(null);

  // Escape closes the picker
  useEffect(() => {
    if (!pickerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPickerOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [pickerOpen]);

  const handleTrigger = () => {
    if (!user) {
      promptGuest({
        message: 'Чтобы что-то опубликовать, войдите в FilmVerse или создайте аккаунт.',
      });
      return;
    }
    setPickerOpen(true);
  };

  const pickVacancy = () => {
    setPickerOpen(false);
    setCreating('work');
  };

  const pickResume = () => {
    setPickerOpen(false);
    // Резюме = заполненный профиль. Отдельной сущности «резюме» пока нет.
    navigate('/profile');
  };

  const pickProject = () => {
    setPickerOpen(false);
    setCreating('project');
  };

  return (
    <div className="relative">
      <button
        onClick={handleTrigger}
        aria-haspopup="dialog"
        aria-expanded={pickerOpen}
        className={`btn-primary ${compact ? '!px-2.5' : ''}`}
      >
        <Plus className="h-4 w-4" />
        {!compact && <span>Разместить</span>}
      </button>

      {/* ── Picker modal: Vacancy | Resume ── */}
      {pickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
          <div
            className="absolute inset-0 bg-base-950/70 backdrop-blur-sm"
            onClick={() => setPickerOpen(false)}
            aria-hidden
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="publish-picker-title"
            className="relative w-full max-w-sm surface p-6 animate-scale-in"
          >
            <button
              type="button"
              onClick={() => setPickerOpen(false)}
              className="absolute top-3 right-3 text-txt-muted hover:text-txt-primary transition-colors"
              aria-label="Закрыть"
            >
              <X className="h-5 w-5" />
            </button>

            <h2
              id="publish-picker-title"
              className="font-display text-xl font-semibold text-txt-primary pr-8"
            >
              Что разместить?
            </h2>
            <p className="mt-1.5 text-sm text-txt-secondary leading-relaxed">
              Выберите тип публикации. Окно можно закрыть крестиком или кликом снаружи.
            </p>

            <div className="mt-5 space-y-2">
              <button
                type="button"
                onClick={pickVacancy}
                className="w-full flex items-start gap-3 p-3.5 rounded-xl border border-line-soft bg-surface-600 hover:border-emerald-400 hover:bg-emerald-200/10 text-left transition-all duration-200"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-700 border border-line-soft shrink-0">
                  <Briefcase className="h-5 w-5 text-emerald-500" strokeWidth={1.8} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-txt-primary">Вакансия</span>
                  <span className="block text-xs text-txt-muted leading-snug mt-0.5">
                    Роль, кастинг, место в группе, массовка
                  </span>
                </span>
              </button>

              <button
                type="button"
                onClick={pickResume}
                className="w-full flex items-start gap-3 p-3.5 rounded-xl border border-line-soft bg-surface-600 hover:border-emerald-400 hover:bg-emerald-200/10 text-left transition-all duration-200"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-700 border border-line-soft shrink-0">
                  <FileText className="h-5 w-5 text-emerald-500" strokeWidth={1.8} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-txt-primary">Резюме</span>
                  <span className="block text-xs text-txt-muted leading-snug mt-0.5">
                    Заполнить профиль — вас найдут работодатели
                  </span>
                </span>
              </button>

              <button
                type="button"
                onClick={pickProject}
                className="w-full flex items-start gap-3 p-3.5 rounded-xl border border-line-soft bg-surface-600 hover:border-emerald-400 hover:bg-emerald-200/10 text-left transition-all duration-200"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-700 border border-line-soft shrink-0">
                  <Clapperboard className="h-5 w-5 text-emerald-500" strokeWidth={1.8} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-txt-primary">Проект</span>
                  <span className="block text-xs text-txt-muted leading-snug mt-0.5">
                    Фильм, реклама, клип — искать команду
                  </span>
                </span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setPickerOpen(false)}
              className="mt-5 w-full text-center text-sm text-txt-muted hover:text-txt-secondary transition-colors py-2"
            >
              Отмена
            </button>
          </div>
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
