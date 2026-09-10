import { useState, useMemo } from 'react';
import { Search, MapPin, Briefcase, ChevronRight, Mail, UserPlus, X } from 'lucide-react';
import { departments, professionals, type Professional } from '../data/mock';
import { ShareButton } from '../components/ui';
import { useRouter } from '../router';

const availabilityColors: Record<string, string> = {
  'Свободен': 'bg-fern-100 text-fern-700',
  'Занят': 'bg-red-100 text-red-700',
  'Ограниченно': 'bg-amber-100 text-amber-700',
};

export function ProfessionalsPage() {
  const { navigate } = useRouter();
  const [selectedDept, setSelectedDept] = useState<string | null>(null);
  const [selectedProfession, setSelectedProfession] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedPro, setSelectedPro] = useState<Professional | null>(null);

  const filtered = useMemo(() => {
    return professionals.filter((p) => {
      if (selectedDept && p.departmentId !== selectedDept) return false;
      if (selectedProfession && p.profession !== selectedProfession) return false;
      if (search) {
        const q = search.toLowerCase();
        const matches =
          p.name.toLowerCase().includes(q) ||
          p.profession.toLowerCase().includes(q) ||
          p.city.toLowerCase().includes(q) ||
          p.skills.some((s) => s.toLowerCase().includes(q));
        if (!matches) return false;
      }
      return true;
    });
  }, [selectedDept, selectedProfession, search]);

  const currentDept = departments.find((d) => d.id === selectedDept);

  const resetAll = () => {
    setSelectedDept(null);
    setSelectedProfession(null);
    setSearch('');
  };

  // Professional detail view
  if (selectedPro) {
    const dept = departments.find((d) => d.id === selectedPro.departmentId);
    return (
      <div className="animate-fade-in max-w-4xl">
        <button
          onClick={() => setSelectedPro(null)}
          className="mb-5 inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900 transition-colors"
        >
          <X className="h-4 w-4" />
          К списку специалистов
        </button>

        <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-6 lg:gap-8">
          {/* Portrait */}
          <div>
            <div className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-stone-200 shadow-portrait">
              <img src={selectedPro.photo} alt={selectedPro.name} className="portrait-img" />
              <div className="absolute top-3 left-3">
                <span className={`chip ${availabilityColors[selectedPro.availability]}`}>
                  {selectedPro.availability}
                </span>
              </div>
            </div>
          </div>

          {/* Info */}
          <div className="flex flex-col">
            <h1 className="font-display text-3xl font-semibold text-ink-900 tracking-tight">
              {selectedPro.name}
            </h1>
            <p className="mt-2 text-base text-fern-600 font-medium">{selectedPro.profession}</p>
            <p className="text-sm text-ink-500 mt-0.5">{dept?.name}</p>

            <div className="mt-5 grid grid-cols-2 gap-4 py-5 border-y border-stone-300/50">
              <div>
                <div className="flex items-center gap-1.5 text-xs text-ink-400 mb-1">
                  <MapPin className="h-3.5 w-3.5" />
                  Город
                </div>
                <p className="text-sm font-medium text-ink-900">{selectedPro.city}</p>
              </div>
              <div>
                <div className="flex items-center gap-1.5 text-xs text-ink-400 mb-1">
                  <Briefcase className="h-3.5 w-3.5" />
                  Опыт
                </div>
                <p className="text-sm font-medium text-ink-900">{selectedPro.experience} лет</p>
              </div>
            </div>

            <p className="mt-5 text-sm text-ink-600 leading-relaxed">{selectedPro.bio}</p>

            <div className="mt-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-400 mb-2.5">Навыки</p>
              <div className="flex flex-wrap gap-2">
                {selectedPro.skills.map((s) => (
                  <span key={s} className="chip chip-fern">{s}</span>
                ))}
              </div>
            </div>

            <div className="mt-auto pt-6 flex flex-wrap gap-3">
              <button onClick={() => navigate('/messages')} className="btn-primary">
                <UserPlus className="h-4 w-4" />
                Пригласить в проект
              </button>
              <button onClick={() => navigate('/messages')} className="btn-secondary">
                <Mail className="h-4 w-4" />
                Написать
              </button>
              <ShareButton />
            </div>
          </div>
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
      <div className="relative max-w-md mb-6">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400" />
        <input
          type="text"
          placeholder="Имя, профессия, город, навык…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-field pl-10"
        />
      </div>

      {/* Department browser */}
      {!selectedDept && (
        <div className="mb-8">
          <h2 className="font-display text-xl font-semibold text-ink-900 mb-4">Департаменты</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {departments.map((dept) => {
              const count = professionals.filter((p) => p.departmentId === dept.id).length;
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
                      {dept.professions.length} профессий{count > 0 ? ` · ${count} специалистов` : ''}
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
            <button onClick={() => { setSelectedDept(null); setSelectedProfession(null); }} className="text-sm text-ink-500 hover:text-ink-900 transition-colors">
              Департаменты
            </button>
            <ChevronRight className="h-4 w-4 text-ink-400" />
            <span className="text-sm font-semibold text-ink-900">{currentDept.name}</span>
            <button onClick={resetAll} className="ml-auto text-sm text-ink-500 hover:text-ink-900 transition-colors flex items-center gap-1">
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
            {currentDept.professions.map((prof) => (
              <button
                key={prof}
                onClick={() => setSelectedProfession(prof)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all duration-200 ${
                  selectedProfession === prof
                    ? 'bg-fern-600 text-white border-fern-600'
                    : 'bg-white text-ink-600 border-stone-300 hover:border-stone-400'
                }`}
              >
                {prof}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Professional cards */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 lg:gap-5">
          {filtered.map((pro) => (
            <div
              key={pro.id}
              onClick={() => setSelectedPro(pro)}
              className="group cursor-pointer animate-fade-up"
            >
              {/* Portrait */}
              <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-stone-200 shadow-soft">
                <img
                  src={pro.photo}
                  alt={pro.name}
                  className="portrait-img transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />
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
                <p className="text-sm font-medium text-fern-700">{pro.profession}</p>
                <div className="mt-1 flex items-center gap-3 text-sm text-ink-500">
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {pro.city}
                  </span>
                  <span>{pro.experience} лет</span>
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
