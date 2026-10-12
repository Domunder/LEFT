/**
 * Invite links.
 *
 * One URL does three jobs, depending on who taps it:
 *
 *  - has LEFT installed  -> the universal link opens 08 · Join with the code
 *                           already in hand (app.json's associatedDomains /
 *                           intentFilters, plus app/+native-intent.ts)
 *  - no app, iOS/Android -> leftmoment.com forwards to the App Store or Play
 *  - anything else       -> that same page, showing the code and both badges
 *
 * Only the first is built in the app. The other two are the website's job, and
 * **none of them work until leftmoment.com is actually serving** — see CLAUDE.md's
 * open gaps for the three endpoints it owes us.
 *
 * A `left://` scheme link was the original plan (and is still what app.json's
 * `scheme` registers) but it cannot be shared: WhatsApp and iMessage render an
 * unknown scheme as dead plain text, so anyone without the app gets nothing to tap.
 */

/** Where invite links point. The one place to change when the domain moves. */
export const INVITE_HOST = 'https://leftmoment.com';

/** The path segment invites live under, shared with +native-intent.ts. */
export const INVITE_PATH = 'j';

/**
 * The link for an invite code — what the QR encodes and what the share sheet sends.
 *
 * Codes come out of the database uppercase (`generate_invite_code()`), and the
 * matching parse in +native-intent.ts re-uppercases, so a link that has been
 * lowercased in transit still resolves.
 */
export function inviteUrl(code: string): string {
  return `${INVITE_HOST}/${INVITE_PATH}/${code.toUpperCase()}`;
}

/**
 * The body of the native share sheet.
 *
 * The code is spelled out alongside the link so the message still carries
 * everything needed if it is read aloud or pasted somewhere the link does not
 * linkify.
 */
export function inviteMessage(eventName: string, code: string): string {
  return `Join "${eventName}" on LEFT — we're filming one shared film together.\n\n${inviteUrl(code)}\n\nCode: ${code.toUpperCase()}`;
}

/** Filename for a QR saved to the camera roll. */
export function qrFilename(code: string): string {
  return `left-${code.toUpperCase()}.png`;
}

/** `/j/K7MP2Q`, with or without a trailing slash or query string. */
const INVITE_ROUTE = new RegExp(`^/?${INVITE_PATH}/([^/?#]+)`, 'i');

/**
 * Pull the invite code out of a URL, or null if it is not an invite link.
 *
 * Shared by two callers that must agree, or a link works one way in and not the
 * other: `app/+native-intent.ts` (a link tapped elsewhere on the phone) and
 * screen 08's QR scanner (the same URL, read off a host's screen). A scanner
 * that accepted a slightly different shape than the deep-link handler would be
 * an unpleasant bug to track down.
 *
 * Accepts both `https://leftmoment.com/j/CODE` and `left://j/CODE`, where the
 * code lands in the host rather than the pathname. Returns the code uppercased,
 * matching the database, so a link lowercased in transit still resolves.
 */
export function parseInviteUrl(url: string): string | null {
  try {
    const parsed = new URL(url, INVITE_HOST);
    const match =
      INVITE_ROUTE.exec(parsed.pathname) ??
      INVITE_ROUTE.exec(`/${parsed.host}${parsed.pathname}`);

    return match ? decodeURIComponent(match[1]).toUpperCase() : null;
  } catch {
    return null;
  }
}

/**
 * Codes are six characters from a deliberately unambiguous alphabet — no I, O,
 * 0 or 1, because they get read aloud and typed by hand at a party. See
 * `generate_invite_code()` in the initial migration.
 */
const CODE_SHAPE = /^[A-HJ-NP-Z2-9]{6}$/;

/** True when a code is well-formed. Not a claim that the event exists. */
export function isValidCodeShape(code: string): boolean {
  return CODE_SHAPE.test(code.trim().toUpperCase());
}
