import { Stack } from 'expo-router';

import { Colors } from '@/constants/theme';

/** The two screens that hang off signing in: collecting a name, and the guest's upgrade. */
export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.bg },
      }}
    />
  );
}
