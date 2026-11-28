/**
 * Missions on 13 — the "Missions 1/3" capsule and the "Next photo: …" note.
 *
 * Not in the prototype. Decisions, all flagged to the user:
 *
 *  - **The capsule sits in the header, under the roll counter**, centred like
 *    it. It is a smaller `Glass` capsule than `GlassButton`'s so the header
 *    grows by as little as possible (the viewfinder gives up that height).
 *    Every control stays outside the picture (2026-11-16).
 *  - **The armed note is a status note, at the viewfinder's top edge** — the
 *    edge nearest the capsule that armed it — in the camera's own note style,
 *    not glass (nothing is glass over the viewfinder). Its × is the one touch
 *    target inside the frame; the alternative, a row of its own above the
 *    shutter, would make the viewfinder jump in size every time a mission is
 *    armed.
 *  - It arrives from the capsule's direction and leaves the same way (eased,
 *    no overshoot, `Springs.settle`'s duration — nobody drags it, so nothing
 *    has to be interrupted); reduced motion cross-fades.
 *  - No haptics: picking a mission is not one of the app's meaningful moments.
 */

import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  Keyframe,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { Glass } from './glass';
import { Camera, Colors, Glass as GlassTokens, MissionsCamera as M, Springs } from '@/constants/theme';
import { Typography } from '@/constants/typography';
import { t } from '@/i18n';

type CapsuleProps = {
  done: number;
  total: number;
  onPress: () => void;
};

/** "Missions 1/3" — opens the list. Gives on touch-down like every glass control. */
export function MissionCapsule({ done, total, onPress }: CapsuleProps) {
  const pressed = useSharedValue(0);
  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * (1 - GlassTokens.pressScale) }],
  }));

  const all = total > 0 && done >= total;
  const color = all ? M.capsule.doneColor : Colors.text;

  return (
    <Animated.View style={[styles.capsuleWrap, animated]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('missions.capsuleA11y', { done, total })}
        accessibilityHint={t('missions.capsuleHint')}
        hitSlop={M.capsule.hitSlop}
        onPressIn={() => {
          pressed.value = withSpring(1, Springs.press);
        }}
        onPressOut={() => {
          pressed.value = withSpring(0, Springs.press);
        }}
        onPress={onPress}>
        <Glass radius={M.capsule.height / 2} interactive style={styles.capsule}>
          <Feather name={all ? 'check' : 'target'} size={M.capsule.iconSize} color={color} />
          <Text
            maxFontSizeMultiplier={M.capsule.maxFontScale}
            numberOfLines={1}
            style={[styles.capsuleText, { color }]}>
            {t('missions.capsule', { done, total })}
          </Text>
        </Glass>
      </Pressable>
    </Animated.View>
  );
}

type ArmedNoteProps = {
  body: string;
  onDisarm: () => void;
};

/*
  Enter from above (where the capsule is), leave the same way. Keyframes rather
  than a spring builder: a layout animation's spring cannot be told to stay
  critically damped across Reanimated versions, and a note must not bounce.
*/
const ENTER = new Keyframe({
  0: { opacity: 0, transform: [{ translateY: M.armed.travelY }] },
  100: { opacity: 1, transform: [{ translateY: 0 }] },
}).duration(Springs.settle.duration);

const EXIT = new Keyframe({
  0: { opacity: 1, transform: [{ translateY: 0 }] },
  100: { opacity: 0, transform: [{ translateY: M.armed.travelY }] },
}).duration(M.armed.fadeMs);

/** "Next photo: …" inside the viewfinder's top edge, with an × to let it go. */
export function MissionArmedNote({ body, onDisarm }: ArmedNoteProps) {
  const reducedMotion = useReducedMotion();

  return (
    <Animated.View
      entering={
        reducedMotion
          ? FadeIn.duration(M.armed.fadeMs).reduceMotion(ReduceMotion.Never)
          : ENTER
      }
      exiting={
        reducedMotion ? FadeOut.duration(M.armed.fadeMs).reduceMotion(ReduceMotion.Never) : EXIT
      }
      style={styles.armed}
      accessibilityLiveRegion="polite">
      <Feather name="target" size={M.armed.iconSize} color={Camera.note.color} />
      <Text style={styles.armedText} numberOfLines={M.armed.lines}>
        {t('missions.armed', { body })}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('missions.disarmA11y')}
        hitSlop={M.armed.closeHitSlop}
        onPress={onDisarm}
        style={({ pressed }) => [styles.close, pressed && styles.closePressed]}>
        <Feather name="x" size={M.armed.closeSize} color={Camera.note.color} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  capsuleWrap: {
    marginTop: M.capsule.marginTop,
  },
  capsule: {
    height: M.capsule.height,
    paddingHorizontal: M.capsule.paddingX,
    flexDirection: 'row',
    alignItems: 'center',
    gap: M.capsule.gap,
  },
  capsuleText: {
    ...Typography.durationPill,
    fontVariant: ['tabular-nums'],
  },
  armed: {
    position: 'absolute',
    top: M.armed.inset,
    left: M.armed.insetX,
    right: M.armed.insetX,
    flexDirection: 'row',
    alignItems: 'center',
    gap: M.armed.gap,
    paddingVertical: M.armed.paddingY,
    paddingLeft: M.armed.paddingLeft,
    paddingRight: M.armed.paddingRight,
    borderRadius: Camera.viewfinder.radius,
    borderWidth: 1,
    borderColor: Camera.note.border,
    backgroundColor: Camera.note.bg,
  },
  armedText: {
    ...Typography.metaMd,
    flex: 1,
    color: Camera.note.color,
  },
  close: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  closePressed: {
    opacity: M.armed.closePressedOpacity,
  },
});
