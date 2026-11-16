/**
 * 17 · Album
 *
 * Replaces the clip player; **not in the prototype**. The `id` param is the
 * event id. One route, two states, decided by the server's clock:
 *
 *  - **Before the event is developed** — `DevelopingFilm`: a countdown, how
 *    many photos exist, nothing to see. The host can develop early.
 *  - **Developed** — `AlbumHero` (one of the album's photos, picked at random
 *    each time the screen opens, full-bleed and going dark towards the name,
 *    the two counts and "Save all"), then the whole group's photos two to a
 *    row with the photographer's name on each, the shared `PhotoViewer`, save,
 *    share and moderation. (2026-11-16, replacing the dense three-column grid
 *    under a small title — the user's design.)
 *
 * **The reveal** plays the first time a developed album is opened on this
 * phone: the sheet waits in the dark until the first thumbnails are loaded,
 * then the hero and after it the prints come up one after another
 * (`RevealVeil`), with a haptic as it starts and one as it lands. It is the only choreographed moment in the
 * app; everything else here stays quiet.
 *
 * What a member may read is RLS, not this file: before the reveal the photo
 * rows of other people simply do not come back.
 *
 * A guest who leaves a developed album is offered `(auth)/keep` once — after
 * they have seen the photos, never in front of them.
 */

import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, type FlatList, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedScrollHandler,
  useReducedMotion,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AlbumHero } from '@/components/ui/album-hero';
import { DevelopingFilm } from '@/components/ui/developing-film';
import { Glass, GlassButton } from '@/components/ui/glass';
import { PhotoTile, useTileRegistry } from '@/components/ui/photo-tile';
import { PhotoViewer, type Rect, type ViewerPhoto } from '@/components/ui/photo-viewer';
import { PillButton } from '@/components/ui/pill-button';
import { RevealVeil, revealDurationMs } from '@/components/ui/reveal-veil';
import { Screen } from '@/components/ui/screen';
import { Spinner } from '@/components/ui/spinner';
import { Body } from '@/components/ui/typography';
import { Album as T, Colors, Glass as GlassTokens } from '@/constants/theme';
import { Typography } from '@/constants/typography';
import {
  ensureCanSave,
  hasSeenReveal,
  loadAlbum,
  markRevealSeen,
  originalUrl,
  PhotoAccessDeniedError,
  savePhoto,
  sharePhoto,
  type Album,
  type AlbumPhoto,
} from '@/lib/album';
import { getSession, isAnonymous } from '@/lib/auth';
import { messageFor } from '@/lib/auth-errors';
import { endEvent, subscribeToEventStatus } from '@/lib/events';
import { deletePhoto } from '@/lib/photos';
import { isPromptDismissed } from '@/lib/prompt-dismissal';

type LoadState = { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; album: Album };

/** `waiting` holds the sheet dark; `playing` develops it; `done` is a plain album. */
type Reveal = 'waiting' | 'playing' | 'done';

const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

