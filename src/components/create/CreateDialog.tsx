import { ModalShell } from '../ModalShell';
import { useState, useEffect } from 'react';
import { Loader2, ImagePlus, ShoppingBag, Briefcase, Clapperboard, Check } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useOrganization } from '../../hooks/useOrganization';
import { addPulse } from '../../lib/pulse';
import { compensationLabels } from '../../lib/modelTaxonomy';
import { CityInput } from '../CityInput';
import type { Department, Profession } from '../../types';

export type CreateKind = 'listing' | 'work' | 'project';

type CreateDialogProps = {
  projectSource?: { id: string; title: string; city: string; visibility: string };
  rentalSource?: { title: string; category: string; city: string; description: string; inventory_item_id?: string; equipment_package_id?: string };
  initialKind?: CreateKind;
  allowKindSwitch?: boolean;
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
  { key: 'model', audience: 'Модели', label: 'Модель', hint: 'Модельная работа / TFP' },
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

export function CreateDialog({ initialKind = 'listing', allowKindSwitch = true, onClose, onCreated, rentalSource, projectSource }: CreateDialogProps) {
  const { user, profile } = useAuth();
  const organization = useOrganization();
  // Freeze author identity when opening: later context changes cannot silently
  // publish a draft as a different organization. Database revalidates authority.
  const [publisher] = useState(organization.selected);
  const [kind, setKind] = useState<CreateKind>(initialKind);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Shared
  const [title, setTitle] = useState(rentalSource?.title || '');
  const [city, setCity] = useState(projectSource?.city || rentalSource?.city || profile?.city || '');
  const [description, setDescription] = useState(rentalSource?.description || '');
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  // Listing
  const [mode, setMode] = useState('Аренда');
  const [category, setCategory] = useState(rentalSource?.category || 'Камеры');
  const [price, setPrice] = useState('');

  // Work
  const [target, setTarget] = useState<WorkTarget>(projectSource ? 'model' : 'actor');
  const [roleType, setRoleType] = useState('Главная роль');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [professions, setProfessions] = useState<Profession[]>([]);
  const [deptId, setDeptId] = useState('');
  const [profId, setProfId] = useState('');
  const [projectName, setProjectName] = useState(projectSource?.title || '');
  const [shootDate, setShootDate] = useState('');
  const [ageRange, setAgeRange] = useState('');
  const [pay, setPay] = useState('');
  const [compensation, setCompensation] = useState('');
  const [expenses, setExpenses] = useState('');
  const [rights, setRights] = useState('');
  const [deliverables, setDeliverables] = useState('');
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
    (!publisher || organization.can(kind === 'listing' ? 'manage_marketplace' : kind === 'work' ? 'publish_jobs' : 'manage_projects', publisher.id)) &&
    (kind !== 'work' || target !== 'model' || (!!compensation && !!expenses.trim() && !!rights.trim() && !!deliverables.trim() && !!city.trim() && !!shootDate.trim())) &&
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
        target_kinds: [target === 'model' ? 'models' : target === 'crew' ? 'crew' : 'actors'],
        compensation_type: target === 'model' ? compensation : null,
        expenses_covered: target === 'model' ? expenses : null,
        usage_rights: target === 'model' ? rights : null,
        deliverables: target === 'model' ? deliverables : null,
        department_id: target === 'crew' && deptId ? deptId : null,
        profession_id: target === 'crew' && profId ? profId : null,
        project_name: projectName.trim() || null,
        project_id: projectSource?.id || null,
        visibility: projectSource?.visibility || 'public',
        city: city.trim() || null,
        shoot_date: shootDate.trim() || null,
        age_range: target === 'crew' || target === 'model' ? null : ageRange.trim() || null,
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

    payload.organization_id = publisher?.id || null;
    if (kind === 'listing' && rentalSource) {
      payload.inventory_item_id = rentalSource.inventory_item_id || null;
      payload.equipment_package_id = rentalSource.equipment_package_id || null;
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

    // The legacy Pulse is person-owned and publicly readable. Do not emit a
    // company/private-business title under the employee's personal identity.
    // Company events need their own visibility-aware publication path.
    if (publisher || projectSource) {
      setSaving(false);
      onCreated(kind, data.id as string);
      return;
    }
    if (kind === 'listing') {
      await addPulse({
        userId: user.id,
        kind: 'marketplace',
        person: personName,
        action: mode === 'Услуги' ? 'предлагает услугу' : `разместил${mode === 'Аренда' ? ' в аренду' : ' на продажу'}`,
        target: title.trim(),
        photoUrl: profile?.avatar_url ?? null,
      });
    } else if (kind === 'work') {
      await addPulse({
        userId: user.id,
        kind: target === 'crew' ? 'crew-search' : 'spots',
        person: personName,
        action: target === 'crew'
          ? `ищет в группу — ${chosenProfession?.name || 'специалиста'}`
          : target === 'extra' ? 'набирает массовку' : target === 'model' ? 'ищет модель' : 'ищет актёра',
        target: projectName.trim() || title.trim(),
        photoUrl: profile?.avatar_url ?? null,
      });
    } else {
      await addPulse({
        userId: user.id,
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
    <ModalShell title="Разместить" onClose={onClose} width="max-w-xl">

        <p className="text-xs text-txt-muted mb-5">Публикация видна всем — и тем, кто ещё не зарегистрирован.</p>

        {/* What to publish */}
        {allowKindSwitch && <div className="grid grid-cols-3 gap-2 mb-5">
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

        }
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
              ) : target === 'model' ? (
                <div className="space-y-3"><label className="block">Компенсация<select className="input-field" value={compensation} onChange={e=>setCompensation(e.target.value)}><option value="">Выберите явно</option>{Object.entries(compensationLabels).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label><label className="block">Покрытие расходов<input className="input-field" maxLength={1000} value={expenses} onChange={e=>setExpenses(e.target.value)} /></label><label className="block">Права использования<input className="input-field" maxLength={2000} value={rights} onChange={e=>setRights(e.target.value)} /></label><label className="block">Ожидаемый результат<input className="input-field" maxLength={2000} value={deliverables} onChange={e=>setDeliverables(e.target.value)} /></label><p className="text-xs text-txt-muted">TFP — сотрудничество без оплаты, не оплачиваемая работа. Укажите также даты и город.</p></div>
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

        <p className="text-sm mt-4">Публикуем от имени: <strong>{publisher ? `компании «${publisher.name}»` : personName}</strong>. Этот выбор закреплён за черновиком.</p>
        <button onClick={handleSubmit} disabled={!canSubmit} className="btn-primary w-full mt-5">
          {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Публикуем…</> : <><Check className="h-4 w-4" /> Опубликовать</>}
        </button>
    </ModalShell>
  );
}
