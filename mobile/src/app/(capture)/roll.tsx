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
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { CircleIconButton } from '@/components/ui/circle-back-button';
import { PhotoTile, useTileRegistry } from '@/components/ui/photo-tile';
import { PhotoViewer, type Rect, type ViewerPhoto } from '@/components/ui/photo-viewer';
import { Screen } from '@/components/ui/screen';
import { Spinner } from '@/components/ui/spinner';
import { Body, Display, Em } from '@/components/ui/typography';
import { Shots as T, Spacing } from '@/constants/theme';
import { loadMyShots, type MyShot as Shot } from '@/lib/my-shots';
import { signedUrls } from '@/lib/storage';
import { subscribeToQueue } from '@/lib/upload-queue';

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
      if (change.type === 'changed') load();
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [eventId]);

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
        };
      }),
    [shots]
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
        </View>

        <View style={styles.title}>
          <Display size="md">
            Your <Em>shots.</Em>
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
            renderItem={({ item, index }) => (
              <PhotoTile
                id={item.id}
                uri={item.thumbUri}
                accessibilityLabel={`Photo ${index + 1} of ${count}`}
                register={register}
                onPress={(origin) => setOpen({ index, origin })}
                style={styles.tile}
              />
            )}
          />
        )}
      </Screen>

      {open && photos.length > 0 ? (
        <PhotoViewer
          photos={photos}
          initialIndex={open.index}
          origin={open.origin}
          originFor={originFor}
          onIndexChange={follow}
          onClose={() => setOpen(null)}
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
    paddingBottom: Spacing.xl,
  },
  row: {
    gap: T.gridGap,
  },
  // A third of the row each; an incomplete last row keeps its tiles the same size.
  tile: {
    flex: 1 / T.columns,
  },
});
