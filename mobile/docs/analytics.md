# Usage statistics and error reports

One provider for both: **PostHog, EU cloud**. Wired in `src/lib/analytics.ts`.
Without `EXPO_PUBLIC_POSTHOG_KEY` the SDK is never loaded and nothing is sent —
that is the default, and every build so far.

## Why PostHog

- The React Native SDK is JavaScript only: no native module, no config plugin,
  no new build, nothing that can break the iOS build (VisionCamera, Worklets and
  Skia make that build fragile enough).
- Events and JS error tracking in one account.
- EU hosting (`eu.i.posthog.com`), which keeps the privacy policy simple.

**Not covered: native crashes** (the kind the camera produced in M2). Read those
from TestFlight / Xcode Organizer and the Play Console. If that is not enough
after the beta, add Sentry (`@sentry/react-native`) — it needs a new native
build and a second processor in the privacy policy.

## What is sent

| Event | When | Properties |
|---|---|---|
| `event_created` | `createEvent()` succeeded | `look`, `event_type`, `roll_size`, `max_members`, `paid` |
| `event_joined` | `joinEvent()` succeeded | — |
| `photo_taken` | a shot was queued (`enqueueShot()`), or a library photo added | `look`, `imported` |
| `reveal_seen` | the reveal finished playing | `photos` |

Plus uncaught JS exceptions, unhandled promise rejections, and the SDK's app
lifecycle events (installed / opened / backgrounded).

Never sent: names, email addresses, event titles, invite codes, user ids,
anything from a photo. There is no `identify()` call — everything is tied to the
random id the SDK stores on the device. Autocapture, session replay, feature
flags and GeoIP lookup are off.

The numbers the launch is judged by come straight out of these:
events created, joins per event, photos per guest, and reveal rate
(`reveal_seen` devices ÷ `event_joined` devices).

## The switch

Settings → Privacy → "Share usage data" (shown only when a key is configured)
opts the device out; the privacy policy names it as the way to object.

## Setup (needs an account — not done)

1. Create a PostHog account and a project on the **EU** cloud.
2. Project settings → copy the project API key (`phc_…`).
3. Put it in `mobile/.env` for development and in the EAS environment for
   builds:

   ```
   EXPO_PUBLIC_POSTHOG_KEY=phc_...
   EXPO_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com
   ```

   `EXPO_PUBLIC_*` values are baked in at bundle time — restart with
   `npx expo start --clear`.
4. In PostHog: turn off "Autocapture" and "Session replay" project-wide as a
   second lock, set data retention, and sign the DPA.
5. Take one photo in a dev build and check that `photo_taken` arrives.
6. Stack traces are minified in release builds. Uploading source maps
   (`posthog-cli sourcemap`) is optional and not set up.

## Not verified

No account exists, so nothing was ever sent: the SDK options are type-checked
and the app runs without a key, but the first real event is untested.
