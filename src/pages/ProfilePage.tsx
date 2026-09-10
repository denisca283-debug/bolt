import { useState, useEffect, useCallback } from 'react';
import {
  MapPin, Calendar, Mail, Camera, Briefcase, Check, Loader2, Edit3, X,
  AlertCircle,
} from 'lucide-react';
import { Card, Badge, ShareButton, Avatar } from '../components/ui';
import { Logo } from '../components/Logo';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import type { Department, Profession } from '../types';

type PrimaryProfession = {
  user_profession_id: string;
  profession_id: string;
  profession_name: string;
  department_id: string;
  department_name: string;
};

export function ProfilePage() {
  const { user, profile, refreshProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [primaryProf, setPrimaryProf] = useState<PrimaryProfession | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [allProfessions, setAllProfessions] = useState<Profession[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editAbout, setEditAbout] = useState('');
  const [editAvailability, setEditAvailability] = useState<'available' | 'busy' | 'limited'>('available');
  const [editAvatarUrl, setEditAvatarUrl] = useState<string | null>(null);
  const [editDeptId, setEditDeptId] = useState<string>('');
  const [editProfId, setEditProfId] = useState<string>('');

  const loadData = useCallback(async () => {
    if (!user) return;
    const [deptRes, profRes, userProfRes] = await Promise.all([
      supabase.from('departments').select('*').order('sort_order'),
      supabase.from('professions').select('*').order('sort_order'),
      supabase
        .from('user_professions')
        .select(`
          id,
          profession_id,
          is_primary,
          profession:professions(
            id,
            name,
            department_id,
            department:departments(id, name)
          )
        `)
        .eq('user_id', user.id),
    ]);

    if (deptRes.data) setDepartments(deptRes.data as Department[]);
    if (profRes.data) setAllProfessions(profRes.data as Profession[]);

    if (userProfRes.data) {
      const rows = userProfRes.data as unknown as Array<{
        id: string;
        profession_id: string;
        is_primary: boolean;
        profession: {
          id: string;
          name: string;
          department_id: string;
          department: { id: string; name: string } | null;
        } | null;
      }>;
      const primary = rows.find((r) => r.is_primary && r.profession);
      if (primary?.profession) {
        setPrimaryProf({
          user_profession_id: primary.id,
          profession_id: primary.profession.id,
          profession_name: primary.profession.name,
          department_id: primary.profession.department_id,
          department_name: primary.profession.department?.name || '',
        });
      }
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (profile) {
      setEditName(profile.full_name || '');
      setEditCity(profile.city || '');
      setEditAbout(profile.about || '');
      setEditAvailability(profile.availability_status || 'available');
      setEditAvatarUrl(profile.avatar_url || null);
    }
  }, [profile]);

  // Sync edit form with loaded primary profession
  useEffect(() => {
    if (primaryProf) {
      setEditDeptId(primaryProf.department_id);
      setEditProfId(primaryProf.profession_id);
    } else {
      setEditDeptId('');
      setEditProfId('');
    }
  }, [primaryProf]);

  const filteredProfessions = editDeptId
    ? allProfessions.filter((p) => p.department_id === editDeptId)
    : [];

  const handleAvatarUpload = async (file: File) => {
    if (!user) return;
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

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    setSaveMsg(null);

    try {
      // 1. Save profile fields
      const { error: profError } = await supabase
        .from('profiles')
        .update({
          full_name: editName,
          city: editCity,
          about: editAbout,
          availability_status: editAvailability,
          avatar_url: editAvatarUrl,
        })
        .eq('id', user.id);
      if (profError) {
        setSaveMsg({ type: 'error', text: 'Не удалось сохранить профиль. Попробуйте ещё раз.' });
        setSaving(false);
        return;
      }

      // 2. Save primary profession if selected
      if (editProfId) {
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
              .update({ is_primary: true })
              .eq('id', existingRow.id);
          } else {
            // Insert new primary profession
            const { error: insertError } = await supabase
              .from('user_professions')
              .insert({
                user_id: user.id,
                profession_id: editProfId,
                is_primary: true,
              });
            if (insertError) {
              setSaveMsg({ type: 'error', text: 'Не удалось сохранить профессию. Попробуйте ещё раз.' });
              setSaving(false);
              return;
            }
          }
        }
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 text-emerald-500 animate-spin" />
      </div>
    );
  }

  const displayName = profile?.full_name || user?.email || 'Гость';
  const initials = displayName.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const availabilityLabels: Record<string, string> = {
    available: 'Свободен',
    busy: 'Занят',
    limited: 'Ограниченно',
  };
  const availabilityColors: Record<string, string> = {
    available: 'bg-emerald-200/30 text-emerald-600',
    busy: 'bg-danger-200/30 text-danger-700',
    limited: 'bg-warn-200/30 text-warn-700',
  };

  // Missing profile basics (owner-only)
  const missing: string[] = [];
  if (!profile?.avatar_url) missing.push('фото');
  if (!profile?.city) missing.push('город');
  if (!primaryProf) missing.push('основная профессия');
  if (!profile?.about) missing.push('о себе');
  const profileIncomplete = missing.length > 0;

  if (editing) {
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
            <input type="text" value={editCity} onChange={(e) => setEditCity(e.target.value)} className="input-field" />
          </div>

          {/* Department + Profession */}
          <div className="space-y-4">
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
          </div>

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
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="h-20 w-20 rounded-full object-cover ring-4 ring-surface-600" />
            ) : (
              <Avatar initials={initials} size="lg" className="ring-4 ring-surface-600 !h-20 !w-20 !text-2xl" />
            )}
            <div className="flex gap-2 mb-2">
              <button onClick={() => setEditing(true)} className="btn-secondary">
                <Edit3 className="h-4 w-4" /> Редактировать
              </button>
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
            <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{profile?.city || 'Город не указан'}</span>
            <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />На FilmVerse с {new Date(profile?.created_at || Date.now()).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}</span>
            {user?.email && <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />{user.email}</span>}
          </div>
          <div className="mt-3">
            <span className={`chip ${availabilityColors[profile?.availability_status || 'available']}`}>
              {availabilityLabels[profile?.availability_status || 'available']}
            </span>
          </div>
        </div>
      </Card>

      {/* Incomplete profile prompt (owner-only) */}
      {profileIncomplete && (
        <Card className="p-5 mt-6 border-emerald-400/30">
          <h2 className="text-sm font-semibold text-txt-primary mb-2">Заполните профиль</h2>
          <p className="text-sm text-txt-secondary mb-3">
            Не хватает: {missing.join(', ')}
          </p>
          <button onClick={() => setEditing(true)} className="btn-primary">
            <Edit3 className="h-4 w-4" /> Дополнить профиль
          </button>
        </Card>
      )}

      {/* Primary profession */}
      <Card className="p-6 mt-6">
        <div className="flex items-center gap-2 mb-4">
          <Briefcase className="h-4 w-4 text-emerald-500" />
          <h2 className="text-sm font-semibold text-txt-primary">Основная профессия</h2>
        </div>
        {primaryProf ? (
          <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-200/20 border border-emerald-300/20">
            <div>
              <p className="text-sm font-medium text-txt-primary">{primaryProf.profession_name}</p>
              <p className="text-xs text-txt-muted mt-0.5">{primaryProf.department_name}</p>
            </div>
            <Badge variant="fern">Основная</Badge>
          </div>
        ) : (
          <p className="text-sm text-txt-muted">Добавьте основную профессию</p>
        )}
      </Card>

      {/* About */}
      {profile?.about && (
        <Card className="p-6 mt-6">
          <h2 className="text-sm font-semibold text-txt-primary mb-3">О себе</h2>
          <p className="text-sm text-txt-secondary leading-relaxed">{profile.about}</p>
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
