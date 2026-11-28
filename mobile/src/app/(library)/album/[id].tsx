/**
 * 17 · Album
 *
 * Replaces the clip player; **not in the prototype**. The `id` param is the
 * event id. One route, two states, decided by the server's clock:
 *
 *  - **Before the event is developed** — the gallery (2026-11-23, the user,
 *    replacing "Nothing to see yet"): `DevelopingHero` (the event image, a
 *    large countdown, the count so far, the camera and the host's "Develop
 *    now"), then every photo three to a row — the viewer's own sharp and
 *    openable, everyone else's a blurhash smudge with the photographer's name
 *    and a small countdown (`HiddenPhotoTile`).
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
import { haptic } from '@/lib/haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, type FlatList, Share, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AlbumHero } from '@/components/ui/album-hero';
import { DevelopingHero } from '@/components/ui/developing-hero';
import { HiddenPhotoTile } from '@/components/ui/hidden-photo-tile';
import { Glass, GlassButton } from '@/components/ui/glass';
import { PhotoTile, useTileRegistry } from '@/components/ui/photo-tile';
import { PhotoViewer, type Rect, type ViewerPhoto } from '@/components/ui/photo-viewer';
import { PillButton } from '@/components/ui/pill-button';
import { Screen } from '@/components/ui/screen';
import { Spinner } from '@/components/ui/spinner';
import { Body } from '@/components/ui/typography';
import { Album as T, Colors, Glass as GlassTokens, MissionsCamera } from '@/constants/theme';
import { Typography } from '@/constants/typography';
import { t } from '@/i18n';
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
  type HiddenPhoto,
} from '@/lib/album';
import { getSession, isAnonymous } from '@/lib/auth';
import { messageFor } from '@/lib/auth-errors';
import { useMomentActions } from '@/hooks/use-moment-actions';
import { countdownParts } from '@/lib/event-end';
import { endEvent, EventGoneError, subscribeToEventStatus } from '@/lib/events';
import { canImport, importAllowance, importPhotos } from '@/lib/import-photos';
import { inviteUrl } from '@/lib/invite';
import { pendingCount, subscribeToQueue } from '@/lib/upload-queue';
import { listPhotoMissions } from '@/lib/missions';
import { deletePhoto, reportPhoto } from '@/lib/photos';
import { isPromptDismissed } from '@/lib/prompt-dismissal';
import { signedUrls } from '@/lib/storage';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error' }
  /** Deleted by its host (or never this user's): nothing to retry. */
  | { kind: 'gone' }
  | { kind: 'ready'; album: Album };

type GridItem = AlbumPhoto | HiddenPhoto;
const isHiddenPhoto = (item: GridItem): item is HiddenPhoto => 'kind' in item;

