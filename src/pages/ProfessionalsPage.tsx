import { useState, useMemo, useEffect } from 'react';
import { Search, MapPin, ChevronRight, X, Loader2, UserPlus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useRouter } from '../router';
import { useAuth } from '../hooks/useAuth';
import { useAuthModal } from '../components/AuthModal';
import type { Department, Profession } from '../types';

const AVAILABILITY_LABELS: Record<string, string> = {
  available: 'Свободен',
  busy: 'Занят',
  limited: 'Ограниченно',
};

const availabilityColors: Record<string, string> = {
  'Свободен': 'bg-fern-100 text-fern-700',
  'Занят': 'bg-red-100 text-red-700',
  'Ограниченно': 'bg-amber-100 text-amber-700',
};

const ALL = 'Все';

type Specialist = {
  userId: string;
  slug: string | null;
  name: string;
  city: string | null;
  avatarUrl: string | null;
  availability: string;
  professionId: string;
  professionName: string;
  departmentId: string;
  experienceYears: number | null;
  skills: string[];
};

export function ProfessionalsPage() {
  const { navigate } = useRouter();
  const { isAuthenticated } = useAuth();
  const { openRegister } = useAuthModal();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [professions, setProfessions] = useState<Profession[]>([]);
  const [specialists, setSpecialists] = useState<Specialist[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedDept, setSelectedDept] = useState<string | null>(null);
  const [selectedProfession, setSelectedProfession] = useState<string | null>(null);
  const [availability, setAvailability] = useState(ALL);
  const [search, setSearch] = useState('');

  const [offset, setOffset] = useState(0);
  const [error, setError] = useState('');
  useEffect(() => { setOffset(0); }, [selectedDept, selectedProfession, availability, search]);
  useEffect(() => {
    let cancelled = false; setLoading(true); setError('');
    void (async () => {
      const [depts, profs, people] = await Promise.all([
        supabase.from('departments').select('*').order('sort_order'),
        supabase.from('professions').select('*').order('sort_order'),
        supabase.rpc('professional_directory', { p_query: search, p_department: selectedDept,
          p_profession: selectedProfession, p_offset: offset,
          p_availability: Object.entries(AVAILABILITY_LABELS).find(([, label]) => label === availability)?.[0] || '' }),
      ]);
      if (cancelled) return;
      setDepartments(depts.data || []); setProfessions(profs.data || []);
      setSpecialists(people.error ? [] : people.data || []);
      setError(people.error || depts.error || profs.error ? 'Не удалось загрузить специалистов.' : ''); setLoading(false);
    })().catch(() => { if (!cancelled) { setError('Нет соединения. Повторите загрузку.'); setLoading(false); } });
    return () => { cancelled = true; };
  }, [selectedDept, selectedProfession, availability, search, offset, isAuthenticated]);

  const filtered = useMemo(() => {
    return specialists.filter((p) => {
      if (selectedDept && p.departmentId !== selectedDept) return false;
      if (selectedProfession && p.professionId !== selectedProfession) return false;
      if (availability !== ALL && p.availability !== availability) return false;
      if (search) {
        const q = search.toLowerCase();
        const matches =
          p.name.toLowerCase().includes(q) ||
          p.professionName.toLowerCase().includes(q) ||
          (p.city || '').toLowerCase().includes(q) ||
          p.skills.some((s) => s.toLowerCase().includes(q));
        if (!matches) return false;
      }
      return true;
    });
  }, [specialists, selectedDept, selectedProfession, availability, search]);

  const currentDept = departments.find((d) => d.id === selectedDept);
  const deptProfessions = professions.filter((p) => p.department_id === selectedDept);

  const resetAll = () => {
    setSelectedDept(null);
    setSelectedProfession(null);
    setAvailability(ALL);
    setSearch('');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 text-emerald-500 animate-spin" />
      </div>
    );
  }

  if (error) return <p role="alert">{error}</p>;
  if (specialists.length === 0 && !selectedDept && !selectedProfession && availability === ALL && !search && offset === 0) {
    return (
      <div className="animate-fade-in">
        <div className="mb-6">
          <h1 className="font-display text-3xl sm:text-4xl font-semibold text-ink-900 tracking-tight">
            Специалисты
          </h1>
        </div>
        <div className="surface p-10 text-center">
          <p className="text-ink-900 text-lg font-medium">Здесь пока никого нет</p>
          <p className="text-ink-500 text-sm mt-2 max-w-md mx-auto leading-relaxed">
            Укажите в профиле департамент и профессию — и вас начнут находить продюсеры
            и режиссёры, которые собирают команду.
          </p>
          <button
            onClick={() => (isAuthenticated ? navigate('/profile') : openRegister())}
            className="mt-5 btn-primary"
          >
            <UserPlus className="h-4 w-4" />
            {isAuthenticated ? 'Заполнить профиль' : 'Создать профиль'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-3xl sm:text-4xl font-semibold text-ink-900 tracking-tight">
          Специалисты
        </h1>
        <p className="mt-2 text-base text-ink-500">
          Съёмочная группа — от режиссуры до монтажа
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-md mb-5">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400" />
        <input
          type="text"
          placeholder="Имя, профессия, город, навык…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-field pl-10"
        />
      </div>

      {/* Availability — the thing a production actually needs to know */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-ink-400 mr-1">
          Доступность
        </span>
        {[ALL, 'Свободен', 'Ограниченно', 'Занят'].map((a) => (
          <button
            key={a}
            onClick={() => setAvailability(a)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all duration-200 ${
              availability === a
                ? 'bg-fern-600 text-white border-fern-600'
                : 'bg-white text-ink-600 border-stone-300 hover:border-stone-400'
            }`}
          >
            {a}
          </button>
        ))}
      </div>

      {/* Department browser */}
      {!selectedDept && (
        <div className="mb-8">
          <h2 className="font-display text-xl font-semibold text-ink-900 mb-4">Департаменты</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {departments.map((dept) => {
              const count = specialists.filter((p) => p.departmentId === dept.id).length;
              const profCount = professions.filter((p) => p.department_id === dept.id).length;
              return (
                <button
                  key={dept.id}
                  onClick={() => setSelectedDept(dept.id)}
                  className="surface p-4 flex items-center justify-between hover:shadow-card hover:border-stone-400/40 transition-all duration-200 text-left group"
                >
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-ink-900 group-hover:text-fern-700 transition-colors">
                      {dept.name}
                    </h3>
                    <p className="text-xs text-ink-400 mt-0.5">
                      {profCount} профессий{count > 0 ? ` · ${count} в базе` : ''}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-ink-400 group-hover:text-fern-600 transition-colors shrink-0" />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Profession chips within a department */}
      {selectedDept && currentDept && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={() => { setSelectedDept(null); setSelectedProfession(null); }}
              className="text-sm text-ink-500 hover:text-ink-900 transition-colors"
            >
              Департаменты
            </button>
            <ChevronRight className="h-4 w-4 text-ink-400" />
            <span className="text-sm font-semibold text-ink-900">{currentDept.name}</span>
            <button
              onClick={resetAll}
              className="ml-auto text-sm text-ink-500 hover:text-ink-900 transition-colors flex items-center gap-1"
            >
              <X className="h-3.5 w-3.5" />
              Сбросить
            </button>
          </div>

          <div className="flex flex-wrap gap-2 mb-5">
            <button
              onClick={() => setSelectedProfession(null)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all duration-200 ${
                !selectedProfession
                  ? 'bg-fern-600 text-white border-fern-600'
                  : 'bg-white text-ink-600 border-stone-300 hover:border-stone-400'
              }`}
            >
              Все
            </button>
            {deptProfessions.map((prof) => (
              <button
                key={prof.id}
                onClick={() => setSelectedProfession(prof.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all duration-200 ${
                  selectedProfession === prof.id
                    ? 'bg-fern-600 text-white border-fern-600'
                    : 'bg-white text-ink-600 border-stone-300 hover:border-stone-400'
                }`}
              >
                {prof.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Specialist cards */}
      <div className="flex gap-3 mb-4">
        <button className="btn-secondary" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 24))}>Назад</button>
        <button className="btn-secondary" disabled={specialists.length < 24} onClick={() => setOffset(offset + 24)}>Далее</button>
      </div>
      {filtered.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 lg:gap-5">
          {filtered.map((pro) => (
            <div
              key={pro.userId}
              onClick={() => pro.slug && navigate(`/u/${pro.slug}`)}
              className="group cursor-pointer animate-fade-up"
            >
              {/* Portrait */}
              <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-surface-700 shadow-soft">
                {pro.avatarUrl ? (
                  <img
                    src={pro.avatarUrl}
                    alt={pro.name}
                    className="portrait-img transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center bg-surface-600">
                    <span className="font-display text-3xl font-semibold text-txt-muted">
                      {pro.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
                    </span>
                  </div>
                )}
                <div className="absolute top-3 left-3">
                  <span className={`chip ${availabilityColors[pro.availability]}`}>
                    {pro.availability}
                  </span>
                </div>
                <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <h3 className="font-display text-lg font-semibold text-white leading-tight">
                    {pro.name}
                  </h3>
                </div>
              </div>
              {/* Info */}
              <div className="mt-3 px-1">
                <p className="text-sm font-medium text-fern-700">{pro.professionName}</p>
                <div className="mt-1 flex items-center gap-3 text-sm text-ink-500">
                  {pro.city && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {pro.city}
                    </span>
                  )}
                  {pro.experienceYears != null && <span>{pro.experienceYears} лет</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20">
          <p className="text-ink-500 text-lg">Никого не найдено</p>
          <p className="text-ink-400 text-sm mt-1">Попробуйте изменить фильтры или сбросить поиск</p>
          <button onClick={resetAll} className="mt-4 btn-secondary">Сбросить всё</button>
        </div>
      )}
    </div>
  );
}
