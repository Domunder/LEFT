/**
 * Loads the three families the design uses, at runtime via expo-font.
 *
 * Runtime loading (rather than the expo-font config plugin) is deliberate: it
 * works in Expo Go, which is how iOS gets tested from a Windows machine. Once
 * the project moves to a dev build, these can be embedded at build time instead.
 *
 * Keep this list in sync with FontFamily in @/constants/typography.
 */

import { DMSerifDisplay_400Regular } from '@expo-google-fonts/dm-serif-display';
import {
  Inter_300Light,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import {
  Newsreader_300Light,
  Newsreader_300Light_Italic,
  Newsreader_400Regular,
} from '@expo-google-fonts/newsreader';
import { useFonts } from 'expo-font';

export function useAppFonts() {
  return useFonts({
    // Display serif — design weight 340 maps to 300 Light.
    Newsreader_300Light,
    Newsreader_300Light_Italic,
    Newsreader_400Regular,
    // Numerals — group size, price, dial readout.
    DMSerifDisplay_400Regular,
    // UI sans.
    Inter_300Light,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
}
