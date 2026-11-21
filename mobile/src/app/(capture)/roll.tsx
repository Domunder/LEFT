/**
 * Your shots — the frames this guest has taken in a live event.
 *
 * Reached from the tile in 13's bottom-left corner. **Not in the prototype**,
 * and a change to the original rule that nothing is seen before the reveal:
 * a guest may look at their *own* pictures. Everyone else's stay hidden until
 * the film is developed — that is RLS, and nothing here can widen it.
 *
 * The frames come from `lib/my-shots.ts`: uploaded ones and those still in the
 * upload queue, so the sheet is complete with no signal.
 *
 * A contact sheet, deliberately plain. Tapping a frame opens the shared
 * `PhotoViewer` from that tile — swipe through the roll, pinch, drag down to
 * put it back.
 *
 * **Missions** (2026-11-17): a frame taken for a mission carries a small mark
 * on its tile and "Mission · …" in the viewer. While the event is live and the
 * guest was dealt missions, the viewer has a "Mission" action that opens
 * `MissionPickerSheet` — the way to mark a photo taken without arming the
 * mission first. A frame still waiting for its claim is tagged in the queue;
 * a claimed one goes straight to the server (`setShotMission`).
 *
 * **Add photos** (2026-11-21, the user): a glass "Add" capsule in the header
 * opens Apple's picker for up to the shots left (`lib/import-photos.ts`); the
 * picked photos join the queue like camera frames, without the look. Hidden
 * when the roll is used up, before the start, or in a build without the
 * picker.
 */

import { Feather } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, StyleSheet, View } from 'react-native';

import { ScrollEdged } from '@/components/ui/scroll-edge';

import { CircleIconButton } from '@/components/ui/circle-back-button';
import { GlassButton } from '@/components/ui/glass';
import { MissionPickerSheet } from '@/components/ui/mission-sheet';
import { PhotoTile, useTileRegistry } from '@/components/ui/photo-tile';
import { PhotoViewer, type Rect, type ViewerPhoto } from '@/components/ui/photo-viewer';
import { Screen } from '@/components/ui/screen';
import { Spinner } from '@/components/ui/spinner';
import { Body, Display, Em } from '@/components/ui/typography';
import { Colors, MissionsCamera as M, ScrollEdge as Edge, Shots as T, Spacing } from '@/constants/theme';
import { getSession } from '@/lib/auth';
import { getEvent, isDeveloped, type Event } from '@/lib/events';
import { canImport, importAllowance, importPhotos } from '@/lib/import-photos';
import type { Mission } from '@/lib/missions';
import {
  applyMissionTag,
  cachedMissions,
  fetchMissions,
  loadMyShots,
  missionOf,
  withQueuedTags,
  type MyShot as Shot,
} from '@/lib/my-shots';
import { signedUrls } from '@/lib/storage';
import { setShotMission, subscribeToQueue } from '@/lib/upload-queue';

/** What the server said, in words for the picker. */
function tagFailure(error: unknown): { message: string; closed: boolean } {
  const hint = (error as { hint?: string } | null)?.hint;
  if (hint === 'event_closed') {
    return { message: 'The film is developed. Missions are locked.', closed: true };
  }
  if (hint === 'not_yours') {
    return { message: 'That mission isn’t one of yours.', closed: false };
  }
  return { message: 'Couldn’t save. Try again.', closed: false };
}

