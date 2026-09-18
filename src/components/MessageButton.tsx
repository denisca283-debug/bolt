import { useState } from 'react';
import { Mail, Loader2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useAuthModal } from './AuthModal';
import { useRouter } from '../router';
import { openDirectChat } from '../lib/chat';

type MessageButtonProps = {
  /** Profile id of the person to write to. */
  targetUserId: string | null | undefined;
  targetName?: string | null;
  label?: string;
  variant?: 'primary' | 'secondary';
  className?: string;
};

/**
 * "Написать" — opens the personal chat with this person and goes to it.
 *
 * Lives in one place so every profile, card and listing behaves the same:
 * a guest is asked to sign in, an existing thread is reused, and a new one
 * is created only when there isn't one.
 */
export function MessageButton({
  targetUserId,
  targetName,
  label = 'Написать',
  variant = 'secondary',
  className = '',
}: MessageButtonProps) {
  const { user } = useAuth();
  const { promptGuest } = useAuthModal();
  const { navigate } = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!targetUserId) return null;
  if (user?.id === targetUserId) return null;

  const handleClick = async () => {
    if (!user) {
      promptGuest({ message: 'Чтобы написать сообщение, войдите в FilmVerse или создайте аккаунт.' });
      return;
    }
    setBusy(true);
    setError(null);
    const { roomId, error: err } = await openDirectChat(user.id, targetUserId);
    setBusy(false);
    if (err || !roomId) {
      setError(err || 'Не удалось открыть переписку.');
      return;
    }
    navigate(`/messages/${roomId}`);
  };

  return (
    <div className="inline-flex flex-col items-start gap-1.5">
      <button
        onClick={handleClick}
        disabled={busy}
        className={`${variant === 'primary' ? 'btn-primary' : 'btn-secondary'} ${className}`}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
        {label}
      </button>
      {error && <p className="text-xs text-danger-700 max-w-[260px] leading-snug">{error}</p>}
    </div>
  );
}
