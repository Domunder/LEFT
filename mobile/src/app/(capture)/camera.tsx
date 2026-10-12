/**
 * 13 · Camera — the core of the app.
 *
 * Where the shared budget is actually spent. Everything else in LEFT exists to
 * get a group of people to this screen with time on the clock.
 *
 * **The budget is server-authoritative and this screen never decrements it.**
 * Recording is a transaction against the database (see lib/budget.ts): a place in
 * the queue is claimed before the camera rolls, and the true length is reported
 * when it stops.
 *
 * **Everyone films against the same number.** A hold hides nothing from anybody,
 * so two people can start with 50s left and both roll. Overspending is prevented
 * at settlement, in the order the takes *started* — which means a commit has
 * three possible answers and only one of them is "done":
 *
 *  - 'charged'  settled. `usedAfter` is authoritative and already contains this
 *               take, so the local provisional count is dropped in the same
 *               React commit that adopts it.
 *  - 'dropped'  somebody who started earlier used the last of the budget. There
 *               is no clip and the take is gone. Said plainly, not swallowed.
 *  - 'waiting'  somebody who started earlier is still rolling, so this take's
 *               charge is not knowable yet. The entry stays in `settling` and
 *               `subscribeToMyTakes` brings the verdict.
 *
 * Two rules keep the bar honest, and both replace arithmetic that got this
 * wrong. `used_seconds` is **monotonic**, so every write goes through a max and
 * a late realtime frame can never drag it backwards. And a pending take is
 * retired **only by an explicit server verdict**, never by inferring from
 * `used_seconds` deltas whether our own commit has landed — that inference is
 * what made a 10s take render as 22.
 *
 * Also worth knowing:
 *
 *  - `reserveBudget` returns `grantedSeconds`, which **may be less than asked
 *    for**, and 0 when the group is out. That number is the hard cap, and it is
 *    handed to `recordAsync({ maxDuration })` so the camera stops itself.
 *  - At 0 granted, `reservationId` comes back **null**. Guarded below.
 *  - `used_seconds` moves for everyone, not just the person filming. It arrives
 *    over realtime, which is why the bar is subscribed rather than computed.
 *
 * The viewfinder is inset and rounded, not full-bleed. `design/README.md` says
 * full-bleed; the artboard insets it 10px at radius 26. The prototype wins.
 *
 * Needs a dev build — recording does not work in Expo Go.
 */

import Constants from 'expo-constants';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS, useSharedValue } from 'react-native-reanimated';

import { ClipBadge } from '@/components/ui/clip-badge';
import { EventCountdown } from '@/components/ui/event-countdown';
import { LiveBudgetBar } from '@/components/ui/live-budget-bar';
import { PillButton } from '@/components/ui/pill-button';
import { RecordButton } from '@/components/ui/record-button';
import { RecPill } from '@/components/ui/rec-pill';
import { Screen } from '@/components/ui/screen';
import { ZoomSelector } from '@/components/ui/zoom-selector';
import { Body, Display, Em, Mono } from '@/components/ui/typography';
import { Camera as CameraTokens, Colors, Spacing } from '@/constants/theme';
import { Typography } from '@/constants/typography';
import { Feather } from '@expo/vector-icons';
import { getSession } from '@/lib/auth';
import { reserveBudget, subscribeToBudget, subscribeToMyTakes } from '@/lib/budget';
import { attachUpload, discardTake, finishTake, subscribeToClipCount } from '@/lib/clips';
import {
  endBudgetActivity,
  startBudgetActivity,
  updateBudgetActivity,
} from '@/lib/live-activity';
import {
  finishEvent,
  getEvent,
  listClips,
  listMyEvents,
  subscribeToEventStatus,
  type Event,
} from '@/lib/events';
import {
  defaultStop,
  pinchStop,
  stopsForLenses,
  supportsLensSwitching,
  type ZoomStop,
} from '@/lib/zoom';

type LoadState = { kind: 'loading' } | { kind: 'ready'; event: Event } | { kind: 'error' };

/**
 * What the camera is doing right now.
 *
 * `reserving` and `stopping` exist so the record button can be held inert across
 * two round trips it would otherwise be tappable during — the window between
 * asking for a hold and the camera rolling is short but real on a venue network.
 * Uploading is deliberately *not* in here: it happens after a take is finished
 * and must not block the next one.
 */
type Phase = 'idle' | 'reserving' | 'recording' | 'stopping';

/**
 * How far a pinch travels through the zoom range.
 *
 * A raw pinch scale runs roughly 0.5–3× in one comfortable gesture, which mapped
 * straight onto 0–1 makes anything but the extremes unreachable. Damped to a
 * fifth so the whole range takes several deliberate pinches to cross.
 */
const PINCH_SENSITIVITY = 0.2;

/**
 * What the group will be charged for a take of this length.
 *
 * Mirrors the server's own cap — `least(ceil(actual), held)` — so the number the
 * bar shows is the integer the group will actually be billed. Applied to the
 * *running* counter as well as the finished one, which is what makes the fill
 * stop dead the instant the finger lifts: a raw fraction would show 10.4, then
 * step to 11 when the commit landed, and a bar that moves after you stopped
 * filming reads as being charged twice.
 *
 * The server is still the authority; this only removes the disagreement.
 */
function chargeFor(seconds: number, grantedSeconds: number): number {
  return Math.min(Math.ceil(seconds), grantedSeconds);
}