export default function AlbumScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [open, setOpen] = useState<{
    index: number;
    origin: Rect | null;
  } | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [developing, setDeveloping] = useState(false);
  /** Whether leaving should pass through the "keep your film" offer. */
  const [offerKeep, setOfferKeep] = useState(false);

  const list = useRef<FlatList<GridItem>>(null);
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
    }, [load]),
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

  // --- before the reveal: the countdown and fresh photos ----------------------

  const waiting = album !== null && !developed;
  const endsAt = album?.event.ends_at;
  const [now, setNow] = useState(() => new Date());
  const remaining = endsAt ? new Date(endsAt).getTime() - now.getTime() : 0;
  // Seconds are on screen in the last hour; before that a slow tick is enough.
  const tickMs = remaining < 3_600_000 ? T.developing.fastTickMs : T.developing.slowTickMs;
  useEffect(() => {
    if (!waiting) return;
    const tick = setInterval(() => setNow(new Date()), tickMs);
    return () => clearInterval(tick);
  }, [waiting, tickMs]);
  const countdown = useMemo(
    () => countdownParts(endsAt ? new Date(endsAt) : now, now),
    [endsAt, now],
  );
  const countdownLabel = `${countdown[0].value}${countdown[0].unit} ${countdown[1].value}${countdown[1].unit}`;

  // The clock passing the end develops the film (RLS reads the clock).
  const ended = waiting && remaining <= 0;
  useEffect(() => {
    if (ended) void load();
  }, [ended, load]);

  // Others' photos arrive while the screen is open.
  useFocusEffect(
    useCallback(() => {
      if (!waiting) return;
      const timer = setInterval(() => void load(), T.developing.refreshMs);
      return () => clearInterval(timer);
    }, [waiting, load]),
  );

  const hidden = useMemo(() => album?.hidden ?? [], [album]);
  const gridItems = useMemo<readonly GridItem[]>(
    () => (developed ? photos : hidden),
    [developed, photos, hidden],
  );
  /** Only the viewer's own frames open before the reveal. */
  const mineBefore = useMemo(
    () =>
      hidden.filter((item): item is Extract<HiddenPhoto, { kind: 'mine' }> => item.kind === 'mine'),
    [hidden],
  );

  /*
    Which mission each photo was for, for the viewer's caption. Asked once the
    film is developed (RLS returns everyone's then) and only when the event had
    missions. Without an answer the photos simply carry no caption.
  */
  const [missionByPhoto, setMissionByPhoto] = useState<ReadonlyMap<string, string>>(
    () => new Map(),
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
      haptic.success();
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
    [],
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
    Alert.alert(t('album.developTitle'), t('album.developBody'), [
      { text: t('album.developNotYet'), style: 'cancel' },
      {
        text: t('album.develop'),
        style: 'destructive',
        onPress: () => {
          setDeveloping(true);
          endEvent(id)
            .then(load)
            .catch((e) => Alert.alert(t('album.developFailed'), messageFor(e)))
            .finally(() => setDeveloping(false));
        },
      },
    ]);
  }, [id, load]);

  // Rename / delete / remove (2026-11-21) — the same menu as a long press on
  // the Moments card.
  const openMenu = useMomentActions({
    onRenamed: (name) =>
      setState((current) =>
        current.kind === 'ready'
          ? {
              kind: 'ready',
              album: {
                ...current.album,
                event: { ...current.album.event, name },
              },
            }
          : current,
      ),
    onGone: () => router.replace('/(library)/films'),
  });
  const menu = album ? (
    <GlassButton
      icon="more-horizontal"
      accessibilityLabel={t('album.more')}
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
        say(t('album.adding', { count: added }));
        lastQueued.current = id ? pendingCount(id) : 0;
        setQueued(lastQueued.current);
      }
    } catch {
      say(t('album.addFailed'));
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
          e instanceof PhotoAccessDeniedError ? t('album.allowPhotoAccess') : failure,
        );
      } finally {
        setBusy(false);
      }
    },
    [busy, say],
  );

  const saveOne = useCallback(
    (photo: AlbumPhoto) =>
      guarded(async () => {
        await ensureCanSave();
        say(t('album.saving'), true);
        await savePhoto(photo);
        say(t('album.saved'));
      }, t('album.saveFailed')),
    [guarded, say],
  );

  const shareOne = useCallback(
    (photo: AlbumPhoto) =>
      guarded(async () => {
        say(t('album.preparing'), true);
        await sharePhoto(photo);
        setStatus(null);
      }, t('album.shareFailed')),
    [guarded, say],
  );

  const saveAll = useCallback(() => {
    const total = photos.length;
    if (total === 0) return;
    Alert.alert(t('album.saveAllTitle', { count: total }), t('album.saveAllBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('album.saveAll'),
        onPress: () =>
          void guarded(async () => {
            await ensureCanSave();
            let failed = 0;
            for (let i = 0; i < total; i += 1) {
              say(t('album.savingProgress', { index: i + 1, count: total }), true);
              try {
                await savePhoto(photos[i]);
              } catch {
                failed += 1;
              }
            }
            say(
              failed === 0
                ? t('album.savedAll', { count: total })
                : t('album.savedSome', { saved: total - failed, count: total }),
            );
          }, t('album.saveAllFailed')),
      },
    ]);
  }, [photos, guarded, say]);

  const remove = useCallback(
    (photo: AlbumPhoto) => {
      Alert.alert(
        t('album.deleteTitle'),
        photo.mine
          ? t('album.deleteMineBody')
          : photo.author
            ? t('album.deleteOthersBody', { author: photo.author })
            : t('album.deleteUnknownBody'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('common.delete'),
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
                    : current,
                );
                say(t('album.photoDeleted'));
              }, t('album.deleteFailed')),
          },
        ],
      );
    },
    [guarded, say],
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
        t('album.reportTitle'),
        t('album.reportBody'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('album.report'),
            style: 'destructive',
            onPress: () =>
              void guarded(async () => {
                await reportPhoto(photo.id);
                say(t('album.reported'));
              }, t('album.reportFailed')),
          },
        ],
      );
    },
    [guarded, say],
  );

  // --- viewer ---------------------------------------------------------------

  const viewerPhotos = useMemo<ViewerPhoto[]>(
    () =>
      !developed
        ? mineBefore.map((item) => ({
            id: item.id,
            thumbUri: item.shot.thumbUri,
            full: async () => {
              const full = item.shot.full;
              if ('uri' in full) return full.uri;
              return (await signedUrls([full.path])).get(full.path);
            },
            width: null,
            height: null,
            caption: item.author,
          }))
        : photos.map((photo) => ({
            id: photo.id,
            thumbUri: photo.thumbUri,
            full: () => originalUrl(photo),
            width: photo.width,
            height: photo.height,
            caption: photo.author,
            mission: missionByPhoto.get(photo.id),
          })),
    [developed, mineBefore, photos, missionByPhoto],
  );

  /** The viewer's photo — the status capsule steps above its mission caption. */
  const [viewerIndex, setViewerIndex] = useState(0);

  const follow = useCallback(
    (index: number) => {
      setViewerIndex(index);
      // Before the reveal the viewer pages the own frames, which sit among the others.
      const at = developed ? index : hidden.findIndex((item) => item.id === mineBefore[index]?.id);
      if (at < 0) return;
      list.current?.scrollToIndex({
        index: Math.floor(at / T.columns),
        viewPosition: 0.5,
        animated: false,
      });
    },
    [developed, hidden, mineBefore],
  );

  const originFor = useCallback(
    (index: number) => {
      const id = developed ? photos[index]?.id : mineBefore[index]?.id;
      return id ? rectOf(id) : Promise.resolve(null);
    },
    [developed, photos, mineBefore, rectOf],
  );

  // --- render ---------------------------------------------------------------

  if (!album) {
    return (
      <Screen transparent>
        <View style={styles.plainHeader}>
          <GlassButton icon="chevron-left" accessibilityLabel={t('common.back')} onPress={leave} />
        </View>
        <View style={styles.center}>
          {state.kind === 'loading' ? (
            <Spinner />
          ) : state.kind === 'gone' ? (
            <Body small style={styles.centerCopy}>
              {t('album.gone')}
            </Body>
          ) : (
            <>
              <Body small style={styles.centerCopy}>
                {t('album.loadFailed')}
              </Body>
              <PillButton
                label={t('common.tryAgain')}
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

  const shareAlbum = () => {
    // The invite link opens the album for every member (app, App Clip or
    // browser) and lets a newcomer join and see it.
    void Share.share({
      message: t('album.shareMessage', {
        name: album.event.name,
        url: inviteUrl(album.event.invite_code),
      }),
    }).catch(() => say(t('album.shareAlbumFailed')));
  };

  return (
    <View style={styles.root}>
      <Animated.FlatList
        ref={list}
        onScroll={onScroll}
        scrollEventThrottle={16}
        data={gridItems}
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
          !developed ? (
            <DevelopingHero
              title={album.event.name}
              cover={album.event}
              countdown={countdown}
              shotsTaken={album.shotsTaken}
              memberCount={album.memberCount}
              scrollY={scrollY}
              onOpenCamera={() =>
                router.replace({
                  pathname: '/(capture)/camera',
                  params: { eventId: album.event.id },
                })
              }
              onDevelop={album.isHost && album.event.status === 'live' ? develop : undefined}
              developing={developing}
            />
          ) : (
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
          )
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Body small style={styles.centerCopy}>
              {developed
                ? t('album.emptyDeveloped')
                : t('album.emptyWaiting')}
            </Body>
          </View>
        }
        extraData={countdownLabel}
        renderItem={({ item, index }) => {
          if (isHiddenPhoto(item)) {
            if (item.kind === 'hidden') {
              return (
                <HiddenPhotoTile
                  blurhash={item.blurhash}
                  author={item.author}
                  countdown={countdownLabel}
                  style={styles.tile}
                />
              );
            }
            const own = mineBefore.indexOf(item);
            return (
              <PhotoTile
                id={item.id}
                uri={item.shot.thumbUri}
                accessibilityLabel={t('album.yourPhotoOf', {
                  index: own + 1,
                  count: mineBefore.length,
                })}
                register={register}
                onPress={(origin) => setOpen({ index: own, origin })}
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
              </PhotoTile>
            );
          }
          return (
            <PhotoTile
              id={item.id}
              uri={item.thumbUri}
              accessibilityLabel={t(
                item.author
                  ? missionByPhoto.has(item.id)
                    ? 'album.photoOfByMission'
                    : 'album.photoOfBy'
                  : missionByPhoto.has(item.id)
                    ? 'album.photoOfMission'
                    : 'album.photoOf',
                { index: index + 1, count: photos.length, author: item.author ?? '' }
              )}
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
          );
        }}
      />

      {/* A soft edge where the grid scrolls under the back button, instead of a divider. */}
      <LinearGradient
        pointerEvents="none"
        colors={[T.topFadeColor, 'rgba(16,16,16,0)']}
        style={[styles.topFade, { height: insets.top + T.topFade }]}
      />

      <View style={[styles.chrome, { top: insets.top + T.chromeInset }]} pointerEvents="box-none">
        <GlassButton icon="chevron-left" accessibilityLabel={t('common.back')} onPress={leave} />
        <View style={styles.chromeRight}>
          {allowance > 0 ? (
            <GlassButton
              icon="plus"
              label={t('album.add')}
              accessibilityLabel={t('album.addA11y', { count: allowance })}
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
            if (!developed) return null;
            const photo = photos[index];
            if (!photo) return null;
            return (
              <>
                <GlassButton
                  icon="download"
                  label={t('common.save')}
                  accessibilityLabel={t('album.saveThis')}
                  disabled={busy}
                  onPress={() => void saveOne(photo)}
                />
                <GlassButton
                  icon="share"
                  label={t('common.share')}
                  accessibilityLabel={t('album.shareThis')}
                  disabled={busy}
                  onPress={() => void shareOne(photo)}
                />
                {album.isHost || photo.mine ? (
                  <GlassButton
                    icon="trash-2"
                    accessibilityLabel={t('album.deleteThis')}
                    color={Colors.destructive}
                    disabled={busy}
                    onPress={() => remove(photo)}
                  />
                ) : (
                  <GlassButton
                    icon="flag"
                    accessibilityLabel={t('album.reportThis')}
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
                (open && viewerPhotos[viewerIndex]?.mission
                  ? MissionsCamera.caption.statusLift
                  : 0),
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
