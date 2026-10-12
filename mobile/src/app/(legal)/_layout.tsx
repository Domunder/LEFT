import { Stack } from 'expo-router';

import { Colors } from '@/constants/theme';

/** Terms and Privacy — required by the app stores, not part of the prototype. */
export default function LegalLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.bg },
      }}
    />
  );
}
