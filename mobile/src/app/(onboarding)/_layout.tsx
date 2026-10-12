import { Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AmbientGlow } from '@/components/ui/ambient-glow';
import { ProgressDots } from '@/components/ui/progress-dots';
import { Colors, StepDots } from '@/constants/theme';
import { ONBOARDING_STEPS, useOnboarding } from '@/lib/onboarding-draft';

/**
 * The 4-step host onboarding flow (screens 02 → 05.1).
 *
 * Two things are rendered here rather than per screen, for the same reason: the
 * ambient glow and the step indicator both have to *travel* as the user advances.
 * A screen that owned either would slide in with it already in its new position
 * and the movement would never be seen. Each screen claims its place in the arc
 * with `useGlow(...)` / `useStep(...)`.
 *
 * For that to be visible the sliding screens must not paint over it, so the Stack's
 * content background is transparent and Colors.bg is painted once, underneath.
 *
 * The draft itself is provided by the root layout rather than here. It had to be
 * when screen 06 consumed it from the (auth) group; 05.1 consumes it now, and the
 * note on OnboardingProvider says why it was left where it is.
 */
export default function OnboardingLayout() {
  const { glow, step } = useOnboarding();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <AmbientGlow preset={glow} />

      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: 'transparent' },
        }}
      />

      {/*
        Sits above the Stack so it survives the screen transition, aligned to the
        centre of each screen's own 38px header row. Non-interactive, so the back
        button underneath still takes touches.
      */}
      <View
        style={[styles.dotsLayer, { top: insets.top + StepDots.headerCenterOffset }]}
        pointerEvents="none">
        <ProgressDots step={step} total={ONBOARDING_STEPS} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  dotsLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
});
