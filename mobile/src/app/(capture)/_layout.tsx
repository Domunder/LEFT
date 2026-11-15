import { Stack } from 'expo-router';

import { Colors } from '@/constants/theme';

/** The disposable camera (screen 13). */
export default function CaptureLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.bg },
        // No swipe-back out of the camera.
        gestureEnabled: false,
      }}
    />
  );
}
