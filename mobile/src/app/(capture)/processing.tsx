/**
 * 14 · Creating Your Film
 *
 * The group has spent its budget, the event is over, and everyone waits together
 * while the film is made.
 *
 * **Every member lands here, not just whoever was filming.** The camera calls
 * `finishEvent()` when the budget hits zero; that flips `events.status` to
 * 'processing', and every other member's phone follows the realtime UPDATE onto
 * this screen without anyone touching anything. This screen then watches the same
 * column and moves everyone onward together when it reads 'ready'.
 *
 * **The wait is for the uploads, not for the render.** What this screen waits on
 * is every clip's file actually arriving in the bucket — a take is charged and
 * rowed the moment recording stops, but the upload lands later, possibly much
 * later on a venue network. A clip that has not landed is a gap in the film, so
 * waiting here is what makes 17 complete.
 *
 * **Nothing is rendered, and nothing here should ever wait for something that
 * is.** There was briefly a second step — a rendering API stitching the clips
 * into a single mp4 — asked for from this screen and taking minutes. It is gone.
 * `compile_film()` makes no video either; it marks the event watchable, which is
 * the only thing standing between the group and 17.
 *
 * That wait is **bounded**. A member who closed the app mid-upload leaves a clip
 * 'pending' forever, and hanging the whole group on it would be worse than the
 * gap: past `UPLOAD_WAIT_TIMEOUT_MS` the screen moves on and 17 reports the
 * missing clips honestly.
 *
 * The glow is rendered here rather than by (capture)/_layout, which is shared
 * with the camera — a viewfinder must not have a light bleeding over it.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AmbientGlow } from '@/components/ui/ambient-glow';
import { IndeterminateBar } from '@/components/ui/indeterminate-bar';
import { Screen } from '@/components/ui/screen';
import { Spinner } from '@/components/ui/spinner';
import { Body, Display, Em } from '@/components/ui/typography';
import { Colors, Processing } from '@/constants/theme';
import { getSession, isAnonymous } from '@/lib/auth';
import { isPromptDismissed } from '@/lib/prompt-dismissal';
import {
  compileFilm,
  getEvent,
  listClips,
  listMyEvents,
  subscribeToEventStatus,
  type Event,
} from '@/lib/events';

/**
 * The longest the group waits on a clip that may never arrive.
 *
 * Long enough for a large take on a poor connection, short enough that one
 * person's closed app does not strand everyone else in front of a spinner.
 */
const UPLOAD_WAIT_TIMEOUT_MS = 90_000;

/** How often to re-count the clips while waiting. */
const UPLOAD_POLL_MS = 2_000;

/**
 * A floor on how long the screen is visible.
 *
 * When every clip has already landed the wait resolves instantly, and a screen
 * that appears and vanishes inside a frame tells nobody what happened to their
 * film. Unlike the delay this replaces, it is a floor on a real wait rather than
 * a substitute for one.
 */
const MIN_VISIBLE_MS = 1_200;

