/**
 * 17 · Album — PLACEHOLDER
 *
 * Replaces the clip player. Before the event ends this is the "developing"
 * state (a count of photos taken, nothing visible); afterwards it is the
 * developed album — grid, full-screen viewer, save and share. Milestone M3 in
 * docs/MILESTONES.md. The `id` param is the event id.
 */

import { Placeholder } from '@/components/dev/placeholder';

export default function AlbumScreen() {
  return (
    <Placeholder
      screen="17 · Album"
      note="The event's photos — hidden while the film develops, a shared album once it has. Built in milestone M3."
    />
  );
}
