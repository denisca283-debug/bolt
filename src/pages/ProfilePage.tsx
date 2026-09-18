import { useState, useEffect, useCallback } from 'react';
import { useSearchIndexing } from '../hooks/useSearchIndexing';
import {
  MapPin, Calendar, Mail, Camera, Briefcase, Check, Loader2, Edit3, X,
  AlertCircle, Clapperboard, Sparkles,
} from 'lucide-react';
import { Card, Badge, ShareButton, Avatar } from '../components/ui';
import { Logo } from '../components/Logo';
import { useAuth } from '../hooks/useAuth';
import { useAuthModal } from '../components/AuthModal';
import { useRouter } from '../router';
import { supabase } from '../lib/supabase';
import { ActorFields, type ActorFieldsValue } from '../components/profile/ActorFields';
import { SkillsPicker } from '../components/profile/SkillsPicker';
import { AdditionalSkills } from '../components/profile/AdditionalSkills';
import { ProfessionalGraph } from '../components/ProfessionalGraph';
import { StudentEducation } from '../components/StudentEducation';
import { ProfileContacts } from '../components/profile/ProfileContacts';
import { ProfileMedia } from '../components/profile/ProfileMedia';
import { MessageButton } from '../components/MessageButton';
import type { Actor, Department, Profession, Profile, Skill } from '../types';

type PrimaryProfession = {
  user_profession_id: string;
  profession_id: string;
  profession_name: string;
  department_id: string;
  department_name: string;
  experience_years: number | null;
};

type UserProfessionRow = {
  id: string;
  profession_id: string;
  is_primary: boolean;
  experience_years: number | null;
  profession: {
    id: string;
    name: string;
    department_id: string;
    department: { id: string; name: string } | null;
  } | null;
};

function extractPrimaryProfession(rows: UserProfessionRow[]): PrimaryProfession | null {
  const primary = rows.find((r) => r.is_primary && r.profession);
  if (!primary?.profession) return null;
  return {
    user_profession_id: primary.id,
    profession_id: primary.profession.id,
    profession_name: primary.profession.name,
    department_id: primary.profession.department_id,
    department_name: primary.profession.department?.name || '',
    experience_years: primary.experience_years,
  };
}

// Module-level so `handleSave` can use it without depending on a const
// declared further down the component body.
const AVAILABILITY_LABELS: Record<string, string> = {
  available: 'Свободен',
  busy: 'Занят',
  limited: 'Ограниченно',
};

const EMPTY_ACTOR_FIELDS: ActorFieldsValue = {
  category: '',
  gender: '',
  age: '',
  height: '',
  hairColor: '',
  eyeColor: '',
  experienceYears: '',
  gallery: [],
};

function actorRowToFields(row: Actor | null): ActorFieldsValue {
  if (!row) return EMPTY_ACTOR_FIELDS;
  return {
    category: row.category || '',
    gender: row.gender || '',
    age: row.age == null ? '' : String(row.age),
    height: row.height == null ? '' : String(row.height),
    hairColor: row.hair_color || '',
    eyeColor: row.eye_color || '',
    experienceYears: row.experience_years == null ? '' : String(row.experience_years),
    gallery: row.gallery || [],
  };
}

// Empty string means "not filled in", which must land in the database as
// NULL rather than 0 — otherwise every blank field reads as a real zero.
function toIntOrNull(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const n = Number.parseInt(t, 10);
  return Number.isFinite(n) ? n : null;
}

const USER_PROFESSIONS_SELECT = `
  id,
  profession_id,
  is_primary,
  experience_years,
  profession:professions(
    id,
    name,
    department_id,
    department:departments(id, name)
  )
`;

// Suggested cities for the profile form. Offered as suggestions rather than a
// closed dropdown on purpose: shoots happen in small towns too, so anything
// typed by hand must still be accepted.
const CITY_SUGGESTIONS = [
  'Москва', 'Санкт-Петербург', 'Новосибирск', 'Екатеринбург', 'Казань',
  'Нижний Новгород', 'Челябинск', 'Самара', 'Омск', 'Ростов-на-Дону',
  'Уфа', 'Красноярск', 'Воронеж', 'Пермь', 'Волгоград', 'Краснодар',
  'Саратов', 'Тюмень', 'Ижевск', 'Ярославль', 'Иркутск', 'Хабаровск',
  'Владивосток', 'Калининград', 'Сочи', 'Тула', 'Ставрополь', 'Ульяновск',
  'Минск', 'Алматы', 'Астана', 'Ташкент', 'Тбилиси', 'Ереван', 'Баку',
];