export default function ProcessingScreen() {
  const router = useRouter();
  const { eventId } = useLocalSearchParams<{ eventId?: string }>();

  const [event, setEvent] = useState<Event | null>(null);
  /** Uploaded / total. Null until the first count lands. */
  const [uploaded, setUploaded] = useState<[number, number] | null>(null);

  /* One finish attempt per visit, however many times status re-reads. */
  const compiling = useRef(false);

  /*
    Resolve the event the same way 10, 13 and the rest do: the param when one was
    passed, else the newest event this user belongs to. The fallback is what makes
    a warm start onto this route work.
  */
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const found = eventId ? await getEvent(eventId) : (await listMyEvents())[0];
        if (!cancelled && found) setEvent(found);
      } catch {
        /*
          Left deliberately quiet. The film is already being made server-side, or
          has been; a failed read here is a reason to keep waiting, not to show
          someone an error about a film that is fine. The subscription below is
          what actually moves the screen on.
        */
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  const liveEventId = event?.id;
  const status = event?.status;

  /*
    Keyed on the id string rather than the event object — a re-read returning an
    equal-but-new row would otherwise tear the channel down and rebuild it,
    dropping any change that landed in between.
  */
  useEffect(() => {
    if (!liveEventId) return;
    return subscribeToEventStatus(liveEventId, (next) => {
      setEvent((current) => (current ? { ...current, status: next } : current));
    });
  }, [liveEventId]);

  /*
    Wait for every clip's file to land, then mark the event watchable.

    Polled rather than subscribed: `clips.status` moves from 'pending' to
    'uploaded' by an UPDATE from whichever member's phone is doing the uploading,
    and a realtime subscription per member for a wait this short would be more
    moving parts than counting rows a few times.
  */
  useEffect(() => {
    if (!liveEventId || status !== 'processing' || compiling.current) return;

    compiling.current = true;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const startedAt = Date.now();

    /** Everyone's clips are in — or we have waited long enough to say they are. */
    function finish() {
      /*
        Not awaited and its failure is swallowed: every member's screen runs
        this, the function is idempotent, and whichever call lands first moves
        everyone on. A phone whose call fails is still carried by the realtime
        update from a phone whose call did not.
      */
      void compileFilm(liveEventId as string).catch(() => {
        compiling.current = false;
      });
    }

    async function poll() {
      if (cancelled) return;

      let done = false;

      try {
        const clips = await listClips(liveEventId as string);
        if (cancelled) return;

        const landed = clips.filter((clip) => clip.status === 'uploaded').length;
        setUploaded([landed, clips.length]);
        done = clips.length === 0 || landed === clips.length;
      } catch {
        /*
          Quiet, like the event read above. A failed count is a reason to try
          again, not to tell someone their film is broken — it is not.
        */
      }

      const waited = Date.now() - startedAt;
      // A stuck upload must not strand the group. See UPLOAD_WAIT_TIMEOUT_MS.
      if (done || waited >= UPLOAD_WAIT_TIMEOUT_MS) {
        const hold = Math.max(0, MIN_VISIBLE_MS - waited);
        timer = setTimeout(finish, hold);
        return;
      }

      timer = setTimeout(poll, UPLOAD_POLL_MS);
    }

    void poll();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [liveEventId, status]);

  /*
    Done — everyone moves on together, but not all to the same place.

    A guest has no account: their identity is an anonymous row whose session
    lives only in this device's storage, so the film they just made is one wiped
    app away from being unreachable. This is the moment to say so — they have
    something to keep for the first time — and it is the whole reason
    `linkIdentity()` exists. Everyone else goes to their library, as before.

    A guest who has already declined is not asked again; the dismissal is shared
    with the library's panel, so the two offers cannot disagree.
  */
  useEffect(() => {
    if (status !== 'ready') return;
    let cancelled = false;

    (async () => {
      let offer = false;
      try {
        const user = (await getSession())?.user;
        // A failed session read is a reason to skip the offer, not to strand
        // anyone here — the film is ready either way.
        if (user && isAnonymous(user)) offer = !(await isPromptDismissed(user.id));
      } catch {
        // Quiet, like the reads above.
      }
      if (!cancelled) router.replace(offer ? '/(auth)/keep' : '/(library)/films');
    })();

    return () => {
      cancelled = true;
    };
  }, [status, router]);

  return (
    <View style={styles.root}>
      <AmbientGlow preset="processing" />

      <Screen transparent padded={false} edges={[]} style={styles.screen}>
        <View style={styles.center}>
          <Spinner style={styles.spinner} />

          <Display size="xs" style={styles.headline}>
            Creating your{'\n'}
            <Em>film.</Em>
          </Display>

          <Body small color={Colors.textDim} style={styles.copy}>
            Budget used up. Gathering everyone&rsquo;s clips, in order.
          </Body>

          {/* A real fraction once the clips have been counted — see the bar. */}
          <IndeterminateBar
            progress={uploaded && uploaded[1] > 0 ? uploaded[0] / uploaded[1] : undefined}
            accessibilityLabel={
              uploaded && uploaded[1] > 0
                ? `Gathering clips, ${uploaded[0]} of ${uploaded[1]}`
                : 'Gathering your film'
            }
          />
        </View>
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  screen: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinner: {
    marginBottom: Processing.spinnerGap,
  },
  headline: {
    textAlign: 'center',
    marginBottom: Processing.headlineGap,
  },
  copy: {
    textAlign: 'center',
    maxWidth: Processing.copyMaxWidth,
    marginBottom: Processing.copyGap,
  },
});
