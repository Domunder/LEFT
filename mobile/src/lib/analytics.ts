/**
 * Usage statistics and error reports — off unless a key is configured.
 *
 * One provider for both: PostHog, on its EU cloud. Chosen because the SDK is
 * JavaScript only (no native module, so no new build and nothing that can
 * break the iOS build), it covers events and JS exceptions in one place, and
 * the data stays in the EU. Native crashes are not covered — those are read
 * from TestFlight / App Store Connect and the Play Console.
 *
 * **Without `EXPO_PUBLIC_POSTHOG_KEY` nothing here does anything**: the SDK is
 * not even required, no network call is made, and every function is a no-op.
 * That is the state of every build until an account exists (docs/LAUNCH.md).
 *
 * What is sent, deliberately little:
 *
 *   - four events (`AnalyticsEvent`) with a handful of non-identifying
 *     properties — never a name, an email address, an event title, an invite
 *     code or anything from a photo;
 *   - uncaught JS exceptions and unhandled promise rejections;
 *   - app lifecycle events (installed, opened), which give "active devices".
 *
 * Nobody is identified: there is no `identify()` call, so everything hangs off
 * the random id the SDK keeps on the device. No screen autocapture, no touch
 * autocapture, no session replay, no feature flags.
 *
 * 20's "Share usage data" switch turns it off per device (`setAnalyticsEnabled`);
 * the privacy policy names that switch as the way to object.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

type PostHogModule = typeof import('posthog-react-native');
type PostHogClient = InstanceType<PostHogModule['default']>;

/** The four numbers the launch is judged by: events created, joins, photos, reveal rate. */
export type AnalyticsEvent =
  | { name: 'event_created'; props: { look: string; event_type: string; roll_size: number | null; max_members: number; paid: boolean } }
  | { name: 'event_joined'; props: Record<string, never> }
  | { name: 'photo_taken'; props: { look: string } }
  | { name: 'reveal_seen'; props: { photos: number } };

const KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY;
const HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://eu.i.posthog.com';

/** Device-wide, not per user: it is this phone that reports. '0' means off. */
const OPT_OUT_KEY = 'left:analytics:enabled';

/** True when a key is configured — i.e. when the switch in Settings means anything. */
export const ANALYTICS_CONFIGURED = Boolean(KEY);

let client: PostHogClient | null = null;
let starting: Promise<PostHogClient | null> | null = null;

export async function isAnalyticsEnabled(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(OPT_OUT_KEY)) !== '0';
  } catch {
    return true;
  }
}

async function start(): Promise<PostHogClient | null> {
  if (!KEY) return null;
  if (client) return client;

  starting ??= (async () => {
    try {
      const enabled = await isAnalyticsEnabled();

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { default: PostHog } = require('posthog-react-native') as PostHogModule;

      client = new PostHog(KEY, {
        host: HOST,
        // Honour the switch from the very first event.
        defaultOptIn: enabled,
        captureAppLifecycleEvents: true,
        enableSessionReplay: false,
        preloadFeatureFlags: false,
        // The server would otherwise derive a city from the IP address.
        disableGeoip: true,
        errorTracking: {
          autocapture: { uncaughtExceptions: true, unhandledRejections: true, console: false },
        },
      });

      return client;
    } catch {
      // A reporting tool that fails to start must never be the reason the app does.
      return null;
    }
  })();

  return starting;
}

/** Call once at app start. Safe to call without a key. */
export function startAnalytics(): void {
  void start();
}

/** Record one of the four events. Never throws, never blocks. */
export function track<E extends AnalyticsEvent>(name: E['name'], props: E['props']): void {
  if (!KEY) return;

  void start().then((posthog) => {
    try {
      posthog?.capture(name, props);
    } catch {
      // Nothing actionable.
    }
  });
}

/** Report a caught error that is worth knowing about. */
export function reportError(error: unknown, context?: Record<string, string | number | boolean>): void {
  if (!KEY) return;

  void start().then((posthog) => {
    try {
      posthog?.captureException(error, context);
    } catch {
      // Nothing actionable.
    }
  });
}

/** 20's switch. Persisted on the device and applied to the running client. */
export async function setAnalyticsEnabled(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(OPT_OUT_KEY, enabled ? '1' : '0');
  } catch {
    // The running client below is still switched for this session.
  }

  const posthog = await start();
  try {
    if (enabled) await posthog?.optIn();
    else await posthog?.optOut();
  } catch {
    // Nothing actionable.
  }
}
