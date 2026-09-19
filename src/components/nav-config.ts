import {
  Activity,
  Users,
  Briefcase,
  Clapperboard,
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
  { path: '/work', label: 'Работа', icon: Briefcase },
  { path: '/projects', label: 'Проекты', icon: Clapperboard },
  { path: '/people', label: 'Люди', icon: Users },
  { path: '/companies', label: 'Компании', icon: Briefcase },
  { path: '/marketplace', label: 'Маркет', icon: ShoppingBag },
  { path: '/industry', label: 'Индустрия', icon: Activity },
];

// Routes that require authentication. When a guest navigates to one,
// the auth modal opens instead of redirecting away.
export const PRIVATE_ROUTES = new Set<string>([
  '/partners',
  '/relationships',
  '/young-talent',
  '/messages',
  '/notifications',
  '/settings',
  '/profile',
  '/onboarding',
  '/model-settings',
  '/resumes',
  '/organizations',
]);
