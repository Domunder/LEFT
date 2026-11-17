/**
 * Takes over the App Clip's guest when LEFT is installed after it.
 *
 * A guest who scanned an invite and shot with the App Clip is an anonymous
 * Supabase user, like a guest in the app. The clip keeps that session in the
 * App Group both targets share (`group.com.leftmoment.app`, key
 * `left.clip.session` — `targets/clip/Server.swift`). On the app's first
 * launch this adopts it, so the guest is the *same* user: same roll, same
 * photos, and the film is in Moments. Without it, opening the invite in the
 * app would join a second time as a stranger with a fresh roll.
 *
 * Runs once, before the root layout reads the session, and only when the app
 * has no session of its own — an account already signed in here is never
 * replaced. The stored copy is deleted either way: it is single-use (Supabase
 * rotates refresh tokens), and the clip is gone once the app is installed.
 *
 * iOS only. `ExtensionStorage` is the native module `@bacons/apple-targets`
 * ships; in a build made before it was added, its JS falls back to no-ops, so
 * this quietly does nothing.
 *
 * Not handed over: frames still waiting in the clip's upload queue when the
 * app replaced it. They stay in the App Group folder, undrained.
 */

import { ExtensionStorage } from '@bacons/apple-targets';
import { Platform } from 'react-native';

import { getSupabase, isSupabaseConfigured } from './supabase';

const APP_GROUP = 'group.com.leftmoment.app';
const HANDOFF_KEY = 'left.clip.session';

type ClipSession = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user_id: string;
};

function parse(raw: string | null | undefined): ClipSession | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<ClipSession>;
    return typeof value.access_token === 'string' && typeof value.refresh_token === 'string'
      ? (value as ClipSession)
      : null;
  } catch {
    return null;
  }
}

/** True when the clip's guest was adopted. Never throws. */
export async function adoptClipSession(): Promise<boolean> {
  if (Platform.OS !== 'ios' || !isSupabaseConfigured()) return false;

  let storage: ExtensionStorage;
  let handed: ClipSession | null;
  try {
    storage = new ExtensionStorage(APP_GROUP);
    handed = parse(storage.get(HANDOFF_KEY));
  } catch {
    return false;
  }
  if (!handed) return false;

  try {
    const supabase = getSupabase();
    const { data } = await supabase.auth.getSession();
    if (data.session) return false;

    // Refreshes on the spot when the clip's access token has expired.
    const { data: adopted, error } = await supabase.auth.setSession({
      access_token: handed.access_token,
      refresh_token: handed.refresh_token,
    });
    return !error && adopted.session?.user.id === handed.user_id;
  } catch {
    return false;
  } finally {
    storage.remove(HANDOFF_KEY);
  }
}
