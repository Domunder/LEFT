/**
 * Maps incoming deep links onto routes.
 *
 * Invite links are public URLs (`https://leftmoment.com/j/K7MP2Q`) rather than a
 * route path, because they have to survive being pasted into WhatsApp for people
 * who do not have the app — see lib/invite.ts. That shape does not match any file
 * in app/, so it is rewritten here into the guest name screen.
 *
 * It goes to 11 rather than 08: the link already carries the code, so the join
 * sheet would have nothing left to ask. 08 is for the guest who arrives without
 * one and has to scan.
 *
 * The `left://` scheme is handled too: it is what app.json registers, so it still
 * arrives from anything that built one. Both shapes are recognised by
 * `parseInviteUrl`, which screen 08's QR scanner also uses — one parser, so a
 * link cannot work one way in and fail the other.
 *
 * The group is part of the path on purpose. `(auth)/name` (screen 06) and
 * `(guest)/name` (screen 11) both resolve to `/name`, and an unqualified `/name`
 * picks the first — which is 06, a screen that writes a name with no session and
 * fails with "Auth session missing!". Every href to either must name its group.
 *
 * This runs before the router resolves the URL. Returning the path unchanged lets
 * every other link (including expo-router's own) route normally.
 */

import { parseInviteUrl } from '@/lib/invite';

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  const code = parseInviteUrl(path);
  return code ? `/(guest)/name?code=${encodeURIComponent(code)}` : path;
}
