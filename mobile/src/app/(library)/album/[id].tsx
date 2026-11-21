/**
 * 17 · Album
 *
 * Replaces the clip player; **not in the prototype**. The `id` param is the
 * event id. One route, two states, decided by the server's clock:
 *
 *  - **Before the event is developed** — `DevelopingFilm`: a countdown, how
 *    many photos exist, nothing to see. The host can develop early.
 *  - **Developed** — `AlbumHero` (the event image in the look since
 *    2026-11-21, full-bleed and going dark towards the name,
 *    the two counts, "Save all" and "Share" as small glass capsules), then
 *    the whole group's photos three to a row (2026-11-21, the user; two since
 *    2026-11-16) with the photographer's name small on each and a glass
 *    target badge on a mission photo; the shared `PhotoViewer`, save, share
 *    and moderation.
 *
 * **No reveal animation** (2026-11-21, the user: it locked the album while it
 * played). A developed album is usable at once; the first time it is opened
 * on this phone it only gives one haptic and records `reveal_seen`.
 *
 * What a member may read is RLS, not this file: before the reveal the photo
 * rows of other people simply do not come back.
 *
 * A guest who leaves a developed album is offered `(auth)/keep` once — after
 * they have seen the photos, never in front of them.
 *
 * A photo taken for a mission shows it in the viewer ("Mission · …",
 * `listPhotoMissions`) and a badge on its tile.
 */

import { Feather } from '@expo/vector-icons';
import { type ImageSource } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, type FlatList, Share, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AlbumHero } from '@/components/ui/album-hero';
import { DevelopingFilm } from '@/components/ui/developing-film';
import { Glass, GlassButton } from '@/components/ui/glass';
import { PhotoTile, useTileRegistry } from '@/components/ui/photo-tile';
import { PhotoViewer, type Rect, type ViewerPhoto } from '@/components/ui/photo-viewer';
import { PillButton } from '@/components/ui/pill-button';
import { Screen } from '@/components/ui/screen';
import { Spinner } from '@/components/ui/spinner';
import { Body } from '@/components/ui/typography';
import { samplesFor } from '@/constants/samples';
import { Album as T, Colors, Glass as GlassTokens, MissionsCamera } from '@/constants/theme';
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
import { useMomentActions } from '@/hooks/use-moment-actions';
import { endEvent, EventGoneError, subscribeToEventStatus } from '@/lib/events';
import { canImport, importAllowance, importPhotos } from '@/lib/import-photos';
import { inviteUrl } from '@/lib/invite';
import { pendingCount, subscribeToQueue } from '@/lib/upload-queue';
import { listPhotoMissions } from '@/lib/missions';
import { loadMyShots } from '@/lib/my-shots';
import { deletePhoto, reportPhoto } from '@/lib/photos';
import { isPromptDismissed } from '@/lib/prompt-dismissal';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error' }
  /** Deleted by its host (or never this user's): nothing to retry. */
  | { kind: 'gone' }
  | { kind: 'ready'; album: Album };

const NO_FRAMES: ImageSource[] = [];

const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

