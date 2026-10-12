import { Stack } from 'expo-router';

import { Colors } from '@/constants/theme';

/** Recording and compilation (screens 13, 14). */
export default function CaptureLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.bg },
        // No swipe-back out of the camera mid-recording.
        gestureEnabled: false,
      }}
    />
  );
}
