/**
 * The shared time budget — the one thing in LEFT that must never be decided on
 * the device.
 *
 * Recording is a transaction against the database in two halves:
 *
 *   1. reserveBudget() on record-start takes a **place in the queue** and tells
 *      you your cap. Honour `grantedSeconds`: 0 means the group is out of time.
 *   2. commitReservation() on record-stop reports the true length. The server
 *      then settles as much of the event's queue as it can. Discarded takes call
 *      releaseReservation() instead.
 *
 * **A hold is no longer exclusive.** Every member sees the same number —
 * `budget_seconds - used_seconds`, which `availableSeconds()` returns — and
 * everyone may film against it at once. That is deliberate: holds used to
 * subtract from what everyone else could see, so the first person to press
 * record locked the whole group out of a budget that was supposed to be shared.
 *
 * Overspending is prevented at settlement instead, **in the order takes
 * started**. Which is why a commit has three possible answers, not one:
 *
 *   'charged'  settled; `usedAfter` is authoritative and includes this take
 *   'dropped'  an earlier take used the last of the budget; no clip exists
 *   'waiting'  an earlier take is still rolling, so this one's charge is not
 *              knowable yet — subscribeToMyTakes() delivers the verdict later
 *
 * 'waiting' is not a failure and not a retry. Someone who stopped filming while
 * a longer take that started before theirs is still running genuinely cannot be
 * billed yet: the answer depends on how long that take turns out to be.
 *
 * Never add up durations locally and write a total.
 */

import { subscribeToChanges } from './realtime';
import { getSupabase } from './supabase';
import type { Database } from '@/types/database';

type ReservationRow = Database['public']['Tables']['budget_reservations']['Row'];

export type Reservation = {
  /**
   * Null when nothing was granted.
   *
   * `reserve_budget` returns `(null, 0, available)` rather than raising when
   * the pool is empty, so this is nullable in practice and the compiler should
   * say so — check `grantedSeconds` before reaching for it.
   */
  reservationId: string | null;
  /** Your cap for this recording. Stop the camera here. 0 = no budget left. */
  grantedSeconds: number;
  remainingAfter: number;
};

/** How a finished take ended up. See the header — 'waiting' is a real answer. */
export type TakeStatus = 'charged' | 'dropped' | 'waiting';

export type TakeOutcome = {
  status: TakeStatus;
  /** Null while waiting, and null forever if dropped. */
  clipId: string | null;
  /** What the group was actually charged. 0 when dropped or still waiting. */
  chargedSeconds: number;
  /**
   * `events.used_seconds` after this call, straight from the row.
   *
   * The single most useful number here. It is authoritative and — when the
   * status is 'charged' — it already contains this take, so a client can adopt
   * it and drop its own provisional count in the same breath, instead of trying
   * to work out from realtime deltas whether its own commit has landed yet.
   * That guesswork is what used to make a 10s take read as 22.
   */
  usedAfter: number;
  budgetSeconds: number;
};

/**
 * Seconds the group has left — the number every member sees.
 *
 * Blind to live holds on purpose. Someone else pressing record must not make
 * this fall on your phone, or the toast and the bar disagree with each other.
 */
export async function availableSeconds(eventId: string): Promise<number> {
  const { data, error } = await getSupabase().rpc('available_seconds', { p_event_id: eventId });
  if (error) throw error;
  return data ?? 0;
}

/**
 * Claim a place in the queue. Call this before the camera starts rolling, not
 * after — `created_at` on the reservation is what "started first" means when
 * two takes cannot both fit.
 */
export async function reserveBudget(eventId: string, seconds: number): Promise<Reservation> {
  const { data, error } = await getSupabase().rpc('reserve_budget', {
    p_event_id: eventId,
    p_seconds: seconds,
  });
  if (error) throw error;

  const row = data?.[0];
  if (!row) throw new Error('reserve_budget returned no row');

  return {
    reservationId: row.reservation_id,
    grantedSeconds: row.granted_seconds,
    remainingAfter: row.remaining_after,
  };
}

/**
 * Report a finished take's real length and settle what can be settled.
 *
 * The server caps the charge at the shorter of what was filmed, what was held,
 * and what the budget actually has left after every take that started earlier —
 * so reporting a longer duration than you reserved cannot overspend the group.
 */