export default function AlbumScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [open, setOpen] = useState<{ index: number; origin: Rect | null } | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [developing, setDeveloping] = useState(false);
  /** Whether leaving should pass through the "keep your film" offer. */
  const [offerKeep, setOfferKeep] = useState(false);


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
    } catch (e) {
      if (e instanceof EventGoneError) {
        setState({ kind: 'gone' });
        return;
      }
      // Keep a loaded album on screen over a failed refresh.
      setState((current) => (current.kind === 'ready' ? current : { kind: 'error' }));
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  /*
    What the developing state's frames hold under their blur: the viewer's own
    latest frames, then stand-ins. Other people's photos cannot be fetched
    before the reveal (RLS), and at that blur a stand-in says the same thing —
    there is a picture here, and it cannot be seen yet.
  */
  // `null` until the viewer's frames are known, so stand-ins never flash first.
  const [ownThumbs, setOwnThumbs] = useState<readonly string[] | null>(null);
  const waiting = state.kind === 'ready' && !state.album.developed;
  useEffect(() => {
    if (!id || !waiting) return;
    let cancelled = false;
    void loadMyShots(id).then((shots) => {
      if (!cancelled) setOwnThumbs(shots.slice(0, T.developing.frames).map((shot) => shot.thumbUri));
    });
    return () => {
      cancelled = true;
    };
  }, [id, waiting]);
  const hiddenFrames = useMemo<ImageSource[]>(() => {
    if (ownThumbs === null) return NO_FRAMES;
    // Stock pictures only for someone with no photos of their own; otherwise
    // the viewer's own frames, repeated to fill the strip.
    if (ownThumbs.length === 0) return samplesFor(id ?? '', T.developing.frames);
    return Array.from({ length: T.developing.frames }, (_, i) => ({
      uri: ownThumbs[i % ownThumbs.length],
    }));
  }, [id, ownThumbs]);

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

  /*
    Which mission each photo was for, for the viewer's caption. Asked once the
    film is developed (RLS returns everyone's then) and only when the event had
    missions. Without an answer the photos simply carry no caption.
  */
  const [missionByPhoto, setMissionByPhoto] = useState<ReadonlyMap<string, string>>(
    () => new Map()
  );
  const hadMissions = album?.event.missions_per_guest != null;
  useEffect(() => {
    if (!id || !developed || !hadMissions) return;
    let cancelled = false;
    listPhotoMissions(id)
      .then((map) => {
        if (!cancelled) setMissionByPhoto(map);
      })
      .catch(() => {
        // No captions; the album is complete without them.
      });
    return () => {
      cancelled = true;
    };
  }, [id, developed, hadMissions]);

  // --- first look -----------------------------------------------------------

  // No animation any more (2026-11-21): the photos are simply there. The first
  // open on this phone still gets the reveal's haptic and its analytics event.
  useEffect(() => {
    if (!id || !developed || photos.length === 0) return;
    let cancelled = false;
    void hasSeenReveal(id).then((seen) => {
      if (seen || cancelled) return;
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      void markRevealSeen(id, photos.length);
    });
    return () => {
      cancelled = true;
    };
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
      'Closes every camera and shows the photos to everyone.',
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

  // Rename / delete / remove (2026-11-21) — the same menu as a long press on
  // the Moments card.
  const openMenu = useMomentActions({
    onRenamed: (name) =>
      setState((current) =>
        current.kind === 'ready'
          ? { kind: 'ready', album: { ...current.album, event: { ...current.album.event, name } } }
          : current
      ),
    onGone: () => router.replace('/(library)/films'),
  });
  const menu = album ? (
    <GlassButton
      icon="more-horizontal"
      accessibilityLabel="More"
      onPress={() =>
        openMenu({
          event: album.event,
          isHost: album.isHost,
          photoCount: album.developed ? album.photos.length : album.shotsTaken,
          memberCount: album.memberCount,
        })
      }
    />
  ) : null;

  // --- add from the library (2026-11-21) -------------------------------------

  // Photos can be added after the reveal too, up to the guest's roll
  // (lib/import-photos.ts). They show up here once uploaded, for everyone.
  const [allowance, setAllowance] = useState(0);
  const [importing, setImporting] = useState(false);
  const [queued, setQueued] = useState(() => (id ? pendingCount(id) : 0));
  const albumEvent = album?.event;
  useEffect(() => {
    if (!albumEvent || !canImport()) return;
    let cancelled = false;
    void importAllowance(albumEvent).then((left) => {
      if (!cancelled) setAllowance(left ?? 0);
    });
    return () => {
      cancelled = true;
    };
  }, [albumEvent, queued]);

  // When one of this phone's photos for this moment finishes, read the album again.
  const lastQueued = useRef(queued);
  useEffect(() => {
    if (!id) return;
    return subscribeToQueue((change) => {
      if (change.type !== 'changed') return;
      const next = pendingCount(id);
      if (next < lastQueued.current) void load();
      lastQueued.current = next;
      setQueued(next);
    });
  }, [id, load]);

  const addPhotos = useCallback(async () => {
    if (!albumEvent || importing || allowance <= 0) return;
    setImporting(true);
    try {
      const added = await importPhotos(albumEvent, allowance);
      if (added > 0) {
        say(`Adding ${plural(added, 'photo', 'photos')}…`);
        lastQueued.current = id ? pendingCount(id) : 0;
        setQueued(lastQueued.current);
      }
    } catch {
      say("Couldn't add the photos.");
    } finally {
      setImporting(false);
    }
  }, [albumEvent, allowance, id, importing, say]);

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

  /*
    Reporting, for a picture that is neither the viewer's nor in their event to
    moderate — the host and the photographer delete instead. Both stores require
    it for user content. The report goes to the operator; the picture stays in
    the album until someone acts on it, and the alert says so rather than
    implying it is gone.
  */
  const report = useCallback(
    (photo: AlbumPhoto) => {
      Alert.alert(
        'Report this photo?',
        'We check reports within 24 hours. The host can also delete it.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Report',
            style: 'destructive',
            onPress: () =>
              void guarded(async () => {
                await reportPhoto(photo.id);
                say('Reported. Thank you.');
              }, "Couldn't send the report."),
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
        mission: missionByPhoto.get(photo.id),
      })),
    [photos, missionByPhoto]
  );

  /** The viewer's photo — the status capsule steps above its mission caption. */
  const [viewerIndex, setViewerIndex] = useState(0);

  const follow = useCallback((index: number) => {
    setViewerIndex(index);
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
          ) : state.kind === 'gone' ? (
            <Body small style={styles.centerCopy}>
              This moment was deleted.
            </Body>
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
        <View style={[styles.plainHeader, styles.plainHeaderInset, styles.headerRow]}>
          <GlassButton icon="chevron-left" accessibilityLabel="Back" onPress={leave} />
          {menu}
        </View>
        <DevelopingFilm
          eventName={album.event.name}
          endsAt={album.event.ends_at}
          shotsTaken={album.shotsTaken}
          memberCount={album.memberCount}
          photos={hiddenFrames}
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

  const shareAlbum = () => {
    // The invite link opens the album for every member (app, App Clip or
    // browser) and lets a newcomer join and see it.
    void Share.share({
      message: `Our photos from ${album.event.name}: ${inviteUrl(album.event.invite_code)}`,
    }).catch(() => say("Couldn't share the album."));
  };

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
        onScrollToIndexFailed={() => {
          // The row is not laid out yet; the viewer then closes with a fade.
        }}
        ListHeaderComponent={
          <AlbumHero
            title={album.event.name}
            photoCount={photos.length}
            memberCount={album.memberCount}
            // The event image heads the album (the user, 2026-11-21), not a
            // random print; the prints are all in the grid below.
            cover={album.event}
            scrollY={scrollY}
            onSaveAll={saveAll}
            onShare={shareAlbum}
            saveDisabled={busy}
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
            accessibilityLabel={`Photo ${index + 1} of ${photos.length}${item.author ? `, by ${item.author}` : ''}${missionByPhoto.has(item.id) ? ', a mission' : ''}`}
            register={register}
            onPress={(origin) => setOpen({ index, origin })}
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
            {missionByPhoto.has(item.id) ? (
              // Glass over the print, never over other glass.
              <Glass radius={T.tile.missionBadge / 2} style={styles.missionBadge}>
                <Feather name="target" size={T.tile.missionIcon} color={Colors.text} />
              </Glass>
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
        <View style={styles.chromeRight}>
          {allowance > 0 ? (
            <GlassButton
              icon="plus"
              label="Add"
              accessibilityLabel={`Add photos from your library, ${allowance} left`}
              disabled={importing}
              onPress={() => void addPhotos()}
            />
          ) : null}
          {menu}
        </View>
      </View>

      {/*
        While a photo is open, a swipe in from the left edge closes the photo
        (the viewer's own "back"), not this screen.
      */}
      <Stack.Screen options={{ gestureEnabled: !open }} />

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
                ) : (
                  <GlassButton
                    icon="flag"
                    accessibilityLabel="Report this photo"
                    disabled={busy}
                    onPress={() => report(photo)}
                  />
                )}
              </>
            );
          }}
        />
      ) : null}

      {status ? (
        <View
          style={[
            styles.status,
            {
              bottom:
                insets.bottom +
                T.status.bottom +
                (open && viewerPhotos[viewerIndex]?.mission ? MissionsCamera.caption.statusLift : 0),
            },
          ]}
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  missionBadge: {
    position: 'absolute',
    top: T.tile.missionInset,
    right: T.tile.missionInset,
    width: T.tile.missionBadge,
    height: T.tile.missionBadge,
    alignItems: 'center',
    justifyContent: 'center',
  },
  caption: {
    ...Typography.tileCaptionSm,
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
  chromeRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.hero.actionGap,
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
