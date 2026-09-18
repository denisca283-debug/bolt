import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

// UI affordance only. chat_create_group independently checks permission in SQL.
export function useDiscussionPermission(userId: string | undefined) {
  const [result, setResult] = useState<{ userId: string; allowed: boolean; error: boolean } | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!userId) return;
    setResult(null);
    void (async () => {
      try {
        const { data, error } = await supabase.rpc('can_create_department_chat', { p_user: userId });
        if (!cancelled) setResult({ userId, allowed: !error && data === true, error: !!error });
      } catch {
        if (!cancelled) setResult({ userId, allowed: false, error: true });
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);
  const current = userId && result?.userId === userId ? result : null;
  return {
    allowed: current?.allowed === true,
    reason: !userId ? 'Войдите, чтобы проверить права.'
      : !current ? 'Проверяем разрешение…'
      : current.error ? 'Не удалось проверить разрешение. Обновите страницу и попробуйте ещё раз.'
      : 'Требуется отдельное разрешение FilmVerse на профессиональные обсуждения. Подписка PRO не предоставляет это право.',
  };
}
