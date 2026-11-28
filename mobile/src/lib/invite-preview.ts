/**
 * The invitation, as a guest may read it before joining (1.3.0).
 *
 * RLS hides an event from everyone who is not a member, and 11 is shown
 * before the join. `invite_preview()` (migration 20261128000000) hands out
 * what the invitation says — name, host, image, end, roll — to a signed-in
 * holder of the code, and nothing else.
 *
 * A server from before that migration has no such function: the call throws,
 * and 11 falls back to asking for the name alone.
 */

import { LOOKS } from '@/constants/looks';
import type { FilmLook } from './events';
import { getSupabase } from './supabase';

export type InvitePreview = {
  eventId: string;
  name: string;
  hostName: string | null;
  look: FilmLook;
  /** `events.cover`: null, 'sample-N' or 'upload'. */
  cover: string | null;
  endsAt: Date;
  /** null is the unlimited roll. */
  rollSize: number | null;
  developed: boolean;
};

function asLook(value: string): FilmLook {
  return LOOKS.some((look) => look.id === value) ? (value as FilmLook) : LOOKS[0].id;
}

/** null when the code names no event. Needs a session (anonymous counts). */
export async function getInvitePreview(inviteCode: string): Promise<InvitePreview | null> {
  const { data, error } = await getSupabase().rpc('invite_preview', {
    p_invite_code: inviteCode,
  });
  if (error) throw error;

  const row = data?.[0];
  if (!row) return null;

  return {
    eventId: row.event_id,
    name: row.name,
    // Nullable in SQL (a subselect, a column without a value); the generated
    // types cannot say so.
    hostName: (row.host_name as string | null) ?? null,
    look: asLook(row.look),
    cover: (row.cover as string | null) ?? null,
    endsAt: new Date(row.ends_at),
    rollSize: (row.roll_size as number | null) ?? null,
    developed: row.status === 'developed',
  };
}
