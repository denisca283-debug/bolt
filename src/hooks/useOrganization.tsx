import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '../lib/supabase';

export type Organization = { id: string; name: string; slug: string; organization_type: string; city: string | null; description: string | null; visibility: string; search_engine_indexable: boolean; website: string | null };
type Membership = { organization_id: string; role: string; public_visible: boolean };
type Context = { organizations: Organization[]; memberships: Membership[]; selected: Organization | null; select: (id: string) => void; can: (permission: string, id?: string) => boolean; loading: boolean; error: string; refresh: () => void };
const OrganizationContext = createContext<Context>({ organizations: [], memberships: [], selected: null, select: () => {}, can: () => false, loading: false, error: '', refresh: () => {} });
export function useOrganization() { return useContext(OrganizationContext); }
export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [selectedId, setSelectedId] = useState('');
  const [result, setResult] = useState<{ userId: string; organizations: Organization[]; memberships: Membership[]; permissions: { role_key: string; permission: string }[] } | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let stale = false;
    setResult(null); setSelectedId(''); setError('');
    if (!user) { setLoading(false); return; }
    setLoading(true);
    void (async () => {
      try {
        const [companies, members, permissions] = await Promise.all([
          supabase.from('organizations').select('id,name,slug,organization_type,city,description,visibility,search_engine_indexable,website').order('name').limit(100),
          supabase.from('organization_members').select('organization_id,role,public_visible').eq('user_id', user.id).eq('active', true).limit(100),
          supabase.from('organization_role_permissions').select('role_key,permission'),
        ]);
        if (companies.error || members.error || permissions.error) throw new Error('load');
        if (!stale) setResult({ userId: user.id, organizations: companies.data || [], memberships: members.data || [], permissions: permissions.data || [] });
      } catch { if (!stale) setError('Компании недоступны. Не удалось проверить права.'); }
      finally { if (!stale) setLoading(false); }
    })();
    return () => { stale = true; };
  }, [user, revision]);
  const current = result?.userId === user?.id ? result : null;
  const organizations = current?.organizations || [];
  const selected = organizations.find(o => o.id === selectedId) || null;
  const can = (permission: string, id = selected?.id) => {
    const member = current?.memberships.find(m => m.organization_id === id);
    return !!member && !!current?.permissions.some(p => p.role_key === member.role && p.permission === permission);
  };
  return <OrganizationContext.Provider value={{ organizations, memberships: current?.memberships || [], selected, select: setSelectedId, can, loading, error, refresh: () => setRevision(n => n + 1) }}>{children}</OrganizationContext.Provider>;
}
