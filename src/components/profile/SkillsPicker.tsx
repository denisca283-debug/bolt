import { useState } from 'react';
import { Search, Check } from 'lucide-react';
import type { Skill } from '../../types';

type SkillsPickerProps = {
  skills: Skill[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
};

/**
 * Multi-select for the shared `skills` reference table. Used by actors
 * (Верховая езда, Фехтование…) and by crew alike (ARRI Alexa, DaVinci…),
 * because the seed list covers both and one person can be both.
 */
export function SkillsPicker({ skills, selectedIds, onChange }: SkillsPickerProps) {
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const visible = q ? skills.filter((s) => s.name.toLowerCase().includes(q)) : skills;

  const toggle = (id: string) => {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((x) => x !== id)
        : [...selectedIds, id]
    );
  };

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <label className="block text-xs font-medium text-txt-secondary">Навыки</label>
        {selectedIds.length > 0 && (
          <span className="text-[11px] text-txt-muted">выбрано: {selectedIds.length}</span>
        )}
      </div>

      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-txt-muted" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Найти навык…"
          className="input-field !py-2 pl-9 text-sm"
        />
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-txt-muted py-2">Ничего не найдено</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {visible.map((s) => {
            const active = selectedIds.includes(s.id);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => toggle(s.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-all duration-200 ${
                  active
                    ? 'bg-emerald-200/30 text-emerald-600 border-emerald-400'
                    : 'bg-surface-600 text-txt-secondary border-line-soft hover:border-line'
                }`}
              >
                {active && <Check className="h-3.5 w-3.5 shrink-0" />}
                <span>{s.name}</span>
              </button>
            );
          })}
        </div>
      )}

      <p className="mt-2 text-xs text-txt-muted">
        Нажмите, чтобы выбрать или снять. Эти навыки видны тем, кто ищет исполнителей.
      </p>
    </div>
  );
}
