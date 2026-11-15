/**
 * Everything 13 needs to know about the event it is shooting into.
 *
 * Three sources, merged here so the screen does not have to:
 *
 *  - **the server** — the event row and the caller's roll (`getRollState`,
 *    then every `claim_shot()` answer the upload queue relays);
 *  - **the upload queue** — frames shot but not yet counted, which the counter
 *    subtracts so an offline guest cannot overdraw their roll;
 *  - **a local copy of the last server answer** — so the camera opens with no
 *    signal at all, which at a wedding in a barn is the normal case.
 *
 * The number the screen shows is `shotsLeft`: the server's last count minus the
 * unclaimed frames. It is never incremented locally and never goes below zero.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

import { getSession } from '@/lib/auth';
import { getEvent, subscribeToEventStatus, type Event } from '@/lib/events';
import { getRollState, type RollState } from '@/lib/photos';
import { pendingCount, subscribeToQueue, unclaimedCount } from '@/lib/upload-queue';

type Snapshot = { event: Event; roll: RollState; userId: string };

const cacheKey = (eventId: string) => `left.camera.${eventId}`;

async function readCache(eventId: string, userId: string): Promise<Snapshot | null> {
  try {
    const stored = await AsyncStorage.getItem(cacheKey(eventId));
    const snapshot = stored ? (JSON.parse(stored) as Snapshot) : null;
    // A copy written under another account on this phone is not this guest's roll.
    return snapshot?.userId === userId ? snapshot : null;
  } catch {
    return null;
  }
}

function writeCache(snapshot: Snapshot) {
  void AsyncStorage.setItem(cacheKey(snapshot.event.id), JSON.stringify(snapshot)).catch(() => {});
}

/** Of two answers about the same roll, the one that has seen more frames. */
function newer(a: RollState, b: RollState): RollState {
  return b.shotsTaken >= a.shotsTaken ? b : a;
}

export type CameraSession =
  | { status: 'loading' }
  | { status: 'error'; reload: () => void }
  | {
      status: 'ready';
      event: Event;
      userId: string;
      /** What the counter shows. Null on the unlimited roll. */
      shotsLeft: number | null;
      /** Frames of this event still on the phone — shot, not yet uploaded. */
      pending: number;
      /** The cameras have closed: by status, or by the clock passing `ends_at`. */
      developed: boolean;
      reload: () => void;
    };

export function useCameraSession(eventId: string | undefined): CameraSession {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [failed, setFailed] = useState(false);
  const [counts, setCounts] = useState({ unclaimed: 0, pending: 0 });
  const [clockEnded, setClockEnded] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const reload = useCallback(() => {
    setFailed(false);
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!eventId) {
      setFailed(true);
      return;
    }
    let cancelled = false;

    async function load(id: string) {
      let userId: string | undefined;
      try {
        // Reads the stored session — works with no network.
        userId = (await getSession())?.user.id;
      } catch {
        userId = undefined;
      }
      if (cancelled) return;
      if (!userId) {
        setFailed(true);
        return;
      }

      const cached = await readCache(id, userId);
      if (cancelled) return;
      if (cached) setSnapshot((current) => current ?? cached);

      try {
        const event = await getEvent(id);
        const roll = await getRollState(id, userId, event.roll_size);
        if (cancelled) return;

        const uid = userId;
        setSnapshot((current) => {
          const next = {
            event,
            userId: uid,
            roll: current && current.userId === uid ? newer(current.roll, roll) : roll,
          };
          writeCache(next);
          return next;
        });
      } catch {
        // Offline with a copy: shoot from the copy. Without one there is nothing to show.
        if (!cancelled && !cached) setFailed(true);
      }
    }

    void load(eventId);
    return () => {
      cancelled = true;
    };
  }, [eventId, attempt]);

  // The queue: counts on every change, and the server's count on every claim.
  useEffect(() => {
    if (!eventId) return;

    const read = () =>
      setCounts({ unclaimed: unclaimedCount(eventId), pending: pendingCount(eventId) });
    read();

    return subscribeToQueue((change) => {
      if (change.type === 'changed') {
        read();
      } else if (change.eventId === eventId) {
        if (change.type === 'claimed') {
          // In the same batch as the count, so the number never flickers up.
          read();
          setSnapshot((current) => {
            if (!current) return current;
            const next = { ...current, roll: newer(current.roll, change.roll) };
            writeCache(next);
            return next;
          });
        } else {
          // The server said no. Ask it where things stand rather than guessing.
          reload();
        }
      }
    });
  }, [eventId, reload]);

  // The host developing early, or the scheduled job catching up with the clock.
  useEffect(() => {
    if (!eventId) return;
    return subscribeToEventStatus(eventId, (status) => {
      setSnapshot((current) => {
        if (!current || current.event.status === status) return current;
        const next = { ...current, event: { ...current.event, status } };
        writeCache(next);
        return next;
      });
    });
  }, [eventId]);

  // The clock. `ends_at` closes the cameras to the second, with or without a signal.
  const endsAt = snapshot?.event.ends_at;
  useEffect(() => {
    if (!endsAt) return;
    const remaining = new Date(endsAt).getTime() - Date.now();
    if (remaining <= 0) {
      setClockEnded(true);
      return;
    }
    setClockEnded(false);
    // setTimeout overflows past ~24.8 days; an event that far out re-arms on remount.
    const timer = setTimeout(() => setClockEnded(true), Math.min(remaining, 2_000_000_000));
    return () => clearTimeout(timer);
  }, [endsAt]);

  if (!snapshot) return failed ? { status: 'error', reload } : { status: 'loading' };

  const { event, roll, userId } = snapshot;
  return {
    status: 'ready',
    event,
    userId,
    shotsLeft: roll.shotsLeft === null ? null : Math.max(0, roll.shotsLeft - counts.unclaimed),
    pending: counts.pending,
    developed: event.status === 'developed' || clockEnded,
    reload,
  };
}
