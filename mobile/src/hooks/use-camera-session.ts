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
 *
 * **Missions** come along when the event has them and is live: the server's
 * deal (`getMyMissions`, cached per event for a phone with no signal), with
 * the tags still in the upload queue laid over it (`withQueuedTags`) — so a
 * mission reads as done the moment its shot is queued, and as open again if
 * the server refuses the tag. Nothing is counted locally as truth.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { getSession } from '@/lib/auth';
import { getEvent, subscribeToEventStatus, type Event } from '@/lib/events';
import type { Mission } from '@/lib/missions';
import { cachedMissions, fetchMissions, withQueuedTags } from '@/lib/my-shots';
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
      /**
       * The guest's missions, with queued tags applied. Empty when missions are
       * off, before the event is live, or when none were dealt.
       */
      missions: Mission[];
      reload: () => void;
    };

/** Missions are only dealt, and only worth asking for, while the event is live. */
const hasMissions = (event: Event) => event.missions_per_guest != null && event.status === 'live';

export function useCameraSession(eventId: string | undefined): CameraSession {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [failed, setFailed] = useState(false);
  const [counts, setCounts] = useState({ unclaimed: 0, pending: 0 });
  const [clockEnded, setClockEnded] = useState(false);
  const [attempt, setAttempt] = useState(0);
  /** The server's last answer about the missions (or the cached one). */
  const [serverMissions, setServerMissions] = useState<Mission[]>([]);
  /** Bumped on every queue change, so the owed tags are laid over again. */
  const [queueVersion, setQueueVersion] = useState(0);
  /** Bumped when a tag reached the server or was dropped: ask the server again. */
  const [missionsVersion, setMissionsVersion] = useState(0);

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

  // Missions: the cached answer at once, then the server's (which deals them on
  // the first call). A failed request keeps what there was — offline is normal.
  const userId = snapshot?.userId;
  const missionsOn = snapshot ? hasMissions(snapshot.event) : false;
  useEffect(() => {
    if (!eventId || !userId) return;
    if (!missionsOn) {
      setServerMissions([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      const cached = await cachedMissions(eventId, userId);
      if (cancelled) return;
      if (cached) setServerMissions(cached);
      try {
        const fresh = await fetchMissions(eventId, userId);
        if (!cancelled) setServerMissions(fresh);
      } catch {
        // Keep the cached copy.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId, userId, missionsOn, missionsVersion, attempt]);

  // The queue: counts on every change, and the server's count on every claim.
  useEffect(() => {
    if (!eventId) return;

    const read = () => {
      setCounts({ unclaimed: unclaimedCount(eventId), pending: pendingCount(eventId) });
      setQueueVersion((n) => n + 1);
    };
    read();

    return subscribeToQueue((change) => {
      if (change.type === 'changed') {
        read();
      } else if (change.eventId === eventId) {
        if (change.type === 'mission') {
          setMissionsVersion((n) => n + 1);
        } else if (change.type === 'claimed') {
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

  const missions = useMemo(
    () => (eventId && missionsOn ? withQueuedTags(eventId, serverMissions) : []),
    // `queueVersion` stands for the queue's contents, which live outside React.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [eventId, missionsOn, serverMissions, queueVersion]
  );

  if (!snapshot) return failed ? { status: 'error', reload } : { status: 'loading' };

  const { event, roll } = snapshot;
  return {
    status: 'ready',
    event,
    userId: snapshot.userId,
    shotsLeft: roll.shotsLeft === null ? null : Math.max(0, roll.shotsLeft - counts.unclaimed),
    pending: counts.pending,
    developed: event.status === 'developed' || clockEnded,
    missions,
    reload,
  };
}
