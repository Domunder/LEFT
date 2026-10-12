/**
 * 10.1 · Your Group — Info
 *
 * Explains the one idea the whole app rests on, opened from the info button on
 * screen 10: everybody films into the same pool of time, and when it is gone the
 * film is finished.
 *
 * The bar **demonstrates** rather than reports. This sheet hangs off screen 10,
 * which the host reaches straight from sharing the invite — nobody has filmed
 * anything yet, so the group's real numbers are an empty bar and a zero, which
 * teaches nothing. Instead two imaginary people spend from a 60s budget and the
 * bar moves twice, which is the entire concept in about two seconds. See
 * `components/ui/budget-bar.tsx`.
 *
 * (The artboard's own caption was placeholder copy anyway: "2m 18s used" and
 * "1m 12s left" sum to 3m 30s, which is not a length any tier sells, and 138/210
 * is 66% against a bar drawn at 64%.)
 *
 * The headline, the copy and the bar now live in `BudgetExplainer` — screen 12
 * shows a guest the same lesson, and the two must not drift. This file is the
 * sheet around it: the scrim, the handle and the "Got it".
 *
 * Its own sheet rather than components/ui/sheet.tsx: this one is inset from the
 * screen edges and floats above the bottom, where that one is pinned flush and
 * rounded only on top.
 */

import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { BudgetExplainer } from '@/components/ui/budget-explainer';
import { PillButton } from '@/components/ui/pill-button';
import { BlurIntensity, Colors, GroupInfo, Radii } from '@/constants/theme';

export default function GroupInfoScreen() {
  const router = useRouter();

  return (
    <View style={styles.root}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={() => router.back()}
        accessibilityLabel="Dismiss"
      />
      <BlurView
        intensity={BlurIntensity.scrim}
        tint="dark"
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View style={styles.scrim} pointerEvents="none" />

      <View style={styles.sheet}>
        <View style={styles.handle} />

        <BudgetExplainer style={styles.explainer} />

        <PillButton label="Got it" onPress={() => router.back()} style={styles.button} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.scrim,
  },
  sheet: {
    marginHorizontal: GroupInfo.inset,
    marginBottom: GroupInfo.bottom,
    borderRadius: Radii.sheetSm,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.hairline,
    paddingTop: GroupInfo.paddingTop,
    paddingHorizontal: GroupInfo.paddingX,
    paddingBottom: GroupInfo.paddingBottom,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: Radii.pill,
    backgroundColor: Colors.hairlineStrong,
    marginBottom: GroupInfo.handleGap,
  },
  explainer: {
    marginBottom: GroupInfo.captionGap,
  },
  button: {
    paddingVertical: GroupInfo.buttonPaddingY,
  },
});
