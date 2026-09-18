import { Camera, Loader2, X } from 'lucide-react';
import type { ActorCategory } from '../../types';

const CATEGORIES: ActorCategory[] = ['Актёр', 'Актриса', 'Массовка', 'Студент', 'Модель'];
const HAIR_COLORS = ['Русые', 'Светлые', 'Тёмные', 'Чёрные', 'Рыжие', 'Седые', 'Крашеные'];
const EYE_COLORS = ['Голубые', 'Серые', 'Зелёные', 'Карие', 'Чёрные'];

export type ActorFieldsValue = {
  category: string;
  gender: string;
  age: string;
  height: string;
  hairColor: string;
  eyeColor: string;
  experienceYears: string;
  gallery: string[];
};

// Stored as 'М' / 'Ж' to match how casting filters read the field.
const GENDERS: { value: string; label: string }[] = [
  { value: 'М', label: 'Мужской' },
  { value: 'Ж', label: 'Женский' },
];

type ActorFieldsProps = {
  value: ActorFieldsValue;
  onChange: (patch: Partial<ActorFieldsValue>) => void;
  onUploadPhoto: (file: File) => void;
  uploading: boolean;
};

/**
 * The fields that only make sense for someone who gets cast on camera.
 * Crew members never see these — their profile shows department, profession
 * and experience instead.
 */
export function ActorFields({ value, onChange, onUploadPhoto, uploading }: ActorFieldsProps) {
  const removePhoto = (url: string) => {
    onChange({ gallery: value.gallery.filter((g) => g !== url) });
  };

  return (
    <div className="space-y-5">
      {/* Category */}
      <div>
        <label className="block text-xs font-medium text-txt-secondary mb-1.5">Категория</label>
        <select
          value={value.category}
          onChange={(e) => onChange({ category: e.target.value })}
          className="input-field"
        >
          <option value="">Не выбрано</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Gender */}
      <div>
        <label className="block text-xs font-medium text-txt-secondary mb-1.5">Пол</label>
        <div className="flex gap-2">
          {GENDERS.map((g) => (
            <button
              key={g.value}
              type="button"
              onClick={() => onChange({ gender: value.gender === g.value ? '' : g.value })}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                value.gender === g.value
                  ? 'bg-emerald-200/30 text-emerald-600 border-emerald-400'
                  : 'bg-surface-600 text-txt-secondary border-line-soft hover:border-line'
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>

      {/* Age + height */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-txt-secondary mb-1.5">Возраст</label>
          <input
            type="number"
            min={0}
            max={120}
            inputMode="numeric"
            value={value.age}
            onChange={(e) => onChange({ age: e.target.value })}
            placeholder="например, 32"
            className="input-field"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-txt-secondary mb-1.5">Рост, см</label>
          <input
            type="number"
            min={0}
            max={260}
            inputMode="numeric"
            value={value.height}
            onChange={(e) => onChange({ height: e.target.value })}
            placeholder="например, 178"
            className="input-field"
          />
        </div>
      </div>

      {/* Hair + eyes */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-txt-secondary mb-1.5">Цвет волос</label>
          <input
            type="text"
            value={value.hairColor}
            onChange={(e) => onChange({ hairColor: e.target.value })}
            list="filmverse-hair-colors"
            placeholder="Начните вводить"
            autoComplete="off"
            className="input-field"
          />
          <datalist id="filmverse-hair-colors">
            {HAIR_COLORS.map((c) => <option key={c} value={c} />)}
          </datalist>
        </div>
        <div>
          <label className="block text-xs font-medium text-txt-secondary mb-1.5">Цвет глаз</label>
          <input
            type="text"
            value={value.eyeColor}
            onChange={(e) => onChange({ eyeColor: e.target.value })}
            list="filmverse-eye-colors"
            placeholder="Начните вводить"
            autoComplete="off"
            className="input-field"
          />
          <datalist id="filmverse-eye-colors">
            {EYE_COLORS.map((c) => <option key={c} value={c} />)}
          </datalist>
        </div>
      </div>

      {/* Experience */}
      <div>
        <label className="block text-xs font-medium text-txt-secondary mb-1.5">
          Опыт съёмок, лет
        </label>
        <input
          type="number"
          min={0}
          max={80}
          inputMode="numeric"
          value={value.experienceYears}
          onChange={(e) => onChange({ experienceYears: e.target.value })}
          placeholder="например, 5"
          className="input-field"
        />
      </div>

      {/* Gallery */}
      <div>
        <label className="block text-xs font-medium text-txt-secondary mb-1.5">
          Фотографии
        </label>
        <p className="text-xs text-txt-muted mb-3">
          Портрет и фото в полный рост — то, по чему кастинг-директор принимает решение.
        </p>

        {value.gallery.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mb-3">
            {value.gallery.map((url) => (
              <div key={url} className="relative group aspect-[3/4] rounded-lg overflow-hidden border border-line-soft">
                <img src={url} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removePhoto(url)}
                  aria-label="Убрать фото"
                  className="absolute top-1.5 right-1.5 p-1 rounded-md bg-base-950/70 text-txt-primary opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <label className={`btn-secondary cursor-pointer ${uploading ? 'pointer-events-none opacity-60' : ''}`}>
          {uploading ? (
            <><Loader2 className="h-4 w-4 animate-spin" /><span>Загрузка…</span></>
          ) : (
            <><Camera className="h-4 w-4" /><span>Добавить фото</span></>
          )}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onUploadPhoto(f);
              e.target.value = '';
            }}
          />
        </label>
      </div>
    </div>
  );
}
