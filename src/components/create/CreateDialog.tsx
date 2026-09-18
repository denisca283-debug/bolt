import { useState, useEffect } from 'react';
import { X, Loader2, ImagePlus, ShoppingBag, Briefcase, Clapperboard, Check } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { addPulse } from '../../lib/pulse';
import { CityInput } from '../CityInput';
import type { Department, Profession } from '../../types';

export type CreateKind = 'listing' | 'work' | 'project';

type CreateDialogProps = {
  initialKind?: CreateKind;
  onClose: () => void;
  /** Called once the row exists, so the caller can refresh or navigate. */
  onCreated: (kind: CreateKind, id: string) => void;
};

const KINDS: { kind: CreateKind; label: string; hint: string; icon: typeof ShoppingBag }[] = [
  { kind: 'listing', label: 'Объявление', hint: 'Аренда, продажа, услуги', icon: ShoppingBag },
  { kind: 'work', label: 'Вакансия', hint: 'Роль, смена, работа в группе', icon: Briefcase },
  { kind: 'project', label: 'Проект', hint: 'Фильм, реклама, клип', icon: Clapperboard },
];

const LISTING_MODES = ['Аренда', 'Продажа', 'Услуги'];
const LISTING_CATEGORIES = ['Камеры', 'Оптика', 'Свет', 'Звук', 'Грип', 'Транспорт', 'Реквизит', 'Костюмы', 'Локации', 'Услуги', 'Другое'];
/**
 * Who the job is for. This is the first question an employer answers, because
 * it decides everything else on the form — an actor is cast by role, a crew
 * member is hired by profession.
 */
const WORK_TARGETS = [
  { key: 'actor', audience: 'Актёры', label: 'Актёра', hint: 'Роль в проекте' },
  { key: 'crew', audience: 'Специалисты', label: 'Специалиста', hint: 'Человека в группу' },
  { key: 'extra', audience: 'Актёры', label: 'Массовку', hint: 'Людей на смену' },
] as const;

type WorkTarget = (typeof WORK_TARGETS)[number]['key'];

const ROLE_TYPES = ['Главная роль', 'Вторая роль', 'Эпизод', 'Реклама', 'Клип', 'Фотосъёмка'];
const PROJECT_STAGES = ['Разработка', 'Препродакшн', 'Съёмки', 'Постпродакшн', 'Завершён'];
const PROJECT_GENRES = ['Драма', 'Комедия', 'Триллер', 'Документальный', 'Реклама', 'Клип', 'Короткий метр', 'Сериал', 'Другое'];

/**
 * Defined at module level, not inside the dialog: a component declared during
 * render is a brand-new type on every keystroke, so React unmounts the input
 * and the field loses focus after each character typed.
 */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-txt-secondary mb-1.5">{label}</label>
      {children}
    </div>
  );
}