// `slug` is set when viewing a public profile at /u/:slug. When absent, this
// renders the current user's own profile (route: /profile), with editing.
export function ProfilePage({ slug }: { slug?: string } = {}) {
  const isOwnProfile = !slug;
  const { user, profile: ownProfile, refreshProfile } = useAuth();
  const { navigate } = useRouter();
  const { promptGuest } = useAuthModal();

  const [targetProfile, setTargetProfile] = useState<Profile | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [primaryProf, setPrimaryProf] = useState<PrimaryProfession | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [allProfessions, setAllProfessions] = useState<Profession[]>([]);
  const [loading, setLoading] = useState(true);

  // Actor extension + skills (both roles)
  const [actorRow, setActorRow] = useState<Actor | null>(null);
  const [allSkills, setAllSkills] = useState<Skill[]>([]);
  const [skillIds, setSkillIds] = useState<string[]>([]);

  // Edit form state (owner only)
  const [editName, setEditName] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editAbout, setEditAbout] = useState('');
  const [editAvailability, setEditAvailability] = useState<'available' | 'busy' | 'limited'>('available');
  const [editAvatarUrl, setEditAvatarUrl] = useState<string | null>(null);
  const [editDeptId, setEditDeptId] = useState<string>('');
  const [editProfId, setEditProfId] = useState<string>('');
  // Which roles this person claims. Both may be true — a camera operator who
  // also acts is one account, not two.
  const [editIsActor, setEditIsActor] = useState(false);
  const [editIsSpecialist, setEditIsSpecialist] = useState(false);
  const [editActor, setEditActor] = useState<ActorFieldsValue>(EMPTY_ACTOR_FIELDS);
  const [editSkillIds, setEditSkillIds] = useState<string[]>([]);
  const [editProfExp, setEditProfExp] = useState('');
  const [galleryUploading, setGalleryUploading] = useState(false);

  const displayProfile = isOwnProfile ? ownProfile : targetProfile;
  useSearchIndexing(!isOwnProfile && !!targetProfile?.search_engine_indexable);

  // Key the loader on the user ID (a string), never on the `user` object.
  // Supabase hands out a new user object on every auth event (tab focus,
  // token refresh); keying on the object made this effect re-run — and the
  // page re-load — on each one.
  const userId = user?.id;

  const loadData = useCallback(async () => {
    setLoading(true);
    setSaveMsg(null);

    if (!slug) {
      // Own profile — driven by the logged-in user's id.
      if (!userId) {
        setLoading(false);
        return;
      }
      setNotFound(false);

      const [deptRes, profRes, userProfRes, skillsRes, userSkillsRes, actorRes] = await Promise.all([
        supabase.from('departments').select('*').order('sort_order'),
        supabase.from('professions').select('*').order('sort_order'),
        supabase.from('user_professions').select(USER_PROFESSIONS_SELECT).eq('user_id', userId),
        supabase.from('skills').select('*').order('name'),
        supabase.from('user_skills').select('skill_id').eq('user_id', userId),
        // No unique constraint on actors.user_id, so take the earliest row
        // rather than maybeSingle(), which would error on an accidental duplicate.
        supabase.from('actors').select('*').eq('user_id', userId).order('created_at').limit(1),
      ]);

      if (deptRes.data) setDepartments(deptRes.data as Department[]);
      if (profRes.data) setAllProfessions(profRes.data as Profession[]);
      if (skillsRes.data) setAllSkills(skillsRes.data as Skill[]);
      setPrimaryProf(
        userProfRes.data ? extractPrimaryProfession(userProfRes.data as unknown as UserProfessionRow[]) : null
      );
      setSkillIds(((userSkillsRes.data || []) as { skill_id: string }[]).map((r) => r.skill_id));
      setActorRow(((actorRes.data || [])[0] as Actor | undefined) || null);

      setLoading(false);
      return;
    }

    // Public profile lookup by slug — must work for guests too.
    const { data: profileRow, error: profileErr } = await supabase.rpc('person_public', { p_slug: slug });

    if (profileErr || !profileRow) {
      setNotFound(true);
      setTargetProfile(null);
      setPrimaryProf(null);
      setLoading(false);
      return;
    }

    setNotFound(false);
    setTargetProfile(profileRow as Profile);

    const [userProfRes, skillsRes, userSkillsRes, actorRes] = await Promise.all([
      supabase.from('user_professions').select(USER_PROFESSIONS_SELECT).eq('user_id', profileRow.id),
      supabase.from('skills').select('*').order('name'),
      supabase.from('user_skills').select('skill_id').eq('user_id', profileRow.id),
      supabase.from('actors').select('*').eq('user_id', profileRow.id).order('created_at').limit(1),
    ]);

    setPrimaryProf(
      userProfRes.data ? extractPrimaryProfession(userProfRes.data as unknown as UserProfessionRow[]) : null
    );
    if (skillsRes.data) setAllSkills(skillsRes.data as Skill[]);
    setSkillIds(((userSkillsRes.data || []) as { skill_id: string }[]).map((r) => r.skill_id));
    setActorRow(((actorRes.data || [])[0] as Actor | undefined) || null);

    setLoading(false);
  }, [slug, userId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Seed the edit form from the stored profile — but NEVER while the form is
  // open. A background profile refresh used to fire this and overwrite the
  // city/name the person was in the middle of typing, which looked exactly
  // like "it didn't save what I entered".
  useEffect(() => {
    if (!isOwnProfile || !ownProfile) return;
    if (editing) return;
    setEditName(ownProfile.full_name || '');
    setEditCity(ownProfile.city || '');
    setEditAbout(ownProfile.about || '');
    setEditAvailability(ownProfile.availability_status || 'available');
    setEditAvatarUrl(ownProfile.avatar_url || null);
  }, [isOwnProfile, ownProfile, editing]);

  // Same rule for the profession selects: don't reset them under the person's
  // hands while they are choosing.
  useEffect(() => {
    if (!isOwnProfile) return;
    if (editing) return;
    if (primaryProf) {
      setEditDeptId(primaryProf.department_id);
      setEditProfId(primaryProf.profession_id);
      setEditProfExp(primaryProf.experience_years == null ? '' : String(primaryProf.experience_years));
      setEditIsSpecialist(true);
    } else {
      setEditDeptId('');
      setEditProfId('');
      setEditProfExp('');
      setEditIsSpecialist(false);
    }
  }, [isOwnProfile, primaryProf, editing]);

  // Seed the actor half of the form. Same rule as above: never while the
  // form is open, or a background refresh wipes what is being typed.
  useEffect(() => {
    if (!isOwnProfile) return;
    if (editing) return;
    setEditIsActor(!!actorRow);
    setEditActor(actorRowToFields(actorRow));
  }, [isOwnProfile, actorRow, editing]);

  useEffect(() => {
    if (!isOwnProfile) return;
    if (editing) return;
    setEditSkillIds(skillIds);
  }, [isOwnProfile, skillIds, editing]);

  const filteredProfessions = editDeptId
    ? allProfessions.filter((p) => p.department_id === editDeptId)
    : [];

  const handleAvatarUpload = async (file: File) => {
    if (!user) {
      // Keep the form open with whatever the person already typed — don't
      // discard it — and tell them plainly why the photo can't upload yet.
      setSaveMsg({ type: 'error', text: 'Сессия истекла. Обновите страницу и войдите снова — тогда фото загрузится.' });
      return;
    }
    setSaving(true);
    setSaveMsg(null);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${user.id}/avatar.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true });
      if (uploadError) {
        setSaveMsg({ type: 'error', text: 'Не удалось загрузить фото. Попробуйте ещё раз.' });
        setSaving(false);
        return;
      }
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
      setEditAvatarUrl(urlData.publicUrl);
    } catch {
      setSaveMsg({ type: 'error', text: 'Не удалось загрузить фото. Попробуйте ещё раз.' });
    }
    setSaving(false);
  };

  // Gallery photos live in the same `avatars` bucket: its policy only requires
  // the first path segment to be the user's id, so no new bucket is needed.
  const handleGalleryUpload = async (file: File) => {
    if (!user) {
      setSaveMsg({ type: 'error', text: 'Сессия истекла. Обновите страницу и войдите снова.' });
      return;
    }
    setGalleryUploading(true);
    setSaveMsg(null);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${user.id}/gallery-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true });
      if (uploadError) {
        setSaveMsg({ type: 'error', text: 'Не удалось загрузить фото. Попробуйте ещё раз.' });
        setGalleryUploading(false);
        return;
      }
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
      setEditActor((prev) => ({ ...prev, gallery: [...prev.gallery, urlData.publicUrl] }));
    } catch {
      setSaveMsg({ type: 'error', text: 'Не удалось загрузить фото. Попробуйте ещё раз.' });
    }
    setGalleryUploading(false);
  };

  const handleSave = async () => {
    if (!user) {
      // Keep the form open with the person's edits intact — don't discard
      // what they typed — and tell them plainly why nothing was saved.
      setSaveMsg({ type: 'error', text: 'Сессия истекла. Обновите страницу и войдите снова — тогда сохраним.' });
      return;
    }
    setSaving(true);
    setSaveMsg(null);

    try {
      // 1. Save profile fields. `.select()` forces Supabase to report back
      // which row(s) were actually touched — without it, an UPDATE that
      // matches zero rows (e.g. no profile row yet for this account) still
      // returns error: null, and the UI would wrongly claim success while
      // silently saving nothing (this was the root cause of "Сохранить"
      // appearing to work but the city/photo never actually sticking).
      const { data: updatedRows, error: profError } = await supabase
        .from('profiles')
        .update({
          full_name: editName,
          city: editCity,
          about: editAbout,
          availability_status: editAvailability,
          avatar_url: editAvatarUrl,
        })
        .eq('id', user.id)
        .select('id');
      if (profError) {
        setSaveMsg({ type: 'error', text: 'Не удалось сохранить профиль. Попробуйте ещё раз.' });
        setSaving(false);
        return;
      }

      if (!updatedRows || updatedRows.length === 0) {
        // No profile row existed for this account yet — create it instead
        // of pretending the (no-op) update succeeded.
        const { error: insertErr } = await supabase.from('profiles').insert({
          id: user.id,
          full_name: editName,
          city: editCity,
          about: editAbout,
          availability_status: editAvailability,
          avatar_url: editAvatarUrl,
        });
        if (insertErr) {
          setSaveMsg({ type: 'error', text: 'Профиль не найден в базе данных. Попробуйте выйти и войти заново.' });
          setSaving(false);
          return;
        }
      }

      // 2. Primary profession + years of experience (industry specialists)
      if (editIsSpecialist && editProfId) {
        const existing = primaryProf;
        const professionChanged = existing?.profession_id !== editProfId;

        if (professionChanged) {
          // Demote any existing primary
          if (existing) {
            await supabase
              .from('user_professions')
              .update({ is_primary: false })
              .eq('id', existing.user_profession_id);
          }

          // Check if the user already has this profession (maybe non-primary)
          const { data: existingRow } = await supabase
            .from('user_professions')
            .select('id')
            .eq('user_id', user.id)
            .eq('profession_id', editProfId)
            .maybeSingle();

          if (existingRow) {
            // Promote existing row to primary
            await supabase
              .from('user_professions')
              .update({ is_primary: true, experience_years: toIntOrNull(editProfExp) })
              .eq('id', existingRow.id);
          } else {
            // Insert new primary profession
            const { error: insertError } = await supabase
              .from('user_professions')
              .insert({
                user_id: user.id,
                profession_id: editProfId,
                is_primary: true,
                experience_years: toIntOrNull(editProfExp),
              });
            if (insertError) {
              setSaveMsg({ type: 'error', text: 'Не удалось сохранить профессию. Попробуйте ещё раз.' });
              setSaving(false);
              return;
            }
          }
        } else if (existing) {
          // Same profession — only the years of experience can have changed.
          await supabase
            .from('user_professions')
            .update({ experience_years: toIntOrNull(editProfExp) })
            .eq('id', existing.user_profession_id);
        }
      }

      // 3. Skills — shared by both roles. `user_skills` has insert and delete
      // policies but no update, so changes are applied as a diff.
      const skillsToAdd = editSkillIds.filter((id) => !skillIds.includes(id));
      const skillsToRemove = skillIds.filter((id) => !editSkillIds.includes(id));

      if (skillsToRemove.length > 0) {
        await supabase
          .from('user_skills')
          .delete()
          .eq('user_id', user.id)
          .in('skill_id', skillsToRemove);
      }
      if (skillsToAdd.length > 0) {
        const { error: skillErr } = await supabase
          .from('user_skills')
          .insert(skillsToAdd.map((skill_id) => ({ user_id: user.id, skill_id })));
        if (skillErr) {
          setSaveMsg({ type: 'error', text: 'Не удалось сохранить навыки. Попробуйте ещё раз.' });
          setSaving(false);
          return;
        }
      }

      // 4. Actor extension row. Shared identity fields are mirrored here so the
      // actor listing can read this table alone, but they stay editable only
      // on the profile above — one source of truth.
      if (editIsActor) {
        const actorPayload = {
          user_id: user.id,
          full_name: editName.trim() || 'Без имени',
          city: editCity.trim() || null,
          bio: editAbout.trim() || null,
          photo_url: editAvatarUrl,
          availability: AVAILABILITY_LABELS[editAvailability] || 'Свободен',
          category: editActor.category || null,
          gender: editActor.gender || null,
          age: toIntOrNull(editActor.age),
          height: toIntOrNull(editActor.height),
          hair_color: editActor.hairColor.trim() || null,
          eye_color: editActor.eyeColor.trim() || null,
          experience_years: toIntOrNull(editActor.experienceYears),
          gallery: editActor.gallery,
        };

        if (actorRow) {
          const { data: updatedActor, error: actorErr } = await supabase
            .from('actors')
            .update(actorPayload)
            .eq('id', actorRow.id)
            .select('id');
          if (actorErr || !updatedActor || updatedActor.length === 0) {
            setSaveMsg({ type: 'error', text: 'Не удалось сохранить анкету актёра. Попробуйте ещё раз.' });
            setSaving(false);
            return;
          }
        } else {
          const { error: actorErr } = await supabase.from('actors').insert(actorPayload);
          if (actorErr) {
            setSaveMsg({ type: 'error', text: 'Не удалось создать анкету актёра. Попробуйте ещё раз.' });
            setSaving(false);
            return;
          }
        }
      } else if (actorRow) {
        // Unchecked "Я актёр" — remove the actor card entirely.
        await supabase.from('actors').delete().eq('id', actorRow.id);
      }

      await refreshProfile();
      await loadData();
      setSaveMsg({ type: 'success', text: 'Профиль сохранён' });
      setEditing(false);
    } catch {
      setSaveMsg({ type: 'error', text: 'Не удалось сохранить профиль. Попробуйте ещё раз.' });
    }
    setSaving(false);
  };

  // Only block the page while there is genuinely nothing to show yet.
  // A background refresh must never blank out a profile that is already on
  // screen — and must never rip away an open edit form mid-typing.
  if (loading && !displayProfile && !editing) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 text-emerald-500 animate-spin" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="text-center py-20">
        <p className="text-txt-secondary text-lg">Профиль не найден</p>
        <button onClick={() => navigate('/')} className="mt-4 btn-secondary">
          На главную
        </button>
      </div>
    );
  }

  const displayName = displayProfile?.full_name || (isOwnProfile ? user?.email : null) || 'Пользователь FilmVerse';
  const initials = displayName.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const availabilityLabels = AVAILABILITY_LABELS;
  const availabilityColors: Record<string, string> = {
    available: 'bg-emerald-200/30 text-emerald-600',
    busy: 'bg-danger-200/30 text-danger-700',
    limited: 'bg-warn-200/30 text-warn-700',
  };

  const selectedSkillNames = allSkills
    .filter((s) => s.is_active !== false && skillIds.includes(s.id))
    .map((s) => s.name);

  // Missing profile basics (owner-only). What counts as missing depends on the
  // role: an actor is not nagged for a department, a gaffer not for a headshot.
  const missing: string[] = [];
  if (!displayProfile?.avatar_url) missing.push('фото');
  if (!displayProfile?.city) missing.push('город');
  if (!actorRow && !primaryProf) missing.push('кто вы — актёр или специалист');
  if (actorRow && (actorRow.gallery || []).length === 0) missing.push('фотографии для кастинга');
  if (!displayProfile?.about) missing.push('о себе');
  const profileIncomplete = missing.length > 0;

  if (isOwnProfile && editing) {
    return (
      <div className="animate-fade-in max-w-2xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-display text-2xl font-semibold text-txt-primary">Редактирование профиля</h1>
          <button onClick={() => setEditing(false)} className="btn-ghost">
            <X className="h-4 w-4" /> Отмена
          </button>
        </div>

        {saveMsg && (
          <div className={`mb-4 p-3 rounded-lg flex items-start gap-2 ${
            saveMsg.type === 'success'
              ? 'bg-emerald-200/30 border border-emerald-400/30'
              : 'bg-danger-200/30 border border-danger-600/30'
          }`}>
            <AlertCircle className={`h-4 w-4 shrink-0 mt-0.5 ${
              saveMsg.type === 'success' ? 'text-emerald-600' : 'text-danger-700'
            }`} />
            <p className={`text-sm ${saveMsg.type === 'success' ? 'text-emerald-600' : 'text-danger-700'}`}>
              {saveMsg.text}
            </p>
          </div>
        )}

        <Card className="p-6 space-y-5">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full overflow-hidden bg-surface-500 border border-line">
              {editAvatarUrl ? (
                <img src={editAvatarUrl} alt="" className="portrait-img" />
              ) : (
                <Avatar initials={initials} size="lg" />
              )}
            </div>
            <label className="btn-secondary cursor-pointer">
              <Camera className="h-4 w-4" />
              <span>Загрузить фото</span>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleAvatarUpload(f);
              }} />
            </label>
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-txt-secondary mb-1.5">Имя</label>
            <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="input-field" />
          </div>

          {/* City */}
          <div>
            <label className="block text-xs font-medium text-txt-secondary mb-1.5">Город</label>
            <input
              type="text"
              value={editCity}
              onChange={(e) => setEditCity(e.target.value)}
              className="input-field"
              list="filmverse-city-suggestions"
              placeholder="Начните вводить — появятся подсказки"
              autoComplete="off"
            />
            <datalist id="filmverse-city-suggestions">
              {CITY_SUGGESTIONS.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            <p className="mt-1.5 text-xs text-txt-muted">
              Города нет в списке? Впишите свой — он сохранится.
            </p>
          </div>

          {/* Which roles this person claims */}
          <div>
            <label className="block text-xs font-medium text-txt-secondary mb-1.5">Кто вы в индустрии</label>
            <p className="text-xs text-txt-muted mb-3">
              Можно отметить оба — если вы и снимаетесь, и работаете в команде.
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setEditIsActor((v) => !v)}
                className={`text-left p-4 rounded-lg border transition-all duration-200 ${
                  editIsActor
                    ? 'bg-emerald-200/25 border-emerald-400'
                    : 'bg-surface-600 border-line-soft hover:border-line'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Clapperboard className={`h-4 w-4 ${editIsActor ? 'text-emerald-600' : 'text-txt-muted'}`} />
                  <span className={`text-sm font-medium ${editIsActor ? 'text-emerald-600' : 'text-txt-primary'}`}>
                    Я актёр
                  </span>
                  {editIsActor && <Check className="h-3.5 w-3.5 text-emerald-600 ml-auto" />}
                </div>
                <p className="text-xs text-txt-muted">Рост, возраст, внешность, фотографии</p>
              </button>

              <button
                type="button"
                onClick={() => setEditIsSpecialist((v) => !v)}
                className={`text-left p-4 rounded-lg border transition-all duration-200 ${
                  editIsSpecialist
                    ? 'bg-emerald-200/25 border-emerald-400'
                    : 'bg-surface-600 border-line-soft hover:border-line'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Briefcase className={`h-4 w-4 ${editIsSpecialist ? 'text-emerald-600' : 'text-txt-muted'}`} />
                  <span className={`text-sm font-medium ${editIsSpecialist ? 'text-emerald-600' : 'text-txt-primary'}`}>
                    Я специалист индустрии
                  </span>
                  {editIsSpecialist && <Check className="h-3.5 w-3.5 text-emerald-600 ml-auto" />}
                </div>
                <p className="text-xs text-txt-muted">Департамент, профессия, опыт</p>
              </button>
            </div>

            {actorRow && !editIsActor && (
              <div className="mt-3 p-3 rounded-lg bg-warn-200/25 border border-warn-600/30 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-warn-700 shrink-0 mt-0.5" />
                <p className="text-xs text-warn-700 leading-relaxed">
                  При сохранении анкета актёра будет удалена: рост, возраст, внешность и фотографии
                  пропадут. Их можно будет заполнить заново.
                </p>
              </div>
            )}
          </div>

          {/* Specialist block */}
          {editIsSpecialist && (
            <div className="space-y-4 p-4 rounded-lg bg-surface-700/60 border border-line-soft">
              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-emerald-500" />
                <h3 className="text-sm font-semibold text-txt-primary">Специалист индустрии</h3>
              </div>
              <div>
                <label className="block text-xs font-medium text-txt-secondary mb-1.5">Департамент</label>
                <select
                  value={editDeptId}
                  onChange={(e) => { setEditDeptId(e.target.value); setEditProfId(''); }}
                  className="input-field"
                >
                  <option value="">Выберите департамент</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-txt-secondary mb-1.5">Основная профессия</label>
                <select
                  value={editProfId}
                  onChange={(e) => setEditProfId(e.target.value)}
                  className="input-field"
                  disabled={!editDeptId}
                >
                  <option value="">Выберите профессию</option>
                  {filteredProfessions.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-txt-secondary mb-1.5">
                  Опыт в профессии, лет
                </label>
                <input
                  type="number"
                  min={0}
                  max={80}
                  inputMode="numeric"
                  value={editProfExp}
                  onChange={(e) => setEditProfExp(e.target.value)}
                  placeholder="например, 7"
                  className="input-field"
                />
              </div>
            </div>
          )}

          {/* Actor block */}
          {editIsActor && (
            <div className="space-y-5 p-4 rounded-lg bg-surface-700/60 border border-line-soft">
              <div className="flex items-center gap-2">
                <Clapperboard className="h-4 w-4 text-emerald-500" />
                <h3 className="text-sm font-semibold text-txt-primary">Анкета актёра</h3>
              </div>
              <ActorFields
                value={editActor}
                onChange={(patch) => setEditActor((prev) => ({ ...prev, ...patch }))}
                onUploadPhoto={handleGalleryUpload}
                uploading={galleryUploading}
              />
            </div>
          )}

          {/* Skills — relevant to both roles */}
          {(editIsActor || editIsSpecialist) && allSkills.length > 0 && (
            <SkillsPicker
              skills={allSkills}
              actor={editIsActor}
              departmentId={editDeptId}
              selectedIds={editSkillIds}
              onChange={setEditSkillIds}
            />
          )}

          {/* Availability */}
          <div>
            <label className="block text-xs font-medium text-txt-secondary mb-1.5">Доступность</label>
            <div className="flex gap-2">
              {(['available', 'busy', 'limited'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setEditAvailability(s)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                    editAvailability === s
                      ? 'bg-emerald-200/30 text-emerald-600 border-emerald-400'
                      : 'bg-surface-600 text-txt-secondary border-line-soft hover:border-line'
                  }`}
                >
                  {availabilityLabels[s]}
                </button>
              ))}
            </div>
          </div>

          {/* About */}
          <div>
            <label className="block text-xs font-medium text-txt-secondary mb-1.5">О себе</label>
            <textarea value={editAbout} onChange={(e) => setEditAbout(e.target.value)} rows={4} className="input-field resize-none" />
          </div>

          <button onClick={handleSave} disabled={saving} className="btn-primary w-full">
            {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Сохранение…</> : <><Check className="h-4 w-4" /> Сохранить</>}
          </button>
        </Card>
      </div>
    );
  }

  return (
    <div className="animate-fade-in max-w-4xl">
      {/* Save message (non-editing view) */}
      {saveMsg && saveMsg.type === 'success' && (
        <div className="mb-4 p-3 rounded-lg flex items-start gap-2 bg-emerald-200/30 border border-emerald-400/30 animate-fade-in">
          <Check className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" />
          <p className="text-sm text-emerald-600">{saveMsg.text}</p>
        </div>
      )}

      {/* Header card */}
      <Card raised className="overflow-hidden">
        <div className="relative h-40 bg-base-950 overflow-hidden">
          <div className="absolute inset-0 opacity-10" style={{
            backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(13,143,112,0.3) 0%, transparent 70%)',
          }} />
        </div>
        <div className="px-6 pb-6">
          <div className="flex items-end justify-between -mt-12">
            {displayProfile?.avatar_url ? (
              <img src={displayProfile.avatar_url} alt="" className="h-20 w-20 rounded-full object-cover ring-4 ring-surface-600" />
            ) : (
              <Avatar initials={initials} size="lg" className="ring-4 ring-surface-600 !h-20 !w-20 !text-2xl" />
            )}
            <div className="flex gap-2 mb-2">
              {isOwnProfile && (
                <button
                  onClick={() => {
                    if (!user) {
                      promptGuest({ message: 'Войдите снова, чтобы редактировать профиль.' });
                      return;
                    }
                    setEditing(true);
                  }}
                  className="btn-secondary"
                >
                  <Edit3 className="h-4 w-4" /> Редактировать
                </button>
              )}
              {/* Someone else's profile: writing to them starts here, not on
                  a dead link to the messages list. */}
              {!isOwnProfile && (
                <MessageButton
                  targetUserId={displayProfile?.id}
                  targetName={displayProfile?.full_name}
                  variant="primary"
                />
              )}
              <ShareButton />
            </div>
          </div>
          <div className="flex items-center gap-3 mt-4">
            <h1 className="font-display text-2xl font-semibold text-txt-primary">{displayName}</h1>
            {/* No fake verification badge — only real approved verification records qualify */}
          </div>
          {primaryProf && (
            <p className="mt-1 text-sm text-emerald-600 font-medium">{primaryProf.profession_name}</p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-txt-secondary">
            <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{displayProfile?.city || 'Город не указан'}</span>
            <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />На FilmVerse с {new Date(displayProfile?.created_at || Date.now()).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}</span>
            {isOwnProfile && user?.email && <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />{user.email}</span>}
          </div>
          <div className="mt-3">
            <span className={`chip ${availabilityColors[displayProfile?.availability_status || 'available']}`}>
              {availabilityLabels[displayProfile?.availability_status || 'available']}
            </span>
          </div>
        </div>
      </Card>

      {/* Incomplete profile prompt (owner-only) */}
      {isOwnProfile && profileIncomplete && (
        <Card className="p-5 mt-6 border-emerald-400/30">
          <h2 className="text-sm font-semibold text-txt-primary mb-2">Заполните профиль</h2>
          <p className="text-sm text-txt-secondary mb-3">
            Не хватает: {missing.join(', ')}
          </p>
          <button
            onClick={() => {
              if (!user) {
                promptGuest({ message: 'Войдите снова, чтобы дополнить профиль.' });
                return;
              }
              setEditing(true);
            }}
            className="btn-primary"
          >
            <Edit3 className="h-4 w-4" /> Дополнить профиль
          </button>
        </Card>
      )}

      {/* Actor card — only for people who marked themselves as actors */}
      {actorRow && (
        <Card className="p-6 mt-6">
          <div className="flex items-center gap-2 mb-4">
            <Clapperboard className="h-4 w-4 text-emerald-500" />
            <h2 className="text-sm font-semibold text-txt-primary">Анкета актёра</h2>
            {actorRow.category && <Badge variant="fern">{actorRow.category}</Badge>}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
            {[
              ['Возраст', actorRow.age == null ? null : `${actorRow.age}`],
              ['Рост', actorRow.height == null ? null : `${actorRow.height} см`],
              ['Волосы', actorRow.hair_color],
              ['Глаза', actorRow.eye_color],
              ['Опыт съёмок', actorRow.experience_years == null ? null : `${actorRow.experience_years} л.`],
            ]
              .filter(([, v]) => !!v)
              .map(([label, value]) => (
                <div key={label as string}>
                  <p className="text-[11px] uppercase tracking-wider text-txt-muted">{label}</p>
                  <p className="text-sm text-txt-primary mt-0.5">{value}</p>
                </div>
              ))}
          </div>

          {(actorRow.gallery || []).length > 0 && (
            <div className="mt-5 grid grid-cols-3 sm:grid-cols-4 gap-3">
              {actorRow.gallery.map((url) => (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="aspect-[3/4] rounded-lg overflow-hidden border border-line-soft block"
                >
                  <img src={url} alt="" className="h-full w-full object-cover" />
                </a>
              ))}
            </div>
          )}

          {actorRow.age == null && actorRow.height == null && (actorRow.gallery || []).length === 0 && (
            <p className="text-sm text-txt-muted">
              {isOwnProfile ? 'Заполните данные — по ним вас находят на кастинг.' : 'Данные не указаны'}
            </p>
          )}
        </Card>
      )}

      {/* Primary profession — shown for specialists, and as a prompt on an
          otherwise empty own profile */}
      {(primaryProf || (isOwnProfile && !actorRow)) && (
        <Card className="p-6 mt-6">
          <div className="flex items-center gap-2 mb-4">
            <Briefcase className="h-4 w-4 text-emerald-500" />
            <h2 className="text-sm font-semibold text-txt-primary">Основная профессия</h2>
          </div>
          {primaryProf ? (
            <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-200/20 border border-emerald-300/20">
              <div>
                <p className="text-sm font-medium text-txt-primary">{primaryProf.profession_name}</p>
                <p className="text-xs text-txt-muted mt-0.5">
                  {primaryProf.department_name}
                  {primaryProf.experience_years != null && ` · опыт ${primaryProf.experience_years} л.`}
                </p>
              </div>
              <Badge variant="fern">Основная</Badge>
            </div>
          ) : (
            <p className="text-sm text-txt-muted">
              {isOwnProfile ? 'Добавьте основную профессию' : 'Профессия не указана'}
            </p>
          )}
        </Card>
      )}

      {/* Skills */}
      {displayProfile?.id && <AdditionalSkills userId={displayProfile.id} editable={isOwnProfile} />}
      {displayProfile?.id && <><ProfessionalGraph userId={displayProfile.id} /><StudentEducation userId={displayProfile.id} /></>}
      {displayProfile?.id && <ProfileContacts userId={displayProfile.id} />}
      {displayProfile?.id && <ProfileMedia userId={displayProfile.id} />}
      {selectedSkillNames.length > 0 && (
        <Card className="p-6 mt-6">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-4 w-4 text-emerald-500" />
            <h2 className="text-sm font-semibold text-txt-primary">Навыки</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedSkillNames.map((name) => (
              <span key={name} className="chip bg-surface-600 text-txt-secondary">{name}</span>
            ))}
          </div>
        </Card>
      )}

      {/* About */}
      {displayProfile?.about && (
        <Card className="p-6 mt-6">
          <h2 className="text-sm font-semibold text-txt-primary mb-3">О себе</h2>
          <p className="text-sm text-txt-secondary leading-relaxed">{displayProfile.about}</p>
        </Card>
      )}

      {/* Watermark */}
      <div className="mt-6 flex items-center justify-center gap-2 text-txt-muted opacity-30">
        <Logo size={16} variant="dark" showText={false} />
        <span className="text-xs">FilmVerse</span>
      </div>
    </div>
  );
}
