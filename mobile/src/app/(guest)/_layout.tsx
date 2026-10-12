import { Stack } from 'expo-router';

import { Colors } from '@/constants/theme';

/** Guest-side join flow (screens 11, 12). */
export default function GuestLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.bg },
      }}
    />
  );
}
