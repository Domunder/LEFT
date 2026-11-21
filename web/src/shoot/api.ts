/**
 * The web camera's side of the server — the same doors the app uses.
 *
 * Nothing here is new on the server: a browser guest is an anonymous Supabase
 * user exactly like an app guest, joins with `join_event()`, spends frames with
 * `claim_shot()`, uploads under the bucket's pinned paths and attaches them
 * with `mark_photo_uploaded()`. The roll, the cap and the reveal are enforced
 * by the database, so a browser cannot do anything the app could not.
 *
 * Mirrors `mobile/src/lib/{events,photos,storage,auth}.ts`; keep the two in
 * step when a door changes.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '../generated/database';

type Tables = Database['public']['Tables'];
export type Event = Tables['events']['Row'];
export type Member = Tables['event_members']['Row'];
export type Photo = Tables['photos']['Row'];
export type FilmLook = Database['public']['Enums']['film_look'];

const URL_ = import.meta.env.PUBLIC_SUPABASE_URL as string | undefined;
const KEY = (import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  import.meta.env.PUBLIC_SUPABASE_ANON_KEY) as string | undefined;

export const PHOTO_BUCKET = 'photos';
export const MAX_NAME_LENGTH = 60;

export function isConfigured(): boolean {
  return Boolean(URL_ && KEY);
}

let client: SupabaseClient<Database> | null = null;

export function db(): SupabaseClient<Database> {
  if (client) return client;
  if (!URL_ || !KEY) throw new Error('The camera is not set up on this site yet.');
  // The session lives in localStorage: a guest who closes the tab and opens
  // the link again is the same member with the same roll.
  client = createClient<Database>(URL_, KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });
  return client;
}

/** The signed-in user's id, signing in anonymously first if there is nobody. Idempotent. */
export async function ensureGuest(): Promise<string> {
  const { data } = await db().auth.getSession();
  if (data.session) return data.session.user.id;

  const { data: signed, error } = await db().auth.signInAnonymously();
  if (error) throw error;
  if (!signed.user) throw new Error('Anonymous sign-in returned no user');
  return signed.user.id;
}

export async function currentUserId(): Promise<string | null> {
  const { data } = await db().auth.getSession();
  return data.session?.user.id ?? null;
}

export async function joinEvent(code: string, name: string): Promise<string> {
  const { data, error } = await db().rpc('join_event', {
    p_invite_code: code,
    p_display_name: name,
  });
  if (error) throw error;
  return data;
}

export async function getEvent(eventId: string): Promise<Event> {
  const { data, error } = await db().from('events').select().eq('id', eventId).single();
  if (error) throw error;
  return data;
}

