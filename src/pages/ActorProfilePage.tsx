import { useState } from 'react';
import {
  MapPin, Ruler, Calendar, Eye, Play, Share2, Mail, UserPlus,
  Check, Film, Camera, Star, ChevronLeft,
} from 'lucide-react';
import { actors } from '../data/mock';
import { useRouter } from '../router';
import { Badge, ShareButton } from '../components/ui';

const statusColors: Record<string, string> = {
  'Профессиональный': 'chip-fern',
  'Начинающий': 'bg-amber-100 text-amber-700 border border-amber-200',
  'Студент': 'bg-blue-100 text-blue-700 border border-blue-200',
  'Массовка': 'chip-neutral',
};

const availabilityColors: Record<string, string> = {
  'Свободен': 'bg-fern-100 text-fern-700',
  'Занят': 'bg-red-100 text-red-700',
  'Ограниченно': 'bg-amber-100 text-amber-700',
};

export function ActorProfilePage({ actorId }: { actorId: string }) {
  const { navigate } = useRouter();
  const actor = actors.find((a) => a.id === actorId);
  const [activePhoto, setActivePhoto] = useState(0);
  const [showInviteModal, setShowInviteModal] = useState(false);

  if (!actor) {
    return (
      <div className="text-center py-20">
        <p className="text-ink-500 text-lg">Профиль не найден</p>
        <button onClick={() => navigate('/actors')} className="mt-4 btn-secondary">
          К списку актёров
        </button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in max-w-5xl">
      {/* Back link */}
      <button
        onClick={() => navigate('/actors')}
        className="mb-5 inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900 transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        К списку актёров
      </button>

      {/* Hero portrait + info */}
      <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-6 lg:gap-8 mb-8">
        {/* Portrait column */}
        <div>
          <div className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-stone-200 shadow-portrait">
            <img src={actor.gallery[activePhoto]} alt={actor.name} className="portrait-img" />
            {actor.gallery.length > 1 && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                {actor.gallery.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setActivePhoto(i)}
                    className={`h-1.5 rounded-full transition-all duration-200 ${
                      i === activePhoto ? 'w-6 bg-white' : 'w-1.5 bg-white/50'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
          {/* Gallery thumbnails */}
          {actor.gallery.length > 1 && (
            <div className="mt-3 grid grid-cols-4 gap-2">
              {actor.gallery.map((photo, i) => (
                <button
                  key={i}
                  onClick={() => setActivePhoto(i)}
                  className={`aspect-square rounded-lg overflow-hidden bg-stone-200 transition-all duration-200 ${
                    i === activePhoto ? 'ring-2 ring-fern-500' : 'opacity-60 hover:opacity-100'
                  }`}
                >
                  <img src={photo} alt="" className="portrait-img" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info column */}
        <div className="flex flex-col">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="font-display text-3xl sm:text-4xl font-semibold text-ink-900 tracking-tight">
                {actor.name}
              </h1>
              <p className="mt-2 text-base text-ink-600">
                {actor.category} · {actor.age} лет · {actor.city}
              </p>
            </div>
            <span className={`chip ${availabilityColors[actor.availability]}`}>
              {actor.availability}
            </span>
          </div>

          {/* Status badge */}
          <div className="mt-4">
            <span className={`chip ${statusColors[actor.status]}`}>{actor.status}</span>
          </div>

          {/* Physical details */}
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4 py-5 border-y border-stone-300/50">
            {[
              { label: 'Рост', value: `${actor.height} см`, icon: Ruler },
              { label: 'Возраст', value: `${actor.age} лет`, icon: Calendar },
              { label: 'Глаза', value: actor.eyeColor, icon: Eye },
              { label: 'Волосы', value: actor.hairColor, icon: Star },
            ].map((d) => (
              <div key={d.label}>
                <div className="flex items-center gap-1.5 text-xs text-ink-400 mb-1">
                  <d.icon className="h-3.5 w-3.5" />
                  {d.label}
                </div>
                <p className="text-sm font-medium text-ink-900">{d.value}</p>
              </div>
            ))}
          </div>

          {/* Bio */}
          <p className="mt-5 text-sm text-ink-600 leading-relaxed">
            {actor.bio}
          </p>

          {/* Skills */}
          <div className="mt-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-400 mb-2.5">
              Навыки
            </p>
            <div className="flex flex-wrap gap-2">
              {actor.skills.map((s) => (
                <Badge key={s} variant="fern">{s}</Badge>
              ))}
            </div>
          </div>

          {/* Primary actions */}
          <div className="mt-auto pt-6 flex flex-wrap gap-3">
            <button
              onClick={() => setShowInviteModal(true)}
              className="btn-primary"
            >
              <UserPlus className="h-4 w-4" />
              Пригласить
            </button>
            <button
              onClick={() => navigate('/messages')}
              className="btn-secondary"
            >
              <Mail className="h-4 w-4" />
              Написать
            </button>
            <ShareButton />
          </div>
        </div>
      </div>

      {/* Showreel placeholder */}
      <div className="mb-8">
        <h2 className="font-display text-xl font-semibold text-ink-900 mb-4">Шоурил</h2>
        <div className="relative aspect-video rounded-2xl overflow-hidden bg-stone-900 group cursor-pointer">
          <img src={actor.gallery[0]} alt="" className="w-full h-full object-cover opacity-50" />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center group-hover:bg-white/30 transition-all duration-300">
              <Play className="h-7 w-7 text-white ml-1" fill="white" />
            </div>
            <p className="mt-3 text-sm text-paper-200">Шоурил скоро будет добавлен</p>
          </div>
        </div>
      </div>

      {/* Portfolio gallery */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Camera className="h-5 w-5 text-ink-500" />
          <h2 className="font-display text-xl font-semibold text-ink-900">Портфолио</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {actor.gallery.map((photo, i) => (
            <div key={i} className="relative aspect-[3/4] rounded-xl overflow-hidden bg-stone-200 shadow-soft group cursor-pointer">
              <img src={photo} alt="" className="portrait-img transition-transform duration-500 group-hover:scale-105" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-200" />
            </div>
          ))}
        </div>
      </div>

      {/* Previous projects */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Film className="h-5 w-5 text-ink-500" />
          <h2 className="font-display text-xl font-semibold text-ink-900">Проекты</h2>
        </div>
        <div className="space-y-3">
          {actor.projects.map((p, i) => (
            <div key={i} className="surface p-4 flex items-center justify-between hover:shadow-card transition-all duration-200">
              <div>
                <h3 className="text-sm font-semibold text-ink-900">{p.title}</h3>
                <p className="text-xs text-ink-500 mt-0.5">{p.role} · Реж. {p.director}</p>
              </div>
              <span className="chip chip-neutral">{p.year}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Shareable card preview */}
      <div className="surface-stone p-6 flex items-center gap-5">
        <div className="w-20 h-20 rounded-xl overflow-hidden bg-stone-800 shrink-0">
          <img src={actor.photo} alt="" className="portrait-img" />
        </div>
        <div className="flex-1">
          <p className="text-xs text-paper-400 mb-1">Карточка профиля для отправки</p>
          <h3 className="font-display text-xl font-semibold text-paper-50">{actor.name}</h3>
          <p className="text-sm text-paper-300">
            {actor.category} · {actor.city} · {actor.age} лет · {actor.height} см
          </p>
        </div>
        <ShareButton dark label="Поделиться" className="hidden sm:inline-flex" />
      </div>

      {/* Invite modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-ink-900/40 backdrop-blur-sm animate-fade-in" onClick={() => setShowInviteModal(false)} />
          <div className="relative surface-raised p-6 max-w-md w-full animate-scale-in">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-fern-100 flex items-center justify-center">
                <Check className="h-6 w-6 text-fern-600" />
              </div>
              <div>
                <h3 className="font-display text-lg font-semibold text-ink-900">Приглашение отправлено</h3>
                <p className="text-sm text-ink-500">{actor.name} получит ваше приглашение</p>
              </div>
            </div>
            <p className="text-sm text-ink-600 leading-relaxed mb-5">
              Когда актёр примет приглашение, вы сможете обсудить детали проекта в сообщениях.
              Регистрация потребуется для отправки приглашения.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowInviteModal(false)} className="flex-1 btn-secondary">
                Закрыть
              </button>
              <button onClick={() => { setShowInviteModal(false); navigate('/messages'); }} className="flex-1 btn-primary">
                К сообщениям
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