export async function commitReservation(
  reservationId: string,
  actualSeconds: number
): Promise<TakeOutcome> {
  const { data, error } = await getSupabase().rpc('commit_reservation', {
    p_reservation_id: reservationId,
    p_actual_seconds: actualSeconds,
  });
  if (error) throw error;

  const row = data?.[0];
  if (!row) throw new Error('commit_reservation returned no row');

  return {
    status: row.status as TakeStatus,
    clipId: row.clip_id,
    chargedSeconds: row.charged_seconds,
    usedAfter: row.used_after,
    budgetSeconds: row.budget_seconds,
  };
}

/** Give a place in the queue back without charging — for a discarded take. */
export async function releaseReservation(reservationId: string): Promise<number> {
  const { data, error } = await getSupabase().rpc('release_reservation', {
    p_reservation_id: reservationId,
  });
  if (error) throw error;
  return data ?? 0;
}

/**
 * Live budget updates for every member's progress bar.
 *
 * Returns an unsubscribe function — call it on unmount.
 */
export function subscribeToBudget(
  eventId: string,
  onChange: (budget: { usedSeconds: number; budgetSeconds: number }) => void
): () => void {
  return subscribeToChanges(
    `event:${eventId}:budget`,
    { event: 'UPDATE', schema: 'public', table: 'events', filter: `id=eq.${eventId}` },
    (change) => {
      const row = change.new as { used_seconds: number; budget_seconds: number };
      onChange({ usedSeconds: row.used_seconds, budgetSeconds: row.budget_seconds });
    }
  );
}

/** The verdict on a take that came back 'waiting'. */
export type TakeResolution = {
  reservationId: string;
  /**
   * 'released' is **not** a verdict on the budget, and folding it into
   * 'dropped' is what told people the group had run out of time when it had not.
   *
   * `charged_seconds = 0` is written by three different things and only one of
   * them is a settlement: `resolve_takes()` charging nothing because an earlier
   * take took the last of the pool; `release_reservation()` handing a hold back
   * for a take nobody wants (a stray tap, a sub-second take, a camera that
   * errored, a screen left mid-take); and the walker sweeping a hold that
   * expired. The 0 alone cannot tell them apart.
   *
   * `committed_at` can. Only `commit_reservation()` sets it, so a row that
   * reaches 0 *with* it was filmed, reported, and genuinely outbid — while a row
   * that reaches 0 without it was never a take at all, and its owner already
   * knows why.
   */
  status: 'charged' | 'dropped' | 'released';
  /** The clip it became. Null when dropped or released. */
  clipId: string | null;
  chargedSeconds: number;
};

/**
 * How a take of yours that came back 'waiting' finally ended.
 *
 * A separate subscription from `subscribeToBudget` because it answers a
 * different question and cannot be derived from that one: a **dropped** take
 * moves `used_seconds` by nothing and creates no clip, so there is no other
 * signal that it is over. The reservation row is the only place the verdict
 * lands.
 *
 * Both filters below are load-bearing. RLS on `budget_reservations` lets a
 * member read *everyone's* holds in their event — it was written so a client
 * could show "somebody else is filming right now" — so the channel really does
 * carry other people's rows, and `user_id` is what keeps them out. And
 * `resolved_at` matters because the row is UPDATEd at commit time as well, and
 * that update is not a verdict.
 */
export function subscribeToMyTakes(
  eventId: string,
  selfUserId: string,
  onResolved: (resolution: TakeResolution) => void
): () => void {
  return subscribeToChanges(
    `event:${eventId}:my-takes`,
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'budget_reservations',
      filter: `event_id=eq.${eventId}`,
    },
    (change) => {
      const row = change.new as unknown as ReservationRow;
      if (row.user_id !== selfUserId || row.resolved_at === null) return;

      const charged = row.charged_seconds ?? 0;
      onResolved({
        reservationId: row.id,
        status: charged > 0 ? 'charged' : row.committed_at ? 'dropped' : 'released',
        clipId: row.clip_id,
        chargedSeconds: charged,
      });
    }
  );
}