/** The caller's own roster row, or null when they are not (or no longer) a member. */
export async function getMyMember(eventId: string, userId: string): Promise<Member | null> {
  const { data, error } = await db()
    .from('event_members')
    .select()
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listMembers(eventId: string): Promise<Member[]> {
  const { data, error } = await db().from('event_members').select().eq('event_id', eventId);
  if (error) throw error;
  return data ?? [];
}

/** As `is_event_developed()` decides it: by status or by the clock. */
export function isDeveloped(event: Pick<Event, 'status' | 'ends_at'>, now = Date.now()): boolean {
  return event.status === 'developed' || new Date(event.ends_at).getTime() <= now;
}

export class RollEmptyError extends Error {
  constructor() {
    super('Your roll is empty');
    this.name = 'RollEmptyError';
  }
}

export class EventClosedError extends Error {
  constructor() {
    super('The cameras are not open');
    this.name = 'EventClosedError';
  }
}

/** Spend one frame. Idempotent per `photoId`; anything but the two refusals is retryable. */
export async function claimShot(eventId: string, photoId: string, takenAt: string) {
  const { data, error } = await db().rpc('claim_shot', {
    p_event_id: eventId,
    p_photo_id: photoId,
    p_taken_at: takenAt,
  });
  if (error) {
    if (error.hint === 'roll_empty') throw new RollEmptyError();
    if (error.hint === 'event_closed') throw new EventClosedError();
    throw error;
  }
  const row = data?.[0];
  if (!row) throw new Error('The shot was not recorded');
  return { shotsTaken: row.shots_taken, shotsLeft: row.shots_left ?? null };
}

export function photoPath(eventId: string, userId: string, photoId: string) {
  return `${eventId}/${userId}/${photoId}.jpg`;
}

export function thumbPath(eventId: string, userId: string, photoId: string) {
  return `${eventId}/${userId}/${photoId}_thumb.jpg`;
}

export async function uploadJpeg(path: string, body: Blob): Promise<void> {
  const { error } = await db()
    .storage.from(PHOTO_BUCKET)
    .upload(path, body, { contentType: 'image/jpeg', upsert: true });
  if (error) throw error;
}

export async function markPhotoUploaded(photoId: string, width: number, height: number) {
  const { error } = await db().rpc('mark_photo_uploaded', {
    p_photo_id: photoId,
    p_width: width,
    p_height: height,
  });
  if (error) throw error;
}

/** Uploaded photos, oldest first. Before the reveal RLS returns only the caller's own. */
export async function listPhotos(eventId: string): Promise<Photo[]> {
  const { data, error } = await db()
    .from('photos')
    .select()
    .eq('event_id', eventId)
    .eq('status', 'uploaded')
    .order('taken_at');
  if (error) throw error;
  return data ?? [];
}

export async function signedUrls(paths: readonly string[], seconds = 3600) {
  const urls = new Map<string, string>();
  if (paths.length === 0) return urls;
  const { data, error } = await db()
    .storage.from(PHOTO_BUCKET)
    .createSignedUrls([...paths], seconds);
  if (error) throw error;
  for (const entry of data ?? []) {
    if (entry.path && entry.signedUrl) urls.set(entry.path, entry.signedUrl);
  }
  return urls;
}

// ---------------------------------------------------------------------------
// The event image — mirrors `mobile/src/lib/event-cover.ts`
// ---------------------------------------------------------------------------

/**
 * The stock pictures, served from `public/shoot/` — copies of the app's
 * `assets/images/samples/sample-{1..6}.jpg`. Positions match the app's
 * `SAMPLE_PHOTOS`: `events.cover = 'sample-N'` is file N.
 */
export const SAMPLE_PHOTOS: readonly string[] = [1, 2, 3, 4, 5, 6].map((n) => `/shoot/sample-${n}.jpg`);

/** The app's `look-sample.jpg`, which its `LookPreview` draws by default. */
export const LOOK_SAMPLE = '/shoot/look-sample.jpg';

/** `count` stock pictures starting at a place seeded by `seed` — the app's `samplesFor`. */
export function samplesFor(seed: string, count = 3): string[] {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return Array.from({ length: count }, (_, i) => SAMPLE_PHOTOS[(hash + i) % SAMPLE_PHOTOS.length]);
}

export function coverPath(eventId: string): string {
  return `${eventId}/cover.jpg`;
}

/**
 * The picture to draw for an event (`events.cover`): null → a stock picture
 * seeded by the id, 'sample-N' → that one, 'upload' → the host's own photo,
 * signed (members may read it before the reveal). An upload that cannot be
 * signed falls back to the seeded stock picture, as in the app.
 */
export async function eventCoverUrl(event: Pick<Event, 'id' | 'cover'>): Promise<string> {
  const fallback = samplesFor(event.id, 1)[0];
  if (event.cover === 'upload') {
    try {
      const path = coverPath(event.id);
      return (await signedUrls([path])).get(path) ?? fallback;
    } catch {
      return fallback;
    }
  }
  const n = /^sample-(\d+)$/.exec(event.cover ?? '')?.[1];
  return (n && SAMPLE_PHOTOS[Number(n) - 1]) || fallback;
}

/** The owner's own photo (or the host's moderation). Files first, then the row. */
export async function deletePhoto(photo: Photo): Promise<void> {
  const paths = [photo.storage_path, photo.thumb_path].filter((p): p is string => !!p);
  if (paths.length) {
    const { error } = await db().storage.from(PHOTO_BUCKET).remove(paths);
    if (error) throw error;
  }
  const { error } = await db().from('photos').delete().eq('id', photo.id);
  if (error) throw error;
}

export async function reportPhoto(photoId: string): Promise<void> {
  const { error } = await db().rpc('report_photo', { p_photo_id: photoId });
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Missions — mirrors the guest half of `mobile/src/lib/missions.ts`
// ---------------------------------------------------------------------------

/** What a guest was dealt. `photoId` is the photo that fulfils it, if any. */
export type Mission = { id: string; body: string; personal: boolean; photoId: string | null };
export type MissionName = { id: string; name: string };

export class MissionNameTakenError extends Error {
  constructor() {
    super('Someone else is already using that name');
    this.name = 'MissionNameTakenError';
  }
}

/** The guest's missions. The first call while the event is live deals them; empty when off. */
export async function getMyMissions(eventId: string): Promise<Mission[]> {
  const { data, error } = await db().rpc('my_missions', { p_event_id: eventId });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.mission_id,
    body: row.body,
    personal: row.personal,
    photoId: row.photo_id,
  }));
}

