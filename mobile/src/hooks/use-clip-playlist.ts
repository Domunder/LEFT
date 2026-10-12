/**
 * 17's film — an event's clips, played back to back.
 *
 * **This is the whole film, and there is only one of it.** For a while there were
 * two: this sequence, and a single mp4 that a rendering API stitched out of the
 * same clips. That renderer is gone, along with the selection it did and the
 * separate offsets an entry had to carry for it. What is left is what always
 * actually worked — the clips, in the order they were filmed, whole.
 *
 * So a `PlaylistEntry` carries one offset again, and it means what it says:
 * where the clip falls when the clips are played back to back. Nothing here
 * chooses between takes, trims one, or leaves one out. Every clip that has a
 * file is in the film, and the group watched every second they were charged for.
 *
 * **A tile tap starts the sequence there**, which is what it has always meant in
 * the absence of a rendered film. There is no spotlight mode and no second thing
 * to put back afterwards.
 *
 * `ClipHero` is presentational and `clip/[id].tsx` keeps its grid and its
 * downloads; both read from here so they cannot disagree about what is playing.
 *
 * ---------------------------------------------------------------------------
 * Three things about expo-video that the implementation is shaped around. All
 * three were read off the installed types (3.0.16), not assumed:
 *
 *  - **`playToEnd` carries no payload** — its signature is `playToEnd(): void`.
 *    `useEvent` stores an event's first argument, so on this event it would hold
 *    null forever and never re-render on a second clip ending. Auto-advance has
 *    to be `useEventListener`. This is the single easiest thing to get wrong
 *    here, and it fails silently: the first clip plays and the film just stops.
 *  - **`replaceAsync` loads off the UI thread**, where `replace` blocks it and is
 *    documented as heading for deprecation. Advancing uses the former.
 *  - **A player binds to one rendering surface.** `(onboarding)/format.tsx`
 *    records that pointing two `VideoView`s at one player crashes on device.
 *    Two players each with their own view is fine; one player with two is not.
 *
 * **One player, not two.** A second player pre-loading clip N+1 would hide the
 * swap entirely, and it was rejected: it needs mirrored subscriptions on both
 * players, an A/B flip that also has to move which player the controls talk to,
 * and preload scheduling re-armed on every jump and every re-sign — many places
 * for a later edit to violate the one-surface rule above, all to save ~300ms
 * between two different people's clips. A brief cover at a cut reads as an edit
 * rather than a stall.
 * ---------------------------------------------------------------------------
 */

import { useEventListener } from 'expo';
import { useVideoPlayer, type VideoPlayer } from 'expo-video';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { authorOf, type ClipAuthor } from '@/lib/clip-authors';
import { signedClipUrls, type PlayableClip } from '@/lib/clip-media';
import type { Clip } from '@/lib/events';

/** One position in the film: a clip, who filmed it, and its file if it has one. */
export type PlaylistEntry = {
  clip: Clip;
  author: ClipAuthor;
  /**
   * Null when the clip is 'pending' or 'failed'.
   *
   * A **gap**, not an omission. Playback skips over it, but the screen still
   * draws its tile and the ended copy still counts it — a film that quietly
   * dropped someone's clip would be a worse lie than the poster this replaced.
   */
  playable: PlayableClip | null;
  /**
   * Where this clip starts when the clips are played back to back.
   *
   * A running sum over every playable clip; gaps contribute none. Used for the
   * progress bar and for deciding how long a signature has to outlive.
   */
  sequenceOffsetSeconds: number;
};

export type PlaylistPhase = 'idle' | 'loading' | 'playing' | 'paused' | 'ended';

export type ClipPlaylist = {
  /** Hand to a single `VideoView`. See the header — only ever one. */
  player: VideoPlayer;
  /**
   * The shape to draw the picture in, as width over height.
   *
   * **`events.format` and nothing else**, so it is constant for the life of the
   * screen. Whatever clip is loaded goes inside a box of the group's chosen
   * shape, letterboxed by `contentFit="contain"` where the two disagree.
   *
   * This used to start there and then hand over to the player's own measurement
   * of the loaded track. It was removed: **iOS records portrait as a 1920x1080
   * track plus a rotation flag**, so `videoTrack.size` reports an upright clip as
   * landscape. The box flipped to 16:9 around a portrait picture, and 17's large
   * view offered to rotate a portrait film. Do not reintroduce it — the format is
   * the group's own choice on screen 03, and it is the only authority on this.
   */
  aspect: number;
  entries: PlaylistEntry[];
  /** Index into `entries`. -1 until something plays. */
  index: number;
  current: PlaylistEntry | null;
  phase: PlaylistPhase;
  /** 0–1 across the **whole** film, not the current clip. */
  progress: number;
  /** Sum of every playable entry's duration. 0 when nothing can be played. */
  totalSeconds: number;
  /** How many clips have no file yet — for copy that admits it. */
  gapCount: number;
  /** Whether there is anything at all to play. */
  playable: boolean;
  toggle: () => void;
  pause: () => void;
  /** A tile tap: start the film from that clip. Inert on a gap. */
  jumpTo: (index: number) => void;
  /** From the ended state, back to the start. */
  restart: () => void;
};

