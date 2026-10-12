# Social sign-in — Google & Apple

Screen 06 is the only way into an account. It offers Google and Apple, and
nothing else: LEFT never sees a password and never sends an email.

Both use the **native ID-token flow**. The provider's own SDK runs the sheet and
returns a signed token; the app hands that token to Supabase, which verifies the
signature and issues a session. No browser redirect, no callback URL.

> **Neither provider works in Expo Go.** Both need native modules that only exist
> in a development build. In Expo Go the buttons render disabled with a note, and
> a dev-only "Skip sign-in" button lets you keep walking the flow.

This document is the setup checklist. Work through it once per environment.

## What you will end up with

| Thing | Where it goes | Secret |
|---|---|---|
| Google Web client ID | `mobile/.env` + Supabase | no |
| Google iOS client ID | `mobile/.env` + `app.json` + Supabase | no |
| Google Android client ID | Supabase only | no |
| Google Web client secret | Supabase only | **yes** |
| Apple `.p8` key → client-secret JWT | Supabase only | **yes** |

The rule: anything prefixed `EXPO_PUBLIC_` is compiled into the app bundle and
readable by anyone who downloads it. OAuth **client IDs** are public by design,
so that is fine. **Client secrets are not** — they only ever live server-side.

## Prerequisites

- A **paid** Apple Developer Program membership. Sign in with Apple is not
  available on a free account.
- A Google account.
- `npm i -g eas-cli` and `eas login`, or a local Xcode / Android SDK install.
- The app's identifiers, already set in `app.json`: bundle ID and Android
  package are both `com.leftmoment.app`, and the URL scheme is `left`.

## Google

### 1. Create the project and consent screen

