import { Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AmbientGlow } from '@/components/ui/ambient-glow';
import { Colors } from '@/constants/theme';

/**
 * Host-side group setup (screens 09, 10).
 *
 * The glow is mounted here rather than in the screen, the same three-part setup
 * onboarding uses: painted once on this root, a transparent Stack content style so
 * the screens do not cover it, and `<Screen transparent>` inside each. Break any
 * one of the three and it disappears.
 *
 * Unlike onboarding's, it does not travel — 09 and 10 are two destinations, not a
 * swept flow — so the preset is fixed rather than read from a provider.
 */
export default function HostLayout() {
  return (
    <View style={styles.root}>
      <AmbientGlow preset="invite" />

      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: 'transparent' },
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
});
