import { supabase } from './supabase';

export type PulseKind =
  | 'role'
  | 'crew-search'
  | 'portfolio'
  | 'join'
  | 'spots'
  | 'marketplace'
  | 'team-complete';

function initialsOf(name: string) {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

/**
 * Write one line into "Пульс индустрии".
 *
 * The feed is the by-product of real activity: publishing a listing, a job or
 * a project each drop a line here. It is deliberately best-effort — a failed
 * pulse entry must never make the user think their listing was not published.
 */
export async function addPulse(params: {
  userId: string;
  kind: PulseKind;
  person: string;
  action: string;
  target?: string | null;
  photoUrl?: string | null;
}): Promise<void> {
  try {
    await supabase.from('pulse_feed').insert({
      user_id: params.userId,
      kind: params.kind,
      person: params.person,
      initials: initialsOf(params.person || 'FV'),
      photo_url: params.photoUrl ?? null,
      action: params.action,
      target: params.target ?? null,
    });
  } catch {
    // Silent on purpose — see the note above.
  }
}
