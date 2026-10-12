/**
 * A real frame for every clip tile on 17.
 *
 * **Every cover in this app was a gradient.** `lib/film-tint.ts` derives two
 * stops from an id and draws them wherever a picture belongs, and the comment at
 * the top of it is an apology: nothing in this stack could pull a frame out of a
 * video, so a deterministic wash stood in for one. The grid on 17 is the worst
 * place for that — eight tiles of eight different colours, none of which say
 * anything about what was filmed.
 *
 * expo-video 3 can do it. `player.generateThumbnailsAsync(times)` returns
 * `VideoThumbnail`s, which are `SharedRef<'image'>` and go straight into
 * `expo-image` as a source. Both packages are already here; nothing was added.
 *
 * ---------------------------------------------------------------------------
 * **This player has no view, and that is what makes it legal.** The rule
 * `use-clip-playlist` documents — and `(onboarding)/format.tsx` records crashing
 * on device — is that one player must not be pointed at two `VideoView`s. Two
 * players is fine; a player with no surface at all is fine. This one is never
 * rendered, never played, and muted, so it cannot take the audio session away
 * from the film either.
 *
 * **One clip at a time, deliberately.** The same call `saveAllClips` makes, for
 * the same reason: this runs over a venue's network against a phone's worth of
 * bandwidth, and eight parallel video loads to build eight thumbnails would
 * compete with the film someone is trying to watch. Sequential, quietly, behind
 * whatever the hero is doing.
 *
 * **Nothing here is required to succeed.** A clip whose frame cannot be made —
 * an interrupted upload marked 'uploaded', a codec the device will not open, web
 * where the API does not exist — is simply absent from the map, and its tile
 * keeps the tint it has today. There is no error state and no retry: a missing
 * cover is not worth telling anyone about.
 *
 * **Not cached across visits.** A `VideoThumbnail` is a native image reference
 * and expo-image offers no way to write one to disk, so this rebuilds on each
 * visit to the screen. Cheap enough — the work is bounded by the clip count and
 * runs off the critical path.
 * ---------------------------------------------------------------------------
 */

import { useVideoPlayer, type VideoThumbnail } from 'expo-video';
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import type { PlayableClip } from '@/lib/clip-media';
import type { Clip } from '@/lib/events';

/** One clip's cover, and the shape it turned out to be. */
export type ClipThumbnail = {
  /** Pass to `expo-image`'s `source` directly. */
  image: VideoThumbnail;
  /** Width over height, measured rather than assumed. */
  aspect: number;
};

/**
 * How far into a clip the frame is taken.
 *
 * Not zero. The first frame of a handheld recording is the moment a thumb was
 * still on the button — a blur, a lap, a pocket. Half a second in, the shot has
 * settled and still answers "what is this clip" for anything long enough to have
 * an answer.
 */
const CAPTURE_AT_SECONDS = 0.5;

/** Tiles are at most half the screen wide; anything larger is wasted decode. */
const MAX_WIDTH = 480;

/**
 * Build a cover frame for each playable clip, in order.
 *
 * Keyed by clip id. Re-runs when the set of playable clips changes — a clip
 * arriving live, or a batch of URLs being re-signed mid-film — and skips
 * anything it already has, so a re-sign does not redo the work.
 */
export function useClipThumbnails(
  clips: Clip[],
  playable: Map<string, PlayableClip>
): Map<string, ClipThumbnail> {
  const [thumbnails, setThumbnails] = useState<Map<string, ClipThumbnail>>(new Map());
  /**
   * Clip ids already attempted, so a second run does not redo them.
   *
   * A ref rather than a read of `thumbnails`: the effect's closure holds the map
   * as it was when the run started, and a clip landing mid-run would restart the
   * loop against stale contents. Holds failures too — a clip whose file will not
   * open is not worth trying again on every re-sign.
   */
  const attempted = useRef(new Set<string>());

  /*
    Its own player, created once and never handed to a view. See the header.
    Muted so that loading a source cannot duck whatever the film is playing.
  */
  const scratch = useVideoPlayer(null, (p) => {
    p.muted = true;
    p.loop = false;
  });

  /*
    The dependency is the ids rather than the map: `signedClipUrls` mints a new
    map on every re-sign, and depending on the object would rebuild every
    thumbnail each time an hour-old signature was renewed.
  */
  const ids = clips
    .filter((clip) => playable.has(clip.id))
    .map((clip) => clip.id)
    .join(',');

  useEffect(() => {
    // The API is native-only, and web has no tiles worth the round trips anyway.
    if (Platform.OS === 'web' || ids.length === 0) return;

    let cancelled = false;

    (async () => {
      for (const id of ids.split(',')) {
        if (cancelled) return;

        const file = playable.get(id);
        if (!file) continue;

        if (attempted.current.has(id)) continue;
        attempted.current.add(id);

        try {
          await scratch.replaceAsync({ uri: file.url });
          if (cancelled) return;

          // A clip can legitimately be shorter than the capture point.
          const at = Math.min(CAPTURE_AT_SECONDS, file.durationSeconds / 2);
          const [frame] = await scratch.generateThumbnailsAsync([at], {
            maxWidth: MAX_WIDTH,
          });
          if (cancelled || !frame) continue;

          setThumbnails((current) => {
            const next = new Map(current);
            next.set(id, {
              image: frame,
              aspect: frame.height > 0 ? frame.width / frame.height : 1,
            });
            return next;
          });
        } catch {
          // See the header: a tile without a frame keeps its tint.
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    /*
      `playable` is read inside and deliberately not a dependency — see `ids`. It
      is only ever used to look up a URL for an id that is in `ids`, and a
      re-signed map holds a working URL for every one of them.
    */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids, scratch]);

  return thumbnails;
}
