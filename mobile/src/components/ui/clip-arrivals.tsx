/**
 * 18 · "Anna added 10 seconds" — raised from anywhere in the app.
 *
 * This used to live on the camera screen, which meant only the people already
 * looking at a viewfinder were told the pool they share had just got smaller.
 * That is precisely backwards: someone waiting on screen 12, or browsing their
 * films, is the person who most needs to hear that the budget is going. So the
 * subscription is mounted once beside `ToastProvider` in the root layout and
 * follows the user's live event wherever they are in the app.
 *
 * It renders nothing. All it owns is the answer to "which event is live, and who
 * am I", which is the pair `subscribeToClipArrivals` needs.
 *
 * Three things it deliberately does not do:
 *
 *  - **It does not tell you about your own take.** That filter lives inside
 *    `subscribeToClipArrivals`, so no consumer can forget it.
 *  - **It does not reach a phone in a pocket.** There is no push infrastructure
 *    in this app — no device tokens, no APNs — so this is an *in-app* banner and
 *    nothing more. A member who has the app closed learns nothing until they
 *    open it. That gap is real and is recorded in CLAUDE.md.
 *  - **It does not quote `remaining_seconds`.** `availableSeconds` is the shared
 *    figure the budget bar draws; the other one subtracts live holds and would
 *    drop the moment somebody merely *started* filming, contradicting the bar.
 */

import { useEffect, useRef, useState } from 'react';
import type { PropsWithChildren } from 'react';

import { useToast } from '@/components/ui/toast-host';
import { getSession } from '@/lib/auth';
import { subscribeToClipArrivals } from '@/lib/clip-events';
import { subscribeToChanges } from '@/lib/realtime';
import { listMyEvents, type Event } from '@/lib/events';
import { updateBudgetActivity } from '@/lib/live-activity';
import { readPrefs } from '@/lib/notification-prefs';
import { getSupabase } from '@/lib/supabase';

export function ClipArrivalsProvider({ children }: PropsWithChildren) {
  const toast = useToast();

  const [selfUserId, setSelfUserId] = useState<string | null>(null);
  const [wantsClipToasts, setWantsClipToasts] = useState(false);
  const [live, setLive] = useState<Event | null>(null);

  /*
    The live event, readable without depending on it. The arrivals callback needs
    `budget_seconds` to turn "what is left" into "what has been used" for 19's
    card, and taking the row as a dependency would tear the channel down and
    rebuild it on every budget tick — dropping any arrival that landed in the gap.
  */
  const liveRef = useRef<Event | null>(null);
  useEffect(() => {
    liveRef.current = live;
  }, [live]);

  const liveEventId = live?.id;

  /*
    Who we are, and whether 20's switch wants these at all.

    Re-read on every auth change: a guest signs in anonymously partway through
    the app's life, and a provider that only looked once at launch would never
    notify them. Both default to silence, so an unreadable session or preference
    errs toward saying nothing rather than toward noise.
  */
  useEffect(() => {
    let cancelled = false;

    async function read() {
      try {
        const session = await getSession();
        const userId = session?.user?.id ?? null;
        if (cancelled) return;

        setSelfUserId(userId);
        setWantsClipToasts(userId ? (await readPrefs(userId)).clipFilmed : false);
      } catch {
        // Stay silent. Nothing else in the app depends on this succeeding.
      }
    }

    void read();

    const { data } = getSupabase().auth.onAuthStateChange(() => {
      void read();
    });

    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, []);

  /*
    Which event is live.

    Seeded from one read, then kept current from realtime on `public.events`.
    RLS limits that stream to events this user belongs to, so no filter is needed
    and none would be right — the whole point is to notice an event *becoming*
    live, which is a row this provider is not yet watching.

    The payload is used directly rather than triggering a refetch: `events` is
    `replica identity full`, so the row arrives complete, and re-querying on every
    `used_seconds` tick would be one round trip per clip filmed by anybody.
  */
  useEffect(() => {
    if (!selfUserId) {
      setLive(null);
      return;
    }

    let cancelled = false;

    void listMyEvents()
      .then((events) => {
        if (!cancelled) setLive(events.find((e) => e.status === 'live') ?? null);
      })
      .catch(() => {
        // No banner until an event turns up on the realtime stream instead.
      });

    const unsubscribe = subscribeToChanges(
      'my-live-event',
      { event: '*', schema: 'public', table: 'events' },
      (change) => {
        const row = change.new as unknown as Event | undefined;
        if (!row?.id) return;

        setLive((current) => {
          if (row.status === 'live') return row;
          // The one we were watching has ended; anything else is not ours to hold.
          return current?.id === row.id ? null : current;
        });
      }
    );

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [selfUserId]);

  useEffect(() => {
    if (!liveEventId || !selfUserId || !wantsClipToasts) return;

    return subscribeToClipArrivals(liveEventId, selfUserId, ({ clip, author, remainingSeconds }) => {
      /*
        `duration_seconds` is the charged whole second, not the raw length of the
        file — the server writes the charge — so this is the same number the
        person's own bar moved by, and the same one the group is billed.
      */
      const seconds = Math.round(clip.duration_seconds);
      const left = remainingSeconds === null ? null : Math.max(0, Math.round(remainingSeconds));

      toast.show({
        initials: author.initials,
        title: `${author.name} added ${seconds} ${seconds === 1 ? 'second' : 'seconds'}`,
        /* Dropped rather than guessed when unreadable: a number that disagrees
           with the budget bar is worse than no number. */
        message: left === null ? undefined : `${left}s left`,
      });

      /*
        The same news, on the lock screen. Sent from here rather than from a
        budget effect because this is the only place the *author* is known, and
        the author is what turns 19's card from a gauge into a sentence.
      */
      const budgetSeconds = liveRef.current?.budget_seconds;
      if (budgetSeconds !== undefined && left !== null) {
        void updateBudgetActivity({
          usedSeconds: Math.max(0, budgetSeconds - left),
          budgetSeconds,
          lastFilmedBy: author.name,
          lastClipSeconds: seconds,
        });
      }
    });
  }, [liveEventId, selfUserId, wantsClipToasts, toast]);

  return <>{children}</>;
}
