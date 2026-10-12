/**
 * 17 · Clip Detail — an event's film, and every clip that went into it.
 *
 * **The route is called `clip/[id]` and receives an *event* id.** `destinationFor`
 * in lib/film-status.ts sends a 'ready' event here as `{ id: event.id }`, because
 * 17 is the destination for a finished *event* and there is no single film object
 * to have an id of its own. The name is a misnomer and is left alone deliberately:
 * `FilmDestination` is a typed union and `typedRoutes` is on, so renaming the
 * route touches film-status.ts, its exported type and the generated route surface
 * for no user-visible gain. Flagged at both ends instead.
 *
 * **The film is the clips, played back to back**, in `recorded_at` order, each
 * cut to what the group was charged for it. There is nothing else and there is
 * nothing to wait for: the film is complete the moment the last upload lands.
 * `hooks/use-clip-playlist.ts` owns the player; this screen owns the loading, the
 * grid and the saving.
 *
 * **The film leads and the clips sit under it.** The hero plays the whole thing,
 * at the shape the group chose on screen 03, resting on a frame from its first
 * clip. Tapping a tile starts the film there and opens it full screen on the
 * platform's own player. So the page reads top to bottom as one thing and then
 * its parts.
 *
 * Deviations from the artboard:
 *
 *  - **a tile starts the film at that clip, full screen.** The artboard drew
 *    tiles beneath a hero that already held a finished film, so a tap meant
 *    nothing. Here a tap moves the film to that clip in `FilmStage` with native
 *    controls, and the tile marks which clip is running.
 *  - **Download saves the clips, not one file.** The artboard's button implied a
 *    single video; there is no single video to hand over, and nothing in this
 *    project can make one. It saves the clips the film is made of, in the order
 *    they play, as separate files — gaps skipped and counted. Share stays
 *    per-clip: a share sheet carries one message, and `shareClip` sends a link
 *    rather than a video.
 *  - **the backdrop is a blurred tint rather than a blurred cover photo**, which
 *    is the last of the deviations Films.backdrop and lib/film-tint.ts document.
 *    Each tile does show a frame of its own clip, with the tint underneath for
 *    anything that has none.
 *  - **the grid rule beyond four clips is inferred.** The artboard draws exactly
 *    four in one fixed arrangement; see `layoutFor`.
 *
 * Like 15/16 it sets its own horizontal padding — the header pads to 24 and the
 * body to 18, neither of which is `Spacing.screenX` (28), so `<Screen>` cannot
 * supply it.
 */

import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';

import { CircleIconButton } from '@/components/ui/circle-back-button';
import { ClipHero } from '@/components/ui/clip-hero';
import { ClipTile } from '@/components/ui/clip-tile';
import { FilmStage } from '@/components/ui/film-stage';
import { Screen } from '@/components/ui/screen';
import { ShareButton } from '@/components/ui/share-button';
import { useToast } from '@/components/ui/toast-host';
import { Body, Label } from '@/components/ui/typography';
import { ClipDetail as CD, Colors, Spacing } from '@/constants/theme';
import { Typography } from '@/constants/typography';
import { useClipPlaylist } from '@/hooks/use-clip-playlist';
import { useClipThumbnails } from '@/hooks/use-clip-thumbnails';
import { authorOf, authorsFor, type ClipAuthor } from '@/lib/clip-authors';
import { downloadClip, saveAllClips, shareClip } from '@/lib/clip-download';
import { filmAspect, signedClipUrls, type PlayableClip } from '@/lib/clip-media';
import { getEvent, listClips, type Clip, type Event } from '@/lib/events';
import { tintFor } from '@/lib/film-tint';
import { formatDuration } from '@/lib/pricing';

/** "maya-r-<id>.mp4" — the bucket stores .mp4 whatever the device recorded. */
function clipFilename(authorName: string, clipId: string): string {
  return `${authorName.replace(/\W+/g, '-').toLowerCase()}-${clipId}.mp4`;
}

