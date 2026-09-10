import { Bell, Mail, Briefcase, Users, Star } from 'lucide-react';
import { notifications } from '../data/mock';
import { Card } from '../components/ui';

const iconMap: Record<string, typeof Bell> = {
  mail: Mail,
  briefcase: Briefcase,
  users: Users,
  star: Star,
};

export function NotificationsPage() {
  return (
    <div className="animate-fade-in max-w-2xl">
      <div className="mb-6 flex items-center gap-3">
        <Bell className="h-6 w-6 text-fern-600" strokeWidth={1.6} />
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-ink-900 tracking-tight">Уведомления</h1>
          <p className="mt-0.5 text-sm text-ink-500">{notifications.length} новых уведомлений</p>
        </div>
      </div>

      <div className="space-y-3">
        {notifications.map((n) => {
          const Icon = iconMap[n.icon] || Bell;
          return (
            <Card key={n.id} className="p-4 flex items-start gap-4 hover:shadow-card transition-all duration-200 cursor-pointer">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-fern-50 border border-fern-200">
                <Icon className="h-5 w-5 text-fern-600" strokeWidth={1.6} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-ink-900">{n.title}</p>
                <p className="text-sm text-ink-600 mt-0.5">{n.text}</p>
                <p className="text-xs text-ink-400 mt-1">{n.time}</p>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
