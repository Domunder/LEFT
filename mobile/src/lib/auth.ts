/**
 * Auth seam.
 *
 * Two kinds of identity, because LEFT has two kinds of user:
 *
 *  - **Hosts** sign in on Landing (01) with Google or Apple. Both use the same
 *    native ID-token flow: the provider's SDK returns a signed token and
 *    Supabase exchanges it for a session. Neither works in Expo Go; both need a
 *    dev build. (The prototype's Email button was replaced by Apple — see
 *    CLAUDE.md "Known conflicts".)
 *  - **Guests** never sign in at all. They tap an invite link and get an
 *    anonymous session — see `signInAnonymously`, and `linkIdentity` for the
 *    upgrade that lets them keep the film afterwards.
 *
 * No state is held here. Session state belongs with the screens (or a store).
 */

import type { Session, User } from '@supabase/supabase-js';
import type * as AppleAuthenticationTypes from 'expo-apple-authentication';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

import { forgetUser } from './purchases';
import { getSupabase } from './supabase';

/** Apple's private-relay domain. Its local part is a random handle, not a name. */
const APPLE_PRIVATE_RELAY = '@privaterelay.appleid.com';

/** Matches the `char_length(display_name) between 1 and 60` check on event_members. */
const MAX_NAME_LENGTH = 60;

/**
 * Backing out of a provider sheet is not a failure.
 *
 * Screens catch this and return to idle silently — a native sheet that leaves an
 * error banner behind when you dismiss it feels broken.
 */
export class SignInCancelledError extends Error {
  constructor() {
    super('Sign-in was cancelled');
    this.name = 'SignInCancelledError';
  }
}

export function isSignInCancelled(e: unknown): e is SignInCancelledError {
  return e instanceof SignInCancelledError;
}

/**
 * Where the provider sheets can actually open.
 *
 * Both SDKs are native-only, and Expo Go carries neither. Constant for the
 * lifetime of the process, so they are resolved once here rather than per render
 * — and here rather than in each screen, because Landing, the keep prompt and the
 * library panel all have to make the same call and must not drift apart.
 * `Constants.appOwnership` is deprecated as of SDK 53; this is its replacement.
 */
export const IS_EXPO_GO = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

/** Neither provider has a browser implementation. */
export const IS_WEB = Platform.OS === 'web';

/** True wherever the native modules are missing, so the buttons cannot work. */
export const NATIVE_AUTH_UNAVAILABLE = IS_EXPO_GO || IS_WEB;

/**
 * Apple's button is hidden on Android — Sign in with Apple has no native path
 * there, so the row is Google alone and takes the full width.
 *
 * It is still drawn on web, where it cannot work either: the browser is the
 * development preview, and hiding half the row there would mean never seeing the
 * two-up layout the artboard specifies.
 */
export const SHOWS_APPLE = Platform.OS !== 'android';

type GoogleSigninModule = typeof import('@react-native-google-signin/google-signin');

let googleConfigured = false;

/**
 * `@react-native-google-signin` resolves its native module with
 * `TurboModuleRegistry.getEnforcing`, at module scope — so *importing* it at all
 * throws in Expo Go, where the native side does not exist. A static import would
 * take down every screen that imports this file, including the root layout's
 * session check. Requiring it inside the call keeps this module importable
 * everywhere and confines the failure to someone actually pressing the button.
 *
 * The same applies to the package's `statusCodes` export, which calls
 * `getConstants()` on that same native module. It is not needed: `signIn()`
 * resolves to `{ type: 'cancelled' }` rather than throwing.
 */
function loadGoogle(): GoogleSigninModule {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@react-native-google-signin/google-signin') as GoogleSigninModule;
}

type AppleAuthenticationModule = typeof import('expo-apple-authentication');

/**
 * Loaded the same way and for the same reason as Google above.
 *
 * `expo-apple-authentication` has no JS fallback: its native module is absent
 * from Expo Go, and a static import runs on the app's boot path because the root
 * layout imports this file for its session check. That is a white screen at
 * launch on every platform, not a failed button on iOS. Required inside the call
 * instead, so the module stays importable anywhere and only an actual press can
 * reach the native side.
 */
function loadApple(): AppleAuthenticationModule {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('expo-apple-authentication') as AppleAuthenticationModule;
}

function configureGoogle(google: GoogleSigninModule): void {
  if (googleConfigured) return;

  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

  if (!webClientId) {
    throw new Error(
      'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is not set — see mobile/docs/social-sign-in.md'
    );
  }

  // The *web* client ID is what Supabase validates the token's `aud` against, on
  // every platform. `iosClientId` is what the native iOS sheet runs against.
  google.GoogleSignin.configure({ webClientId, iosClientId, scopes: ['profile', 'email'] });
  googleConfigured = true;
}

export async function signInWithGoogle(): Promise<Session> {
  const google = loadGoogle();
  configureGoogle(google);

  if (Platform.OS === 'android') {
    await google.GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  }

  const response = await google.GoogleSignin.signIn();
  if (!google.isSuccessResponse(response)) throw new SignInCancelledError();

  const idToken = response.data.idToken;
  if (!idToken) {
    throw new Error('Google returned no ID token — check the client IDs in your .env');
  }

  // No nonce: GoogleSignin.signIn() does not issue one, and the `aud` check
  // against the web client ID is what binds the token to this app.
  const { data, error } = await getSupabase().auth.signInWithIdToken({
    provider: 'google',
    token: idToken,
  });
  if (error) throw error;
  if (!data.session) throw new Error('Google sign-in returned no session');

  return data.session;
}

