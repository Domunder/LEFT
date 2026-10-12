/**
 * Supabase client.
 *
 * Created lazily so that importing this module is safe before the project has
 * credentials — the app boots and the navigation graph works without a .env,
 * and you get a clear error the first time something actually talks to Supabase.
 *
 * Copy .env.example to .env and fill in the two values to activate it.
 */

import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, processLock, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import type { Database } from '@/types/database';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;

/** Supabase renamed the anon key to the publishable key; accept either. */
const SUPABASE_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** True when both env vars are present. Use this to gate auth-dependent UI. */
export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_KEY);
}

let client: SupabaseClient<Database> | null = null;

export function getSupabase(): SupabaseClient<Database> {
  if (client) return client;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error(
      'Supabase is not configured. Copy mobile/.env.example to mobile/.env and set ' +
        'EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY, then restart the dev server.'
    );
  }

  client = createClient<Database>(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
      // AsyncStorage on native; the web build uses localStorage by default.
      ...(Platform.OS !== 'web' ? { storage: AsyncStorage } : {}),
      autoRefreshToken: true,
      persistSession: true,
      // Required on native — there is no URL to read a session out of.
      detectSessionInUrl: false,
      lock: processLock,
    },
  });

  if (Platform.OS !== 'web') {
    // Refresh tokens only while the app is in the foreground.
    AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        client?.auth.startAutoRefresh();
      } else {
        client?.auth.stopAutoRefresh();
      }
    });
  }

  return client;
}
