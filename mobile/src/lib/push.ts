/**
 * Push notifications: this phone's token, and the permission that makes it.
 *
 * Two messages exist, both sent by the server (`send-notifications`): "your
 * photos are developed" and a reminder about an hour before an event ends. The
 * app's part is small — get a token, hand it to the server together with 20's
 * two switches, and take it back on sign-out.
 *
 * **`expo-notifications` is required lazily, inside the calls.** A dev build
 * made before the package was added has no native module for it, and a
 * top-level import would turn "no notifications" into "no app". Every function
 * here degrades to a no-op in that case (`'unavailable'`), in Expo Go, on a
 * simulator (no token), and without Supabase credentials.
 *
 * **Nothing is shown while the app is open.** No notification handler is set,
 * which is the library's "do not present in the foreground" default: an open
 * app already learns about the reveal through realtime, and a banner over the
 * viewfinder is the last thing a camera needs.
 *
 * The permission is asked for in context, never on first launch — see
 * `askForPushOnce()` for the three moments.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

import { readPrefs } from '@/lib/notification-prefs';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';

type NotificationsModule = typeof import('expo-notifications');

/** The token last handed to the server, so sign-out can take it back. */
const TOKEN_KEY = 'left:push-token';

/** Must match the server's `channelId` (supabase/functions/_shared/expo-push.ts). */
const ANDROID_CHANNEL = 'default';

export type PushStatus =
  /** A token is registered for the signed-in user. */
  | 'registered'
  /** Never asked. */
  | 'undetermined'
  /** Asked and refused — only the system settings can change it now. */
  | 'denied'
  /** No native module, no project id, no session, or no token (simulator). */
  | 'unavailable';

let cachedModule: NotificationsModule | null | undefined;

function loadNotifications(): NotificationsModule | null {
  if (cachedModule !== undefined) return cachedModule;

  // Ask for the native half first. Requiring the package in a build without it
  // throws while its modules are evaluated, and although the catch below holds,
  // the dev runtime still prints that as an error on every launch.
  if (!requireOptionalNativeModule('ExpoPushTokenManager')) {
    cachedModule = null;
    return cachedModule;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cachedModule = require('expo-notifications') as NotificationsModule;
  } catch {
    cachedModule = null;
  }

  return cachedModule;
}

function projectId(): string | undefined {
  return (
    (Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined)?.projectId ??
    Constants.easConfig?.projectId
  );
}

/** What the system currently says, without asking anything. */
export async function pushPermission(): Promise<Exclude<PushStatus, 'registered'> | 'granted'> {
  const Notifications = loadNotifications();
  if (!Notifications) return 'unavailable';

  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return 'granted';
    return current.canAskAgain ? 'undetermined' : 'denied';
  } catch {
    return 'unavailable';
  }
}

/**
 * Bring the server in line with this phone: permission, token, switches.
 *
 * `ask: true` may raise the system prompt, once — after a refusal the system
 * never shows it again and this returns `'denied'`. `ask: false` never prompts;
 * it only registers when permission is already there, which is what app start
 * and a flipped switch want.
 *
 * Never throws. A phone that cannot be reached by push is a smaller problem
 * than any screen this is called from failing.
 */
export async function syncPush({ ask }: { ask: boolean }): Promise<PushStatus> {
  const Notifications = loadNotifications();
  if (!Notifications || !isSupabaseConfigured()) return 'unavailable';

  try {
    // Read from the client directly: lib/auth imports this file for sign-out.
    const { data } = await getSupabase().auth.getSession();
    const userId = data.session?.user?.id;
    if (!userId) return 'unavailable';

    // Android 13+ only shows its permission prompt once a channel exists.
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL, {
        name: 'Your events',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    let permission = await Notifications.getPermissionsAsync();

    if (!permission.granted) {
      if (!permission.canAskAgain) return 'denied';
      if (!ask) return 'undetermined';

      permission = await Notifications.requestPermissionsAsync();
      if (!permission.granted) return permission.canAskAgain ? 'undetermined' : 'denied';
    }

    const id = projectId();
    if (!id) return 'unavailable';

    const token = (await Notifications.getExpoPushTokenAsync({ projectId: id })).data;
    const prefs = await readPrefs(userId);

    const { error } = await getSupabase().rpc('register_push_token', {
      p_token: token,
      p_platform: Platform.OS === 'android' ? 'android' : 'ios',
      p_notify_developed: prefs.developed,
      p_notify_reminder: prefs.reminder,
    });
    if (error) return 'unavailable';

    await AsyncStorage.setItem(TOKEN_KEY, token);
    return 'registered';
  } catch {
    // A simulator has no token; an old dev build has no native module.
    return 'unavailable';
  }
}

/** Asked at most once per app run, so three screens can all call it freely. */
let askedThisRun = false;

/**
 * The permission prompt, at a moment when it means something.
 *
 * Called from the three places where someone has just acquired a reason to be
 * told later: a guest waiting for the host on 12, a host looking at their
 * invite on 09, and anyone right after their first shot of a session. Each is
 * a no-op once the question has been answered either way — the system asks
 * exactly once per install.
 */
export function askForPushOnce(): void {
  if (askedThisRun) return;
  askedThisRun = true;
  void syncPush({ ask: true });
}

/**
 * Take this phone's token back. Called before sign-out, while there still is a
 * session to authorise it; best-effort, like everything else here.
 */
export async function unregisterPush(): Promise<void> {
  try {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    if (!token) return;

    await AsyncStorage.removeItem(TOKEN_KEY);
    if (isSupabaseConfigured()) {
      await getSupabase().rpc('unregister_push_token', { p_token: token });
    }
  } catch {
    // The server prunes tokens Expo reports dead; a stray row is not worth a failed sign-out.
  } finally {
    askedThisRun = false;
  }
}

/** Where a tapped notification leads. Null for anything this app did not send. */
export type PushTarget = { eventId: string; kind: 'developed' | 'ending_soon' };

function targetFrom(data: unknown): PushTarget | null {
  const { eventId, kind } = (data ?? {}) as { eventId?: unknown; kind?: unknown };
  if (typeof eventId !== 'string' || !eventId) return null;
  if (kind !== 'developed' && kind !== 'ending_soon') return null;
  return { eventId, kind };
}

/**
 * Listen for taps on notifications, including the one that launched the app.
 *
 * Returns the unsubscribe. The launch notification is cleared once it has been
 * handed over, or every later mount of the root layout would navigate again.
 */
export function onPushOpened(handler: (target: PushTarget) => void): () => void {
  const Notifications = loadNotifications();
  if (!Notifications) return () => {};

  try {
    const launch = Notifications.getLastNotificationResponse();
    const launchTarget = targetFrom(launch?.notification.request.content.data);
    if (launchTarget) {
      Notifications.clearLastNotificationResponse();
      handler(launchTarget);
    }

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const target = targetFrom(response.notification.request.content.data);
      if (target) handler(target);
    });

    return () => subscription.remove();
  } catch {
    return () => {};
  }
}
