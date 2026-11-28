/**
 * The "start a moment" stack — the library's empty state (15): a fan of
 * dimmed sample prints with the invitation on the front one.
 *
 * The file's name is from the carousel of 2026-11-15, where every moment was
 * such a stack (`FilmPoster`); since 2026-11-16 a moment is a `MomentCard` in
 * a list and only this one stack is left. The join capsule is glass over the
 * picture — glass on imagery, never on glass. The whole stack reacts on
 * touch-down and opens on release.
 */

import { Feather } from '@expo/vector-icons';
import type { ImageSource } from 'expo-image';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';

import { GlassButton } from './glass';
import { PhotoStack } from './photo-stack';
import { em } from './rich';
import { Body, Display } from './typography';
import { Colors, Films, Springs } from '@/constants/theme';
import { t } from '@/i18n';

const T = Films.poster;
const F = Films.fresh;

type StackProps = {
  photos: readonly ImageSource[];
  /** The fallback under the front photo, seeded from the event id by `tintFor`. */
  tint: readonly [string, string];
  sample?: boolean;
  spread?: SharedValue<number>;
  onPress: () => void;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
};

/** The pressable stack: down on touch, open on release. */
function PressableStack({
  photos,
  tint,
  sample,
  spread,
  onPress,
  accessibilityLabel,
  style,
  children,
}: StackProps) {
  const pressed = useSharedValue(0);

  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * (1 - T.pressScale) }],
  }));

  return (
    <Animated.View style={[animated, style]}>
      <Pressable
        accessibilityRole="button"
        // One spoken label for the whole stack rather than its loose parts.
        accessibilityLabel={accessibilityLabel}
        onPressIn={() => {
          pressed.value = withSpring(1, Springs.press);
        }}
        onPressOut={() => {
          pressed.value = withSpring(0, Springs.press);
        }}
        onPress={onPress}
        style={styles.fill}>
        <PhotoStack photos={photos} tint={tint} sample={sample} spread={spread}>
          {children}
        </PhotoStack>
      </Pressable>
    </Animated.View>
  );
}

type NewMomentCardProps = {
  /** Sample pictures, front first. */
  photos: readonly ImageSource[];
  tint: readonly [string, string];
  spread?: SharedValue<number>;
  onStart: () => void;
  onJoin: () => void;
  style?: StyleProp<ViewStyle>;
};

/**
 * The stack that starts a new moment, shown while there are none. Tapping
 * anywhere starts one; the capsule is the other way in, for someone who was
 * invited.
 */
export function NewMomentCard({ photos, tint, spread, onStart, onJoin, style }: NewMomentCardProps) {
  return (
    <PressableStack
      photos={photos}
      tint={tint}
      sample
      spread={spread}
      onPress={onStart}
      accessibilityLabel={t('library.startMoment')}
      style={style}>
      <View style={styles.fresh}>
        {/* The one light control: creating is the primary action here. */}
        <View style={styles.plus}>
          <Feather name="plus" size={F.plusIconSize} color={Colors.onLight} />
        </View>

        <Display size="poster" style={styles.freshHeadline}>
          {em(t('library.startHeadline'))}
        </Display>

        <Body small color={Colors.textMuted} style={styles.freshCopy}>
          {t('library.startBody')}
        </Body>

        <GlassButton
          icon="users"
          label={t('library.joinGroup')}
          accessibilityLabel={t('library.joinGroup')}
          onPress={onJoin}
          style={styles.join}
        />
      </View>
    </PressableStack>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  fresh: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: F.padding,
  },
  plus: {
    width: F.plusSize,
    height: F.plusSize,
    borderRadius: F.plusSize / 2,
    backgroundColor: Colors.text,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: F.plusGap,
  },
  freshHeadline: {
    textAlign: 'center',
    marginBottom: F.headlineGap,
  },
  freshCopy: {
    textAlign: 'center',
  },
  join: {
    marginTop: F.joinGap,
  },
});