In the [Google Cloud console](https://console.cloud.google.com/), create a
project, then open **APIs & Services → OAuth consent screen**. Choose
**External**, fill in the app name, support email and developer contact, and add
the `email`, `profile` and `openid` scopes. While the app is in **Testing**, only
accounts listed under **Test users** can sign in — add your own.

### 2. Create three OAuth client IDs

Under **APIs & Services → Credentials → Create credentials → OAuth client ID**,
create all three. You need every one, even though only two are referenced from
JavaScript.

| Type | What it asks for | Where it is used |
|---|---|---|
| Web application | nothing | `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, and Supabase's Client ID + Secret |
| iOS | bundle ID `com.leftmoment.app` | `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`, and reversed into `app.json` |
| Android | package `com.leftmoment.app` + SHA-1 | Supabase's authorized client IDs only |

**Why all three.** The native SDK stamps the *platform's* client ID into the
token's `aud` claim — the iOS SDK uses the iOS ID, Android uses the Android ID.
Supabase rejects a token whose `aud` it does not recognise, so all three must be
listed there. The **Web** client ID is separately required by the SDK as
`webClientId` on every platform, because it is what requests an ID token at all.

### 3. Set the iOS URL scheme

Take the iOS client ID, which looks like `123456-abcdef.apps.googleusercontent.com`,
and reverse it into `com.googleusercontent.apps.123456-abcdef`. Paste it into
`app.json`, replacing the placeholder:

```json
[
  "@react-native-google-signin/google-signin",
  { "iosUrlScheme": "com.googleusercontent.apps.123456-abcdef" }
]
```

This one is committed rather than read from `.env` — it is baked into
`Info.plist` at build time and ships in the binary regardless, so hiding it in an
env var would buy nothing.

### 4. Get the Android SHA-1 fingerprints

The Android client is bound to a signing certificate. **Register every keystore
you build with**, or those builds fail with `DEVELOPER_ERROR`:

```bash
# The EAS-managed keystore, used by every eas build.
eas credentials -p android

# The local debug keystore, used by npx expo run:android.
keytool -list -v -keystore ~/.android/debug.keystore \
  -alias androiddebugkey -storepass android -keypass android
```

Add each SHA-1 to the Android OAuth client. A Play Store release adds a third —
Google re-signs the upload, so **Play Console → Setup → App integrity** has its
own fingerprint that must be registered before release.

## Apple

### 1. Enable the capability on the App ID

In the [Apple Developer portal](https://developer.apple.com/account/resources/identifiers/list),
open **Identifiers**, select the App ID `com.leftmoment.app` (or create it), tick
**Sign in with Apple**, and save.

> **You do not need a Services ID.** Those exist for the *web* redirect flow. The
> native flow authenticates against the bundle identifier directly, which is why
> `config.toml` sets `client_id = "com.leftmoment.app"`.

### 2. Create the key

Under **Keys → +**, name it, tick **Sign in with Apple**, configure it against
the `com.leftmoment.app` App ID, and register it.

**Download the `.p8` file now.** Apple allows exactly one download, ever. Losing
it means revoking the key and creating a new one.

Record three values:

| Value | Where to find it |
|---|---|
| Team ID | top-right of the developer portal, or Membership details |
| Key ID | shown on the key you just created |
| `.p8` contents | the file you downloaded |

### 3. Generate the client-secret JWT

Supabase wants a signed JWT, not the `.p8` itself. Generate it with Supabase's
[client-secret generator](https://supabase.com/docs/guides/auth/social-login/auth-apple#generate-a-client-secret),
supplying the Team ID, Key ID, the bundle ID `com.leftmoment.app`, and the key file.

> **This expires.** Apple caps the secret's lifetime at six months. When it
> lapses, every Apple sign-in fails at once with an `invalid_client` error. Set a
> calendar reminder to regenerate it.

## Supabase

### Local stack

`supabase/config.toml` is already configured; it reads its secrets from the
environment. Put these in a `.env` at the **repository root** — not in
`mobile/.env`, where an `EXPO_PUBLIC_` neighbour would tempt someone into
shipping a client secret in the app bundle:

```
SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=<ios-id>,<android-id>,<web-id>
SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=<web client secret>
SUPABASE_AUTH_EXTERNAL_APPLE_SECRET=<the generated JWT>
```

Then `npm run db:start` from the root, or `npx supabase stop && npm run db:start`
if it is already running — provider config is read at boot.

### Hosted project

`config.toml` drives only the local stack. Set the same values by hand under
**Authentication → Sign In / Providers**:

| Provider | Field | Value |
|---|---|---|
| Google | Client ID | the **Web** client ID |
| Google | Client Secret | the **Web** client secret |
| Google | Authorized Client IDs | iOS, Android and Web IDs, comma-separated |
| Google | Skip nonce check | **on** |
| Apple | Client IDs | `com.leftmoment.app` |
| Apple | Secret Key | the generated JWT |

Under **Authentication → URL Configuration**, add `left://` and
`left://auth/callback` to the redirect allow-list.

The nonce settings differ per provider because the flows differ:
`GoogleSignin.signIn()` issues no nonce and relies on the `aud` check, while
`expo-apple-authentication` is given a real SHA-256 nonce by `lib/auth.ts`.

## Environment variables

| Name | Side | File | Secret |
|---|---|---|---|
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | client | `mobile/.env` | no |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | client | `mobile/.env` | no |
| `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` | server | root `.env` | no |
| `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET` | server | root `.env` | **yes** |
| `SUPABASE_AUTH_EXTERNAL_APPLE_SECRET` | server | root `.env` | **yes** |

There is deliberately no `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`:
`GoogleSignin.configure()` accepts only `webClientId` and `iosClientId`. The
Android client is matched by package name and SHA-1, never by a value in JS.

## Building a dev build

Expo Go cannot load either native module. Build a development client:

```bash
# Cloud build. iOS needs the Apple credentials; EAS will prompt.
eas build --profile development --platform ios
eas build --profile development --platform android

# Or build locally, which is faster to iterate on if the toolchain is installed.
npx expo run:ios
npx expo run:android
```

`eas.json` already defines the `development` profile. After installing the build,
start the bundler with `npm start` and open it from the dev client rather than
from Expo Go.

Re-run the build after changing anything in `app.json` — plugins and
`usesAppleSignIn` are applied at native-build time, not at bundle time.

## Verifying

1. Sign in with Google. You should land on the Invite screen.
2. Check the database — an `events` row, plus an `event_members` row with
   `role = 'host'` and your Google name as `display_name`.
3. Cancel a sign-in sheet mid-flow. The screen must return to its normal state
   with no error showing.
4. Sign in with Apple on a fresh Apple ID and confirm the name is captured.
5. Sign in with Apple using **Hide My Email**. The app should ask for a name
   rather than using the `@privaterelay.appleid.com` handle.

## Troubleshooting

| Symptom | Cause |
|---|---|
| `DEVELOPER_ERROR` on Android | The build's SHA-1 is not on the Android OAuth client. Debug, EAS and Play each have their own. |
| `Unacceptable audience in id_token` | Supabase's authorized client IDs are missing the platform's ID. List all three, comma-separated. |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is not set` | `mobile/.env` is missing or the bundler was not restarted after editing it. |
| `invalid_client` on Apple, having worked before | The Apple client secret JWT expired. Regenerate it. |
| `ERR_REQUEST_CANCELED` | Not an error. The user dismissed the sheet; the app handles it silently. |
| Apple returns no name on a later sign-in | Expected. Apple sends it once, ever. The stored name is reused; the app asks only if it has none. |
| Google sign-in throws about `RNGoogleSignin` | You are in Expo Go. Use a dev build. |