type Loaded = {
  event: Event;
  clips: Clip[];
  authors: Map<string, ClipAuthor>;
  /** Keyed by clip id. A clip missing from this has no file behind it yet. */
  playable: Map<string, PlayableClip>;
};

type LoadState = { kind: 'loading' } | { kind: 'ready'; data: Loaded } | { kind: 'error' };

/**
 * Where each clip sits in the grid.
 *
 * The artboard draws four clips in one fixed shape: a full-width feature tile,
 * then a two-up row, then a full-width tile spanning both columns. This
 * reproduces that exactly at four and extends past it — first full-width, the
 * rest two-up, a trailing odd one full-width again. The extension is **inferred**;
 * the artboard only ever shows the one arrangement.
 */
function layoutFor(count: number): { index: number; height: number; full: boolean }[] {
  const rows: { index: number; height: number; full: boolean }[] = [];

  for (let index = 0; index < count; index++) {
    if (index === 0) {
      rows.push({ index, height: CD.grid.featureHeight, full: true });
      continue;
    }

    // A last clip with no partner spans the row rather than leaving a gap.
    const isLast = index === count - 1;
    const orphan = isLast && (count - 1) % 2 === 1;

    rows.push({
      index,
      height: orphan ? CD.grid.wideHeight : CD.grid.pairHeight,
      full: orphan,
    });
  }

  return rows;
}

/*
  Stable identities for the loading pass. New literals each render would give
  `useClipPlaylist` a fresh dependency every time and rebuild its entries.
*/
const EMPTY_CLIPS: Clip[] = [];
const EMPTY_AUTHORS = new Map<string, ClipAuthor>();
const EMPTY_PLAYABLE = new Map<string, PlayableClip>();

