/**
 * One realtime channel per topic, shared by everyone watching it.
 *
 * Every `subscribeToX` in this folder used to build its own channel:
 *
 *     supabase.channel(`event:${id}:budget`).on('postgres_changes', …).subscribe()
 *
 * which is a bug in two ways, and both of them fire on the same gesture —
 * leaving the camera for "your films" and walking back in.
 *
 * 1. `supabase.channel(topic)` does **not** always hand back a new channel. It
 *    looks the topic up first and returns the existing one if it finds it. So a
 *    second caller under the same name gets an already-joined channel, and
 *    `.on('postgres_changes', …)` on a joined channel throws outright:
 *    *cannot add `postgres_changes` callbacks for realtime:event:…:budget after
 *    `subscribe()`*. That is the crash.
 *
 * 2. `removeChannel()` is not synchronous. It sends a leave and only drops the
 *    channel from the client's list once the server acknowledges. Between the
 *    unmount and that ack — a round trip, longer on a bad connection — the old
 *    channel is still sitting there under its name, so even a *correctly*
 *    cleaned-up screen can remount into (1).
 *
 * This module fixes both. Listeners are reference-counted per logical topic, so
 * two screens watching the same event share one channel and one binding, and the
 * channel is only removed when the last of them leaves. And the topic actually
 * put on the wire carries a per-channel suffix, so a channel that is still
 * saying goodbye can never be mistaken for the fresh one taking its place.
 *
 * The suffix is invisible to the server's change routing: postgres_changes are
 * matched on the binding's schema/table/filter, never on the channel name.
 */

import { getSupabase } from './supabase';

/** What to listen for. Mirrors supabase-js's postgres_changes filter. */
export type ChangeFilter = {
  event: '*' | 'INSERT' | 'UPDATE' | 'DELETE';
  schema: string;
  table?: string;
  /** PostgREST-style, e.g. `event_id=eq.${eventId}`. */
  filter?: string;
};

/**
 * A row change off the wire.
 *
 * `new` is empty on DELETE and `old` carries only the replica identity, which is
 * why both are loose maps here — callers cast the half they asked for. Every
 * table this app subscribes to is `replica identity full`, so on INSERT and
 * UPDATE `new` really is the whole row.
 */
export type Change = {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  schema: string;
  table: string;
  new: Record<string, unknown>;
  old: Record<string, unknown>;
};

type Listener = (change: Change) => void;

type Entry = {
  channel: ReturnType<ReturnType<typeof getSupabase>['channel']>;
  listeners: Set<Listener>;
};

/** Live channels, keyed by logical topic (`event:${id}:budget`). */
const entries = new Map<string, Entry>();

/** Makes each wire topic unique. See the header — (2). */
let seq = 0;

/**
 * Listen to postgres changes on `topic`, and stop listening via the returned
 * function.
 *
 * `topic` is the identity of the subscription: two callers passing the same one
 * share a channel, so they must also pass the same `filter` — which they do,
 * because each `subscribeToX` below owns both halves. Anything a single caller
 * cares about and the others do not (whose row it is, say) belongs in that
 * caller's `onChange`, not in the filter.
 *
 * Safe to call from a `useEffect` and tear down on unmount, including the
 * unmount-remount storms that navigation and Fast Refresh produce.
 */
export function subscribeToChanges(
  topic: string,
  filter: ChangeFilter,
  onChange: Listener
): () => void {
  const supabase = getSupabase();

  let entry = entries.get(topic);

  if (!entry) {
    const listeners = new Set<Listener>();

    const channel = supabase
      .channel(`${topic}#${(seq += 1)}`)
      .on('postgres_changes', filter, (payload) => {
        /*
          Iterate a copy: a listener is allowed to unsubscribe from inside its
          own callback — the camera does exactly that when a take resolves — and
          mutating the set mid-iteration would skip the next listener.
        */
        for (const listener of [...listeners]) listener(payload as unknown as Change);
      })
      .subscribe();

    entry = { channel, listeners };
    entries.set(topic, entry);
  }

  const joined = entry;
  joined.listeners.add(onChange);

  let released = false;

  return () => {
    // Idempotent: React can call an effect's cleanup only once, but callers
    // sometimes hold on to this and a double release must not tear down the
    // channel a later subscriber has since built under the same topic.
    if (released) return;
    released = true;

    joined.listeners.delete(onChange);
    if (joined.listeners.size > 0) return;

    // Only if nobody has replaced it in the meantime.
    if (entries.get(topic) === joined) entries.delete(topic);
    void supabase.removeChannel(joined.channel);
  };
}
