/**
 * Turning a thrown error into a sentence worth showing.
 *
 * Shared rather than screen-local because three screens now sign somebody in or
 * write their name — Landing (01), `(auth)/name` and 05.1's create step — and a
 * failure that reads usefully on one of them reads usefully on all three.
 *
 * **Most of what reaches here is not an `Error`.** `postgrest-js` only builds a
 * real `PostgrestError` when the caller opted into `throwOnError`; every other
 * path hands back a plain `{ message, details, hint, code }` — parsed straight
 * out of the response body, or hand-built for a fetch failure. This project uses
 * `const { data, error } = ...; if (error) throw error;` everywhere, so plain
 * objects are the common case, not the exception. `String(e)` on one of those is
 * `"[object Object]"`, which is what screen 05.1 was showing above its Continue
 * button for every failure it could have.
 */

/** The shape both `postgrest-js` and `gotrue-js` failures arrive in. */
type ErrorLike = {
  message?: unknown;
  code?: unknown;
  hint?: unknown;
  details?: unknown;
};

/**
 * The best string available for a thrown value, whatever shape it came in.
 *
 * Never returns `"[object Object]"`: an object with no usable `message` is
 * serialised instead, because in development the raw fields are the only clue
 * left, and in production a JSON blob is still less useless than a stringified
 * pointer.
 */
function rawMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;

  if (e && typeof e === 'object') {
    const message = (e as ErrorLike).message;
    if (typeof message === 'string' && message.trim()) return message;

    try {
      return JSON.stringify(e);
    } catch {
      // Circular, or something equally unhelpful. Fall through.
    }
  }

  return String(e);
}

/** One string field off a thrown value, or '' when it is not there. */
function fieldOf(e: unknown, key: keyof ErrorLike): string {
  if (!e || typeof e !== 'object') return '';
  const value = (e as ErrorLike)[key];
  return typeof value === 'string' ? value : '';
}

/** `code`, `hint` and `details`, when the thrown value carried them. */
function diagnostics(e: unknown): string {
  if (!__DEV__ || !e || typeof e === 'string' || typeof e !== 'object') return '';

  const { code, hint, details } = e as ErrorLike;
  const parts = [
    typeof code === 'string' && code ? `code ${code}` : null,
    typeof hint === 'string' && hint ? hint : null,
    typeof details === 'string' && details ? details : null,
  ].filter(Boolean);

  return parts.length > 0 ? ` (${parts.join(' · ')})` : '';
}

/**
 * The message to put in front of the user for a failed sign-in or create.
 *
 * A few cases get rewritten; everything else passes through, because a raw
 * Supabase message is more useful than a generic one.
 */
export function messageFor(e: unknown): string {
  const raw = rawMessage(e);

  /*
    Matched against every field, not just the message. Postgres puts the useful
    half of a constraint violation in DETAIL — the message names the constraint,
    the detail names the row that is missing — and PostgREST passes both through
    as separate keys.
  */
  const lower = [raw, fieldOf(e, 'details'), fieldOf(e, 'hint'), fieldOf(e, 'code')]
    .join(' ')
    .toLowerCase();

  // The native module is absent rather than broken — say the useful thing.
  if (raw.includes('RNGoogleSignin') || raw.includes('TurboModuleRegistry')) {
    return 'Google sign-in needs a development build.';
  }

  /*
    "Network request failed" is what fetch throws for *every* unreachable host,
    and on its own it sends you looking at the wrong thing. In development it is
    almost always one cause: EXPO_PUBLIC_SUPABASE_URL points at a LAN IP the
    machine no longer has, because the network changed. Those vars are baked in
    at bundle time, so fixing .env also needs the dev server restarted.

    This branch existed before and never fired: a fetch failure arrives as a
    plain object, so the old `String(e)` matched against "[object Object]".
  */
  if (__DEV__ && lower.includes('network request failed')) {
    return `Can't reach Supabase at ${supabaseHost()}. If your network changed, update EXPO_PUBLIC_SUPABASE_URL in .env to this machine's current LAN IP (npm run db:status) and restart the dev server.`;
  }

  /*
    The signed-in user does not exist in the database.

    The session is still cryptographically valid — the local stack keeps its JWT
    secret across a reset — so nothing notices until a foreign key to
    `auth.users` is checked, and then it surfaces as an opaque constraint
    violation. `npm run db:reset` is what causes it, every time, and the fix is
    never in the code.
  */
  if (__DEV__ && lower.includes('is not present in table "users"')) {
    return 'Your session points at a user this database no longer has — almost always npm run db:reset. Sign out in Settings (or reinstall the dev client) and sign in again.';
  }

  /*
    An anonymous caller tried to create an event. `create_event()` raises this
    with hint = 'anonymous'; its own message is written for a log, and the app
    should say the thing the user can act on.

    Reaching this at all means the client gate was bypassed — the library sends a
    guest to `(auth)/create` before onboarding ever starts — so it is a backstop,
    not a message anyone should meet in the normal flow.
  */
  if (fieldOf(e, 'hint') === 'anonymous') {
    return 'Sign in with Google or Apple to start a memory of your own.';
  }

  return raw + diagnostics(e);
}

/** The host the app is configured to talk to, for the message above. */
function supabaseHost(): string {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  return url ? url.replace(/^https?:\/\//, '') : 'no URL configured';
}
