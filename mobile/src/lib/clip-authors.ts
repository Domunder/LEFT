/**
 * Who filmed a clip.
 *
 * `clips` carries a `user_id` and nothing else about the person — no name, no
 * avatar. The name lives on `event_members.display_name`, and there is **no
 * foreign key from `clips.user_id` to `event_members`**: the schema declares
 * only `clips_event_id_fkey`. PostgREST builds embeds from declared
 * relationships, so `clips(*, event_members(display_name))` does not merely
 * return nulls — it fails. The join has to happen in JavaScript, and this is it.
 *
 * Two holes the schema leaves open, both of which reach the screen:
 *
 *  - `clips.user_id` is nullable. A clip outlives the account that filmed it.
 *  - a user_id may have no member row at all, if they left the event after
 *    filming. Their clip stays, because the group was charged for it.
 *
 * Both resolve to the same anonymous author rather than an empty badge. A tile
 * captioned with a blank is a rendering bug to anyone looking at it; "Someone"
 * is the truth, and it is what the group would say out loud.
 */

import { initialsFor, listMembers, type Clip } from './events';

export type ClipAuthor = {
  name: string;
  /** For the toast's avatar tile. Two letters, or '?'. */
  initials: string;
};

/**
 * The author whose row is gone, or who never had one.
 *
 * '?' matches what `initialsFor` itself returns for an unusable name, so the
 * avatar tile looks the same however the name went missing.
 */
export const UNKNOWN_AUTHOR: ClipAuthor = { name: 'Someone', initials: '?' };

/**
 * Every member of an event, keyed by the user id a clip carries.
 *
 * One query for the whole screen. Called once per load rather than per clip —
 * 17 renders every clip in the event, and a lookup per tile would be one round
 * trip per contributor for data that arrives in a single list.
 */
export async function authorsFor(eventId: string): Promise<Map<string, ClipAuthor>> {
  const members = await listMembers(eventId);

  return new Map(
    members.map((member) => [
      member.user_id,
      { name: member.display_name, initials: initialsFor(member.display_name) },
    ])
  );
}

/** Resolve one clip's author, covering both of the holes described above. */
export function authorOf(clip: Clip, authors: Map<string, ClipAuthor>): ClipAuthor {
  if (!clip.user_id) return UNKNOWN_AUTHOR;
  return authors.get(clip.user_id) ?? UNKNOWN_AUTHOR;
}