export default function CameraScreen() {
  const router = useRouter();
  const { eventId } = useLocalSearchParams<{ eventId?: string }>();

  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [budget, setBudget] = useState({ usedSeconds: 0, budgetSeconds: 0 });
  const [clipCount, setClipCount] = useState(0);

  /*
    Who we are. Needed to tell our own resolved takes apart from everyone else's
    on a channel that carries the whole event.
  */
  const [selfUserId, setSelfUserId] = useState<string | null>(null);

  /**
   * Adopt a server figure for `used_seconds`. Never goes backwards.
   *
   * Nothing in the schema ever decrements `used_seconds`, so the largest number
   * seen is always the truest one. That makes the max not a fudge but the actual
   * invariant, and it is what lets the commit response and the realtime UPDATE
   * race each other freely: whichever arrives second is a no-op instead of a
   * correction, and the bar cannot flicker between them.
   */
  const applyUsed = useCallback((usedSeconds: number, budgetSeconds?: number) => {
    setBudget((current) => ({
      budgetSeconds: budgetSeconds ?? current.budgetSeconds,
      usedSeconds: Math.max(current.usedSeconds, usedSeconds),
    }));
  }, []);

  /*
    How many of our own takes are mid-round-trip, and the highest `used_seconds`
    realtime offered us while they were.

    There is exactly one window in which the server's number and this screen's
    provisional number overlap: between asking the server to settle a take and
    being told what it cost. The realtime UPDATE carrying that very charge
    reliably beats the RPC's own reply — a WAL broadcast against an HTTP round
    trip is not a fair race — so for those few hundred milliseconds the take is
    counted in `usedSeconds` *and* in `settling`, and a 5s take reads as 10
    before snapping back.

    Adopting the frame is what doubles it, so the frame waits. It cannot be lost
    by waiting: whatever it carried is either already inside the `usedAfter` that
    ends the window, or is a later commit that the flush below re-applies — and
    `applyUsed` takes the larger of the two either way.
  */
  const commitsInFlight = useRef(0);
  const deferredUsed = useRef(0);

  /**
   * A `used_seconds` from realtime, which may already contain a take this screen
   * is still counting for itself.
   *
   * `budget_seconds` is not deferred with it — it never changes for an event —
   * so nothing about the bar's scale waits on this.
   */
  const applyRemoteUsed = useCallback(
    (usedSeconds: number, budgetSeconds: number) => {
      if (commitsInFlight.current > 0) {
        deferredUsed.current = Math.max(deferredUsed.current, usedSeconds);
        return;
      }
      applyUsed(usedSeconds, budgetSeconds);
    },
    [applyUsed]
  );

  /** Open the window. Pair with `endVerdict` on **every** path, errors included. */
  const beginVerdict = useCallback(() => {
    commitsInFlight.current += 1;
  }, []);

  /**
   * Close it, and let through anything that arrived meanwhile.
   *
   * Call this *after* the take has been retired, so the flush lands in the same
   * React commit as the retirement rather than one render before it.
   */
  const endVerdict = useCallback(() => {
    commitsInFlight.current = Math.max(0, commitsInFlight.current - 1);
    if (commitsInFlight.current > 0) return;

    const held = deferredUsed.current;
    deferredUsed.current = 0;
    if (held > 0) applyUsed(held);
  }, [applyUsed]);

  const [phase, setPhase] = useState<Phase>('idle');
  const [clipSeconds, setClipSeconds] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);

  /*
    Takes that have stopped filming but whose charge has not reached us yet.

    The bar must never run backwards. Between `stopRecording` and the server
    settling the take, it is charged nowhere this screen can see — dropping it
    from the pending count the instant the phase leaves 'recording' made the fill
    snap back and then jump forward again a moment later. Each finished take
    stays counted here, under its own key, until the server rules on it.

    Keyed by reservation because several takes can be settling at once: filming
    again while the previous upload is still in flight is expected, not an edge
    case, so a single number would be overwritten by whichever take stopped last.

    An entry leaves only on an explicit verdict from the server — 'charged' with
    the authoritative `used_seconds` that contains it, or 'dropped'. It is never
    inferred from `used_seconds` moving, because "the number went up by 11" does
    not say *whose* 11 it was.
  */
  const [settling, setSettling] = useState<Record<string, number>>({});

  /** Drop a take from the pending count. The one way out of `settling`. */
  const retire = useCallback((reservationId: string) => {
    setSettling((current) => {
      if (!(reservationId in current)) return current;
      const { [reservationId]: _dropped, ...rest } = current;
      return rest;
    });
  }, []);

  /*
    The cap on the take being filmed right now, as state rather than only as a
    ref, because the bar's provisional charge is computed during render and
    `chargeFor` needs it. 0 between takes.
  */
  const [grantedSeconds, setGrantedSeconds] = useState(0);

  const [torch, setTorch] = useState(false);
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [cameraReady, setCameraReady] = useState(false);
  /*
    Bumped to throw the native capture session away and build a fresh one, which
    is the only repair there is for a session that has lost the audio route (see
    the catch in `start`). It rides in the `key` below alongside `facing`, so a
    rebuild is exactly the same teardown a flip does.
  */
  const [sessionEpoch, setSessionEpoch] = useState(0);
  /* Latches on the first ready preview and never clears, so the placeholder
     label is a cold-start affordance only. */
  const [hasPreviewed, setHasPreviewed] = useState(false);

  /*
    What this phone's rear camera can actually do. Empty until asked, and only
    ever populated on iOS — `getAvailableLensesAsync` is iOS-only, and everywhere
    else the stops fall back to the digital ladder.
  */
  const [lenses, setLenses] = useState<string[]>([]);
  const stops = useMemo(
    () => stopsForLenses(supportsLensSwitching(facing) ? lenses : []),
    [lenses, facing]
  );
  const [zoom, setZoom] = useState<ZoomStop>(() => defaultStop(stopsForLenses([])));

  /*
    The live zoom fraction, mirrored for the pinch gesture. The gesture runs on
    the UI thread and cannot read React state, so it accumulates from here.
  */
  const zoomBase = useSharedValue(0);
  const zoomAtPinchStart = useSharedValue(0);

  const [cameraPermission, requestCamera] = useCameraPermissions();
  const [micPermission, requestMic] = useMicrophonePermissions();

  const cameraRef = useRef<CameraView>(null);

  /*
    The live hold. A ref rather than state because the stop path reads it from
    inside callbacks that were created before it was set, and because a stale
    render must never be able to settle a reservation twice.
  */
  const reservation = useRef<{ id: string; grantedSeconds: number } | null>(null);

  /*
    Where a waiting take's file already went, keyed the same way as `settling`.

    A take that comes back 'waiting' has been uploaded but has no clip row to
    point at the file yet. The path is parked here until the verdict arrives and
    `attachUpload` can finish the join. Nothing else can hold it: the clip id is
    minted by whichever *other* member's commit finally drains the queue.
  */
  const waitingPaths = useRef<Record<string, string>>({});

  /*
    Verdicts that arrived before the take that earned them had finished
    reporting itself.

    Narrow but real: if the earlier take stops within our own commit's round
    trip, the resolution can reach `subscribeToMyTakes` before `finishTake`
    returns 'waiting' and parks its path — and the two halves would then miss
    each other, leaving a charged clip pointing at nothing while its file sits
    in the bucket. Whichever half arrives second does the join.
  */
  const resolvedTakes = useRef<Record<string, { clipId: string | null }>>({});

  /*
    When the current take started rolling, and how long it had run when the
    camera was told to stop.

    `recordAsync`'s promise resolves only once the file has been finalised, which
    on a real device is seconds after the last frame was captured. Timing the
    promise therefore measures recording *plus* muxing and charged the group for
    both — a two-second take arriving as six. `stoppedAt` is stamped the instant
    the stop is requested, which is the last moment anything was still being
    filmed, and that is the number the group is billed for.

    Null when the camera reached `maxDuration` and ended the take itself: nobody
    asked it to stop, so the length is the granted cap.
  */
  const startedAt = useRef(0);
  const stoppedAt = useRef<number | null>(null);

  /* Guards a double-tap from firing two reserve_budget calls. */
  const busy = useRef(false);

  /* One finish_event call per visit, however many renders see an empty budget. */
  const finishing = useRef(false);

  const event = state.kind === 'ready' ? state.event : undefined;
  const eventName = event?.name ?? '';
  const liveEventId = event?.id;

  /*
    Everything this device is spending but the server has not confirmed: the take
    being filmed right now, plus every take that has stopped and is still waiting
    for its charge to come back. Counted against the pool here and not just in the
    bar, because the exhausted state keys off it — and a warning that only arrived
    once a clip had committed would arrive after the moment it was useful.
  */
  const settlingSeconds = useMemo(
    () => Object.values(settling).reduce((sum, n) => sum + n, 0),
    [settling]
  );
  /*
    `clipSeconds` counts through 'stopping' as well as 'recording'. Dropping it
    the instant the button was pressed left the take charged nowhere the bar
    could see it — the settling entry is not written until `recordAsync` resolves
    a beat later — and the fill visibly fell back before jumping forward again.
    The counter freezes at the stop (see the REC effect), so this holds a steady
    number across the handover rather than a growing one.

    Run through `chargeFor`, so the bar counts in the whole seconds the group is
    actually billed rather than in the fraction being filmed. Stopping at 10.4s
    then leaves the fill exactly where it already was, instead of nudging it once
    more after the finger came off the button.
  */
  const pending =
    (phase === 'recording' || phase === 'stopping' ? chargeFor(clipSeconds, grantedSeconds) : 0) +
    settlingSeconds;

  /*
    What is left once this phone's own unsettled takes are counted — which the
    server's number cannot yet know about.

    Used only to decide whether the group is out (`exhausted` below). A *new*
    reservation is measured against `shared` instead, because a hold is not
    supposed to hide budget from anybody, this device included.
  */
  const remaining = Math.max(0, budget.budgetSeconds - budget.usedSeconds - pending);

  /* The number every member sees, and the one a new take is measured against. */
  const shared = Math.max(0, budget.budgetSeconds - budget.usedSeconds);

  /*
    How much of *this take's* cap is spent, for the record button's ring.

    Deliberately measured against `grantedSeconds` rather than
    `CameraTokens.maxTakeSeconds`: near the end of a pool the grant is the
    remaining budget, which is smaller, and a ring drawn against the cap would
    still be a third full when the camera stopped. The grant is what the camera
    is actually stopping at, so it is what the ring has to track.

    Null when nothing has been granted — the button draws no ring at rest.
  */
  const takeProgress =
    grantedSeconds > 0 && (phase === 'recording' || phase === 'stopping')
      ? clipSeconds / grantedSeconds
      : undefined;

  /* Only truly exhausted once nothing is in flight — mid-take the camera is
     already stopping itself at the granted cap, and a take still settling has
     not had its real length charged yet. Finishing the event on a provisional
     number would end it for everyone a beat early. */
  const exhausted =
    budget.budgetSeconds > 0 &&
    remaining <= 0 &&
    phase !== 'recording' &&
    settlingSeconds === 0;
  const permitted = Boolean(cameraPermission?.granted && micPermission?.granted);

  /* The bar above the viewfinder carries the last-stretch warning on its own;
     this line is reserved for real failures. */
  const message = notice;

  /*
    Resolve the event the same way 10 does: the param when one was passed, else
    the newest event this user belongs to. The fallback is what makes a warm start
    onto this route work — and screen 12 relied on it entirely until it started
    passing the id.
  */
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const found = eventId ? await getEvent(eventId) : (await listMyEvents())[0];
        if (cancelled) return;

        if (!found) {
          setState({ kind: 'error' });
          return;
        }

        setState({ kind: 'ready', event: found });
        /* Through `applyUsed` like every other write, so a re-read landing after
           a commit cannot roll the bar back to a number it has already passed. */
        applyUsed(found.used_seconds, found.budget_seconds);
        setClipCount((await listClips(found.id)).length);
      } catch {
        if (!cancelled) setState({ kind: 'error' });
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [eventId, applyUsed]);

  /*
    Keyed on the id string rather than the event object — a re-read returning an
    equal-but-new row would otherwise tear both channels down and rebuild them,
    dropping any change that landed in between.
  */
  useEffect(() => {
    if (!liveEventId) return;
    return subscribeToBudget(liveEventId, (next) =>
      applyRemoteUsed(next.usedSeconds, next.budgetSeconds)
    );
  }, [liveEventId, applyRemoteUsed]);

  /*
    The verdict on a take that came back 'waiting'.

    This is the *only* thing that retires such a take, and it is a statement
    about that specific reservation rather than an inference from the budget
    moving. The version of this screen that inferred it — "has `used_seconds`
    risen by at least what this take was charged?" — is what put 22 on a 10s
    take: the realtime UPDATE routinely beat the commit response, so the entry
    it was supposed to retire had not been recorded yet, and nothing ever
    re-ran the check.

    The event is re-read before the entry is dropped rather than after, so the
    server's number is already carrying the take by the time the local one lets
    go of it. Skipping that would show a dip on the frame in between.
  */
  useEffect(() => {
    if (!liveEventId || !selfUserId) return;

    return subscribeToMyTakes(liveEventId, selfUserId, (resolution) => {
      void (async () => {
        beginVerdict();

        try {
          const fresh = await getEvent(liveEventId);
          if (fresh) applyUsed(fresh.used_seconds, fresh.budget_seconds);
        } catch {
          /*
            Retire anyway. The take is settled whether or not we could read the
            new total, and holding it locally would double-count it the moment
            the realtime UPDATE lands. `applyUsed` is monotonic, so that UPDATE
            still corrects the number upward on its own.
          */
        }

        retire(resolution.reservationId);
        resolvedTakes.current[resolution.reservationId] = { clipId: resolution.clipId };
        endVerdict();

        /*
          Nothing to attach either way, but only one of the two is worth saying.

          A **released** hold is a take this phone itself threw away — a stray
          tap, a take under `minClipSeconds`, a camera that refused to roll, a
          screen left mid-take. It reaches here because `release_reservation()`
          resolves the row at 0 exactly as a real drop does, and announcing it as
          one told two people sharing a full budget that somebody had used the
          last of the time. Worse, it landed a beat *after* whatever `start()`
          had already put on screen, so it replaced the real explanation with a
          wrong one.

          Retire it and say nothing: whoever released it knows why, and the
          budget never moved.
        */
        if (resolution.status !== 'charged') {
          delete waitingPaths.current[resolution.reservationId];
          if (resolution.status === 'dropped') {
            setNotice(
              'Someone who started before you used the last of the time, so that take was not kept.'
            );
          }
          return;
        }

        /*
          Charged at last — point the clip row at the file already in the bucket.
          Absent when the commit has not come back yet, in which case `settle`
          does this instead; see `resolvedTakes`.
        */
        const path = waitingPaths.current[resolution.reservationId];
        if (path && resolution.clipId) {
          delete waitingPaths.current[resolution.reservationId];
          void attachUpload(resolution.clipId, path);
        }
      })();
    });
  }, [liveEventId, selfUserId, applyUsed, retire, beginVerdict, endVerdict]);

  useEffect(() => {
    if (!liveEventId) return;
    return subscribeToClipCount(liveEventId, setClipCount);
  }, [liveEventId]);

  /*
    Read who we are.

    Separate from the event load because it answers a different question and must
    not fail with it. Without it a waiting take never learns its verdict, so the
    failure is quiet but not harmless — hence the dev log.
  */
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const session = await getSession();
        const userId = session?.user?.id;
        if (!cancelled && userId) setSelfUserId(userId);
      } catch (e) {
        if (__DEV__) console.log('[camera] could not read the session:', e);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  /*
    18 · the in-app banner is **not** raised here any more.

    It lives in `ClipArrivalsProvider`, mounted in the root layout, because a
    member who is not on the camera screen still needs to be told that the pool
    they are sharing just got smaller. Subscribing here as well would show every
    banner twice.
  */

  /*
    19 · the lock-screen Live Activity.

    Started when this screen has a live event, ended when it goes away — so the
    activity's lifetime is the filming session, not the app's. Everything in
    lib/live-activity.ts is a no-op off iOS, in Expo Go, and on any build made
    before the config plugin landed, so nothing here needs its own guard.

    **It only updates while the app is foregrounded.** Reaching a backgrounded
    app's activity needs an ActivityKit push token and an APNs push, neither of
    which exists — so a phone in a pocket shows the budget as of the last time
    its owner looked. Worth knowing before trusting the number on the lock screen.
  */
  useEffect(() => {
    if (state.kind !== 'ready') return;

    const event = state.event;
    if (event.status !== 'live') return;

    void startBudgetActivity(event);
    return () => {
      void endBudgetActivity();
    };
    // Keyed on the id, not the row: a re-read returning an equal-but-new object
    // would otherwise end and restart the activity for no reason.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveEventId]);

  /* Feed it the same numbers the on-screen bar is drawing. */
  useEffect(() => {
    if (!liveEventId || budget.budgetSeconds === 0) return;
    void updateBudgetActivity({
      usedSeconds: budget.usedSeconds,
      budgetSeconds: budget.budgetSeconds,
    });
  }, [liveEventId, budget.usedSeconds, budget.budgetSeconds]);

  /*
    A flip tears the preview down and builds a new one, so readiness has to be
    surrendered until the new one reports back. Without this the button stays
    enabled across the gap and can call into a camera that no longer exists.

    Readiness only comes back because the `key` below remounts `CameraView` on a
    flip. Changing `facing` alone reconfigures the native session in place and
    never fires `onCameraReady` a second time, which used to strand the record
    button disabled — and the placeholder label up — for the rest of the session.

    A rebuild after a capture failure (`sessionEpoch`) is the same teardown, so it
    surrenders readiness the same way.
  */
  useEffect(() => {
    setCameraReady(false);
  }, [facing, sessionEpoch]);

  /* Keep the gesture's copy in step with the selection. */
  useEffect(() => {
    zoomBase.value = zoom.zoom;
  }, [zoom.zoom, zoomBase]);

  /*
    Ask the camera what lenses it has, once it is ready and whenever it flips.

    Only meaningful on iOS and only for the rear camera; elsewhere this resolves
    to nothing and the digital stops stand. Failure is silent on purpose — a
    phone that will not answer still gets a working zoom control.
  */
  useEffect(() => {
    if (!permitted || !cameraReady || Platform.OS !== 'ios') return;

    let cancelled = false;

    void cameraRef.current
      ?.getAvailableLensesAsync()
      .then((found) => {
        if (cancelled) return;
        setLenses(found);

        /*
          Worth saying out loud in development, because the failure is silent:
          `getAvailableLensesAsync` resolves to `[]` rather than throwing when the
          native module cannot answer — which is what happens in Expo Go. An empty
          result and a single-lens iPhone are indistinguishable from here, and both
          land on the digital stops, so without this log there is no way to tell
          "this phone has one lens" from "this build cannot see them".
        */
        if (__DEV__) {
          console.log(
            found.length > 0
              ? `[camera] lenses: ${found.join(', ')}`
              : '[camera] no lenses reported — Expo Go, or a single-lens device. Using digital zoom.'
          );
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [permitted, cameraReady, facing]);

  /*
    Snap back to a stop this device offers when the available set changes —
    flipping to the front camera drops the optical stops, and a selection left
    pointing at a lens that is no longer there would black the preview out.
  */
  useEffect(() => {
    setZoom((current) =>
      stops.some((stop) => stop.label === current.label) ? current : defaultStop(stops)
    );
  }, [stops]);

  /*
    Pinching keeps whichever lens is selected and moves only the digital range on
    top of it — pinching in on a telephoto should zoom that lens further, not drop
    back to wide. The label goes empty, so no pill claims to be selected at a
    value that sits between the stops.
  */
  const applyPinch = useCallback((next: number) => {
    setZoom((current) => pinchStop(next, current.lens));
  }, []);

  const pinch = useMemo(
    () =>
      Gesture.Pinch()
        .onStart(() => {
          zoomAtPinchStart.value = zoomBase.value;
        })
        .onUpdate((e) => {
          const next = Math.min(
            1,
            Math.max(0, zoomAtPinchStart.value + (e.scale - 1) * PINCH_SENSITIVITY)
          );
          zoomBase.value = next;
          runOnJS(applyPinch)(next);
        }),
    [applyPinch, zoomAtPinchStart, zoomBase]
  );

  /*
    Out of time: end the event for the whole group.

    Called by whichever member's phone notices first — `finish_event()` is
    idempotent and row-locked, so the others' calls are harmless no-ops. Not
    gated on being the host: the host may have pocketed their phone, and the
    budget belongs to everyone.

    Failure is deliberately quiet. Another member's phone will manage it, the
    server refuses anyway if any budget is somehow left, and the "Finish the
    film" button below stays as an explicit fallback.
  */
  useEffect(() => {
    if (!liveEventId || !exhausted || finishing.current) return;

    finishing.current = true;
    void finishEvent(liveEventId).catch(() => {
      finishing.current = false;
    });
  }, [liveEventId, exhausted]);

  /*
    Follow the event off 'live'.

    **This is what ends the event for every member rather than for one.** A
    member who never pressed record — or who was mid-idle when someone else spent
    the last second — is carried to 14 by this, not by anything they did.
  */
  useEffect(() => {
    if (!liveEventId) return;
    return subscribeToEventStatus(liveEventId, (status) => {
      if (status === 'processing' || status === 'ready') {
        router.replace({ pathname: '/(capture)/processing', params: { eventId: liveEventId } });
      }
    });
  }, [liveEventId, router]);

  /*
    The REC counter. Local only — the authoritative length is what the file says.

    Measured against a start timestamp rather than accumulated a tick at a time.
    A counter that incremented on each interval reported a full second the moment
    recording began and drifted further with every dropped frame, so the bar
    could claim more of the budget than had actually been filmed and then jump
    back when the real charge arrived. Ticking four times a second keeps the
    readout responsive while the value stays honest.
  */
  useEffect(() => {
    if (phase !== 'recording') return;

    const from = Date.now();
    startedAt.current = from;
    stoppedAt.current = null;
    setClipSeconds(0);

    const tick = setInterval(() => {
      setClipSeconds((Date.now() - from) / 1000);
    }, 250);

    /*
      Cleared but not zeroed. The phase leaving 'recording' is the take ending,
      not the take being forgotten: `pending` keeps reading this value through
      'stopping' until the settling entry replaces it, so zeroing here would
      reintroduce the very dip this counter is holding the bar steady across.
    */
    return () => clearInterval(tick);
  }, [phase]);

  /**
   * Stop the camera.
   *
   * `stopRecording()` returns void; the file's uri arrives on the promise that
   * `recordAsync()` returned, which is where the take is actually settled. This
   * only asks.
   */
  const stop = useCallback(() => {
    if (phase !== 'recording') return;
    /* The last instant anything was being filmed. Everything after this is the
       file being written, and the group is not charged for that. */
    stoppedAt.current = Date.now();
    setPhase('stopping');
    cameraRef.current?.stopRecording();
  }, [phase]);

  /*
    Backgrounding mid-take. iOS tears the capture session down when the app
    leaves the foreground, so the recording ends whether or not we ask — asking
    means the promise resolves through the normal settle path instead of being
    abandoned with a live hold on the group's budget.
  */
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') stop();
    });
    return () => sub.remove();
  }, [stop]);

  /*
    Leaving the screen with a hold still open.

    Backgrounding is handled above, but navigating away is not the same event and
    fires no AppState change — without this, walking out of the camera mid-take
    would leave the group short those seconds until the hold expired fifteen
    minutes later. Runs on unmount only, and reads the ref rather than state
    because the cleanup closes over the render that mounted it.

    `stopRecording` first so the file is finalised rather than abandoned mid-write,
    then the hold goes back. The take itself is lost either way — there is no
    screen left to settle it against — but the budget is not.
  */
  useEffect(
    () => () => {
      cameraRef.current?.stopRecording();

      const abandoned = reservation.current;
      reservation.current = null;
      if (abandoned) void discardTake(abandoned.id);
    },
    []
  );

  /**
   * Settle a finished take: charge it, create the clip, upload the file.
   *
   * Not awaited by the record handler. The group is charged and the clip row
   * exists the moment the commit returns; the upload can take minutes on a venue
   * network, and blocking the button until it lands would stop someone filming
   * the next thing that happens.
   */
  const settle = useCallback(
    async (uri: string, seconds: number) => {
      const held = reservation.current;
      reservation.current = null;
      if (!held || !liveEventId) return;

      /*
        Too short to be worth charging the group for. Released rather than
        committed — see Camera.minClipSeconds for why this case exists at all.
      */
      if (seconds < CameraTokens.minClipSeconds) {
        /* Clear defensively: the stop handler declines to register takes this
           short, but nothing else should depend on those two agreeing. */
        retire(held.id);
        await discardTake(held.id);
        return;
      }

      /*
        Carry the take in the pending count until the verdict lands. The record
        handler has normally registered it already, at the same instant it
        cleared the local counter; this repeats that write only for the paths
        that reach here without it (a take settled from somewhere other than the
        stop handler). Writing the same value twice is harmless.
      */
      const provisional = chargeFor(seconds, held.grantedSeconds);
      setSettling((s) => (s[held.id] === provisional ? s : { ...s, [held.id]: provisional }));

      /*
        The window opens before the request and closes the moment the verdict is
        in — **not** when `finishTake` resolves, which is after the upload. An
        upload can run for minutes on a venue network, and holding other members'
        clips off the bar for that long to avoid a 200ms overlap would be a much
        worse trade. `onCommitted` is what separates the two.
      */
      beginVerdict();
      let closed = false;
      const closeVerdict = () => {
        if (closed) return;
        closed = true;
        endVerdict();
      };

      try {
        const session = await getSession();
        const userId = session?.user.id;
        if (!userId) throw new Error('No session');

        const result = await finishTake({
          reservationId: held.id,
          eventId: liveEventId,
          userId,
          localUri: uri,
          seconds: provisional,
          onCommitted: (outcome) => {
            /*
              The authoritative instant. Adopting `usedAfter` and dropping the
              local entry happen in one React commit, so the take is never
              counted twice and never counted by nobody — and closing the window
              here lets any realtime frame that was held back through, on the
              same commit.
            */
            if (outcome.status === 'charged') {
              applyUsed(outcome.usedAfter, outcome.budgetSeconds);
              retire(held.id);
            } else if (outcome.status === 'dropped') {
              retire(held.id);
              setNotice(
                'Someone who started before you used the last of the time, so that take was not kept.'
              );
            }

            closeVerdict();
          },
        });

        if (result.status === 'waiting') {
          /*
            Somebody who started before us is still filming, so what this take
            costs depends on how long *they* turn out to run. Hold it at the
            provisional figure — the bar keeps showing the seconds as spent,
            which is the safe direction — and let the takes subscription retire
            it. The file is already uploaded; only the row it belongs to is
            missing, and its path waits here for `attachUpload`.
          */
          if (result.storagePath) {
            /* The verdict may already have landed while we were waiting on this
               response. If it did, nobody else is coming to do the join. */
            const already = resolvedTakes.current[held.id];
            if (already) {
              delete resolvedTakes.current[held.id];
              if (already.clipId) void attachUpload(already.clipId, result.storagePath);
            } else {
              waitingPaths.current[held.id] = result.storagePath;
            }
          }
          return;
        }

        /* Already retired and explained by `onCommitted`; nothing was uploaded. */
        if (result.status === 'dropped') return;

        if (!result.uploaded) {
          setNotice('That clip is saved but hasn’t uploaded yet. It will finish when the connection improves.');
        }
      } catch {
        /*
          The commit itself failed, so nothing was charged and no clip exists.
          Hand the place in the queue back rather than leaving everyone who
          started after us waiting on it. The pending count goes with it — there
          is no charge coming to replace it.
        */
        retire(held.id);
        await discardTake(held.id);
        setNotice('That clip couldn’t be saved. Check your connection and try again.');
      } finally {
        /* The commit may have thrown before `onCommitted` ever ran. */
        closeVerdict();
      }
    },
    [liveEventId, applyUsed, retire, beginVerdict, endVerdict]
  );

  /**
   * Start a take.
   *
   * The hold comes first and the camera second, always. Reserving after rolling
   * would mean filming footage the group might not be able to afford.
   */
  const start = useCallback(async () => {
    if (!liveEventId || busy.current) return;

    busy.current = true;
    setNotice(null);
    setPhase('reserving');

    try {
      /*
        Ask against the **shared** figure, not our own local remainder — but never
        for more than one take is allowed to be.

        The server no longer subtracts other members' holds, so `shared` is what
        everybody sees and everybody may claim, and claiming it is not greedy: the
        grant is a cap on this take, not a promise of seconds, and whether the
        seconds are really ours is decided at settlement by who started first.

        `maxTakeSeconds` is the other ceiling, and it is the one that does not
        vary. A member with nine minutes left still gets twenty seconds, because
        the pool is shared and one uncapped take would let one person spend all of
        it — and because a film cut from many short shots is the group's film,
        while one cut from four long holds is one person's.

        Asking for the cap rather than the pool is belt-and-braces: `reserve_budget`
        applies the same `least()` server-side, so an out-of-date client is capped
        anyway. Asking for it here is what makes `maxDuration` and the countdown
        below agree with what the group will actually be charged.
      */
      const held = await reserveBudget(
        liveEventId,
        Math.max(1, Math.min(CameraTokens.maxTakeSeconds, Math.ceil(shared)))
      );

      /*
        Out of time. `reservationId` is null in this case — the RPC returns
        (null, 0, available) rather than raising — so this branch must come
        before anything touches it.
      */
      if (held.grantedSeconds <= 0 || !held.reservationId) {
        setPhase('idle');
        setNotice('The group is out of filming time.');
        return;
      }

      reservation.current = { id: held.reservationId, grantedSeconds: held.grantedSeconds };

      setGrantedSeconds(held.grantedSeconds);
      setClipSeconds(0);
      setPhase('recording');

      /*
        maxDuration is the hard stop: the camera ends the take itself at the
        granted cap, so a phone that loses its connection mid-recording still
        cannot overspend. The promise resolves when it does, exactly as it does
        for a manual stop.
      */
      const camera = cameraRef.current;
      if (!camera) throw new Error('The camera is not ready yet');

      const started = Date.now();
      startedAt.current = started;
      stoppedAt.current = null;

      const result = await camera.recordAsync({
        maxDuration: held.grantedSeconds,
      });

      /*
        How long was actually filmed — not how long this promise took to settle.

        `recordAsync` resolves once the file is finalised, and muxing a take runs
        for seconds after the last frame. Billing the promise charged the group
        for the write as well as the recording, which is how a two-second take
        arrived as six. `stoppedAt` is when the stop was asked for; when the
        camera hit `maxDuration` on its own nothing stamped it, and the take ran
        exactly as long as it was granted.
      */
      const elapsed =
        stoppedAt.current !== null
          ? (stoppedAt.current - startedAt.current) / 1000
          : Math.min((Date.now() - started) / 1000, held.grantedSeconds);

      stoppedAt.current = null;

      /*
        Register the take *before* the phase drops, so the seconds are never
        uncounted. `settle` runs detached and does not reach its own
        `setSettling` until after an await, which left a gap the bar rendered as
        a backwards jump. Doing it here makes the handover atomic within one
        commit: the local counter goes and the settling entry arrives together.
      */
      const stopped = reservation.current;
      if (result?.uri && stopped && elapsed >= CameraTokens.minClipSeconds) {
        setSettling((s) => ({ ...s, [stopped.id]: chargeFor(elapsed, stopped.grantedSeconds) }));
      }

      /*
        Both in the same commit, so the seconds move from the live counter to the
        settling entry without a frame in between where neither holds them.
      */
      setPhase('idle');
      setClipSeconds(0);

      if (result?.uri) {
        void settle(result.uri, elapsed);
      } else {
        /* No file — the take produced nothing to charge for. */
        const abandoned = reservation.current;
        reservation.current = null;
        if (abandoned) await discardTake(abandoned.id);
      }
    } catch (e) {
      setPhase('idle');
      setClipSeconds(0);

      const abandoned = reservation.current;
      reservation.current = null;
      if (abandoned) await discardTake(abandoned.id);

      /*
        Two very different failures land here and they need different words: the
        reservation round-trip failing (network, RLS, no session) and the camera
        itself refusing to roll. Saying "the camera stopped" for a failed request
        sends you looking at the wrong thing entirely.
      */
      const raw = e instanceof Error ? e.message : String(e);
      /*
        The message alone is not enough to act on. `recordAsync` rejects with the
        same "An error occurred while recording a video" string for a genuine
        capture failure, a missing recorder and an interrupted session — so the
        expo module's `code` is the part that separates them, along with what the
        camera was actually asked for.
      */
      if (__DEV__) {
        console.log('[camera] record failed:', raw, {
          expoGo: isExpoGo(),
          platform: Platform.OS,
          code: (e as { code?: string })?.code ?? null,
          askedMaxDuration: abandoned?.grantedSeconds ?? null,
          cameraReady,
          hadCamera: cameraRef.current !== null,
        }, e);
      }

      /*
        A capture failure is not a passing glitch — the session is in a state it
        will not recover from on its own, and every press after it fails the same
        way until something rebuilds it.

        The cause is the audio route. There is one AVAudioSession per process;
        expo-video pins it to `.playback` for any live player and never hands it
        back, while the capture session needs `.playAndRecord`, which it claims
        once, when it starts. Lose that race — an ambient loop still playing on a
        screen below this one, a clip that was paused on the way here — and the
        recorder has a microphone it is not allowed to use, so `recordAsync`
        rejects the instant it starts.

        `background-video.tsx` is where that race is actually settled; this is the
        safety net for every other way it can be lost. Rebuilding the session is
        the same repair as flipping the camera, which is how this failure was
        first worked around by hand — the difference is that the next press now
        just works, instead of the fix having to be discovered.
      */
      if (rebuildableFailure(raw)) setSessionEpoch((n) => n + 1);

      setNotice(recordErrorMessage(raw));
    } finally {
      busy.current = false;
    }
  }, [liveEventId, shared, settle]);

  /**
   * The record button.
   *
   * Permissions are asked for here rather than on mount: arriving at a camera
   * screen and being interrogated by two system dialogs before seeing anything is
   * how permission prompts get denied. The first press is when the request has an
   * obvious reason attached to it.
   */
  const handleRecord = useCallback(async () => {
    if (phase === 'recording') {
      stop();
      return;
    }
    if (phase !== 'idle' || exhausted) return;

    if (!cameraPermission?.granted) {
      const granted = await requestCamera();
      if (!granted.granted) return;
    }
    if (!micPermission?.granted) {
      const granted = await requestMic();
      if (!granted.granted) return;
    }

    void start();
  }, [
    phase,
    exhausted,
    stop,
    start,
    cameraPermission?.granted,
    micPermission?.granted,
    requestCamera,
    requestMic,
  ]);

  const blocked =
    cameraPermission?.canAskAgain === false || micPermission?.canAskAgain === false;

  return (
    <Screen padded={false} edges={[]}>
      <View style={styles.header}>
        <Text style={styles.eventName} numberOfLines={1}>
          {eventName}
        </Text>
      </View>

      <View style={styles.barRow}>
        <LiveBudgetBar
          usedSeconds={budget.usedSeconds}
          budgetSeconds={budget.budgetSeconds}
          pendingSeconds={pending}
        />
      </View>

      <View style={styles.viewfinder}>
        <View style={styles.frame}>
          {permitted ? (
            /*
              The detector wraps a plain View rather than the CameraView itself.
              Gesture handler attaches to the native view its child renders, and
              a component that manages its own native surface is not a reliable
              target — the pinch silently never fires. A wrapper it fully owns is.
            */
            <GestureDetector gesture={pinch}>
              <View style={StyleSheet.absoluteFill} collapsable={false}>
                <CameraView
                  key={`${facing}-${sessionEpoch}`}
                  ref={cameraRef}
                  style={StyleSheet.absoluteFill}
                  mode="video"
                  facing={facing}
                  enableTorch={torch}
                  zoom={zoom.zoom}
                  /* Only ever passed when the device reported the lens — naming
                     one a phone does not have blacks the preview out. */
                  selectedLens={zoom.lens}
                  onCameraReady={() => {
                    setCameraReady(true);
                    setHasPreviewed(true);
                  }}
                />
              </View>
            </GestureDetector>
          ) : (
            <View style={styles.permission}>
              {state.kind === 'loading' ? (
                <ActivityIndicator size="small" color={Colors.textMuted} />
              ) : (
                <>
                  <Display size="xs" style={styles.permissionHeadline}>
                    Let LEFT <Em>see and hear.</Em>
                  </Display>
                  <Body small style={styles.permissionBody}>
                    {blocked
                      ? 'Camera or microphone access is off for LEFT. Turn both on in Settings to film.'
                      : 'Your clips need the camera and the microphone. Nothing records until you press the button.'}
                  </Body>
                  {blocked ? (
                    <PillButton label="Open Settings" onPress={() => void Linking.openSettings()} />
                  ) : null}
                </>
              )}
            </View>
          )}

          {phase === 'recording' ? (
            <RecPill
              seconds={Math.floor(clipSeconds)}
              /*
                The grant, not the cap. They differ on the last take of a pool,
                and the grant is what the camera stops at — so it is what the
                countdown has to promise.
              */
              limitSeconds={grantedSeconds > 0 ? grantedSeconds : undefined}
            />
          ) : null}

          {/* The artboard's placeholder label, kept for the moment before the preview
              first lights up. Deliberately not shown again across a flip: the
              outgoing preview stays on screen until the new one takes over, so
              there is nothing blank to label. */}
          {permitted && !cameraReady && !hasPreviewed ? (
            <View style={styles.feedLabel} pointerEvents="none">
              <Mono color={Colors.textGhost}>camera feed</Mono>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.controls}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={torch ? 'Turn the light off' : 'Turn the light on'}
          accessibilityState={{ selected: torch }}
          onPress={() => setTorch((on) => !on)}
          style={styles.circleButton}>
          <Feather
            name="zap"
            size={CameraTokens.controls.flashIconSize}
            color={CameraTokens.controls.flashColor[torch ? 1 : 0]}
          />
        </Pressable>

        <ZoomSelector stops={stops} selected={zoom.label} onSelect={setZoom} />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Switch camera"
          /* Flipping mid-take ends the recording on both platforms, so it is
             simply unavailable while one is running rather than silently
             truncating someone's clip. */
          disabled={phase !== 'idle'}
          onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
          style={[styles.circleButton, phase !== 'idle' && styles.dimmed]}>
          <Feather
            name="refresh-cw"
            size={CameraTokens.controls.flipIconSize}
            color={CameraTokens.controls.flipColor}
          />
        </Pressable>
      </View>

      {message ? (
        <View style={styles.noticeRow}>
          <Body small color={Colors.textMuted} style={styles.notice}>
            {message}
          </Body>
        </View>
      ) : null}

      {/*
        Out of time. The film is finished by definition — the budget running out
        is the product's own end condition — so the screen offers the way onward
        rather than leaving someone tapping a dead button.
      */}
      {exhausted ? (
        <View style={styles.finishRow}>
          <PillButton
            label="Finish the film"
            onPress={() =>
              router.replace({
                pathname: '/(capture)/processing',
                params: liveEventId ? { eventId: liveEventId } : {},
              })
            }
          />
        </View>
      ) : null}

      <View style={styles.bottom}>
        <View style={styles.bottomSide}>
          {event ? <EventCountdown endsAt={event.ends_at} /> : null}
        </View>

        <RecordButton
          recording={phase === 'recording'}
          progress={takeProgress}
          /*
            `cameraReady` is load-bearing, not cosmetic. expo-camera's own docs
            say to wait for onCameraReady before calling into the camera, and
            recordAsync on a preview that has not finished initialising throws —
            which is what "the camera stopped unexpectedly" used to be, on the
            first press after landing on the screen.
          */
          disabled={
            exhausted ||
            phase === 'reserving' ||
            phase === 'stopping' ||
            !event ||
            (permitted && !cameraReady)
          }
          onPress={() => void handleRecord()}
        />

        <View style={[styles.bottomSide, styles.bottomRight]}>
          <ClipBadge count={clipCount} onPress={() => router.push('/(library)/films')} />
        </View>
      </View>
    </Screen>
  );
}

/**
 * Turn a thrown record failure into something a user can act on.
 *
 * The bare "camera stopped unexpectedly" this used to always show was
 * misleading: most failures here are not the camera at all, they are the
 * reservation round-trip that has to succeed before it rolls.
 */
/**
 * True when running inside Expo Go rather than a dev or production build.
 *
 * `appOwnership` is 'expo' only in Expo Go; it is null everywhere else. Used to
 * tell a missing native recorder apart from a real capture failure, since both
 * surface the same message.
 */
function isExpoGo(): boolean {
  return Constants.appOwnership === 'expo';
}

/**
 * Is this the failure a fresh capture session can fix?
 *
 * Only the camera's own capture failure qualifies. A failed reservation is a
 * network problem and a missing recorder is Expo Go — throwing the session away
 * would fix neither and would blank the preview for a moment on the way.
 */
function rebuildableFailure(raw: string): boolean {
  return raw.toLowerCase().includes('an error occurred while recording') && !isExpoGo();
}

function recordErrorMessage(raw: string): string {
  const lower = raw.toLowerCase();

  if (lower.includes('network request failed') || lower.includes('fetch')) {
    return __DEV__
      ? "Can't reach Supabase, so no filming time could be reserved. Check EXPO_PUBLIC_SUPABASE_URL and restart the dev server."
      : 'No connection, so this clip could not be started. Try again in a moment.';
  }

  /*
    The camera module is missing rather than broken — Expo Go has no recorder.

    Expo Go does not report this as "unimplemented": `recordAsync` rejects with
    the generic "An error occurred while recording a video", which is the same
    string a genuine capture failure produces. Matched here as well, because in
    Expo Go it is overwhelmingly the missing recorder rather than a real fault,
    and sending someone to check their camera hardware would be a wild goose
    chase. On a dev build the message below is the honest one.
  */
  if (lower.includes('unimplemented') || lower.includes('not implemented')) {
    return 'Recording needs a development build — it does not work in Expo Go.';
  }

  if (lower.includes('an error occurred while recording')) {
    return isExpoGo()
      ? 'Recording needs a development build — it does not work in Expo Go.'
      : 'The camera stopped before it could save that take. Try again.';
  }

  if (lower.includes('not authenticated') || lower.includes('jwt')) {
    return 'Your session expired. Reopen the app to keep filming.';
  }

  if (lower.includes('not a member')) {
    return 'You are no longer part of this event.';
  }

  return __DEV__ ? `Recording failed: ${raw}` : 'That take could not be started. Try again.';
}

const styles = StyleSheet.create({
  header: {
    paddingTop: CameraTokens.headerPaddingTop,
    paddingBottom: CameraTokens.headerPaddingBottom,
    paddingHorizontal: CameraTokens.headerPaddingX,
  },
  eventName: {
    ...Typography.wordmark,
    textTransform: 'none',
    letterSpacing: -0.225,
    color: Colors.text,
  },
  barRow: {
    paddingHorizontal: CameraTokens.bar.paddingX,
    marginBottom: CameraTokens.bar.marginBottom,
  },
  viewfinder: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: CameraTokens.viewfinder.paddingX,
  },
  frame: {
    flex: 1,
    borderRadius: CameraTokens.viewfinder.radius,
    overflow: 'hidden',
    backgroundColor: CameraTokens.viewfinder.bg,
  },
  permission: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.screenX,
    gap: Spacing.md,
  },
  permissionHeadline: {
    textAlign: 'center',
  },
  permissionBody: {
    textAlign: 'center',
  },
  feedLabel: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: CameraTokens.controls.paddingX,
    paddingTop: CameraTokens.controls.paddingTop,
    paddingBottom: CameraTokens.controls.paddingBottom,
  },
  circleButton: {
    width: CameraTokens.controls.buttonSize,
    height: CameraTokens.controls.buttonSize,
    borderRadius: CameraTokens.controls.buttonSize / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dimmed: {
    opacity: 0.4,
  },
  noticeRow: {
    paddingHorizontal: CameraTokens.bottom.paddingX,
    paddingTop: Spacing.xs,
  },
  notice: {
    textAlign: 'center',
  },
  finishRow: {
    paddingHorizontal: CameraTokens.bottom.paddingX,
    paddingTop: Spacing.sm,
  },
  bottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: CameraTokens.bottom.paddingX,
    paddingTop: CameraTokens.bottom.paddingTop,
    paddingBottom: CameraTokens.bottom.paddingBottom,
  },
  /* Equal flex either side, so the record button sits dead centre whether or not
     the badge is showing. */
  bottomSide: {
    flex: 1,
    justifyContent: 'center',
  },
  bottomRight: {
    alignItems: 'flex-end',
  },
});
