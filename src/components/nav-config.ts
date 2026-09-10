import {
  Home,
  Activity,
  Users,
  Briefcase,
  Clapperboard,
  MessageSquare,
  ShoppingBag,
  type LucideIcon,
} from 'lucide-react';

export type NavItem = {
  path: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
  requiresAuth?: boolean;
};

export const navItems: NavItem[] = [
  { path: '/', label: 'Главная', icon: Home },
  { path: '/pulse', label: 'Пульс индустрии', icon: Activity },
  { path: '/actors', label: 'Актёры', icon: Users },
  { path: '/professionals', label: 'Специалисты', icon: Clapperboard },
  { path: '/work', label: 'Работа', icon: Briefcase, badge: 10 },
  { path: '/projects', label: 'Проекты', icon: Clapperboard },
  { path: '/messages', label: 'Сообщения', icon: MessageSquare, badge: 3, requiresAuth: true },
  { path: '/marketplace', label: 'Кинобарахолка', icon: ShoppingBag },
];

// Routes that require authentication. When a guest navigates to one,
// the auth modal opens instead of redirecting away.
export const PRIVATE_ROUTES = new Set<string>([
  '/messages',
  '/notifications',
  '/settings',
  '/profile',
  '/onboarding',
]);
