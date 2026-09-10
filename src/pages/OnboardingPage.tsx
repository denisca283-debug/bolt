import { useState, useEffect, useCallback } from 'react';
import {
  ChevronRight, ChevronLeft, Check, Loader2, MapPin, Camera, User as UserIcon,
  Briefcase, ImagePlus,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { Logo } from '../components/Logo';
import { useRouter } from '../router';
import type { Department, Profession } from '../types';

const STEPS = [
  { num: 1, title: 'Основная информация', icon: UserIcon },
  { num: 2, title: 'Основная профессия', icon: Briefcase },
  { num: 3, title: 'Доп. профессии', icon: Briefcase },
  { num: 4, title: 'Город', icon: MapPin },
  { num: 5, title: 'Фото профиля', icon: Camera },
  { num: 6, title: 'О себе', icon: UserIcon },
];

export function OnboardingPage() {
  const { user, profile, refreshProfile } = useAuth();
  const { navigate } = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [professions, setProfessions] = useState<Profession[]>([]);
  const [selectedDept, setSelectedDept] = useState<string>('');
  const [primaryProfessionId, setPrimaryProfessionId] = useState<string>('');
  const [additionalProfessionIds, setAdditionalProfessionIds] = useState<string[]>([]);
  const [city, setCity] = useState(profile?.city || '');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile?.avatar_url || null);
  const [about, setAbout] = useState(profile?.about || '');

  useEffect(() => {
    (async () => {
      const [deptRes, profRes] = await Promise.all([
        supabase.from('departments').select('*').order('sort_order'),
        supabase.from('professions').select('*').order('sort_order'),
      ]);
      if (deptRes.data) setDepartments(deptRes.data as Department[]);
      if (profRes.data) setProfessions(profRes.data as Profession[]);
    })();
  }, []);

  const professionsForDept = professions.filter((p) => p.department_id === selectedDept);

  const handleAvatarUpload = useCallback(async (file: File) => {
    if (!user) return;
    setLoading(true);
    setError(null);
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${user.id}/avatar.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true });
    if (uploadError) {
      setError('Не удалось загрузить фото: ' + uploadError.message);
      setLoading(false);
      return;
    }
    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
    setAvatarUrl(urlData.publicUrl);
    setLoading(false);
  }, [user]);

  const completeOnboarding = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        full_name: fullName,
        city,
        about,
        avatar_url: avatarUrl,
        onboarding_completed: true,
      })
      .eq('id', user.id);

    if (profileError) {
      setError('Ошибка сохранения: ' + profileError.message);
      setLoading(false);
      return;
    }

    // Save primary profession
    if (primaryProfessionId) {
      await supabase.from('user_professions').insert({
        user_id: user.id,
        profession_id: primaryProfessionId,
        is_primary: true,
      });
    }

    // Save additional professions
    for (const profId of additionalProfessionIds) {
      if (profId !== primaryProfessionId) {
        await supabase.from('user_professions').insert({
          user_id: user.id,
          profession_id: profId,
          is_primary: false,
        });
      }
    }

    await refreshProfile();
    setLoading(false);
    navigate('/');
  };

  const canProceed = () => {
    if (step === 1) return fullName.trim().length >= 2;
    if (step === 2) return Boolean(primaryProfessionId);
    if (step === 4) return city.trim().length >= 2;
    return true;
  };

  const next = () => {
    if (step < 6) setStep(step + 1);
    else completeOnboarding();
  };
  const back = () => {
    if (step > 1) setStep(step - 1);
  };

  return (
    <div className="min-h-screen bg-base-900 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 sm:px-6 h-16 border-b border-line-soft">
        <Logo size={32} variant="emerald" />
        <button
          onClick={() => navigate('/')}
          className="text-sm text-txt-muted hover:text-txt-secondary transition-colors"
        >
          Пропустить
        </button>
      </div>

      {/* Progress */}
      <div className="px-4 sm:px-6 py-4 border-b border-line-soft">
        <div className="flex items-center gap-2 max-w-2xl mx-auto">
          {STEPS.map((s, i) => (
            <div key={s.num} className="flex items-center gap-2 flex-1">
              <div
                className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                  step >= s.num ? 'bg-emerald-500' : 'bg-surface-500'
                }`}
              />
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-txt-muted text-center">
          Шаг {step} из 6 — {STEPS[step - 1].title}
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-start justify-center px-4 py-8">
        <div className="w-full max-w-lg">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-danger-200/30 border border-danger-600/30 text-xs text-danger-700">
              {error}
            </div>
          )}

          {/* Step 1: Basic info */}
          {step === 1 && (
            <div className="animate-fade-up">
              <h2 className="font-display text-2xl font-semibold text-txt-primary mb-2">Как вас зовут?</h2>
              <p className="text-sm text-txt-secondary mb-6">Это имя увидят другие пользователи</p>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Иван Иванов"
                className="input-field"
                autoFocus
              />
            </div>
          )}

          {/* Step 2: Primary profession */}
          {step === 2 && (
            <div className="animate-fade-up">
              <h2 className="font-display text-2xl font-semibold text-txt-primary mb-2">Кто вы?</h2>
              <p className="text-sm text-txt-secondary mb-6">Выберите свою основную профессию</p>

              <label className="block text-xs font-medium text-txt-secondary mb-2">Департамент</label>
              <select
                value={selectedDept}
                onChange={(e) => { setSelectedDept(e.target.value); setPrimaryProfessionId(''); }}
                className="input-field mb-4"
              >
                <option value="">Выберите департамент…</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>

              {professionsForDept.length > 0 && (
                <>
                  <label className="block text-xs font-medium text-txt-secondary mb-2">Профессия</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {professionsForDept.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setPrimaryProfessionId(p.id)}
                        className={`px-4 py-2.5 rounded-lg text-sm font-medium border transition-all duration-200 text-left ${
                          primaryProfessionId === p.id
                            ? 'bg-emerald-200/30 text-emerald-600 border-emerald-400'
                            : 'bg-surface-600 text-txt-secondary border-line-soft hover:border-line'
                        }`}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Step 3: Additional professions */}
          {step === 3 && (
            <div className="animate-fade-up">
              <h2 className="font-display text-2xl font-semibold text-txt-primary mb-2">Ещё профессии?</h2>
              <p className="text-sm text-txt-secondary mb-6">Один человек может совмещать несколько ролей. Это необязательно.</p>

              <label className="block text-xs font-medium text-txt-secondary mb-2">Департамент</label>
              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="input-field mb-4"
              >
                <option value="">Выберите департамент…</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>

              {professionsForDept.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {professionsForDept.map((p) => {
                    const isSelected = additionalProfessionIds.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        onClick={() => {
                          setAdditionalProfessionIds((prev) =>
                            isSelected ? prev.filter((id) => id !== p.id) : [...prev, p.id]
                          );
                        }}
                        className={`px-4 py-2.5 rounded-lg text-sm font-medium border transition-all duration-200 text-left flex items-center justify-between ${
                          isSelected
                            ? 'bg-emerald-200/30 text-emerald-600 border-emerald-400'
                            : 'bg-surface-600 text-txt-secondary border-line-soft hover:border-line'
                        }`}
                      >
                        {p.name}
                        {isSelected && <Check className="h-4 w-4" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Step 4: City */}
          {step === 4 && (
            <div className="animate-fade-up">
              <h2 className="font-display text-2xl font-semibold text-txt-primary mb-2">Где вы находитесь?</h2>
              <p className="text-sm text-txt-secondary mb-6">Город поможет находить съёмки рядом</p>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Москва"
                className="input-field"
                autoFocus
              />
            </div>
          )}

          {/* Step 5: Avatar */}
          {step === 5 && (
            <div className="animate-fade-up">
              <h2 className="font-display text-2xl font-semibold text-txt-primary mb-2">Добавьте фото</h2>
              <p className="text-sm text-txt-secondary mb-6">Лица — главное в FilmVerse</p>

              <div className="flex flex-col items-center gap-4">
                <div className="w-32 h-32 rounded-full overflow-hidden bg-surface-600 border-2 border-line flex items-center justify-center">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="" className="portrait-img" />
                  ) : (
                    <Camera className="h-10 w-10 text-txt-muted" />
                  )}
                </div>

                <label className="btn-secondary cursor-pointer">
                  <ImagePlus className="h-4 w-4" />
                  <span>{avatarUrl ? 'Заменить фото' : 'Загрузить фото'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleAvatarUpload(file);
                    }}
                  />
                </label>

                {loading && (
                  <p className="text-xs text-txt-muted flex items-center gap-1.5">
                    <Loader2 className="h-3 w-3 animate-spin" /> Загрузка…
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Step 6: About */}
          {step === 6 && (
            <div className="animate-fade-up">
              <h2 className="font-display text-2xl font-semibold text-txt-primary mb-2">Расскажите о себе</h2>
              <p className="text-sm text-txt-secondary mb-6">Пару предложений — этого достаточно. Можно пропустить.</p>
              <textarea
                value={about}
                onChange={(e) => setAbout(e.target.value)}
                placeholder="Опыт, жанры, интересы…"
                rows={5}
                className="input-field resize-none"
                autoFocus
              />
            </div>
          )}

          {/* Navigation */}
          <div className="mt-8 flex items-center justify-between">
            <button
              onClick={back}
              disabled={step === 1}
              className="btn-ghost disabled:opacity-30 disabled:pointer-events-none"
            >
              <ChevronLeft className="h-4 w-4" />
              Назад
            </button>

            <button
              onClick={next}
              disabled={!canProceed() || loading}
              className="btn-primary"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Сохраняем…</span>
                </>
              ) : step === 6 ? (
                <>
                  <span>Перейти в FilmVerse</span>
                  <Check className="h-4 w-4" />
                </>
              ) : (
                <>
                  <span>Далее</span>
                  <ChevronRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
