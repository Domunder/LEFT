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
      }}>
      <Stack.Screen name="camera" />
      {/*
        "Your shots" swipes back to the camera. It has to say so itself: with
        the gesture off here too, the edge swipe is taken by the root stack,
        which pops the whole group and lands in the library.
      */}
      <Stack.Screen name="roll" options={{ gestureEnabled: true }} />
    </Stack>
  );
}
