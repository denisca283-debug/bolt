import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useRouter } from '../router';
import { useSearchIndexing } from '../hooks/useSearchIndexing';
import { StudentSupportProgram } from '../components/StudentSupport';
import { ShareButton } from '../components/ui';

type Company = { id: string; slug: string; name: string; organization_type: string; city: string | null; description: string | null; website?: string; logo_url?: string; cover_url?: string; service_geography?: string[]; specialties?: string[]; founded_year?: number; verified?: boolean; search_engine_indexable?: boolean };
type Card = { id: string; title: string; city: string | null };
type Person = { id: string; full_name: string; public_slug: string | null; avatar_url: string | null };
const types: Record<string, string> = { production_company: 'Продакшн', rental_house: 'Рентал', agency: 'Агентство', casting_agency: 'Кастинг-агентство', studio: 'Студия', post_production: 'Постпродакшн', service_company: 'Сервисная компания', education: 'Образование', other: 'Другое' };
function safeLink(url?: string) { try { const u = new URL(url || ''); return ['https:', 'http:'].includes(u.protocol) ? u.href : undefined; } catch { return undefined; } }
export function CompaniesPage() {
  const { navigate } = useRouter();
  const [query, setQuery] = useState(''); const [type, setType] = useState(''); const [city, setCity] = useState(''); const [page, setPage] = useState(0);
  const [rows, setRows] = useState<Company[]>([]); const [error, setError] = useState(''); const [loading, setLoading] = useState(true);
  useEffect(() => { let stale = false; setLoading(true); setRows([]); setError(''); const timer = setTimeout(() => { void (async () => { try { const r = await supabase.rpc('company_search', { p_query: query.trim(), p_type: type, p_city: city.trim(), p_offset: page * 24 }); if (r.error) throw r.error; if (!stale) setRows(r.data || []); } catch { if (!stale) setError('Не удалось загрузить компании.'); } finally { if (!stale) setLoading(false); } })(); }, 250); return () => { stale = true; clearTimeout(timer); }; }, [query, type, city, page]);
  return <section className="p-4 sm:p-8 space-y-5"><h1 className="text-2xl font-display">Компании киноиндустрии</h1><div className="flex flex-wrap gap-3"><input aria-label="Название компании" placeholder="Найти компанию" className="input-field flex-1" value={query} onChange={e => { setQuery(e.target.value); setPage(0); }} /><input aria-label="Город компании" className="input-field flex-1" placeholder="Город" value={city} onChange={e => { setCity(e.target.value); setPage(0); }} /><select aria-label="Тип компании" className="input-field !w-auto" value={type} onChange={e => { setType(e.target.value); setPage(0); }}><option value="">Все компании</option>{Object.entries(types).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>
    {loading && <p role="status">Ищем компании…</p>}{error && <p role="alert">{error}</p>}{!loading && !error && !rows.length && <p>По этим условиям компаний не найдено.</p>}
    <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">{rows.map(c => <button key={c.id} className="surface p-5 text-left space-y-2" onClick={() => navigate('/company/' + c.slug)}><h2 className="font-semibold text-lg">{c.name}</h2><p className="text-emerald-500">{types[c.organization_type] || c.organization_type} · {c.city}</p><p className="text-sm text-txt-secondary line-clamp-3">{c.description}</p></button>)}</div>
    <div className="flex gap-4"><button disabled={page === 0 || loading} onClick={() => setPage(n => n - 1)}>Назад</button><span>Страница {page + 1}</span><button disabled={rows.length < 24 || loading} onClick={() => setPage(n => n + 1)}>Далее</button></div>
  </section>;
}
export function CompanyPage({ slug }: { slug: string }) {
  const { navigate } = useRouter();
  const [company, setCompany] = useState<Company | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const [jobs, setJobs] = useState<Card[]>([]); const [projects, setProjects] = useState<Card[]>([]); const [listings, setListings] = useState<Card[]>([]); const [team, setTeam] = useState<Person[]>([]);
  useSearchIndexing(!!company?.search_engine_indexable);
  useEffect(() => { let stale = false; setCompany(null); setLoading(true); setError(''); setJobs([]); setProjects([]); setListings([]); setTeam([]);
    void (async () => { try {
      const r = await supabase.rpc('company_public', { p_slug: slug }); if (r.error) throw r.error; if (!r.data) return;
      if (!stale) setCompany(r.data);
      const [j, p, l, t] = await Promise.all([
        supabase.from('work_opportunities').select('id,title,city').eq('organization_id', r.data.id).eq('visibility', 'public').order('created_at', { ascending: false }).limit(12),
        supabase.from('projects').select('id,title,city').eq('organization_id', r.data.id).eq('visibility', 'public').order('created_at', { ascending: false }).limit(12),
        supabase.from('marketplace_listings').select('id,title,city').eq('organization_id', r.data.id).eq('visibility', 'public').order('created_at', { ascending: false }).limit(12),
        supabase.rpc('company_team', { p_org: r.data.id }),
      ]); if ([j, p, l, t].some(x => x.error)) throw new Error('content');
      if (!stale) { setJobs(j.data || []); setProjects(p.data || []); setListings(l.data || []); setTeam(t.data || []); }
    } catch { if (!stale) setError('Не удалось загрузить страницу компании полностью.'); } finally { if (!stale) setLoading(false); } })(); return () => { stale = true; };
  }, [slug]);
  if (loading) return <p role="status" className="p-8">Загружаем компанию…</p>;
  if (!company) return <p className="p-8" role={error ? 'alert' : undefined}>{error || 'Компания не найдена или недоступна.'}</p>;
  const rental = company.organization_type === 'rental_house';
  const sections = [{ title: 'Проекты и портфолио', rows: projects }, { title: 'Вакансии и кастинги', rows: jobs }, { title: rental ? 'Оборудование и предложения аренды' : 'Публичные услуги и предложения', rows: listings }];
  if (rental) sections.unshift(sections.pop()!);
  return <article className="max-w-6xl mx-auto p-4 sm:p-8 space-y-6">
    <header className="surface p-6 space-y-4">{safeLink(company.cover_url) && <img alt="" src={company.cover_url} className="w-full h-44 object-cover rounded-lg" />}<p className="text-emerald-500">{types[company.organization_type] || company.organization_type}</p><h1 className="font-display text-3xl">{company.name} {company.verified && <span className="text-sm text-emerald-500">✓ Проверена</span>}</h1><p>{company.city}{company.founded_year ? ` · С ${company.founded_year} года` : ''}</p><p className="whitespace-pre-wrap text-txt-secondary">{company.description}</p><p>{company.specialties?.join(' · ')}</p><p>{company.service_geography?.join(', ')}</p>{safeLink(company.website) && <a href={safeLink(company.website)} target="_blank" rel="noreferrer" className="text-emerald-500">Сайт компании ↗</a>}<ShareButton /></header>
    {error && <p role="alert">{error}</p>}
    <StudentSupportProgram companyId={company.id} />
    {sections.map(section => <section key={section.title} className="space-y-3"><h2 className="text-xl font-semibold">{section.title}</h2>{!section.rows.length ? <p className="text-txt-muted">Пока нет публичных публикаций.</p> : <div className="grid sm:grid-cols-2 gap-3">{section.rows.map(row => <div key={row.id} className="surface p-4"><h3>{row.title}</h3><p className="text-sm text-txt-muted">{row.city}</p>{section.rows === listings && <button className="text-emerald-500" onClick={() => navigate('/listing/' + row.id)}>Открыть предложение</button>}</div>)}</div>}</section>)}
    {!!team.length && <section><h2 className="text-xl font-semibold mb-3">Публичная команда</h2><div className="flex flex-wrap gap-3">{team.map(person => person.public_slug ? <button className="surface p-3" key={person.id} onClick={() => navigate('/u/' + person.public_slug)}>{person.full_name}</button> : <span key={person.id}>{person.full_name}</span>)}</div></section>}
  </article>;
}