export default function ClipDetailScreen() {
  // See the header: this is an *event* id, whatever the route is called.
  const { id: eventId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();

  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [busy, setBusy] = useState<'download' | 'share' | null>(null);
  const [tileBusy, setTileBusy] = useState<string | null>(null);
  /** "Saving 3 of 8…" — a whole film is slow enough to need a position. */
  const [saveProgress, setSaveProgress] = useState<[number, number] | null>(null);
  /**
   * Whether the large view is open.
   *
   * It is not another screen and not another player: it shows the same one, and
   * the hero unmounts its `VideoView` while it is up. See `FilmStage`.
   */
  const [stage, setStage] = useState(false);

  /**
   * The clip ids the playlist is currently built from.
   *
   * Read by the focus effect to decide whether a reload may replace the loaded
   * data wholesale. See there.
   */
  const loadedIdsRef = useRef<string>('');
  /** Whether a film is mid-playback, without making the effect depend on phase. */
  const watchingRef = useRef(false);
  /** The playlist's `pause`, so the focus cleanup can stop audio on the way out. */
  const pauseRef = useRef<(() => void) | null>(null);

  /*
    On focus, with the cancellation shape films.tsx uses. Signatures are minted
    per load and never cached — see clip-media.ts for why a cache keyed by
    storage path would outlive sign-out and leak into the next session.

    **A reload must not restart a film someone is watching.** This runs on every
    focus, so tabbing away and back re-signs everything — and swapping a fresh
    `playable` map in wholesale rebuilds the playlist's entries and drops the
    cursor back to the first clip. When the same clips come back while playback
    is under way, the fresh URLs are merged in and everything else is left alone.
  */
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      async function load() {
        if (!eventId) {
          setState({ kind: 'error' });
          return;
        }

        try {
          const [event, clips, authors] = await Promise.all([
            getEvent(eventId),
            listClips(eventId),
            authorsFor(eventId),
          ]);
          if (cancelled) return;

          const playable = await signedClipUrls(clips);
          if (cancelled) return;

          const ids = clips.map((clip) => clip.id).join(',');
          const sameFilm = ids === loadedIdsRef.current;
          loadedIdsRef.current = ids;

          setState((current) => {
            if (sameFilm && watchingRef.current && current.kind === 'ready') {
              // Same clips, still playing: take the new signatures, keep the film.
              return {
                kind: 'ready',
                data: { ...current.data, event, authors, playable },
              };
            }
            return { kind: 'ready', data: { event, clips, authors, playable } };
          });
        } catch {
          if (!cancelled) setState({ kind: 'error' });
        }
      }

      void load();
      return () => {
        cancelled = true;
        // Leaving the screen must not leave audio running behind it.
        pauseRef.current?.();
      };
    }, [eventId])
  );

  const data = state.kind === 'ready' ? state.data : null;

  /** The tint behind everything, and behind the hero's idle and ended states. */
  const tint = useMemo(() => (data ? tintFor(data.event.id) : null), [data]);

  /*
    Stable empties: `useClipPlaylist` cannot be called conditionally, and passing
    fresh `[]` / `new Map()` literals while loading would rebuild its entries on
    every render.
  */
  const clips = data?.clips ?? EMPTY_CLIPS;
  const authors = data?.authors ?? EMPTY_AUTHORS;
  const playableMap = data?.playable ?? EMPTY_PLAYABLE;

  /** Fresh signatures from mid-film re-signing, so saving does not hold a dead URL. */
  const handleResign = useCallback((playable: Map<string, PlayableClip>) => {
    setState((current) =>
      current.kind === 'ready'
        ? { kind: 'ready', data: { ...current.data, playable } }
        : current
    );
  }, []);

  const playlist = useClipPlaylist({
    clips,
    authors,
    playable: playableMap,
    /*
      The shape the group chose on screen 03. Known before any clip is signed, so
      the hero is laid out correctly from the first frame of the screen rather
      than resizing once something loads.
    */
    aspect: data ? filmAspect(data.event) : 9 / 16,
    onResign: handleResign,
  });

  /*
    A frame for each tile, built off-screen while the hero does its own thing.
    Nothing waits on this and nothing reports it failing — see the hook.
  */
  const thumbnails = useClipThumbnails(clips, playableMap);

  /*
    Read by the focus effect's cleanup, which must not depend on the playlist —
    adding it would re-run the load on every phase change.
  */
  pauseRef.current = playlist.pause;
  watchingRef.current = playlist.phase === 'playing' || playlist.phase === 'paused';

  const save = useCallback(
    async (playable: PlayableClip, authorName: string) => {
      const outcome = await downloadClip(playable, clipFilename(authorName, playable.clipId));

      /*
        Reported through 18's toast rather than a second notice mechanism built
        for this screen — the host is already mounted for every route.
      */
      switch (outcome.kind) {
        case 'saved':
          toast.show({ initials: '✓', title: 'Saved to your photos.' });
          break;
        case 'denied':
          toast.show({
            initials: '!',
            title: 'Photo access is off.',
            message: 'Allow photo access in Settings to save clips.',
          });
          break;
        case 'unavailable':
          toast.show({ initials: '!', title: 'Saving is not available here.' });
          break;
        case 'failed':
          toast.show({ initials: '!', title: "Couldn't save that clip." });
          break;
      }
    },
    [toast]
  );

  /**
   * Save the whole film.
   *
   * The clips it is made of, in the order they play, as separate files. There is
   * no single video to hand over — nothing in this project can stitch one — so
   * this is what "save the film" means here, and the button label says so rather
   * than promising a file that does not exist.
   *
   * Gaps are skipped and counted; a partial result is reported as one rather than
   * being rounded up to success or down to failure.
   */
  const handleSaveAll = useCallback(async () => {
    if (!data) return;

    const savable = playlist.entries
      .filter((entry) => entry.playable)
      .map((entry) => ({
        playable: entry.playable as PlayableClip,
        filename: clipFilename(entry.author.name, entry.clip.id),
      }));

    if (savable.length === 0) return;

    setBusy('download');
    setSaveProgress([0, savable.length]);

    try {
      const outcome = await saveAllClips(savable, (completed, total) =>
        setSaveProgress([completed, total])
      );

      const missing = playlist.gapCount;
      const stillUploading =
        missing > 0 ? ` ${missing} ${missing === 1 ? 'clip is' : 'clips are'} still uploading.` : '';

      switch (outcome.kind) {
        case 'saved':
          toast.show({
            initials: '✓',
            title: `Saved ${outcome.saved} ${outcome.saved === 1 ? 'clip' : 'clips'} to your photos.`,
            message: stillUploading.trim() || undefined,
          });
          break;
        case 'partial':
          toast.show({
            initials: '!',
            title: `Saved ${outcome.saved} of ${outcome.saved + outcome.failed} clips.`,
            message: `${outcome.failed} couldn't be saved.${stillUploading}`.trim(),
          });
          break;
        case 'denied':
          toast.show({
            initials: '!',
            title: 'Photo access is off.',
            message: 'Allow photo access in Settings to save clips.',
          });
          break;
        case 'unavailable':
          toast.show({ initials: '!', title: 'Saving is not available here.' });
          break;
        case 'failed':
          toast.show({ initials: '!', title: "Couldn't save this film." });
          break;
      }
    } finally {
      setBusy(null);
      setSaveProgress(null);
    }
  }, [data, playlist.entries, playlist.gapCount, toast]);

  /** Share stays per-clip: the sheet carries one message, and it sends a link. */
  const current = playlist.current;
  const handleShare = useCallback(async () => {
    if (!current?.playable || !data) return;
    setBusy('share');
    try {
      // See clip-download.ts: this sends a live signed URL as text.
      await shareClip(data.event.name, current.author.name, current.playable);
    } finally {
      setBusy(null);
    }
  }, [current, data]);

  /**
   * The sentence the hero shows when there is no picture — idle, or ended.
   *
   * It has to admit a gap. A film that quietly plays five of seven clips and
   * says nothing is a worse lie than the poster this replaced.
   */
  const heroNote = useMemo(() => {
    const missing = playlist.gapCount;
    const stillUploading =
      missing > 0
        ? ` ${missing} ${missing === 1 ? 'clip is' : 'clips are'} still uploading.`
        : '';

    if (!playlist.playable) {
      return missing > 0
        ? 'Nothing has finished uploading yet. Check back in a moment.'
        : 'Nobody filmed anything for this one.';
    }

    if (playlist.phase === 'ended') return `That's the film.${stillUploading}`;

    const count = playlist.entries.length - missing;
    return `${count} ${count === 1 ? 'clip' : 'clips'} · ${formatDuration(
      Math.round(playlist.totalSeconds)
    )}${stillUploading}`;
  }, [
    playlist.gapCount,
    playlist.playable,
    playlist.phase,
    playlist.entries,
    playlist.totalSeconds,
  ]);

  /**
   * "3 of 8" beside the author's name.
   *
   * Counted over *playable* clips, since those are the ones that play — placing
   * a clip as "4 of 9" in a film that only ever shows 8 would be arithmetic the
   * viewer cannot follow. Suppressed at one clip, where it says nothing.
   */
  const positionLabel = useMemo(() => {
    if (playlist.index < 0) return null;

    const total = playlist.entries.filter((entry) => entry.playable).length;
    if (total <= 1) return null;

    const position = playlist.entries
      .slice(0, playlist.index + 1)
      .filter((entry) => entry.playable).length;

    return `${position} of ${total}`;
  }, [playlist.entries, playlist.index]);

  /**
   * The still behind the hero's idle and ended states.
   *
   * The first clip's own frame, built by `use-clip-thumbnails`. Null until one
   * has been made, and permanently for a film whose clips will not open — both
   * of which fall back to the tint the hero has always drawn.
   */
  const heroPoster = useMemo(() => {
    const first = playlist.entries.find((entry) => entry.playable);
    return first ? (thumbnails.get(first.clip.id)?.image ?? null) : null;
  }, [playlist.entries, thumbnails]);

  /**
   * Dismissing the large view.
   *
   * Only closes it. The film keeps playing behind, on the hero's own `VideoView`
   * — there is one player and the two surfaces trade it, so nothing has to be
   * reloaded or put back.
   */
  const closeStage = useCallback(() => {
    setStage(false);
  }, []);

  const handleTileDownload = useCallback(
    async (playable: PlayableClip, authorName: string) => {
      setTileBusy(playable.clipId);
      try {
        await save(playable, authorName);
      } finally {
        setTileBusy(null);
      }
    },
    [save]
  );

  return (
    <Screen transparent padded={false} edges={['top']}>
      {tint ? (
        <View style={styles.backdrop} pointerEvents="none">
          <View style={[StyleSheet.absoluteFill, { backgroundColor: tint[0] }]} />
          <View style={[StyleSheet.absoluteFill, styles.backdropScrim]} />
        </View>
      ) : null}

      {/*
        A local row, not ScreenHeader: that is a space-between layout with a
        right-hand spacer, and this is a left-aligned button with a two-line
        title block beside it.
      */}
      <View style={styles.header}>
        <CircleIconButton
          icon="chevron-left"
          variant="flat"
          accessibilityLabel="Back"
          onPress={() => router.back()}
        />

        {data ? (
          <View style={styles.headerCopy}>
            <Text style={styles.title} numberOfLines={1}>
              {data.event.name}
            </Text>
            {/*
              Length comes from the playlist rather than from `used_seconds`.
              The two agree for a finished event — the group watches exactly what
              it filmed — but `used_seconds` counts takes that are charged and
              still uploading, so it runs ahead of what this screen can play.
            */}
            <Text style={styles.subtitle}>
              {data.clips.length} {data.clips.length === 1 ? 'clip' : 'clips'} ·{' '}
              {formatDuration(Math.round(playlist.totalSeconds))}
            </Text>
          </View>
        ) : null}
      </View>

      {/*
        Three states that must read as three different sentences — the same rule
        films.tsx documents. "No clips" shown to someone whose network dropped is
        a lie about their film.
      */}
      {state.kind === 'loading' ? (
        <View style={styles.centered}>
          <ActivityIndicator size="small" color={Colors.textMuted} />
          <Body small color={Colors.textDim}>
            Loading your film…
          </Body>
        </View>
      ) : state.kind === 'error' ? (
        <View style={styles.centered}>
          <Body small color={Colors.textDim} style={styles.centeredCopy}>
            Couldn&rsquo;t load this film.{'\n'}Check your connection and try again.
          </Body>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <ClipHero
            player={playlist.player}
            phase={playlist.phase}
            progress={playlist.progress}
            authorName={playlist.current?.author.name ?? null}
            positionLabel={positionLabel}
            tint={tint ?? ['#000', '#000']}
            note={heroNote}
            playable={playlist.playable}
            aspect={playlist.aspect}
            poster={heroPoster}
            onExpand={() => setStage(true)}
            // One VideoView per player, always. See `FilmStage`.
            inline={!stage}
            onTogglePlay={playlist.toggle}
            onRestart={playlist.restart}
          />

          <View style={styles.actions}>
            <ShareButton
              label={
                saveProgress
                  ? `Saving ${saveProgress[0] + 1} of ${saveProgress[1]}…`
                  : /*
                      Names what the tap will actually produce: a folder of takes,
                      not one video. "Save film" would promise a file that does
                      not exist.
                    */
                    'Save all clips'
              }
              icon="download"
              variant="light"
              iconSize={CD.actions.downloadIconSize}
              paddingY={CD.actions.paddingY}
              /*
                Saving does not need playback, only files — so this is gated on
                the film having any, not on the hero having started.
              */
              disabled={!playlist.playable}
              busy={busy === 'download'}
              onPress={handleSaveAll}
            />
            <ShareButton
              label="Share clip"
              icon="share"
              iconSize={CD.actions.shareIconSize}
              paddingY={CD.actions.paddingY}
              // Share is per-clip, so it needs one on screen to act on.
              disabled={!current?.playable}
              busy={busy === 'share'}
              onPress={handleShare}
            />
          </View>

          <Label small color={Colors.textFaint} style={styles.sectionLabel}>
            Contributing Clips
          </Label>

          {data && data.clips.length === 0 ? (
            <Body small color={Colors.textDim}>
              Nobody filmed anything for this one.
            </Body>
          ) : null}

          <View style={styles.grid}>
            {data
              ? layoutFor(data.clips.length).map(({ index, height, full }) => {
                  const clip = data.clips[index];
                  const author = authorOf(clip, data.authors);
                  const playable = data.playable.get(clip.id);

                  return (
                    <View
                      key={clip.id}
                      style={[styles.cell, full ? styles.cellFull : styles.cellHalf]}>
                      <ClipTile
                        height={height}
                        tint={tintFor(clip.id)}
                        thumbnail={thumbnails.get(clip.id)?.image ?? null}
                        authorName={author.name}
                        durationLabel={`${clip.duration_seconds}s`}
                        selected={playlist.index === index}
                        playing={playlist.index === index && playlist.phase === 'playing'}
                        unavailable={!playable}
                        downloading={tileBusy === clip.id}
                        onPress={() => {
                          if (!playable) return;
                          void Haptics.selectionAsync();
                          /*
                            Straight to full screen. `jumpTo` starts the film at
                            that clip; opening the stage in the same tap is what
                            moves the picture to where someone is already
                            looking, rather than 400px up the page.
                          */
                          playlist.jumpTo(index);
                          setStage(true);
                        }}
                        onDownload={
                          playable
                            ? () => void handleTileDownload(playable, author.name)
                            : undefined
                        }
                      />
                    </View>
                  );
                })
              : null}
          </View>
        </ScrollView>
      )}

      {/*
        The large view. Mounted last so it sits over everything, and only when
        asked for — while it is up, the hero's own VideoView is unmounted and
        this one holds the player.
      */}
      {stage ? (
        <FilmStage
          player={playlist.player}
          aspect={playlist.aspect}
          title={data?.event.name ?? 'The film'}
          onClose={closeStage}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    opacity: CD.backdrop.opacity,
  },
  backdropScrim: {
    backgroundColor: Colors.backdropScrim,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: CD.header.gap,
    paddingHorizontal: CD.header.paddingX,
    paddingBottom: CD.header.paddingBottom,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
    gap: CD.header.subGap,
  },
  title: {
    ...Typography.titleSm,
    color: Colors.text,
  },
  subtitle: {
    ...Typography.metaSm,
    color: Colors.textFaint,
  },
  body: {
    paddingTop: CD.body.paddingTop,
    paddingHorizontal: CD.body.paddingX,
    paddingBottom: CD.body.paddingBottom,
  },
  actions: {
    flexDirection: 'row',
    gap: CD.actions.gap,
    marginBottom: CD.actions.marginBottom,
  },
  sectionLabel: {
    marginBottom: CD.sectionLabel.marginBottom,
  },
  /*
    RN has no CSS Grid. The row wraps and each cell claims either the full width
    or half of it less the gap, which is what reproduces the artboard's
    `grid-template-columns: 1fr 1fr` with its `1 / -1` spans.
  */
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CD.grid.gap,
  },
  cell: {
    // Height is set by the tile itself, from the layout rule.
  },
  cellFull: {
    width: '100%',
  },
  cellHalf: {
    // See `ClipDetail.grid.halfBasis` for why this is a basis, not `flex: 1`.
    flexBasis: CD.grid.halfBasis,
    flexGrow: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  centeredCopy: {
    textAlign: 'center',
  },
});