export default function RollScreen() {
  const router = useRouter();
  const { eventId } = useLocalSearchParams<{ eventId?: string }>();

  const [shots, setShots] = useState<Shot[] | null>(null);
  const [open, setOpen] = useState<{
    index: number;
    origin: Rect | null;
  } | null>(null);

  const list = useRef<FlatList<Shot>>(null);
  const { register, rectOf } = useTileRegistry();

  /** Bumped on every queue change: frames move, and owed mission tags with them. */
  const [queueVersion, setQueueVersion] = useState(0);
  /** Bumped when a tag reached the server or was dropped. */
  const [missionsVersion, setMissionsVersion] = useState(0);

  useEffect(() => {
    if (!eventId) return;
    let cancelled = false;

    const load = () =>
      void loadMyShots(eventId).then((next) => {
        if (!cancelled) setShots(next);
      });

    load();
    // A frame finishing its upload moves from one source to the other.
    const unsubscribe = subscribeToQueue((change) => {
      if (change.type === 'changed') {
        load();
        setQueueVersion((n) => n + 1);
      } else if (change.type === 'mission' && change.eventId === eventId) {
        setMissionsVersion((n) => n + 1);
      }
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [eventId]);

  // --- add from the library --------------------------------------------------

  const [event, setEvent] = useState<Event | null>(null);
  const [allowance, setAllowance] = useState(0);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (!eventId || !canImport()) return;
    let cancelled = false;
    getEvent(eventId)
      .then(async (next) => {
        const left = await importAllowance(next);
        if (cancelled) return;
        setEvent(next);
        setAllowance(left ?? 0);
      })
      .catch(() => {
        // Offline: no button; the camera still works.
      });
    return () => {
      cancelled = true;
    };
    // Each queue change can move the count: a claim, a refusal, a new frame.
  }, [eventId, queueVersion]);

  const addPhotos = useCallback(async () => {
    if (!event || importing || allowance <= 0) return;
    setImporting(true);
    try {
      await importPhotos(event, allowance);
    } catch (e) {
      Alert.alert("Couldn't add the photos", e instanceof Error ? e.message : 'Try again.');
    } finally {
      setImporting(false);
    }
  }, [allowance, event, importing]);

  // --- missions -------------------------------------------------------------

  /** The server's last answer (or this phone's copy of it). */
  const [serverMissions, setServerMissions] = useState<Mission[]>([]);
  /** Whether photos can still be marked: missions dealt, film not developed. */
  const [canTag, setCanTag] = useState(false);

  useEffect(() => {
    if (!eventId) return;
    let cancelled = false;
    void (async () => {
      const userId = (await getSession().catch(() => null))?.user.id;
      if (!userId || cancelled) return;

      const cached = await cachedMissions(eventId, userId);
      if (cancelled) return;
      if (cached) {
        setServerMissions(cached);
        // Offline the film's state is unknown; the server refuses a late tag.
        setCanTag(cached.length > 0);
      }

      try {
        const event = await getEvent(eventId);
        const live = event.status === 'live' && !isDeveloped(event);
        if (event.missions_per_guest == null || !live) {
          if (!cancelled) {
            setCanTag(false);
            if (event.missions_per_guest == null) setServerMissions([]);
          }
          return;
        }
        const fresh = await fetchMissions(eventId, userId);
        if (cancelled) return;
        setServerMissions(fresh);
        setCanTag(fresh.length > 0);
      } catch {
        // Offline: the cached copy stands.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId, missionsVersion]);

  const missions = useMemo(
    () => (eventId ? withQueuedTags(eventId, serverMissions) : serverMissions),
    // `queueVersion` stands for the queue's contents, which live outside React.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [eventId, serverMissions, queueVersion]
  );

  const [picker, setPicker] = useState<{ photoId: string } | null>(null);
  const [tagging, setTagging] = useState(false);
  const [tagError, setTagError] = useState<string | null>(null);

  const closePicker = useCallback(() => {
    setPicker(null);
    setTagError(null);
  }, []);

  const pick = useCallback(
    async (photoId: string, missionId: string | null) => {
      if (!eventId || tagging) return;
      setTagging(true);
      setTagError(null);
      try {
        const outcome = await setShotMission(eventId, photoId, missionId);
        // Sent: the server has it — show it now, the refetch confirms it.
        // Queued: the queue's owed tag already shows through `withQueuedTags`.
        if (outcome === 'sent') {
          setServerMissions((current) => applyMissionTag(current, photoId, missionId));
        }
        setPicker(null);
      } catch (e) {
        const failure = tagFailure(e);
        setTagError(failure.message);
        if (failure.closed) setCanTag(false);
      } finally {
        setTagging(false);
      }
    },
    [eventId, tagging]
  );

  // --- viewer ---------------------------------------------------------------

  const photos = useMemo<ViewerPhoto[]>(
    () =>
      (shots ?? []).map((shot) => {
        const { full } = shot;
        return {
          id: shot.id,
          thumbUri: shot.thumbUri,
          // A frame still on the phone is a file; an uploaded one is signed when shown.
          full:
            'uri' in full ? full.uri : async () => (await signedUrls([full.path])).get(full.path),
          mission: missionOf(missions, shot.id)?.body,
        };
      }),
    [shots, missions]
  );

  // Keep the current photo's tile on screen, so the viewer has somewhere to return to.
  const follow = useCallback((index: number) => {
    list.current?.scrollToIndex({
      index: Math.floor(index / T.columns),
      viewPosition: 0.5,
      animated: false,
    });
  }, []);

  const originFor = useCallback(
    (index: number) => {
      const shot = shots?.[index];
      return shot ? rectOf(shot.id) : Promise.resolve(null);
    },
    [shots, rectOf]
  );

  const count = shots?.length ?? 0;
  const taggable = canTag && missions.length > 0;

  return (
    <View style={styles.root}>
      <Screen>
        <View style={styles.header}>
          <CircleIconButton
            icon="chevron-left"
            accessibilityLabel="Back to the camera"
            onPress={() =>
              router.canGoBack() ? router.back() : router.replace('/(library)/films')
            }
          />
          {allowance > 0 ? (
            <GlassButton
              icon="plus"
              label="Add"
              accessibilityLabel={`Add photos from your library, ${allowance} left`}
              disabled={importing}
              onPress={() => void addPhotos()}
            />
          ) : null}
        </View>

        <View style={styles.title}>
          <Display size="md">
            Your <Em>photos.</Em>
          </Display>
          <Body small>
            {count === 0
              ? 'Only you can see these until the film is developed.'
              : `${count} so far. Only you can see these until the film is developed.`}
          </Body>
        </View>

        {shots === null ? (
          <View style={styles.center}>
            <Spinner />
          </View>
        ) : shots.length === 0 ? (
          <View style={styles.center}>
            <Body small>Nothing yet. Your photos show up here as you take them.</Body>
          </View>
        ) : (
          <ScrollEdged>
          <FlatList
            ref={list}
            data={shots}
            keyExtractor={(shot) => shot.id}
            numColumns={T.columns}
            columnWrapperStyle={styles.row}
            contentContainerStyle={styles.grid}
            showsVerticalScrollIndicator={false}
            onScrollToIndexFailed={() => {
              // The row is not laid out yet; the viewer then closes with a fade.
            }}
            renderItem={({ item, index }) => {
              const mission = missionOf(missions, item.id);
              return (
                <PhotoTile
                  id={item.id}
                  uri={item.thumbUri}
                  accessibilityLabel={`Photo ${index + 1} of ${count}${mission ? `, for the mission: ${mission.body}` : ''}`}
                  register={register}
                  onPress={(origin) => setOpen({ index, origin })}
                  style={styles.tile}>
                  {mission ? (
                    <View style={styles.marker} pointerEvents="none">
                      <Feather name="target" size={M.tileMarker.iconSize} color={Colors.text} />
                    </View>
                  ) : null}
                </PhotoTile>
              );
            }}
          />
          </ScrollEdged>
        )}
      </Screen>

      {/*
        While a photo is open, a swipe in from the left edge closes the photo
        (the viewer's own "back"), not this screen.
      */}
      <Stack.Screen options={{ gestureEnabled: !open }} />

      {open && photos.length > 0 ? (
        <PhotoViewer
          photos={photos}
          initialIndex={open.index}
          origin={open.origin}
          originFor={originFor}
          onIndexChange={follow}
          onClose={() => {
            setOpen(null);
            closePicker();
          }}
          renderActions={
            taggable
              ? (photo) => (
                  <GlassButton
                    icon="target"
                    label="Mission"
                    accessibilityLabel={
                      photo.mission
                        ? `Mission: ${photo.mission}. Change it.`
                        : 'Mark this photo for a mission'
                    }
                    onPress={() => {
                      setTagError(null);
                      setPicker({ photoId: photo.id });
                    }}
                  />
                )
              : undefined
          }
        />
      ) : null}

      {picker && open ? (
        <MissionPickerSheet
          missions={missions}
          photoId={picker.photoId}
          busy={tagging}
          error={tagError}
          onPick={(missionId) => void pick(picker.photoId, missionId)}
          onClose={closePicker}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    paddingTop: T.headerPaddingTop,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    marginTop: T.titleGap,
    marginBottom: T.titleGap,
    gap: T.metaGap,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: {
    gap: T.gridGap,
    paddingBottom: Math.max(Spacing.xl, Edge.bottom),
  },
  row: {
    gap: T.gridGap,
  },
  // A third of the row each; an incomplete last row keeps its tiles the same size.
  tile: {
    flex: 1 / T.columns,
  },
  // Not glass: a dozen blurs in a contact sheet would cost more than they say.
  marker: {
    position: 'absolute',
    top: M.tileMarker.inset,
    right: M.tileMarker.inset,
    width: M.tileMarker.size,
    height: M.tileMarker.size,
    borderRadius: M.tileMarker.size / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: M.tileMarker.bg,
  },
});