export async function signInWithApple(): Promise<Session> {
  // Apple signs the *hashed* nonce into the token; Supabase hashes the raw one
  // itself and compares. Sending the same value to both would never match.
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce,
    { encoding: Crypto.CryptoEncoding.HEX }
  );

  const Apple = loadApple();

  let credential: AppleAuthenticationTypes.AppleAuthenticationCredential;
  try {
    credential = await Apple.signInAsync({
      requestedScopes: [
        Apple.AppleAuthenticationScope.FULL_NAME,
        Apple.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
  } catch (e) {
    if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') {
      throw new SignInCancelledError();
    }
    throw e;
  }

  if (!credential.identityToken) throw new Error('Apple returned no identity token');

  const { data, error } = await getSupabase().auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
    nonce: rawNonce,
  });
  if (error) throw error;
  if (!data.session) throw new Error('Apple sign-in returned no session');

  /*
    Apple sends `fullName` on the *first* sign-in for this Apple ID and app pair,
    and never again — not even after deleting the app. Capture it now or lose it.

    The `!user_metadata.name` guard matters on every subsequent sign-in, where
    the credential carries nothing: without it a re-install would blank a name
    the user already has.
  */
  const name = [credential.fullName?.givenName, credential.fullName?.familyName]
    .filter(Boolean)
    .join(' ')
    .trim();

  if (name && !data.session.user.user_metadata?.name) {
    await setDisplayName(name);
  }

  return data.session;
}

/**
 * The best name we can derive for a user, or `null` when there is none worth
 * using — which is what sends a nameless account to `(auth)/name`.
 *
 * Mirrors the fallback chain in the `add_host_as_member()` trigger, minus its
 * final `'Host'` literal: the trigger needs *a* value, this needs to know when
 * there isn't a real one.
 */
export function resolveDisplayName(user: User): string | null {
  const meta = user.user_metadata ?? {};
  const email = user.email ?? '';

  // A private-relay address's local part is a random handle like `a1b2c3d4e5`.
  // It satisfies every check and would still be a terrible name to show a group.
  const fromEmail = email && !email.endsWith(APPLE_PRIVATE_RELAY) ? email.split('@')[0] : null;

  const candidate = meta.name ?? meta.full_name ?? fromEmail;
  const trimmed = typeof candidate === 'string' ? candidate.trim() : '';

  return trimmed.length >= 1 && trimmed.length <= MAX_NAME_LENGTH ? trimmed : null;
}

/**
 * Persist a display name to user metadata.
 *
 * Must land *before* `createEvent()` — the `add_host_as_member()` trigger reads
 * `raw_user_meta_data ->> 'name'` at insert time, so a later write would leave
 * the host's first event showing the fallback.
 */
export async function setDisplayName(name: string): Promise<void> {
  const trimmed = name.trim();
  if (trimmed.length < 1 || trimmed.length > MAX_NAME_LENGTH) {
    throw new Error(`Name must be between 1 and ${MAX_NAME_LENGTH} characters`);
  }

  const { error } = await getSupabase().auth.updateUser({ data: { name: trimmed } });
  if (error) throw error;
}

/**
 * Sign in a guest with no account at all.
 *
 * A guest taps an invite link, lands in the event and starts filming — there is
 * no sign-up screen anywhere on that path, by design. Supabase's anonymous
 * sign-in gives them a real `auth.users` row with no email and no provider,
 * which is what the schema needs: `join_event()` requires `auth.uid()`, every
 * RLS policy keys off membership, and `clips.user_id` has to point at somebody
 * for a clip to be attributable.
 *
 * Anonymous users carry the `authenticated` role, so **every existing policy
 * already accepts them** — none had to be widened to let guests in.
 *
 * The session persists across restarts (AsyncStorage, see lib/supabase.ts), so
 * a guest who force-quits mid-event comes back as the same member rather than
 * as a stranger who has to rejoin.
 *
 * Idempotent: an existing session is returned untouched. Minting a second
 * identity for someone who already has one would silently orphan their
 * membership and their clips, locking them out of their own event.
 */
export async function signInAnonymously(): Promise<Session> {
  const existing = await getSession();
  if (existing) return existing;

  const { data, error } = await getSupabase().auth.signInAnonymously();
  if (error) throw error;
  if (!data.session) throw new Error('Anonymous sign-in returned no session');

  return data.session;
}

/**
 * True for a guest who joined without an account.
 *
 * The end-of-film prompt ("sign in to keep this film") keys off this — see the
 * note on `linkIdentity` below.
 */
export function isAnonymous(user: User): boolean {
  return user.is_anonymous === true;
}

/**
 * Upgrade an anonymous guest to a real account, keeping the same user id.
 *
 * This is the *other* half of the guest model and the reason guests are
 * anonymous users rather than no user at all: linking attaches a provider to
 * the existing row, so the guest's membership, their clips and the films they
 * appear in all survive the upgrade. Signing them in as a fresh user instead
 * would strand every one of those on an identity nobody can reach.
 *
 * Called by `(auth)/keep` — the screen a guest is shown once their film is
 * ready — and by the library's fallback panel. The ordering is the point: a
 * finished film is what gives someone a reason to sign in.
 */
export async function linkIdentity(provider: 'google' | 'apple'): Promise<void> {
  const { error } = await getSupabase().auth.linkIdentity({ provider });
  if (error) throw error;
}

export async function signOut() {
  /*
    Clear the RevenueCat identity too, or the next person to sign in on this
    device inherits the previous user's purchases. Best-effort: a failure here
    must not keep someone signed in.
  */
  try {
    await forgetUser();
  } catch {
    // Nothing actionable — the Supabase sign-out below is what matters.
  }

  const { error } = await getSupabase().auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  const { data, error } = await getSupabase().auth.getSession();
  if (error) throw error;
  return data.session;
}