/** "This photo was for that mission." Null: for none. Needs the photo's row (after the claim). */
export async function setPhotoMission(photoId: string, missionId: string | null): Promise<void> {
  const { error } = await db().rpc('set_photo_mission', {
    p_photo_id: photoId,
    p_mission_id: missionId ?? undefined,
  });
  if (error) throw error;
}

/** `photoId -> mission text`. RLS: your own photos' tags, everyone's once developed. */
export async function listPhotoMissions(eventId: string): Promise<Map<string, string>> {
  const { data, error } = await db()
    .from('member_missions')
    .select('photo_id, event_missions ( body )')
    .eq('event_id', eventId)
    .not('photo_id', 'is', null);
  if (error) throw error;
  const byPhoto = new Map<string, string>();
  for (const row of data ?? []) {
    const body = row.event_missions?.body;
    if (row.photo_id && body) byPhoto.set(row.photo_id, body);
  }
  return byPhoto;
}

/** The names the host listed for personal missions that nobody has claimed yet. */
export async function listUnclaimedNames(code: string): Promise<MissionName[]> {
  const { data, error } = await db().rpc('mission_people_for_invite', { p_invite_code: code });
  if (error) throw error;
  return (data ?? []).map((row) => ({ id: row.person_id, name: row.name }));
}

/** "That's me." Refused with `taken`; `already_dealt` is ignored by the caller. */
export async function claimName(eventId: string, personId: string): Promise<void> {
  const { error } = await db().rpc('claim_mission_person', {
    p_event_id: eventId,
    p_person_id: personId,
  });
  if (error) {
    if (error.hint === 'taken') throw new MissionNameTakenError();
    throw error;
  }
}

/** The server refuses this tag for good: developed, not the guest's, no such photo. */
export function tagRefusedForGood(error: unknown): boolean {
  const e = error as { code?: string; hint?: string } | null;
  return e?.hint === 'event_closed' || e?.hint === 'not_yours' || e?.code === 'P0002';
}

/** The server answered (rather than being unreachable, which has an empty code). */
export function answeredByServer(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' && code.length > 0;
}

/**
 * A sentence for any failure. Supabase errors are plain objects, not `Error`s,
 * so `String(e)` would print "[object Object]".
 */
export function messageFor(e: unknown): string {
  if (e && typeof e === 'object') {
    const err = e as { hint?: string; code?: string; message?: string };
    if (err.hint === 'full') return 'This group is full. Ask the host to make room.';
    if (err.code === 'P0002') return 'This invite link does not work any more. Ask the host for a new one.';
    if (err.message && /fetch|network/i.test(err.message)) return 'No connection. Check your signal and try again.';
    if (err.message && /anonymous/i.test(err.message)) return 'Joining isn’t available right now.';
    if (err.message) return err.message;
  }
  return 'Something went wrong. Try again.';
}
