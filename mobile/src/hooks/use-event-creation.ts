/**
 * Spending the onboarding draft: pay, then create the event.
 *
 * **This hook used to be the paywall, then was not, and is again.** The purchase
 * machinery below — the settle backoff, the paid-transaction ref, the cancelled
 * sheet handling — moved out to `use-film-unlock.ts` when the ask moved to 17,
 * and has moved back near-verbatim now that there is nothing to sell after the
 * film. Read it as a return rather than a rewrite; the reasoning for each piece
 * is unchanged, only the moment it runs at.
 *
 * The order is pay, then create, and it is that way round for one reason:
 * `create_event()` claims a ledger row in the same transaction as the insert, so
 * a purchase that exists but is never spent is recoverable (it stays unconsumed
 * and pays for the next attempt) while an event that exists but was never paid
 * for is not.
 *
 * **Groups of four or fewer never touch any of this.** `isFreeGroup()` short-
 * circuits straight to `createEvent()` with no transaction id, and the server
 * skips its claim for the same band. The free tier is enforced there, not here.
 */

import { useRef, useState } from 'react';

import { getSession } from '@/lib/auth';
import { messageFor } from '@/lib/auth-errors';
import {
  createEvent,
  isPurchaseUnsettled,
  type CreateEventInput,
  type Event,
} from '@/lib/events';
import {
  identify,
  isPurchaseCancelled,
  PURCHASES_UNAVAILABLE,
  purchaseTier,
} from '@/lib/purchases';
import { isFreeGroup, tierFor } from '@/lib/tiers';

/**
 * Waits between creation attempts while a purchase settles, in ms.
 *
 * Roughly 15s in total. The synchronous reconciliation in the `create-event`
 * function normally makes the first attempt succeed; this covers the case where
 * RevenueCat's records lag their own API. Money has already changed hands by the
 * time this runs, so giving up quickly is the wrong move.
 */
const SETTLE_BACKOFF_MS = [500, 1000, 2000, 4000, 8000] as const;

export type CreationPhase =
  | { kind: 'idle' }
  /** The store's sheet is open. Cancelling returns to idle. */
  | { kind: 'purchasing' }
  /** Paid, but RevenueCat has not told the server yet. Retrying on a backoff. */
  | { kind: 'settling' }
  | { kind: 'creating' }
  /** `recover` offers a way out of a failure the user can actually fix. */
  | { kind: 'error'; message: string; recover?: 'ending' };

export type EventCreation = {
  phase: CreationPhase;
  busy: boolean;
  /** Resolves to the created event, or null when the phase now explains why not. */
  submit: (input: CreateEventInput) => Promise<Event | null>;
  /** Report a failure the hook itself did not raise — a draft that cannot be spent. */
  fail: (message: string, recover?: 'ending') => void;
};

export function useEventCreation(): EventCreation {
  const [phase, setPhase] = useState<CreationPhase>({ kind: 'idle' });

  /*
    The transaction paid for in this session, held so a retry never charges
    twice. A ref rather than state: it must be readable by the very next line
    after it is written, and nothing renders from it.

    It does not survive unmount, which is what Restore Purchases is for — the
    receipt is still in the ledger and still unspent, so the next attempt at any
    group size it covers will find and spend it.
  */
  const paidTransaction = useRef<string | undefined>(undefined);

  const busy = phase.kind === 'purchasing' || phase.kind === 'settling' || phase.kind === 'creating';

  /**
   * Create, waiting out the gap between paying and the server knowing it.
   *
   * The edge function asks RevenueCat directly, so this normally succeeds first
   * time. The backoff is the fallback for when that lookup misses — RevenueCat's
   * own webhook can be seconds behind, and its first retry is five minutes away.
   */
  async function createSettling(input: CreateEventInput): Promise<Event> {
    let lastError: unknown;

    for (const wait of SETTLE_BACKOFF_MS) {
      try {
        return await createEvent(input);
      } catch (e) {
        if (!isPurchaseUnsettled(e)) throw e;
        lastError = e;
        setPhase({ kind: 'settling' });
        await new Promise((resolve) => setTimeout(resolve, wait));
      }
    }

    try {
      return await createEvent(input);
    } catch (e) {
      throw isPurchaseUnsettled(e) ? (lastError ?? e) : e;
    }
  }

  async function submit(input: CreateEventInput): Promise<Event | null> {
    try {
      /*
        The free tier, and the only branch that skips the store entirely. The
        server refuses a paid group size without a receipt whatever this says, so
        a wrong answer here is a bad screen rather than a free event.
      */
      if (isFreeGroup(input.maxMembers)) {
        setPhase({ kind: 'creating' });
        return await createEvent(input);
      }

      // Only charge if this session has not already paid. Re-entering after a
      // settling failure must reuse the receipt, never buy a second one.
      if (!paidTransaction.current) {
        /*
          Bind purchases to the real user first. It is `Purchases.logIn`
          underneath and idempotent for the same id, so calling it here is cheap
          and is the only thing that guarantees the receipt attaches to an account
          rather than to an anonymous RevenueCat id.
        */
        if (!PURCHASES_UNAVAILABLE) {
          const session = await getSession();
          if (!session) throw new Error('You need to be signed in to create an event.');
          await identify(session.user.id);
        }

        setPhase({ kind: 'purchasing' });
        /*
          Priced on the group size on screen. The server compares the receipt
          against `max_members` itself — this only decides which product the store
          sheet shows — and `create_event`'s 15-minute leniency covers the host who
          changes the group while that sheet is open.
        */
        paidTransaction.current = (await purchaseTier(tierFor(input.maxMembers))).transactionId;
      }

      setPhase({ kind: 'creating' });
      const event = await createSettling({ ...input, transactionId: paidTransaction.current });

      /*
        Cleared only once the event exists. The receipt is spent at that point —
        `create_event()` consumed it in the same transaction as the insert — so
        holding it any longer would let a second event try to spend it again.
      */
      paidTransaction.current = undefined;
      return event;
    } catch (e) {
      // A dismissed store sheet should leave nothing behind.
      if (isPurchaseCancelled(e)) {
        setPhase({ kind: 'idle' });
        return null;
      }
      setPhase({ kind: 'error', message: messageFor(e) });
      return null;
    }
  }

  function fail(message: string, recover?: 'ending') {
    setPhase({ kind: 'error', message, recover });
  }

  return { phase, busy, submit, fail };
}
