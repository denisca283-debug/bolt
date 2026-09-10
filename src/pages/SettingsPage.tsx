import { Settings, Bell, Lock, Palette, Globe, Share2 } from 'lucide-react';
import { Card, Badge } from '../components/ui';

const sections = [
  {
    icon: Bell,
    title: 'Уведомления',
    description: 'Управление email- и push-уведомлениями',
  },
  {
    icon: Lock,
    title: 'Конфиденциальность',
    description: 'Видимость профиля и контактной информации',
  },
  {
    icon: Palette,
    title: 'Внешний вид',
    description: 'Светлая тема активна',
    badge: 'Включено',
  },
  {
    icon: Globe,
    title: 'Язык интерфейса',
    description: 'Русский',
    badge: 'RU',
  },
  {
    icon: Share2,
    title: 'Поделиться профилем',
    description: 'Скопировать ссылку на ваш профиль',
    badge: 'Ссылка',
  },
];

export function SettingsPage() {
  return (
    <div className="animate-fade-in max-w-2xl">
      <div className="mb-6 flex items-center gap-3">
        <Settings className="h-6 w-6 text-fern-600" strokeWidth={1.6} />
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-ink-900 tracking-tight">Настройки</h1>
          <p className="mt-0.5 text-sm text-ink-500">Управление аккаунтом и предпочтениями</p>
        </div>
      </div>

      <div className="space-y-3">
        {sections.map((s) => (
          <Card key={s.title} className="p-5 flex items-center gap-4 hover:shadow-card transition-all duration-200 cursor-pointer">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-paper-200">
              <s.icon className="h-5 w-5 text-ink-600" strokeWidth={1.6} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-ink-900">{s.title}</p>
              <p className="text-xs text-ink-400 mt-0.5">{s.description}</p>
            </div>
            {s.badge && <Badge variant={s.badge === 'Ссылка' ? 'neutral' : 'fern'}>{s.badge}</Badge>}
          </Card>
        ))}
      </div>
    </div>
  );
}
