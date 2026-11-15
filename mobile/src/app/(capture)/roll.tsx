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
 * A contact sheet, deliberately plain. Tapping a frame enlarges it; the real
 * viewer — swipe, pinch, drag to dismiss — belongs to the album (M3).
 */

import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';

import { CircleIconButton } from '@/components/ui/circle-back-button';
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
  const [open, setOpen] = useState<{ id: string; uri: string } | null>(null);

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

  async function enlarge(shot: Shot) {
    // The thumbnail first, so the frame opens on the press; the original replaces it.
    setOpen({ id: shot.id, uri: shot.thumbUri });
    if ('uri' in shot.full) {
      setOpen({ id: shot.id, uri: shot.full.uri });
      return;
    }
    try {
      const { path } = shot.full;
      const url = (await signedUrls([path])).get(path);
      if (url) setOpen((current) => (current?.id === shot.id ? { id: shot.id, uri: url } : current));
    } catch {
      // The thumbnail stays up.
    }
  }

  const count = shots?.length ?? 0;

  return (
    <Screen>
      <View style={styles.header}>
        <CircleIconButton
          icon="chevron-left"
          accessibilityLabel="Back to the camera"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(library)/films'))}
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
          data={shots}
          keyExtractor={(shot) => shot.id}
          numColumns={T.columns}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.grid}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <Pressable
              accessibilityRole="imagebutton"
              accessibilityLabel={`Photo ${index + 1} of ${count}`}
              onPress={() => void enlarge(item)}
              style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}>
              <Image
                source={{ uri: item.thumbUri }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                recyclingKey={item.id}
                transition={150}
              />
            </Pressable>
          )}
        />
      )}

      <Modal
        visible={open !== null}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setOpen(null)}>
        <Pressable
          style={styles.viewer}
          accessibilityRole="button"
          accessibilityLabel="Close photo"
          onPress={() => setOpen(null)}>
          {open ? (
            <Image source={{ uri: open.uri }} style={styles.viewerImage} contentFit="contain" />
          ) : null}
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
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
    aspectRatio: T.tileAspectRatio,
    borderRadius: T.tileRadius,
    overflow: 'hidden',
    backgroundColor: T.tileBg,
  },
  tilePressed: {
    opacity: 0.7,
  },
  viewer: {
    flex: 1,
    backgroundColor: T.viewer.scrim,
    padding: T.viewer.padding,
    justifyContent: 'center',
  },
  viewerImage: {
    width: '100%',
    height: '100%',
  },
});
