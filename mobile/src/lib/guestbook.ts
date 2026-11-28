/**
 * The guest book (1.3.0, step 9) — polaroids and short notes a moment's
 * members leave for each other.
 *
 * Not part of the reveal: every member sees every entry right away. Three
 * entries per guest, never counted against the roll; the host can switch the
 * book off. All of that is the server's
 * (`supabase/migrations/20261128030000_guestbook.sql`); this file only calls
 * its doors: `add_guestbook_entry()` → upload to the entry's own path →
 * `mark_guestbook_uploaded()`.
 */

import * as Crypto from 'expo-crypto';
import { File, Paths } from 'expo-file-system';

import { getSession } from './auth';
import { getEvent, listMembers, type Event, type FilmLook } from './events';
import { developPhoto } from './look-shader';
import { removeFiles, signedUrls, uploadJpeg } from './storage';
import { getSupabase } from './supabase';

/** Mirrors `guestbook_limit()` and `guestbook_note_max()` — for the UI only. */
export const GUESTBOOK_LIMIT = 3;
export const GUESTBOOK_NOTE_MAX = 150;

export type GuestbookEntry = {
  id: string;
  userId: string;
  /** The author's name on the roster; null when they are no longer on it. */
  author: string | null;
  note: string | null;
  /** A signed URL, or null for a note without a picture. */
  photoUri: string | null;
  createdAt: string;
  mine: boolean;
};

export type Guestbook = {
  event: Event;
  isHost: boolean;
  entries: GuestbookEntry[];
  /** How many more the viewer may add. */
  left: number;
};

/** `{event_id}/guestbook/{entry_id}.jpg` — `guestbook_path()` on the server. */
function guestbookPath(eventId: string, entryId: string): string {
  return `${eventId}/guestbook/${entryId}.jpg`;
}

/** The whole book, newest first. Entries still uploading (the viewer's own) are left out. */
export async function loadGuestbook(eventId: string): Promise<Guestbook> {
  const [event, session, members] = await Promise.all([
    getEvent(eventId),
    getSession(),
    listMembers(eventId),
  ]);
  const userId = session?.user.id ?? '';

  const { data, error } = await getSupabase()
    .from('guestbook_entries')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });
  if (error) throw error;

  const rows = data ?? [];
  const ready = rows.filter((row) => row.status === 'ready');
  const urls = await signedUrls(
    ready.filter((row) => row.has_photo).map((row) => guestbookPath(eventId, row.id))
  );
  const names = new Map(members.map((member) => [member.user_id, member.display_name]));

  return {
    event,
    isHost: event.host_id === userId,
    entries: ready.map((row) => ({
      id: row.id,
      userId: row.user_id,
      author: names.get(row.user_id) ?? null,
      note: row.note,
      photoUri: row.has_photo ? (urls.get(guestbookPath(eventId, row.id)) ?? null) : null,
      createdAt: row.created_at,
      mine: row.user_id === userId,
    })),
    // Counted over every row of the viewer's, as the server does.
    left: Math.max(0, GUESTBOOK_LIMIT - rows.filter((row) => row.user_id === userId).length),
  };
}

export type PreparedPolaroid = { uri: string; width: number; height: number };

/**
 * Turn a capture or a picked photo into the polaroid's picture: a square cut
 * of a portrait frame, at the thumbnail size, with the moment's look baked in
 * when one is given (a camera shot) and its own colours otherwise (a photo
 * from the phone). Written to the cache; what is shown is what is uploaded.
 */
export async function preparePolaroid(
  uri: string,
  look: FilmLook | null
): Promise<PreparedPolaroid> {
  const bytes = await new File(uri).bytes();
  const developed = developPhoto(bytes, look, 1);
  const file = new File(Paths.cache, `polaroid-${Crypto.randomUUID()}.jpg`);
  await file.write(developed.thumb);
  return { uri: file.uri, width: developed.width, height: developed.height };
}

/**
 * Add an entry: a note, a picture, or both. With a picture the entry only
 * shows once its file is in the bucket; if that fails the entry is taken back,
 * so a failed attempt does not use up one of the three.
 */
export async function addGuestbookEntry(input: {
  eventId: string;
  note: string;
  photo: PreparedPolaroid | null;
}): Promise<void> {
  const supabase = getSupabase();
  const id = Crypto.randomUUID();
  const note = input.note.trim();

  const { error } = await supabase.rpc('add_guestbook_entry', {
    p_event_id: input.eventId,
    p_entry_id: id,
    p_note: note.length > 0 ? note : undefined,
    p_has_photo: input.photo !== null,
  });
  if (error) throw error;
  if (!input.photo) return;

  try {
    const bytes = await new File(input.photo.uri).bytes();
    await uploadJpeg(guestbookPath(input.eventId, id), bytes.buffer as ArrayBuffer);
    const { error: markError } = await supabase.rpc('mark_guestbook_uploaded', {
      p_entry_id: id,
      p_width: input.photo.width,
      p_height: input.photo.height,
    });
    if (markError) throw markError;
  } catch (e) {
    await supabase.rpc('delete_guestbook_entry', { p_entry_id: id }).then(
      () => {},
      () => {}
    );
    throw e;
  }
}

/** Its author takes an entry back; the host removes any. The file first, best effort. */
export async function deleteGuestbookEntry(eventId: string, entry: GuestbookEntry): Promise<void> {
  if (entry.photoUri) {
    await removeFiles([guestbookPath(eventId, entry.id)]).catch(() => {});
  }
  const { error } = await getSupabase().rpc('delete_guestbook_entry', { p_entry_id: entry.id });
  if (error) throw error;
}

/** Flag someone else's entry for the operator. A second report is a no-op. */
export async function reportGuestbookEntry(entryId: string): Promise<void> {
  const { error } = await getSupabase().rpc('report_guestbook_entry', { p_entry_id: entryId });
  if (error) throw error;
}

/** The host switches the guest book on or off, at any time. */
export async function setEventGuestbook(eventId: string, on: boolean): Promise<Event> {
  const { data, error } = await getSupabase().rpc('set_event_guestbook', {
    p_event_id: eventId,
    p_on: on,
  });
  if (error) throw error;
  return data as unknown as Event;
}