export function CreateDialog({ initialKind = 'listing', onClose, onCreated }: CreateDialogProps) {
  const { user, profile } = useAuth();
  const [kind, setKind] = useState<CreateKind>(initialKind);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Shared
  const [title, setTitle] = useState('');
  const [city, setCity] = useState(profile?.city || '');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  // Listing
  const [mode, setMode] = useState('Аренда');
  const [category, setCategory] = useState('Камеры');
  const [price, setPrice] = useState('');

  // Work
  const [target, setTarget] = useState<WorkTarget>('actor');
  const [roleType, setRoleType] = useState('Главная роль');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [professions, setProfessions] = useState<Profession[]>([]);
  const [deptId, setDeptId] = useState('');
  const [profId, setProfId] = useState('');
  const [projectName, setProjectName] = useState('');
  const [shootDate, setShootDate] = useState('');
  const [ageRange, setAgeRange] = useState('');
  const [pay, setPay] = useState('');
  const [spots, setSpots] = useState('');

  // Project
  const [logline, setLogline] = useState('');
  const [genre, setGenre] = useState('Драма');
  const [stage, setStage] = useState('Препродакшн');
  const [director, setDirector] = useState('');
  const [teamSize, setTeamSize] = useState('');

  const personName = profile?.full_name || 'Пользователь FilmVerse';

  // The profession taxonomy already lives in the database — a vacancy points
  // at it instead of repeating it as free text, so "нужен 1AC" is searchable.
  useEffect(() => {
    if (kind !== 'work' || departments.length > 0) return;
    let cancelled = false;
    (async () => {
      const [deptRes, profRes] = await Promise.all([
        supabase.from('departments').select('*').order('sort_order'),
        supabase.from('professions').select('*').order('sort_order'),
      ]);
      if (cancelled) return;
      if (deptRes.data) setDepartments(deptRes.data as Department[]);
      if (profRes.data) setProfessions(profRes.data as Profession[]);
    })();
    return () => { cancelled = true; };
  }, [kind, departments.length]);

  const professionsInDept = deptId ? professions.filter((p) => p.department_id === deptId) : [];
  const chosenProfession = professions.find((p) => p.id === profId) || null;

  // Photos go into the existing `avatars` bucket: its policy only requires the
  // first path segment to be the user's id, so no new bucket is needed.
  const handleImageUpload = async (file: File) => {
    if (!user) {
      setError('Сессия истекла. Обновите страницу и войдите снова.');
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `${user.id}/post-${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
      if (uploadErr) {
        setError('Не удалось загрузить фото. Попробуйте другое изображение.');
        setUploading(false);
        return;
      }
      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      setImageUrl(data.publicUrl);
    } catch {
      setError('Не удалось загрузить фото. Попробуйте ещё раз.');
    }
    setUploading(false);
  };

  const canSubmit =
    title.trim().length > 1 &&
    !saving &&
    !uploading &&
    // A crew vacancy without a profession is exactly the "кто требуется?"
    // gap this form exists to close.
    (kind !== 'work' || target !== 'crew' || !!profId);

  const handleSubmit = async () => {
    if (!user) {
      setError('Сессия истекла. Обновите страницу и войдите снова — тогда опубликуем.');
      return;
    }
    setSaving(true);
    setError(null);

    let table = '';
    let payload: Record<string, unknown> = {};

    if (kind === 'listing') {
      table = 'marketplace_listings';
      payload = {
        user_id: user.id,
        title: title.trim(),
        mode,
        category,
        city: city.trim() || null,
        price: price.trim() || null,
        image_url: imageUrl,
        description: description.trim() || null,
      };
    } else if (kind === 'work') {
      const total = parseInt(spots, 10);
      const targetDef = WORK_TARGETS.find((t) => t.key === target)!;
      table = 'work_opportunities';
      payload = {
        user_id: user.id,
        title: title.trim(),
        type: target === 'crew' ? (chosenProfession?.name || 'Съёмочная группа')
          : target === 'extra' ? 'Массовка'
          : roleType,
        audience: targetDef.audience,
        department_id: target === 'crew' && deptId ? deptId : null,
        profession_id: target === 'crew' && profId ? profId : null,
        project_name: projectName.trim() || null,
        city: city.trim() || null,
        shoot_date: shootDate.trim() || null,
        age_range: target === 'crew' ? null : ageRange.trim() || null,
        genre: null,
        pay: pay.trim() || null,
        spots_total: Number.isFinite(total) ? total : null,
        spots_left: Number.isFinite(total) ? total : null,
        description: description.trim() || null,
      };
    } else {
      const size = parseInt(teamSize, 10);
      table = 'projects';
      payload = {
        user_id: user.id,
        title: title.trim(),
        logline: logline.trim() || null,
        genre,
        stage,
        city: city.trim() || null,
        director: director.trim() || null,
        team_size: Number.isFinite(size) ? size : null,
        image_url: imageUrl,
      };
    }

    // `.select()` matters: without it an insert blocked by a policy can come
    // back looking fine while nothing was written.
    const { data, error: insertErr } = await supabase.from(table).insert(payload).select('id').single();

    if (insertErr || !data) {
      setSaving(false);
      setError(
        insertErr?.message?.includes('does not exist') || insertErr?.code === '42P01'
          ? 'Таблица ещё не создана в базе. Выполните миграции 008 и 009 в панели базы данных.'
          : 'Не удалось опубликовать. Проверьте поля и попробуйте ещё раз.'
      );
      return;
    }

    if (kind === 'listing') {
      await addPulse({
        kind: 'marketplace',
        person: personName,
        action: mode === 'Услуги' ? 'предлагает услугу' : `разместил${mode === 'Аренда' ? ' в аренду' : ' на продажу'}`,
        target: title.trim(),
        photoUrl: profile?.avatar_url ?? null,
      });
    } else if (kind === 'work') {
      await addPulse({
        kind: target === 'crew' ? 'crew-search' : 'spots',
        person: personName,
        action: target === 'crew'
          ? `ищет в группу — ${chosenProfession?.name || 'специалиста'}`
          : target === 'extra' ? 'набирает массовку' : 'ищет актёра',
        target: projectName.trim() || title.trim(),
        photoUrl: profile?.avatar_url ?? null,
      });
    } else {
      await addPulse({
        kind: 'role',
        person: personName,
        action: 'открыл проект',
        target: title.trim(),
        photoUrl: profile?.avatar_url ?? null,
      });
    }

    setSaving(false);
    onCreated(kind, data.id as string);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
      <div className="absolute inset-0 bg-base-950/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl surface p-6 animate-scale-in max-h-[88vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-txt-muted hover:text-txt-primary transition-colors"
          aria-label="Закрыть"
        >
          <X className="h-5 w-5" />
        </button>

        <h2 className="font-display text-xl font-semibold text-txt-primary mb-1">Разместить</h2>
        <p className="text-xs text-txt-muted mb-5">Публикация видна всем — и тем, кто ещё не зарегистрирован.</p>

        {/* What to publish */}
        <div className="grid grid-cols-3 gap-2 mb-5">
          {KINDS.map((k) => {
            const active = kind === k.kind;
            const Icon = k.icon;
            return (
              <button
                key={k.kind}
                type="button"
                onClick={() => setKind(k.kind)}
                className={`p-3 rounded-lg border text-left transition-all duration-200 ${
                  active ? 'bg-emerald-200/25 border-emerald-400' : 'bg-surface-600 border-line-soft hover:border-line'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon className={`h-3.5 w-3.5 ${active ? 'text-emerald-600' : 'text-txt-muted'}`} />
                  <span className={`text-xs font-medium ${active ? 'text-emerald-600' : 'text-txt-primary'}`}>{k.label}</span>
                </div>
                <p className="text-[11px] text-txt-muted leading-snug">{k.hint}</p>
              </button>
            );
          })}
        </div>

        <div className="space-y-4">
          <Field label={kind === 'listing' ? 'Что размещаете' : kind === 'work' ? 'Заголовок объявления' : 'Название проекта'}>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                kind === 'listing' ? 'Например: ARRI Alexa Mini LF' :
                kind === 'work' ? (
                  target === 'crew' ? 'Например: Второй оператор на сериал, 6 смен' :
                  target === 'extra' ? 'Например: Массовка на вокзал, 40 человек' :
                  'Например: Главная роль, женщина 25–35'
                ) :
                'Например: Тихая гавань'
              }
              className="input-field"
            />
          </Field>

          {/* ── Listing ─────────────────────────────────────────── */}
          {kind === 'listing' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Тип">
                  <select value={mode} onChange={(e) => setMode(e.target.value)} className="input-field">
                    {LISTING_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </Field>
                <Field label="Категория">
                  <select value={category} onChange={(e) => setCategory(e.target.value)} className="input-field">
                    {LISTING_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Город">
                  <CityInput value={city} onChange={setCity} />
                </Field>
                <Field label="Цена">
                  <input
                    type="text"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder={mode === 'Аренда' ? '18 000 ₽ / смена' : '420 000 ₽'}
                    className="input-field"
                  />
                </Field>
              </div>
            </>
          )}

          {/* ── Work ────────────────────────────────────────────── */}
          {kind === 'work' && (
            <>
              {/* Кто требуется — первый и главный вопрос */}
              <div>
                <label className="block text-xs font-medium text-txt-secondary mb-1.5">Кто требуется</label>
                <div className="grid grid-cols-3 gap-2">
                  {WORK_TARGETS.map((t) => {
                    const active = target === t.key;
                    return (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => setTarget(t.key)}
                        className={`p-2.5 rounded-lg border text-left transition-all duration-200 ${
                          active ? 'bg-emerald-200/25 border-emerald-400' : 'bg-surface-700 border-line-soft hover:border-line'
                        }`}
                      >
                        <span className={`block text-xs font-medium ${active ? 'text-emerald-600' : 'text-txt-primary'}`}>
                          {t.label}
                        </span>
                        <span className="block text-[11px] text-txt-muted leading-snug mt-0.5">{t.hint}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {target === 'crew' ? (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Департамент">
                    <select
                      value={deptId}
                      onChange={(e) => { setDeptId(e.target.value); setProfId(''); }}
                      className="input-field"
                    >
                      <option value="">Выберите департамент</option>
                      {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Профессия">
                    <select
                      value={profId}
                      onChange={(e) => setProfId(e.target.value)}
                      className="input-field"
                      disabled={!deptId}
                    >
                      <option value="">{deptId ? 'Выберите профессию' : 'Сначала департамент'}</option>
                      {professionsInDept.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </Field>
                </div>
              ) : target === 'actor' ? (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Тип роли">
                    <select value={roleType} onChange={(e) => setRoleType(e.target.value)} className="input-field">
                      {ROLE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </Field>
                  <Field label="Возраст">
                    <input type="text" value={ageRange} onChange={(e) => setAgeRange(e.target.value)} placeholder="25–35" className="input-field" />
                  </Field>
                </div>
              ) : (
                <Field label="Возраст">
                  <input type="text" value={ageRange} onChange={(e) => setAgeRange(e.target.value)} placeholder="18–60 или «любой»" className="input-field" />
                </Field>
              )}

              <div className="grid grid-cols-2 gap-3">
                <Field label="Проект">
                  <input type="text" value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="Название проекта" className="input-field" />
                </Field>
                <Field label="Город">
                  <CityInput value={city} onChange={setCity} />
                </Field>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Даты смен">
                  <input type="text" value={shootDate} onChange={(e) => setShootDate(e.target.value)} placeholder="12–14 июня" className="input-field" />
                </Field>
                <Field label="Мест">
                  <input type="number" min="1" value={spots} onChange={(e) => setSpots(e.target.value)} placeholder="1" className="input-field" />
                </Field>
                <Field label="Оплата">
                  <input type="text" value={pay} onChange={(e) => setPay(e.target.value)} placeholder="5 000 ₽ / смена" className="input-field" />
                </Field>
              </div>
            </>
          )}

          {/* ── Project ─────────────────────────────────────────── */}
          {kind === 'project' && (
            <>
              <Field label="Логлайн">
                <input type="text" value={logline} onChange={(e) => setLogline(e.target.value)} placeholder="О чём проект в одном предложении" className="input-field" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Жанр">
                  <select value={genre} onChange={(e) => setGenre(e.target.value)} className="input-field">
                    {PROJECT_GENRES.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </Field>
                <Field label="Стадия">
                  <select value={stage} onChange={(e) => setStage(e.target.value)} className="input-field">
                    {PROJECT_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className="block text-xs font-medium text-txt-secondary mb-1.5">Город</label>
                  <CityInput value={city} onChange={setCity} />
                </div>
                <Field label="Режиссёр">
                  <input type="text" value={director} onChange={(e) => setDirector(e.target.value)} placeholder="Имя" className="input-field" />
                </Field>
                <Field label="Размер группы">
                  <input type="number" min="1" value={teamSize} onChange={(e) => setTeamSize(e.target.value)} placeholder="20" className="input-field" />
                </Field>
              </div>
            </>
          )}

          <Field label="Описание">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder={
                kind === 'listing' ? 'Комплектация, состояние, условия аренды, доставка…' :
                kind === 'work' ? 'Требования, условия, что нужно прислать…' :
                'Подробности проекта'
              }
              className="input-field resize-none"
            />
          </Field>

          {/* Photo */}
          {kind !== 'work' && (
            <div>
              <label className="block text-xs font-medium text-txt-secondary mb-1.5">Фото</label>
              <div className="flex items-center gap-3">
                <div className="h-16 w-20 rounded-lg overflow-hidden bg-surface-700 border border-line-soft shrink-0 flex items-center justify-center">
                  {imageUrl ? (
                    <img src={imageUrl} alt="" className="portrait-img" />
                  ) : (
                    <ImagePlus className="h-5 w-5 text-txt-muted" />
                  )}
                </div>
                <label className="btn-secondary cursor-pointer">
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                  <span>{imageUrl ? 'Заменить' : 'Загрузить'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleImageUpload(f);
                    }}
                  />
                </label>
                {imageUrl && (
                  <button onClick={() => setImageUrl(null)} className="btn-ghost text-xs">Убрать</button>
                )}
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-lg bg-danger-200/30 border border-danger-600/30">
            <p className="text-xs text-danger-700 leading-relaxed">{error}</p>
          </div>
        )}

        <button onClick={handleSubmit} disabled={!canSubmit} className="btn-primary w-full mt-5">
          {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Публикуем…</> : <><Check className="h-4 w-4" /> Опубликовать</>}
        </button>
      </div>
    </div>
  );
}
