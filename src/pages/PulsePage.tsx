import { useState, useEffect, useCallback } from 'react';
import {
  Award, Search, Users, Camera, CheckCircle2, Briefcase, FileImage, Activity, Loader2,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { PulseEntry } from '../types';

const KIND_CONFIG: Record<string, { icon: typeof Award; label: string; color: string }> = {
  role: { icon: Award, label: 'Проект', color: 'chip-fern' },
  'crew-search': { icon: Search, label: 'Поиск группы', color: 'chip-stone' },
  portfolio: { icon: FileImage, label: 'Портфолио', color: 'chip-neutral' },
  join: { icon: Users, label: 'Команда', color: 'chip-neutral' },
  spots: { icon: Briefcase, label: 'Набор', color: 'chip-stone' },
  marketplace: { icon: Camera, label: 'Кинобарахолка', color: 'chip-neutral' },
  'team-complete': { icon: CheckCircle2, label: 'Команда готова', color: 'chip-fern' },
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'только что';
  if (m < 60) return `${m} мин назад`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ч назад`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'вчера';
  if (d < 30) return `${d} дн. назад`;
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

export function PulsePage() {
  const [items, setItems] = useState<PulseEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [schemaMissing, setSchemaMissing] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('pulse_feed')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      setSchemaMissing(true);
      setLoading(false);
      return;
    }
    setSchemaMissing(false);
    setItems((data || []) as PulseEntry[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="animate-fade-in max-w-3xl">
      <div className="mb-6">
        <h1 className="font-display text-3xl sm:text-4xl font-semibold text-txt-primary tracking-tight">
          Пульс индустрии
        </h1>
        <p className="mt-2 text-base text-txt-secondary">
          Что происходит в киносообществе прямо сейчас
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 text-emerald-500 animate-spin" />
        </div>
      ) : schemaMissing ? (
        <div className="surface p-6">
          <h2 className="text-sm font-semibold text-txt-primary mb-1">База ещё не обновлена</h2>
          <p className="text-sm text-txt-secondary leading-relaxed">
            Ленте нужна таблица <span className="text-txt-primary">pulse_feed</span>. Выполните
            миграцию <span className="text-txt-primary">009_communication_tables</span> в панели базы данных.
          </p>
        </div>
      ) : items.length === 0 ? (
        <div className="surface p-12 text-center">
          <Activity className="h-8 w-8 text-txt-muted mx-auto mb-4" strokeWidth={1.5} />
          <p className="text-txt-primary text-lg font-medium">В ленте пока пусто</p>
          <p className="text-txt-secondary text-sm mt-2 max-w-md mx-auto leading-relaxed">
            Лента наполняется сама: как только кто-то разместит объявление, откроет проект
            или начнёт искать группу — это появится здесь.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const cfg = KIND_CONFIG[item.kind] || KIND_CONFIG.portfolio;
            const Icon = cfg.icon;
            return (
              <div
                key={item.id}
                className="surface p-5 flex items-start gap-4 hover:border-line-strong transition-all duration-200 animate-fade-up"
              >
                {item.photo_url ? (
                  <div className="relative shrink-0">
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-surface-700">
                      <img src={item.photo_url} alt={item.person} className="portrait-img" />
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-surface-500 border border-line flex items-center justify-center">
                      <Icon className="h-3 w-3 text-txt-secondary" strokeWidth={2} />
                    </div>
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-full bg-surface-500 border border-line flex items-center justify-center text-txt-primary font-semibold text-sm shrink-0">
                    {item.initials || '—'}
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`chip ${cfg.color} !py-0.5`}>
                      <Icon className="h-3 w-3" />
                      {cfg.label}
                    </span>
                    <span className="text-xs text-txt-muted">{timeAgo(item.created_at)}</span>
                  </div>
                  <p className="text-sm text-txt-secondary leading-relaxed">
                    <span className="font-semibold text-txt-primary">{item.person}</span>{' '}
                    <span>{item.action}</span>{' '}
                    {item.target && <span className="font-medium text-emerald-600">{item.target}</span>}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
