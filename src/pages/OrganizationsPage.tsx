import { useEffect, useState } from 'react';
import { useOrganization, type Organization } from '../hooks/useOrganization';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { useRouter } from '../router';
import { ModalShell } from '../components/ModalShell';
import { CreateDialog, type CreateKind } from '../components/create/CreateDialog';
import { canOfferOrganizationRole } from '../lib/organizationRoles';
import { OrganizationRecords } from '../components/OrganizationRecords';

type Dictionary = { key: string; label: string };
type Invite = { id: string; organization_id: string; organization_name: string; organization_type: string; inviter_name: string | null; is_recipient: boolean; role_key: string; status: string; expires_at: string };
type Member = { user_id: string; role: string; active: boolean; public_visible: boolean };
export function OrganizationsPage() {
  const context = useOrganization();
  const { navigate } = useRouter();
  const [creating, setCreating] = useState(false);
  const [types, setTypes] = useState<Dictionary[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let stale = false;
    void (async () => {
      try {
        const [t, i] = await Promise.all([supabase.from('organization_types').select('key,label'), supabase.rpc('organization_invitation_cards')]);
        if (t.error || i.error) throw new Error('load');
        if (!stale) { setTypes(t.data || []); setInvites((i.data || []).filter((v: Invite) => v.status === 'pending')); }
      } catch { if (!stale) setError('Не удалось загрузить справочник и приглашения.'); }
    })(); return () => { stale = true; };
  }, [revision]);
  const reply = async (id: string, action: string) => {
    setError('');
    try { const r = await supabase.rpc('organization_invitation_reply', { p_invite: id, p_action: action }); if (r.error) throw r.error; setRevision(n => n + 1); context.refresh(); }
    catch { setError('Приглашение недоступно, истекло или адрес аккаунта ещё не подтверждён.'); }
  };
  return <section className="p-4 sm:p-8 space-y-5 max-w-6xl mx-auto">
    <h1 className="text-2xl font-display">Компании и рабочие пространства</h1>
    <p className="text-txt-secondary">Вы входите как человек. Компания — отдельное рабочее пространство с собственными правами и публикациями.</p>
    {(error || context.error) && <p role="alert">{error || context.error} <button onClick={() => { context.refresh(); setRevision(n => n + 1); }}>Повторить</button></p>}
    {context.loading && <p role="status">Проверяем участие…</p>}
    <div className="flex flex-wrap gap-2"><button className="btn-primary" onClick={() => setCreating(true)}>Создать компанию</button><button className="btn-secondary" onClick={() => navigate('/companies')}>Найти компанию</button></div>
    <div className="grid gap-3 sm:grid-cols-2">{context.organizations.map(o => <button key={o.id} className={`surface p-4 text-left ${context.selected?.id === o.id ? 'ring-1 ring-emerald-500' : ''}`} onClick={() => context.select(o.id)}><strong>{o.name}</strong><p className="text-sm text-txt-muted">{types.find(t => t.key === o.organization_type)?.label || o.organization_type} · {o.city}</p></button>)}</div>
    {!context.loading && !context.error && !context.organizations.length && <p>Пока вы не состоите в компаниях. Создайте свою или примите приглашение.</p>}
    {context.selected && <CompanyWorkspace key={context.selected.id} company={context.selected} />}
    {!!invites.length && <section className="surface p-5 space-y-3"><h2 className="font-semibold">Приглашения</h2><p className="text-xs text-txt-muted">Письма автоматически не отправляются. Получатель увидит приглашение после входа с подтверждённым адресом.</p>{invites.map(invite => <div key={invite.id} className="border-t border-line-soft py-3"><p>{invite.organization_name} · {invite.role_key}{invite.inviter_name ? ` · Пригласил(а): ${invite.inviter_name}` : ''}</p><p className="text-xs">Компания: {types.find(t => t.key === invite.organization_type)?.label || invite.organization_type} · до {new Date(invite.expires_at).toLocaleDateString('ru')}</p><div className="flex gap-3 mt-2">{!invite.is_recipient && context.can('manage_members', invite.organization_id) ? <button onClick={() => void reply(invite.id, 'revoke')}>Отозвать</button> : <><button onClick={() => void reply(invite.id, 'accept')}>Принять</button><button onClick={() => void reply(invite.id, 'decline')}>Отклонить</button></>}</div></div>)}</section>}
    {creating && <CreateCompany types={types} onClose={() => setCreating(false)} onSaved={() => { setCreating(false); context.refresh(); }} />}
  </section>;
}
function CreateCompany({ types, onClose, onSaved }: { types: Dictionary[]; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(''); const [slug, setSlug] = useState(''); const [type, setType] = useState('production_company'); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  return <ModalShell title="Новая компания" onClose={() => { if (!busy) onClose(); }}><form className="space-y-4" onSubmit={e => { e.preventDefault(); setBusy(true); setError(''); void (async () => { try { const r = await supabase.rpc('organization_create', { p_name: name.trim(), p_slug: slug.trim(), p_type: type }); if (r.error) throw r.error; onSaved(); } catch { setError('Не сохранено. Проверьте адрес: он должен быть уникальным и состоять из латинских букв, цифр и дефисов.'); } finally { setBusy(false); } })(); }}>
    <label className="block">Название<input className="input-field" required minLength={2} maxLength={160} value={name} onChange={e => setName(e.target.value)} /></label>
    <label className="block">Адрес компании<input className="input-field" required pattern="[a-z0-9-]{3,80}" value={slug} onChange={e => setSlug(e.target.value)} /></label>
    <label className="block">Тип<select className="input-field" value={type} onChange={e => setType(e.target.value)}>{types.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}</select></label>
    {error && <p role="alert">{error}</p>}<button className="btn-primary" disabled={busy || !types.length}>{busy ? 'Создаём…' : 'Создать компанию и стать владельцем'}</button>
  </form></ModalShell>;
}
function CompanyWorkspace({ company }: { company: Organization }) {
  const context = useOrganization(); const { user } = useAuth(); const { navigate } = useRouter();
  const [members, setMembers] = useState<Member[]>([]); const [roles, setRoles] = useState<Dictionary[]>([]);
  const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0); const [creating, setCreating] = useState<CreateKind | null>(null);
  const [email, setEmail] = useState(''); const [role, setRole] = useState('member');
  const [draft, setDraft] = useState(company);
  useEffect(() => { let stale = false; void (async () => { try { const [m, r] = await Promise.all([supabase.from('organization_members').select('user_id,role,active,public_visible').eq('organization_id', company.id).limit(100), supabase.from('organization_roles').select('key,label')]); if (m.error || r.error) throw new Error('load'); if (!stale) { setMembers(m.data || []); setRoles(r.data || []); } } catch { if (!stale) setError('Не удалось загрузить доступ команды.'); } })(); return () => { stale = true; }; }, [company.id, revision]);
  const act = async (fn: () => PromiseLike<{ error: unknown }>, message: string) => {
    setBusy(true); setError(''); setNotice('');
    try { const r = await fn(); if (r.error) throw r.error; setNotice(message); setRevision(n => n + 1); }
    catch { setError('Изменение не сохранено. Проверьте права и поля. Последний владелец не может покинуть компанию.'); }
    finally { setBusy(false); }
  };
  const ownMember = members.find(m => m.user_id === user?.id && m.active);
  const lastOwner = members.filter(m => m.active && m.role === 'owner').length === 1;
  const canChange = (m: Member) => canOfferOrganizationRole(ownMember?.role, m.role, m.role, m.user_id === user?.id, lastOwner && m.role === 'owner');
  return <section className="surface p-5 space-y-5">
    <div><h2 className="text-xl font-semibold">{company.name}</h2><button className="text-emerald-500" onClick={() => navigate('/company/' + company.slug)}>Открыть публичную страницу</button></div>
    <p className="text-sm text-txt-muted">{company.organization_type === 'agency' ? 'Брифы, проекты и партнёры' : company.organization_type === 'rental_house' ? 'Инвентарь, комплекты и предложения аренды' : 'Проекты и найм команды'}</p>
    {error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    <div className="flex flex-wrap gap-2">{context.can('manage_projects') && <button className="btn-primary" onClick={() => setCreating('project')}>Создать проект компании</button>}{context.can('publish_jobs') && <button className="btn-primary" onClick={() => setCreating('work')}>Разместить вакансию компании</button>}{context.can('manage_marketplace') && <button className="btn-primary" onClick={() => setCreating('listing')}>Разместить предложение компании</button>}</div>
    {context.can('manage_organization') && <form className="space-y-3 border-t border-line-soft pt-4" onSubmit={e => { e.preventDefault(); void act(() => supabase.from('organizations').update({ name: draft.name, description: draft.description, city: draft.city, website: draft.website, visibility: draft.visibility, search_engine_indexable: draft.search_engine_indexable }).eq('id', company.id).select('id').single(), 'Профиль компании сохранён.'); }}>
      <h3 className="font-semibold">Профиль и видимость компании</h3>
      <label className="block">Название<input className="input-field" required minLength={2} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /></label>
      <label className="block">Описание<textarea className="input-field" maxLength={10000} value={draft.description || ''} onChange={e => setDraft({ ...draft, description: e.target.value })} /></label>
      <label className="block">Город<input className="input-field" value={draft.city || ''} onChange={e => setDraft({ ...draft, city: e.target.value })} /></label>
      <label className="block">Сайт<input type="url" className="input-field" value={draft.website || ''} onChange={e => setDraft({ ...draft, website: e.target.value })} /></label>
      <label className="block">Видимость<select className="input-field" value={draft.visibility} onChange={e => setDraft({ ...draft, visibility: e.target.value })}><option value="public">Публичная</option><option value="unlisted">Только по ссылке</option><option value="members_only">Только участникам</option></select></label>
      <label className="block"><input type="checkbox" checked={draft.search_engine_indexable} onChange={e => setDraft({ ...draft, search_engine_indexable: e.target.checked })} /> Разрешить индексацию поисковиками</label>
      <button className="btn-secondary" disabled={busy}>Сохранить профиль компании</button>
    </form>}
    {context.can('manage_members') && <section className="space-y-3 border-t border-line-soft pt-4"><h3 className="font-semibold">Команда и доступ</h3>{members.map(m => <div key={m.user_id} className="flex flex-wrap gap-3 items-center"><span className="text-xs break-all">{m.user_id === user?.id ? 'Вы' : m.user_id} {!m.active && '(доступ закрыт)'}</span><select aria-label={`Роль ${m.user_id}`} disabled={busy || !m.active || !canChange(m)} className="input-field !w-auto" value={m.role} onChange={e => void act(() => supabase.rpc('organization_member_change', { p_org: company.id, p_user: m.user_id, p_role: e.target.value, p_active: true }), 'Роль обновлена.')}>
      {roles.filter(r => r.key === m.role || canOfferOrganizationRole(ownMember?.role, r.key, m.role, m.user_id === user?.id, lastOwner && m.role === 'owner')).map(r => <option key={r.key} value={r.key}>{r.label}</option>)}</select>{m.active && canChange(m) && <button disabled={busy} onClick={() => void act(() => supabase.rpc('organization_member_change', { p_org: company.id, p_user: m.user_id, p_role: m.role, p_active: false }), 'Доступ отозван.')}>Отозвать доступ</button>}</div>)}
      <form className="flex flex-wrap gap-2" onSubmit={e => { e.preventDefault(); void act(() => supabase.rpc('organization_invite', { p_org: company.id, p_email: email, p_role: role }), 'Приглашение сохранено. Письмо не отправлялось: получатель увидит приглашение в разделе «Мои компании».'); }}><input aria-label="Email приглашённого" type="email" className="input-field flex-1" required value={email} onChange={e => setEmail(e.target.value)} /><select aria-label="Роль приглашённого" className="input-field !w-auto" value={role} onChange={e => setRole(e.target.value)}>{roles.filter(r => canOfferOrganizationRole(ownMember?.role, r.key)).map(r => <option key={r.key} value={r.key}>{r.label}</option>)}</select><button className="btn-secondary" disabled={busy}>Пригласить</button></form>
    </section>}
    <OrganizationRecords company={company} />
    {ownMember?.active && <div className="border-t border-line-soft pt-4 space-y-3"><label className="block"><input type="checkbox" disabled={busy} checked={ownMember.public_visible} onChange={e => void act(() => supabase.from('organization_members').update({ public_visible: e.target.checked }).eq('organization_id', company.id).eq('user_id', user!.id).select('user_id').single(), 'Согласие обновлено.')} /> Показывать меня в публичной команде</label><button disabled={busy} onClick={() => void act(() => supabase.rpc('organization_member_change', { p_org: company.id, p_user: user!.id, p_role: ownMember.role, p_active: false }), 'Вы покинули компанию. Обновите список компаний.')}>Покинуть компанию</button></div>}
    {creating && <CreateDialog initialKind={creating} allowKindSwitch={false} onClose={() => setCreating(null)} onCreated={() => { setCreating(null); setNotice('Публикация компании сохранена.'); }} />}
  </section>;
}
