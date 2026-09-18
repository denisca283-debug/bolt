import { useState, useEffect, useCallback, useRef } from 'react';
import { Send, Plus, Users, Building2, MessageSquare, Loader2, AlertCircle, ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useAuthModal } from '../components/AuthModal';
import { Avatar } from '../components/ui';
import { NewChatDialog } from '../components/chat/NewChatDialog';
import type { ChatMessage, ChatRoom, Department } from '../types';

type RoomView = ChatRoom & { memberNames: string[]; memberCount: number };

type PersonLite = { id: string; name: string; avatarUrl: string | null };

const KIND_ICON: Record<string, typeof MessageSquare> = {
  direct: MessageSquare,
  group: Users,
  department: Building2,
};

function timeLabel(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay
    ? d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

export function MessagesPage() {
  const { user, profile } = useAuth();
  const { openLogin } = useAuthModal();

  const [rooms, setRooms] = useState<RoomView[]>([]);
  const [people, setPeople] = useState<Map<string, PersonLite>>(new Map());
  const [departments, setDepartments] = useState<Department[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [schemaMissing, setSchemaMissing] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [verifiedTypes, setVerifiedTypes] = useState(0);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const userId = user?.id;

  // ── Rooms ────────────────────────────────────────────────────────
  const loadRooms = useCallback(async () => {
    if (!userId) { setLoading(false); return; }

    const { data: memberRows, error: memberErr } = await supabase
      .from('chat_members')
      .select('room_id')
      .eq('user_id', userId);

    // The chat tables arrive with a migration. Until it is applied, say so
    // plainly instead of showing an empty screen with no explanation.
    if (memberErr) {
      setSchemaMissing(true);
      setLoading(false);
      return;
    }
    setSchemaMissing(false);

    const roomIds = [...new Set((memberRows || []).map((r: { room_id: string }) => r.room_id))];
    if (roomIds.length === 0) {
      setRooms([]);
      setLoading(false);
      return;
    }

    const [roomRes, allMembersRes] = await Promise.all([
      supabase.from('chat_rooms').select('*').in('id', roomIds),
      supabase.from('chat_members').select('room_id, user_id').in('room_id', roomIds),
    ]);

    const allMembers = (allMembersRes.data || []) as { room_id: string; user_id: string }[];
    const otherIds = [...new Set(allMembers.map((m) => m.user_id))];

    const { data: profileRows } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', otherIds);

    const peopleMap = new Map<string, PersonLite>(
      ((profileRows || []) as { id: string; full_name: string | null; avatar_url: string | null }[])
        .map((p) => [p.id, { id: p.id, name: p.full_name || 'Пользователь', avatarUrl: p.avatar_url }])
    );
    setPeople(peopleMap);

    const byRoom = new Map<string, string[]>();
    for (const m of allMembers) {
      byRoom.set(m.room_id, [...(byRoom.get(m.room_id) || []), m.user_id]);
    }

    const built: RoomView[] = ((roomRes.data || []) as ChatRoom[])
      .map((r) => {
        const ids = byRoom.get(r.id) || [];
        return {
          ...r,
          memberCount: ids.length,
          memberNames: ids
            .filter((id) => id !== userId)
            .map((id) => peopleMap.get(id)?.name || 'Участник'),
        };
      })
      .sort((a, b) => (b.last_message_at || b.created_at).localeCompare(a.last_message_at || a.created_at));

    setRooms(built);
    setLoading(false);
  }, [userId]);

  useEffect(() => { loadRooms(); }, [loadRooms]);

  // ── Reference data + eligibility ────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const [deptRes, verifRes] = await Promise.all([
        supabase.from('departments').select('*').order('sort_order'),
        supabase
          .from('verification_records')
          .select('verification_type')
          .eq('user_id', userId)
          .eq('status', 'approved'),
      ]);
      if (cancelled) return;
      if (deptRes.data) setDepartments(deptRes.data as Department[]);
      setVerifiedTypes(
        new Set(((verifRes.data || []) as { verification_type: string }[]).map((v) => v.verification_type)).size
      );
    })();
    return () => { cancelled = true; };
  }, [userId]);

  // ── Messages of the open room (polled, so a reply shows up on its own) ──
  const loadMessages = useCallback(async () => {
    if (!activeRoomId) { setMessages([]); return; }
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('room_id', activeRoomId)
      .order('created_at');
    setMessages((data || []) as ChatMessage[]);
  }, [activeRoomId]);

  useEffect(() => { loadMessages(); }, [loadMessages]);

  useEffect(() => {
    if (!activeRoomId) return;
    const t = setInterval(loadMessages, 8000);
    return () => clearInterval(t);
  }, [activeRoomId, loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const isPro = profile?.plan === 'pro';
  const canCreateDepartmentChat = isPro && verifiedTypes >= 2;
  const departmentLockReason = !isPro && verifiedTypes < 2
    ? 'Чаты департаментов доступны по подписке Про и после двух пройденных верификаций. У вас пока нет ни того, ни другого.'
    : !isPro
    ? 'Верификации пройдены. Для чатов департаментов не хватает подписки Про.'
    : `Подписка Про есть. Для чатов департаментов нужны две разные пройденные верификации — сейчас ${verifiedTypes === 0 ? 'нет ни одной' : 'есть одна'}.`;

  const activeRoom = rooms.find((r) => r.id === activeRoomId) || null;

  const handleSend = async () => {
    const body = draft.trim();
    if (!body || !activeRoomId || !userId) return;
    setSending(true);

    const { error } = await supabase
      .from('chat_messages')
      .insert({ room_id: activeRoomId, sender_id: userId, body });

    if (error) {
      setSending(false);
      return;
    }

    setDraft('');
    await loadMessages();
    await loadRooms();
    setSending(false);
  };

  // ── States ───────────────────────────────────────────────────────

  if (!user) {
    return (
      <div className="animate-fade-in max-w-lg mx-auto text-center py-20">
        <h1 className="font-display text-2xl font-semibold text-txt-primary">Сообщения</h1>
        <p className="mt-2 text-sm text-txt-secondary">
          Войдите, чтобы переписываться и создавать обсуждения.
        </p>
        <button onClick={openLogin} className="mt-5 btn-primary">Войти</button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 text-emerald-500 animate-spin" />
      </div>
    );
  }

  if (schemaMissing) {
    return (
      <div className="animate-fade-in max-w-lg mx-auto py-16">
        <div className="surface p-6 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-warn-700 shrink-0 mt-0.5" />
          <div>
            <h2 className="text-sm font-semibold text-txt-primary mb-1">База ещё не обновлена</h2>
            <p className="text-sm text-txt-secondary leading-relaxed">
              Групповые чаты требуют новых таблиц. Выполните SQL-миграцию
              <span className="text-txt-primary"> 010_chat_rooms_group_department</span> в панели
              базы данных — после этого раздел заработает.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-display text-2xl font-semibold text-txt-primary">Сообщения</h1>
        <button onClick={() => setShowNewChat(true)} className="btn-primary">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Новый чат</span>
        </button>
      </div>

      {rooms.length === 0 ? (
        <div className="surface p-10 text-center">
          <p className="text-txt-primary text-lg font-medium">Переписки пока нет</p>
          <p className="text-txt-secondary text-sm mt-2 max-w-md mx-auto leading-relaxed">
            Начните личный разговор, соберите группу под смену или — если у вас Про и пройдены
            верификации — откройте обсуждение между департаментами.
          </p>
          <button onClick={() => setShowNewChat(true)} className="mt-5 btn-primary">
            <Plus className="h-4 w-4" /> Создать чат
          </button>
        </div>
      ) : (
        <div className="grid md:grid-cols-[300px_1fr] gap-4 lg:gap-5">
          {/* Room list */}
          <div className={`space-y-1.5 ${activeRoomId ? 'hidden md:block' : ''}`}>
            {rooms.map((r) => {
              const Icon = KIND_ICON[r.kind] || MessageSquare;
              const active = r.id === activeRoomId;
              const subtitle = r.last_message_text
                || (r.memberNames.length > 0 ? r.memberNames.join(', ') : 'Пока ни одного сообщения');
              return (
                <button
                  key={r.id}
                  onClick={() => setActiveRoomId(r.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-all duration-200 ${
                    active
                      ? 'bg-emerald-200/20 border-emerald-400/50'
                      : 'bg-surface-600 border-line-soft hover:border-line'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                    <span className="text-sm font-medium text-txt-primary truncate flex-1">
                      {r.title || r.memberNames.join(', ') || 'Чат'}
                    </span>
                    <span className="text-[11px] text-txt-muted shrink-0">
                      {timeLabel(r.last_message_at)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-txt-muted truncate">{subtitle}</p>
                  {r.kind !== 'direct' && (
                    <p className="mt-0.5 text-[11px] text-txt-muted">{r.memberCount} участников</p>
                  )}
                </button>
              );
            })}
          </div>

          {/* Conversation */}
          <div className={`surface flex flex-col min-h-[60vh] ${activeRoomId ? '' : 'hidden md:flex'}`}>
            {!activeRoom ? (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-sm text-txt-muted">Выберите чат слева</p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 px-4 py-3 border-b border-line-soft">
                  <button
                    onClick={() => setActiveRoomId(null)}
                    className="md:hidden text-txt-muted hover:text-txt-primary"
                    aria-label="Назад"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-txt-primary truncate">
                      {activeRoom.title || activeRoom.memberNames.join(', ') || 'Чат'}
                    </p>
                    <p className="text-xs text-txt-muted truncate">
                      {activeRoom.kind === 'department' && 'Чат департамента · '}
                      {activeRoom.memberCount} участников
                    </p>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {messages.length === 0 ? (
                    <p className="text-sm text-txt-muted text-center py-10">
                      Сообщений пока нет. Напишите первым.
                    </p>
                  ) : (
                    messages.map((m) => {
                      const mine = m.sender_id === userId;
                      const author = people.get(m.sender_id);
                      return (
                        <div key={m.id} className={`flex gap-2.5 ${mine ? 'flex-row-reverse' : ''}`}>
                          {author?.avatarUrl ? (
                            <img src={author.avatarUrl} alt="" className="h-7 w-7 rounded-full object-cover shrink-0" />
                          ) : (
                            <Avatar
                              initials={(author?.name || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
                              size="sm"
                            />
                          )}
                          <div className={`max-w-[75%] ${mine ? 'text-right' : ''}`}>
                            {!mine && activeRoom.kind !== 'direct' && (
                              <p className="text-[11px] text-txt-muted mb-0.5">{author?.name}</p>
                            )}
                            <div
                              className={`inline-block px-3 py-2 rounded-xl text-sm leading-relaxed ${
                                mine
                                  ? 'bg-emerald-200/30 text-txt-primary'
                                  : 'bg-surface-600 text-txt-primary'
                              }`}
                            >
                              {m.body}
                            </div>
                            <p className="mt-0.5 text-[11px] text-txt-muted">{timeLabel(m.created_at)}</p>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={bottomRef} />
                </div>

                <div className="p-3 border-t border-line-soft flex items-center gap-2">
                  <input
                    type="text"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    placeholder="Написать сообщение…"
                    className="input-field flex-1"
                  />
                  <button
                    onClick={handleSend}
                    disabled={!draft.trim() || sending}
                    className="btn-primary !px-3"
                    aria-label="Отправить"
                  >
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {showNewChat && userId && (
        <NewChatDialog
          currentUserId={userId}
          departments={departments}
          canCreateDepartmentChat={canCreateDepartmentChat}
          departmentLockReason={departmentLockReason}
          onClose={() => setShowNewChat(false)}
          onCreated={async (roomId) => {
            setShowNewChat(false);
            await loadRooms();
            setActiveRoomId(roomId);
          }}
        />
      )}
    </div>
  );
}
