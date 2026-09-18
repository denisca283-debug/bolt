import { supabase } from './supabase';

export type OpenChatResult =
  | { roomId: string; error: null }
  | { roomId: null; error: string };

/** Client-generated id, used as an idempotency key by the chat functions. */
export function newRequestId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  // Fallback for older browsers: good enough as a request key.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Turn a Postgres error into something a person can act on.
 * 42501 is the code the chat functions raise for "you may not do this".
 */
function readableError(err: { code?: string; message?: string } | null, fallback: string) {
  if (!err) return fallback;
  if (err.code === '42501') return 'Недостаточно прав для этого действия.';
  if (err.code === 'P0002') return 'Пользователь не найден.';
  if (err.code === 'PGRST202' || err.message?.includes('does not exist')) {
    return 'Раздел сообщений ещё не готов в базе — не применена миграция 011_secure_messaging_core.';
  }
  return err.message || fallback;
}

/**
 * Open (or reopen) the personal 1:1 chat with someone and return its id.
 *
 * Writing to the chat tables directly is blocked by RLS on purpose — they
 * carry SELECT policies only. Every write goes through a SECURITY DEFINER
 * function that checks membership itself, so this calls the database's
 * `get_or_create_direct_chat`, which also handles two people pressing
 * "Написать" at the same moment without creating two rooms.
 */
export async function openDirectChat(
  currentUserId: string,
  otherUserId: string
): Promise<OpenChatResult> {
  if (!currentUserId) return { roomId: null, error: 'Войдите, чтобы написать сообщение.' };
  if (currentUserId === otherUserId) return { roomId: null, error: 'Это ваш собственный профиль.' };

  const { data, error } = await supabase.rpc('get_or_create_direct_chat', {
    other_user_id: otherUserId,
  });

  if (error || !data) {
    return { roomId: null, error: readableError(error, 'Не удалось открыть переписку. Попробуйте ещё раз.') };
  }
  return { roomId: data as string, error: null };
}

/** Create a group (or department) chat. Department rooms need the trust rule. */
export async function createGroupChat(params: {
  title: string;
  memberIds: string[];
  departmentId?: string | null;
}): Promise<OpenChatResult> {
  const { data, error } = await supabase.rpc('chat_create_group', {
    p_title: params.title,
    p_members: params.memberIds,
    p_department: params.departmentId ?? null,
    p_request: newRequestId(),
  });

  if (error || !data) {
    return {
      roomId: null,
      error: params.departmentId
        ? readableError(error, 'База не разрешила создать чат департамента. Нужны подписка Про и две пройденные верификации.')
        : readableError(error, 'Не удалось создать чат. Попробуйте ещё раз.'),
    };
  }
  return { roomId: data as string, error: null };
}

/** Send a message. `requestId` makes a retry after a lost reply harmless. */
export async function sendChatMessage(
  roomId: string,
  body: string,
  requestId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('chat_send', {
    p_room: roomId,
    p_body: body,
    p_id: requestId,
  });
  if (error) return { error: readableError(error, 'Сообщение не отправилось. Попробуйте ещё раз.') };
  return { error: null };
}

/** Mark the room read up to a message, so unread counts can work later. */
export async function markChatRead(roomId: string, messageId: string): Promise<void> {
  try {
    await supabase.rpc('chat_mark_read', { p_room: roomId, p_message: messageId });
  } catch {
    // Best-effort: a failed read receipt must never block the conversation.
  }
}
