import { supabase } from './supabase';

export type OpenChatResult =
  | { roomId: string; error: null }
  | { roomId: null; error: string };

/**
 * Find (or create) the personal 1:1 chat between two people and return its id.
 *
 * A direct room is the "Сообщения" case of the room model: kind = 'direct'
 * with exactly two members. Looking it up first keeps a second "Написать"
 * from spawning a duplicate thread with the same person.
 */
export async function openDirectChat(
  currentUserId: string,
  otherUserId: string,
  otherName?: string | null
): Promise<OpenChatResult> {
  if (!currentUserId) return { roomId: null, error: 'Войдите, чтобы написать сообщение.' };
  if (currentUserId === otherUserId) return { roomId: null, error: 'Это ваш собственный профиль.' };

  // 1. Rooms I am in.
  const { data: mine, error: mineErr } = await supabase
    .from('chat_members')
    .select('room_id')
    .eq('user_id', currentUserId);

  if (mineErr) {
    return {
      roomId: null,
      error: 'Раздел сообщений ещё не готов в базе. Выполните миграцию 010_chat_rooms_group_department.',
    };
  }

  const myRoomIds = (mine || []).map((r: { room_id: string }) => r.room_id);

  if (myRoomIds.length > 0) {
    // 2. Of those, the ones the other person is also in.
    const { data: shared } = await supabase
      .from('chat_members')
      .select('room_id')
      .eq('user_id', otherUserId)
      .in('room_id', myRoomIds);

    const sharedIds = (shared || []).map((r: { room_id: string }) => r.room_id);

    if (sharedIds.length > 0) {
      // 3. Only a two-person personal room counts — a group we both happen to
      //    be in is not "личный чат".
      const [roomsRes, countsRes] = await Promise.all([
        supabase.from('chat_rooms').select('id, kind').in('id', sharedIds).eq('kind', 'direct'),
        supabase.from('chat_members').select('room_id').in('room_id', sharedIds),
      ]);

      const size = new Map<string, number>();
      for (const m of (countsRes.data || []) as { room_id: string }[]) {
        size.set(m.room_id, (size.get(m.room_id) || 0) + 1);
      }

      const existing = ((roomsRes.data || []) as { id: string }[]).find((r) => size.get(r.id) === 2);
      if (existing) return { roomId: existing.id, error: null };
    }
  }

  // 4. Nothing yet — open a new personal chat.
  const { data: room, error: roomErr } = await supabase
    .from('chat_rooms')
    .insert({
      kind: 'direct',
      title: otherName || 'Личный чат',
      created_by: currentUserId,
    })
    .select('id')
    .single();

  if (roomErr || !room) {
    return { roomId: null, error: 'Не удалось открыть переписку. Попробуйте ещё раз.' };
  }

  const { error: memberErr } = await supabase.from('chat_members').insert([
    { room_id: room.id, user_id: currentUserId, role: 'owner' },
    { room_id: room.id, user_id: otherUserId, role: 'member' },
  ]);

  if (memberErr) {
    return { roomId: null, error: 'Чат создан, но собеседника добавить не удалось. Попробуйте ещё раз.' };
  }

  return { roomId: room.id, error: null };
}
