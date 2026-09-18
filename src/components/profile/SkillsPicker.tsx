import { Fragment, useState } from 'react';
import { Search, Check } from 'lucide-react';
import type { Skill } from '../../types';

type SkillsPickerProps = {
  skills: Skill[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  actor?: boolean;
  departmentId?: string;
};
const categoryLabels: Record<string, string> = { performance: 'Актёрское мастерство', movement: 'Движение и танец', combat: 'Трюки и бой', sport: 'Спорт', vehicles: 'Транспорт', animals: 'Животные', music: 'Музыка', other: 'Другое', camera: 'Камера', lighting: 'Свет', grip: 'Grip', post: 'Монтаж и пост', vfx: 'VFX', sound: 'Звук', makeup: 'Грим', production: 'Продакшн', stunts: 'Каскадёрская работа', art: 'Художественный департамент', costume: 'Костюм' };

/**
 * Multi-select for the shared `skills` reference table. Used by actors
 * (Верховая езда, Фехтование…) and by crew alike (ARRI Alexa, DaVinci…),
 * because the seed list covers both and one person can be both.
 */
export function SkillsPicker({ skills, selectedIds, onChange, actor = false, departmentId }: SkillsPickerProps) {
  const [query, setQuery] = useState('');
  const [all, setAll] = useState(false);

  const q = query.trim().toLowerCase();
  const visible = skills.filter(s => s.is_active !== false && (!q || s.name.toLowerCase().includes(q)))
    .filter(s => all || selectedIds.includes(s.id) || s.scope === 'both' || (actor ? s.scope === 'actor' : s.scope === 'professional' && (!departmentId || s.department_id === departmentId)))
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

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

      <button type="button" className="text-sm text-emerald-500 mb-3" onClick={() => setAll(!all)}>{all ? 'Показать подходящие' : 'Показать все навыки'}</button>
      {visible.length === 0 ? (
        <p className="text-sm text-txt-muted py-2">Ничего не найдено</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {visible.map((s, index) => {
            const active = selectedIds.includes(s.id);
            return (
              <Fragment key={s.id}>
              {(index === 0 || visible[index - 1].category !== s.category) && <h3 className="w-full text-xs font-semibold text-txt-muted mt-2">{s.scope === 'both' ? 'Общие' : s.scope === 'actor' ? 'Актёрские' : 'Профессиональные'} · {categoryLabels[s.category || 'other'] || s.category}</h3>}
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
              </Fragment>
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
