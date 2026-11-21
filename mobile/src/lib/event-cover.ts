/**
 * The event image (2026-11-21, the user) — picked by the host on the creation
 * step after the look, shown through the look behind 12, behind 09's QR and on
 * a Moments card that has no photos yet.
 *
 * `events.cover` (migration `20261121162520_event_cover.sql`):
 *   null        no choice → a stock picture seeded by the event id
 *   'sample-N'  one of `COVER_SAMPLES`
 *   'upload'    the host's own photo at `photos/{event_id}/cover.jpg`
 *
 * The file sits in the photos bucket under the event's folder, so the purge,
 * account deletion and the orphan sweep remove it with the photos. Members may
 * read it before the reveal (its own storage policy); only the host writes it.
 */

import { File } from 'expo-file-system';
import { useEffect, useState } from 'react';

import { COVER_SAMPLES, coverFor } from '@/constants/samples';
import type { Event } from './events';
import { developPhoto } from './look-shader';
import { getSupabase } from './supabase';
import { signedUrls, uploadJpeg } from './storage';

/** What the creation step hands over: a stock key, or a local file to upload. */
export type CoverChoice = { kind: 'sample'; key: string } | { kind: 'upload'; uri: string };

export function coverPath(eventId: string): string {
  return `${eventId}/cover.jpg`;
}

/** The stock picture for a key, or the event's seeded default. */
function sampleSource(event: Pick<Event, 'id' | 'cover'>): number {
  const picked = COVER_SAMPLES.find((sample) => sample.key === event.cover);
  return picked ? picked.source : coverFor(event.id).source;
}

/**
 * The picture to draw for an event: a bundled `require` or a signed URL.
 * Until an uploaded cover's URL is known (or if it cannot be signed) the
 * seeded stock picture stands in.
 */
export function useEventCover(
  event: Pick<Event, 'id' | 'cover'> | null | undefined,
): number | string | null {
  const [url, setUrl] = useState<{ id: string; uri: string } | null>(null);
  const id = event?.id;
  const uploaded = event?.cover === 'upload';

  useEffect(() => {
    if (!id || !uploaded) return;
    let cancelled = false;
    const path = coverPath(id);
    signedUrls([path])
      .then((urls) => {
        const uri = urls.get(path);
        if (uri && !cancelled) setUrl({ id, uri });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [id, uploaded]);

  if (!event) return null;
  if (uploaded && url?.id === event.id) return url.uri;
  return sampleSource(event);
}

/**
 * Save the host's choice on a freshly created event. An own photo is resized
 * to the thumbnail size (1080 on the long edge — the backdrop's width) without
 * a look, uploaded, then named on the row. Throws on failure; the caller
 * decides whether that is worth stopping for (creation is not).
 */
export async function applyCover(eventId: string, choice: CoverChoice): Promise<void> {
  let cover: string;
  if (choice.kind === 'upload') {
    const bytes = await new File(choice.uri).bytes();
    const { thumb } = developPhoto(bytes, null);
    await uploadJpeg(coverPath(eventId), thumb.buffer as ArrayBuffer);
    cover = 'upload';
  } else {
    cover = choice.key;
  }

  const { error } = await getSupabase().from('events').update({ cover }).eq('id', eventId);
  if (error) throw error;
}

/** The first stock picture — the creation step's preselection. */
export const DEFAULT_COVER: CoverChoice = {
  kind: 'sample',
  key: COVER_SAMPLES[0].key,
};
