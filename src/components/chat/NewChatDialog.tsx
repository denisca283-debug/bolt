import { useState, useEffect } from 'react';
import { X, Search, Check, Lock, Loader2, Users, MessageSquare, Building2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Avatar } from '../ui';
import type { ChatRoomKind, Department } from '../../types';

type Candidate = {
  id: string;
  name: string;
  city: string | null;
  avatarUrl: string | null;
};

type NewChatDialogProps = {
  currentUserId: string;
  departments: Department[];
  canCreateDepartmentChat: boolean;
  /** Why the department option is locked, in plain words. */
  departmentLockReason: string;
  onClose: () => void;
  onCreated: (roomId: string) => void;
};

const KINDS: { kind: ChatRoomKind; label: string; hint: string; icon: typeof Users }[] = [
  { kind: 'direct', label: 'Личный', hint: 'Разговор с одним человеком', icon: MessageSquare },
  { kind: 'group', label: 'Групповой', hint: 'Несколько человек, любая задача', icon: Users },
  { kind: 'department', label: 'Департамент', hint: 'Обсуждение между департаментами', icon: Building2 },
];

export function NewChatDialog({
  currentUserId,
  departments,
  canCreateDepartmentChat,
  departmentLockReason,
  onClose,
  onCreated,
}: NewChatDialogProps) {
  const [kind, setKind] = useState<ChatRoomKind>('direct');
  const [title, setTitle] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [query, setQuery] = useState('');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [picked, setPicked] = useState<Candidate[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, city, avatar_url')
        .neq('id', currentUserId)
        .order('full_name')
        .limit(100);
      if (cancelled) return;
      setCandidates(
        ((data || []) as { id: string; full_name: string | null; city: string | null; avatar_url: string | null }[])
          .map((p) => ({
            id: p.id,
            name: p.full_name || 'Пользователь FilmVerse',
            city: p.city,
            avatarUrl: p.avatar_url,
          }))
      );
    })();
    return () => { cancelled = true; };
  }, [currentUserId]);

  const q = query.trim().toLowerCase();
  const visible = q
    ? candidates.filter((c) => c.name.toLowerCase().includes(q) || (c.city || '').toLowerCase().includes(q))
    : candidates;

  const togglePick = (c: Candidate) => {
    setPicked((prev) => {
      if (prev.some((p) => p.id === c.id)) return prev.filter((p) => p.id !== c.id);
      // A direct chat is between exactly two people.
      return kind === 'direct' ? [c] : [...prev, c];
    });
  };

  const defaultTitle = () => {
    if (kind === 'direct') return picked[0]?.name || 'Личный чат';
    if (kind === 'department') {
      const dept = departments.find((d) => d.id === departmentId);
      return title.trim() || dept?.name || 'Чат департамента';
    }
    return title.trim() || 'Групповой чат';
  };

  const canSubmit =
    picked.length > 0 &&
    (kind !== 'department' || (!!departmentId && canCreateDepartmentChat)) &&
    !creating;

  const handleCreate = async () => {
    setCreating(true);
    setError(null);

    const { data: room, error: roomErr } = await supabase
      .from('chat_rooms')
      .insert({
        kind,
        title: defaultTitle(),
        department_id: kind === 'department' ? departmentId : null,
        created_by: currentUserId,
      })
      .select('id')
      .single();

    if (roomErr || !room) {
      // The department rule is enforced by the database, not just here, so a
      // blocked insert surfaces as a policy error.
      setError(
        kind === 'department'
          ? 'База не разрешила создать чат департамента. Нужны подписка Про и две пройденные верификации.'
          : 'Не удалось создать чат. Попробуйте ещё раз.'
      );
      setCreating(false);
      return;
    }

    const members = [
      { room_id: room.id, user_id: currentUserId, role: 'owner' },
      ...picked.map((p) => ({ room_id: room.id, user_id: p.id, role: 'member' })),
    ];
    const { error: memberErr } = await supabase.from('chat_members').insert(members);
    if (memberErr) {
      setError('Чат создан, но участников добавить не удалось. Откройте его и попробуйте снова.');
      setCreating(false);
      return;
    }

    setCreating(false);
    onCreated(room.id);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-base-950/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg surface p-6 animate-scale-in max-h-[85vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-txt-muted hover:text-txt-primary transition-colors"
          aria-label="Закрыть"
        >
          <X className="h-5 w-5" />
        </button>

        <h2 className="font-display text-xl font-semibold text-txt-primary mb-4">Новый чат</h2>

        {/* Kind */}
        <div className="grid grid-cols-3 gap-2 mb-5">
          {KINDS.map((k) => {
            const locked = k.kind === 'department' && !canCreateDepartmentChat;
            const active = kind === k.kind;
            const Icon = k.icon;
            return (
              <button
                key={k.kind}
                type="button"
                disabled={locked}
                onClick={() => { setKind(k.kind); setPicked([]); }}
                className={`p-3 rounded-lg border text-left transition-all duration-200 ${
                  locked
                    ? 'bg-surface-700 border-line-soft opacity-60 cursor-not-allowed'
                    : active
                    ? 'bg-emerald-200/25 border-emerald-400'
                    : 'bg-surface-600 border-line-soft hover:border-line'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  {locked ? (
                    <Lock className="h-3.5 w-3.5 text-txt-muted" />
                  ) : (
                    <Icon className={`h-3.5 w-3.5 ${active ? 'text-emerald-600' : 'text-txt-muted'}`} />
                  )}
                  <span className={`text-xs font-medium ${active && !locked ? 'text-emerald-600' : 'text-txt-primary'}`}>
                    {k.label}
                  </span>
                </div>
                <p className="text-[11px] text-txt-muted leading-snug">{k.hint}</p>
              </button>
            );
          })}
        </div>

        {!canCreateDepartmentChat && (
          <div className="mb-5 p-3 rounded-lg bg-surface-700 border border-line-soft flex items-start gap-2">
            <Lock className="h-4 w-4 text-txt-muted shrink-0 mt-0.5" />
            <p className="text-xs text-txt-secondary leading-relaxed">{departmentLockReason}</p>
          </div>
        )}

        {/* Department picker */}
        {kind === 'department' && (
          <div className="mb-5">
            <label className="block text-xs font-medium text-txt-secondary mb-1.5">Департамент</label>
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className="input-field"
            >
              <option value="">Выберите департамент</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Title */}
        {kind !== 'direct' && (
          <div className="mb-5">
            <label className="block text-xs font-medium text-txt-secondary mb-1.5">
              Название {kind === 'department' && <span className="text-txt-muted">(необязательно)</span>}
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={kind === 'department' ? 'Например: Свет и камера — смена 12' : 'Например: Смена №4'}
              className="input-field"
            />
          </div>
        )}

        {/* People */}
        <div className="mb-5">
          <div className="flex items-baseline justify-between mb-1.5">
            <label className="block text-xs font-medium text-txt-secondary">
              {kind === 'direct' ? 'С кем' : 'Участники'}
            </label>
            {picked.length > 0 && (
              <span className="text-[11px] text-txt-muted">выбрано: {picked.length}</span>
            )}
          </div>

          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-txt-muted" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Найти человека…"
              className="input-field !py-2 pl-9 text-sm"
            />
          </div>

          <div className="max-h-52 overflow-y-auto space-y-1">
            {visible.length === 0 ? (
              <p className="text-sm text-txt-muted py-3 text-center">
                {candidates.length === 0 ? 'Пока не с кем переписываться — нет других зарегистрированных.' : 'Никого не найдено'}
              </p>
            ) : (
              visible.map((c) => {
                const active = picked.some((p) => p.id === c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => togglePick(c)}
                    className={`w-full flex items-center gap-3 p-2 rounded-lg border transition-all ${
                      active ? 'bg-emerald-200/25 border-emerald-400' : 'bg-transparent border-transparent hover:bg-surface-600'
                    }`}
                  >
                    {c.avatarUrl ? (
                      <img src={c.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover shrink-0" />
                    ) : (
                      <Avatar initials={c.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()} size="sm" />
                    )}
                    <div className="min-w-0 text-left flex-1">
                      <p className="text-sm text-txt-primary truncate">{c.name}</p>
                      {c.city && <p className="text-xs text-txt-muted truncate">{c.city}</p>}
                    </div>
                    {active && <Check className="h-4 w-4 text-emerald-600 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-danger-200/30 border border-danger-600/30">
            <p className="text-xs text-danger-700 leading-relaxed">{error}</p>
          </div>
        )}

        <button onClick={handleCreate} disabled={!canSubmit} className="btn-primary w-full">
          {creating ? <><Loader2 className="h-4 w-4 animate-spin" /> Создание…</> : 'Создать чат'}
        </button>
      </div>
    </div>
  );
}