type PlaylistInput = {
  clips: Clip[];
  authors: Map<string, ClipAuthor>;
  /** Keyed by clip id, from `signedClipUrls`. */
  playable: Map<string, PlayableClip>;
  /**
   * The shape every surface draws the picture in — `filmAspect(event)`.
   *
   * Passed in rather than measured. Handed straight back out as `aspect`;
   * nothing here adjusts it — see that field for why.
   */
  aspect: number;
  /**
   * Called with a freshly signed map when signatures are renewed mid-film.
   *
   * The screen holds the same `PlayableClip` objects for its download and share
   * buttons, so it has to be told — otherwise those keep a URL this hook has
   * already replaced, and the next save 403s.
   */
  onResign: (playable: Map<string, PlayableClip>) => void;
};

/**
 * Headroom on top of the film's remaining length before a signature is renewed.
 *
 * The check has to cover *the rest of the film*, not a flat couple of minutes: a
 * URL that is valid at the boundary but dies four minutes into a ten-minute clip
 * fails in exactly the place this is meant to prevent.
 */
const RESIGN_MARGIN_MS = 60_000;

export function useClipPlaylist({
  clips,
  authors,
  playable: playableMap,
  aspect: declaredAspect,
  onResign,
}: PlaylistInput): ClipPlaylist {
  /*
    Created over a null source: the hook is called before the clips have loaded
    and `useVideoPlayer` cannot be conditional. An empty source loads nothing and
    costs one native object — the same call `ClipHero` used to make for its
    poster state.
  */
  const player = useVideoPlayer(null, (p) => {
    p.loop = false;
    // Twice a second: enough for a 336pt bar to look continuous, far cheaper
    // than the default on a track this short.
    p.timeUpdateEventInterval = 0.5;
    /*
      Held for the whole film rather than renegotiated per clip. On iOS the
      session is released and re-acquired around a source swap, which ducks other
      audio once per cut — several times over a film.
    */
    p.audioMixingMode = 'doNotMix';
  });

  const [index, setIndex] = useState(-1);
  const [phase, setPhase] = useState<PlaylistPhase>('idle');
  const [currentTime, setCurrentTime] = useState(0);

  const entries = useMemo<PlaylistEntry[]>(() => {
    let offset = 0;
    return clips.map((clip) => {
      const file = playableMap.get(clip.id) ?? null;
      const entry: PlaylistEntry = {
        clip,
        author: authorOf(clip, authors),
        playable: file,
        sequenceOffsetSeconds: offset,
      };
      if (file) offset += file.durationSeconds;
      return entry;
    });
  }, [clips, authors, playableMap]);

  /** How long the clips run end to end. This is the film's length. */
  const totalSeconds = useMemo(
    () => entries.reduce((sum, entry) => sum + (entry.playable?.durationSeconds ?? 0), 0),
    [entries]
  );

  const gapCount = useMemo(
    () => entries.reduce((count, entry) => count + (entry.playable ? 0 : 1), 0),
    [entries]
  );

  /*
    Mirrors of state, read from inside event listeners whose closures would
    otherwise capture a stale render. Assigned in an effect rather than during
    render — the React Compiler is on, and a write during render is not safe.
  */
  const entriesRef = useRef(entries);
  const indexRef = useRef(index);
  const phaseRef = useRef(phase);
  /** True while a source swap is in flight. Guards a double `playToEnd`. */
  const advancingRef = useRef(false);
  /** Clip ids already retried once after a load error, so one bad file ends. */
  const retriedRef = useRef(new Set<string>());

  useEffect(() => {
    entriesRef.current = entries;
  }, [entries]);
  useEffect(() => {
    indexRef.current = index;
  }, [index]);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  /**
   * Renew the batch's signatures if they will not outlive the rest of the film.
   *
   * `signedClipUrls` mints one expiry for a whole batch, so one URL being close
   * to death means they all are — which is why this re-signs everything in a
   * single round trip rather than one clip at a time.
   */
  const ensureFresh = useCallback(
    async (entry: PlaylistEntry): Promise<PlayableClip> => {
      const file = entry.playable;
      if (!file) throw new Error('not playable');

      const remainingMs = Math.max(0, totalSeconds - entry.sequenceOffsetSeconds) * 1000;
      if (file.expiresAt - Date.now() > remainingMs + RESIGN_MARGIN_MS) return file;

      const refreshed = await signedClipUrls(entriesRef.current.map((e) => e.clip));
      onResign(refreshed);
      // Falling back to the stale URL beats refusing to play: it may still work,
      // and if it does not the error path below reports it honestly.
      return refreshed.get(entry.clip.id) ?? file;
    },
    [totalSeconds, onResign]
  );

  const firstPlayable = useMemo(
    () => entries.findIndex((entry) => entry.playable !== null),
    [entries]
  );

  /**
   * Move to `target`, or to the next playable entry after it.
   *
   * A source swap. Gaps are stepped over rather than stalled on, and running off
   * the end is the film finishing, not a failure.
   */
  const advance = useCallback(
    async (target: number) => {
      const list = entriesRef.current;

      let next = target;
      while (next < list.length && !list[next].playable) next++;

      if (next >= list.length) {
        setPhase('ended');
        return;
      }

      advancingRef.current = true;
      setPhase('loading');

      try {
        const fresh = await ensureFresh(list[next]);
        await player.replaceAsync({ uri: fresh.url });
        setIndex(next);
        indexRef.current = next;
        setCurrentTime(0);
        player.play();
      } catch {
        /* Stopping and saying so beats skipping silently to the next clip. */
        setPhase('ended');
      } finally {
        advancingRef.current = false;
      }
    },
    [player, ensureFresh]
  );

  /*
    The end of a clip is the start of the next one. See the header on why this
    cannot be `useEvent`: `playToEnd` has no payload to store.
  */
  useEventListener(player, 'playToEnd', () => {
    if (advancingRef.current) return;
    void advance(indexRef.current + 1);
  });

  useEventListener(player, 'timeUpdate', ({ currentTime: at }) => {
    setCurrentTime(at);

    /*
      Stop at what the group was charged, which is not always the length of the
      file.

      A take that started while somebody else was already filming is settled
      against whatever budget that earlier take left behind, and can be kept at
      *part* of its length — 20 seconds filmed, the first 10 paid for. The server
      writes the charge to `duration_seconds`, and there is no ffmpeg anywhere in
      this project to trim the file itself, so the cut is made here, at playback.

      Without this the film runs longer than the budget it sold, which is the one
      promise the whole app is built on.
    */
    const entry = entriesRef.current[indexRef.current];
    const paidFor = entry?.playable?.durationSeconds;
    if (paidFor === undefined || advancingRef.current) return;
    if (at < paidFor) return;

    void advance(indexRef.current + 1);
  });

  useEventListener(player, 'playingChange', ({ isPlaying }) => {
    // The pause inside a source swap is not the user pausing.
    if (advancingRef.current) return;
    if (isPlaying) {
      setPhase('playing');
      return;
    }
    /*
      'ended' and 'idle' are both states the player stopping does not change:
      one is the film having finished, the other is nothing having started. Only
      a stop from playing is a pause.
    */
    if (phaseRef.current === 'ended' || phaseRef.current === 'idle') return;
    setPhase('paused');
  });

  /*
    The backstop for a file that loaded but is broken — which does happen, since
    an interrupted upload can still be marked 'uploaded'. One retry and then past
    it, so one bad clip ends rather than stopping the film dead with nothing said.
  */
  useEventListener(player, 'statusChange', ({ status }) => {
    if (status !== 'error') return;

    const list = entriesRef.current;
    const at = indexRef.current;
    const entry = list[at];
    if (!entry) return;

    if (retriedRef.current.has(entry.clip.id)) {
      void advance(at + 1);
      return;
    }
    retriedRef.current.add(entry.clip.id);
    void advance(at);
  });

  /** Where the film is, as a fraction of the whole thing. */
  const progress = useMemo(() => {
    if (totalSeconds <= 0) return 0;
    if (phase === 'ended') return 1;

    const entry = entries[index];
    if (!entry?.playable) return 0;

    /*
      Clamped to the row's own duration. `duration_seconds` is what
      `commit_reservation` charged — an integer, capped at the hold — while the
      file's real length can run a fraction longer. Unclamped, the bar creeps
      into the next clip's share of the track and then jumps back at the cut.
    */
    const within = Math.min(currentTime, entry.playable.durationSeconds);
    return Math.min(1, (entry.sequenceOffsetSeconds + within) / totalSeconds);
  }, [entries, index, currentTime, totalSeconds, phase]);

  const restart = useCallback(() => {
    if (firstPlayable < 0) return;
    retriedRef.current.clear();
    void advance(firstPlayable);
  }, [advance, firstPlayable]);

  const toggle = useCallback(() => {
    if (phase === 'playing') {
      player.pause();
      return;
    }
    // Nothing loaded yet, or the film has run out: both start from the top.
    if (phase === 'idle' || phase === 'ended' || index < 0) {
      restart();
      return;
    }
    player.play();
  }, [phase, index, player, restart]);

  const pause = useCallback(() => {
    player.pause();
  }, [player]);

  const jumpTo = useCallback(
    (target: number) => {
      const entry = entriesRef.current[target];
      if (!entry?.playable) return;
      void advance(target);
    },
    [advance]
  );

  return {
    player,
    // The event's format, unchanged for the life of the screen. See `ClipPlaylist`.
    aspect: declaredAspect,
    entries,
    index,
    current: index >= 0 ? (entries[index] ?? null) : null,
    phase,
    progress,
    totalSeconds,
    gapCount,
    playable: firstPlayable >= 0,
    toggle,
    pause,
    jumpTo,
    restart,
  };
}
