import { Stack } from 'expo-router';

/**
 * Sheets presented over whatever screen opened them (08 Join, 10.1 Group Info).
 * Transparent so the parent screen stays visible behind the scrim.
 */
export default function ModalsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        presentation: 'transparentModal',
        animation: 'fade',
        contentStyle: { backgroundColor: 'transparent' },
      }}
    />
  );
}
