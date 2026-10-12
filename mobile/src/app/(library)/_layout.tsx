import { Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AmbientGlow } from '@/components/ui/ambient-glow';
import { Colors } from '@/constants/theme';

/**
 * Film library and clip playback (screens 15/16, 17).
 *
 * The glow is mounted here rather than in the screen — the same three-part setup
 * (host) and (onboarding) use: `Colors.bg` painted once on this root, a
 * transparent Stack content style so the screens do not cover it, and
 * `<Screen transparent>` inside each. Break any one of the three and it
 * disappears.
 *
 * Fixed rather than travelling: these are destinations, not a swept flow.
 *
 * Note 16 covers this with its own blurred backdrop, as drawn — the artboard
 * renders the glow only on the empty state. The screen paints over it rather
 * than the layout conditionally mounting it, which would need the layout to know
 * how many films its child had loaded.
 */
export default function LibraryLayout() {
  return (
    <View style={styles.root}>
      <AmbientGlow preset="films" />

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