export default function AlbumScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [reveal, setReveal] = useState<Reveal>('waiting');
  const [open, setOpen] = useState<{ index: number; origin: Rect | null } | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [developing, setDeveloping] = useState(false);
  /** Whether leaving should pass through the "keep your film" offer. */
  const [offerKeep, setOfferKeep] = useState(false);

  /** Which photo opens the album — drawn once per visit, so it holds still. */
  const [heroDraw] = useState(() => Math.random());
  const [heroFull, setHeroFull] = useState<{ id: string; uri: string } | null>(null);

  const list = useRef<FlatList<AlbumPhoto>>(null);
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });
  const { register, rectOf } = useTileRegistry();

  // --- loading --------------------------------------------------------------

  const load = useCallback(async () => {
    if (!id) {
      setState({ kind: 'error' });
      return;
    }
    try {
      const album = await loadAlbum(id);
      setState({ kind: 'ready', album });
    } catch {
      // Keep a loaded album on screen over a failed refresh.
      setState((current) => (current.kind === 'ready' ? current : { kind: 'error' }));
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  // The host developing early, or the scheduled job catching up with the clock.
  useEffect(() => {
    if (!id) return;
    return subscribeToEventStatus(id, (next) => {
      if (next === 'developed') void load();
    });
  }, [id, load]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const user = (await getSession().catch(() => null))?.user;
      if (!user || !isAnonymous(user)) return;
      const dismissed = await isPromptDismissed(user.id);
      if (!cancelled) setOfferKeep(!dismissed);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const album = state.kind === 'ready' ? state.album : null;
  const photos = useMemo(() => album?.photos ?? [], [album]);
  const developed = album?.developed ?? false;

  // --- the hero -------------------------------------------------------------

  const heroIndex = photos.length > 0 ? Math.floor(heroDraw * photos.length) : -1;
  const hero = heroIndex >= 0 ? photos[heroIndex] : undefined;

  // The thumbnail is soft at this size: fetch a URL for the original.
  useEffect(() => {
    if (!hero) return;
    let cancelled = false;
    void originalUrl(hero)
      .then((uri) => {
        if (uri && !cancelled) setHeroFull({ id: hero.id, uri });
      })
      .catch(() => {
        // The thumbnail stays.
      });
    return () => {
      cancelled = true;
    };
    // Keyed by id: a refresh hands over a new object for the same photo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hero?.id]);

  // --- the reveal -----------------------------------------------------------

  const firstThumbs = useMemo(() => {
    const thumbs = photos.slice(0, T.reveal.maxStaggered).map((photo) => photo.thumbUri);
    return hero ? [hero.thumbUri, ...thumbs] : thumbs;
  }, [photos, hero]);

  useEffect(() => {
    if (!id || !developed || reveal !== 'waiting') return;
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    void (async () => {
      if (photos.length === 0 || (await hasSeenReveal(id))) {
        if (!cancelled) setReveal('done');
        return;
      }

      // Prints coming up over empty tiles would be an anticlimax: wait for the
      // first thumbnails, but not for ever.
      await Promise.race([
        Image.prefetch(firstThumbs).catch(() => false),
        new Promise((resolve) => timers.push(setTimeout(resolve, T.reveal.prefetchTimeoutMs))),
      ]);
      if (cancelled) return;

      setReveal('playing');
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      timers.push(
        setTimeout(() => {
          if (cancelled) return;
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setReveal('done');
          void markRevealSeen(id, photos.length);
          // The hero comes up first, so the sheet is one print longer.
        }, revealDurationMs(photos.length + 1, reducedMotion))
      );
    })();

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
    // `reveal` is left out on purpose: this effect moves it to 'playing' itself,
    // and re-running then would cancel the timer that finishes the reveal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, developed, photos.length]);

  // --- status capsule -------------------------------------------------------

  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const say = useCallback((message: string, sticky = false) => {
    if (statusTimer.current) clearTimeout(statusTimer.current);
    setStatus(message);
    if (!sticky) statusTimer.current = setTimeout(() => setStatus(null), T.status.showMs);
  }, []);
  useEffect(
    () => () => {
      if (statusTimer.current) clearTimeout(statusTimer.current);
    },
    []
  );

  // --- actions --------------------------------------------------------------

  const leave = useCallback(() => {
    if (developed && offerKeep) {
      router.replace('/(auth)/keep');
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(library)/films');
    }
  }, [developed, offerKeep, router]);

  const develop = useCallback(() => {
    if (!id) return;
    Alert.alert(
      'Develop the film now?',
      'This closes every camera and shows the photos to everyone. It cannot be undone.',
      [
        { text: 'Not yet', style: 'cancel' },
        {
          text: 'Develop',
          style: 'destructive',
          onPress: () => {
            setDeveloping(true);
            endEvent(id)
              .then(load)
              .catch((e) => Alert.alert("Couldn't develop the film", messageFor(e)))
              .finally(() => setDeveloping(false));
          },
        },
      ]
    );
  }, [id, load]);

  const guarded = useCallback(
    async (work: () => Promise<void>, failure: string) => {
      if (busy) return;
      setBusy(true);
      try {
        await work();
      } catch (e) {
        say(
          e instanceof PhotoAccessDeniedError
            ? 'Allow photo access in Settings to save.'
            : failure
        );
      } finally {
        setBusy(false);
      }
    },
    [busy, say]
  );

  const saveOne = useCallback(
    (photo: AlbumPhoto) =>
      guarded(async () => {
        await ensureCanSave();
        say('Saving…', true);
        await savePhoto(photo);
        say('Saved to your photos.');
      }, "Couldn't save the photo."),
    [guarded, say]
  );

  const shareOne = useCallback(
    (photo: AlbumPhoto) =>
      guarded(async () => {
        say('Preparing…', true);
        await sharePhoto(photo);
        setStatus(null);
      }, "Couldn't share the photo."),
    [guarded, say]
  );

  const saveAll = useCallback(() => {
    const total = photos.length;
    if (total === 0) return;
    Alert.alert(`Save all ${plural(total, 'photo', 'photos')}?`, 'They go to your photo library.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Save all',
        onPress: () =>
          void guarded(async () => {
            await ensureCanSave();
            let failed = 0;
            for (let i = 0; i < total; i += 1) {
              say(`Saving ${i + 1} / ${total}`, true);
              try {
                await savePhoto(photos[i]);
              } catch {
                failed += 1;
              }
            }
            say(
              failed === 0
                ? `Saved ${plural(total, 'photo', 'photos')}.`
                : `Saved ${total - failed} of ${total}. Try again for the rest.`
            );
          }, "Couldn't save the photos."),
      },
    ]);
  }, [photos, guarded, say]);

  const remove = useCallback(
    (photo: AlbumPhoto) => {
      Alert.alert(
        'Delete this photo?',
        photo.mine
          ? 'It is removed from the album for everyone.'
          : `${photo.author ?? 'Its photographer'} and everyone else lose it too.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () =>
              void guarded(async () => {
                await deletePhoto(photo.row);
                setState((current) =>
                  current.kind === 'ready'
                    ? {
                        kind: 'ready',
                        album: {
                          ...current.album,
                          photos: current.album.photos.filter((p) => p.id !== photo.id),
                        },
                      }
                    : current
                );
                say('Photo deleted.');
              }, "Couldn't delete the photo."),
          },
        ]
      );
    },
    [guarded, say]
  );

  // --- viewer ---------------------------------------------------------------

  const viewerPhotos = useMemo<ViewerPhoto[]>(
    () =>
      photos.map((photo) => ({
        id: photo.id,
        thumbUri: photo.thumbUri,
        full: () => originalUrl(photo),
        width: photo.width,
        height: photo.height,
        caption: photo.author,
      })),
    [photos]
  );

  const follow = useCallback((index: number) => {
    list.current?.scrollToIndex({
      index: Math.floor(index / T.columns),
      viewPosition: 0.5,
      animated: false,
    });
  }, []);

  const originFor = useCallback(
    (index: number) => {
      const photo = photos[index];
      return photo ? rectOf(photo.id) : Promise.resolve(null);
    },
    [photos, rectOf]
  );

  // --- render ---------------------------------------------------------------

  if (!album) {
    return (
      <Screen transparent>
        <View style={styles.plainHeader}>
          <GlassButton icon="chevron-left" accessibilityLabel="Back" onPress={leave} />
        </View>
        <View style={styles.center}>
          {state.kind === 'loading' ? (
            <Spinner />
          ) : (
            <>
              <Body small style={styles.centerCopy}>
                Couldn&rsquo;t load the album.{'\n'}Check your connection and try again.
              </Body>
              <PillButton
                label="Try again"
                variant="secondary"
                onPress={() => {
                  setState({ kind: 'loading' });
                  void load();
                }}
                style={styles.retry}
              />
            </>
          )}
        </View>
      </Screen>
    );
  }

  if (!developed) {
    return (
      <Screen transparent padded={false}>
        <View style={[styles.plainHeader, styles.plainHeaderInset]}>
          <GlassButton icon="chevron-left" accessibilityLabel="Back" onPress={leave} />
        </View>
        <DevelopingFilm
          eventName={album.event.name}
          endsAt={album.event.ends_at}
          shotsTaken={album.shotsTaken}
          memberCount={album.memberCount}
          canDevelop={album.isHost && album.event.status === 'live'}
          developing={developing}
          onDevelop={develop}
          onOpenCamera={() =>
            router.replace({ pathname: '/(capture)/camera', params: { eventId: album.event.id } })
          }
          onEnded={() => void load()}
        />
      </Screen>
    );
  }

  const veiled = reveal !== 'done';

  return (
    <View style={styles.root}>
      <Animated.FlatList
        ref={list}
        onScroll={onScroll}
        scrollEventThrottle={16}
        data={photos}
        keyExtractor={(photo) => photo.id}
        numColumns={T.columns}
        columnWrapperStyle={styles.row}
        contentContainerStyle={[
          styles.grid,
          { paddingBottom: insets.bottom + T.listPaddingBottom },
        ]}
        showsVerticalScrollIndicator={false}
        // The sheet holds still while it develops.
        scrollEnabled={!veiled}
        onScrollToIndexFailed={() => {
          // The row is not laid out yet; the viewer then closes with a fade.
        }}
        ListHeaderComponent={
          <AlbumHero
            title={album.event.name}
            photoCount={photos.length}
            memberCount={album.memberCount}
            photo={
              hero
                ? {
                    id: hero.id,
                    thumbUri: hero.thumbUri,
                    fullUri: heroFull?.id === hero.id ? heroFull.uri : undefined,
                  }
                : undefined
            }
            scrollY={scrollY}
            veil={
              veiled ? (
                <RevealVeil index={0} play={reveal === 'playing'} reducedMotion={reducedMotion} />
              ) : null
            }
            onPressPhoto={veiled ? undefined : () => setOpen({ index: heroIndex, origin: null })}
            onSaveAll={saveAll}
            saveDisabled={busy || veiled}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Body small style={styles.centerCopy}>
              Nobody took a photo.{'\n'}The film came back blank.
            </Body>
          </View>
        }
        renderItem={({ item, index }) => (
          <PhotoTile
            id={item.id}
            uri={item.thumbUri}
            accessibilityLabel={`Photo ${index + 1} of ${photos.length}${item.author ? `, by ${item.author}` : ''}`}
            register={register}
            onPress={(origin) => {
              if (!veiled) setOpen({ index, origin });
            }}
            style={styles.tile}>
            {item.author ? (
              <>
                <LinearGradient
                  pointerEvents="none"
                  colors={T.tile.captionFade}
                  style={styles.captionFade}
                />
                <Text style={styles.caption} numberOfLines={1}>
                  {item.author}
                </Text>
              </>
            ) : null}
            {veiled ? (
              // The hero is print 0.
              <RevealVeil
                index={index + 1}
                play={reveal === 'playing'}
                reducedMotion={reducedMotion}
              />
            ) : null}
          </PhotoTile>
        )}
      />

      {/* A soft edge where the grid scrolls under the back button, instead of a divider. */}
      <LinearGradient
        pointerEvents="none"
        colors={[T.topFadeColor, 'rgba(16,16,16,0)']}
        style={[styles.topFade, { height: insets.top + T.topFade }]}
      />

      <View style={[styles.chrome, { top: insets.top + T.chromeInset }]} pointerEvents="box-none">
        <GlassButton icon="chevron-left" accessibilityLabel="Back" onPress={leave} />
      </View>

      {open && viewerPhotos.length > 0 ? (
        <PhotoViewer
          photos={viewerPhotos}
          initialIndex={open.index}
          origin={open.origin}
          originFor={originFor}
          onIndexChange={follow}
          onClose={() => setOpen(null)}
          renderActions={(_, index) => {
            const photo = photos[index];
            if (!photo) return null;
            return (
              <>
                <GlassButton
                  icon="download"
                  label="Save"
                  accessibilityLabel="Save this photo"
                  disabled={busy}
                  onPress={() => void saveOne(photo)}
                />
                <GlassButton
                  icon="share"
                  label="Share"
                  accessibilityLabel="Share this photo"
                  disabled={busy}
                  onPress={() => void shareOne(photo)}
                />
                {album.isHost || photo.mine ? (
                  <GlassButton
                    icon="trash-2"
                    accessibilityLabel="Delete this photo"
                    color={Colors.destructive}
                    disabled={busy}
                    onPress={() => remove(photo)}
                  />
                ) : null}
              </>
            );
          }}
        />
      ) : null}

      {status ? (
        <View
          style={[styles.status, { bottom: insets.bottom + T.status.bottom }]}
          pointerEvents="none"
          accessibilityLiveRegion="polite">
          <Glass radius={GlassTokens.capsuleHeight / 2} style={styles.statusCapsule}>
            <Text style={styles.statusText}>{status}</Text>
          </Glass>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  plainHeader: {
    paddingTop: T.chromeInset,
  },
  plainHeaderInset: {
    paddingHorizontal: T.chromeInset,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerCopy: {
    textAlign: 'center',
  },
  retry: {
    marginTop: T.titlePaddingBottom,
    alignSelf: 'stretch',
  },
  grid: {
    gap: T.gap,
  },
  row: {
    gap: T.gap,
    paddingHorizontal: T.gridPaddingX,
  },
  tile: {
    flex: 1 / T.columns,
    borderRadius: T.tile.radius,
  },
  captionFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: T.tile.captionFadeHeight,
  },
  caption: {
    ...Typography.tileCaption,
    position: 'absolute',
    left: T.tile.captionPaddingX,
    right: T.tile.captionPaddingX,
    bottom: T.tile.captionPaddingBottom,
    color: Colors.text,
  },
  empty: {
    paddingTop: T.titlePaddingBottom,
    alignItems: 'center',
  },
  topFade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  chrome: {
    position: 'absolute',
    left: T.chromeInset,
    right: T.chromeInset,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  status: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  statusCapsule: {
    height: GlassTokens.capsuleHeight,
    paddingHorizontal: GlassTokens.capsulePaddingX,
    justifyContent: 'center',
  },
  statusText: {
    ...Typography.durationPill,
    color: Colors.text,
  },
});
