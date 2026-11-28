/**
 * Missions.
 *
 * Thin wrappers over the database — no state is held here. What a mission is,
 * who is dealt which, and which photo fulfils it are all decided server-side
 * (`supabase/migrations/20261117000000_missions.sql`):
 *
 *   - **The deal is the server's.** `getMyMissions()` deals once, while the event
 *     is live, and returns the same cards on every later call.
 *   - **A photo is tagged through `setPhotoMission()`**, never by writing a row.
 *     The tag needs the photo's row to exist, so the upload queue calls it after
 *     the claim (a shot taken offline is tagged once it is claimed).
 *   - **The reveal holds.** Before the film is developed a guest reads only their
 *     own cards; `listPhotoMissions()` then returns only their own photos' tags.
 */

import { getSupabase } from './supabase';
import { t } from '@/i18n';
import type { Database } from '@/types/database';

type Tables = Database['public']['Tables'];

export type MissionPerson = Tables['mission_people']['Row'];
export type EventMission = Tables['event_missions']['Row'];

/** What a guest was dealt. `photoId` is the photo that fulfils it, if any. */
export type Mission = {
  id: string;
  body: string;
  /** Written for this guest by name, rather than drawn from the list. */
  personal: boolean;
  photoId: string | null;
};

/** The count the host picks, and what the server allows. */
export const MISSIONS_PER_GUEST_MIN = 1;
export const MISSIONS_PER_GUEST_MAX = 3;
export const MISSIONS_PER_GUEST_DEFAULT = 1;
/** `max_event_missions()`: personal and shared together. The server is the authority. */
export const MAX_EVENT_MISSIONS = 200;

/** Someone else already claimed that name. */
export class MissionNameTakenError extends Error {
  constructor() {
    super(t('missions.nameTaken'));
    this.name = 'MissionNameTakenError';
  }
}

/** The cards were dealt; the guest can no longer pick or change their name. */
export class MissionsDealtError extends Error {
  constructor() {
    super(t('missions.alreadyDealt'));
    this.name = 'MissionsDealtError';
  }
}

/** The host's list is fixed once the event has started. */
export class MissionsLockedError extends Error {
  constructor() {
    super(t('missions.fixedOnceStarted'));
    this.name = 'MissionsLockedError';
  }
}

/**
 * The guest's missions. The first call while the event is live deals them.
 * Empty before the event starts and when missions are off.
 */
export async function getMyMissions(eventId: string): Promise<Mission[]> {
  const { data, error } = await getSupabase().rpc('my_missions', { p_event_id: eventId });
  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.mission_id,
    body: row.body,
    personal: row.personal,
    photoId: row.photo_id,
  }));
}

/**
 * "This photo was for that mission." `missionId` null says it was for none.
 * One photo has at most one mission, and one mission one photo: tagging moves
 * the photo off whatever it held and replaces what the mission held.
 */
export async function setPhotoMission(photoId: string, missionId: string | null): Promise<void> {
  const { error } = await getSupabase().rpc('set_photo_mission', {
    p_photo_id: photoId,
    p_mission_id: missionId ?? undefined,
  });
  if (error) throw error;
}

/**
 * Which mission each photo of the event was for, as `photoId -> text`.
 *
 * RLS decides what comes back: your own photos' tags always, everyone's once
 * the film is developed. Used by the viewer to caption a photo.
 */
export async function listPhotoMissions(eventId: string): Promise<Map<string, string>> {
  const { data, error } = await getSupabase()
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

// ---------------------------------------------------------------------------
// Joining: picking your name
// ---------------------------------------------------------------------------

/** `mine`: the caller holds this name already (back on 11 from the waiting screen). */
export type MissionName = { id: string; name: string; mine: boolean };

/**
 * The names the host listed that nobody else holds, for the join screen —
 * the caller's own included, marked `mine`. Someone else's claimed name is
 * not listed at all.
 */
export async function listUnclaimedNames(inviteCode: string): Promise<MissionName[]> {
  const { data, error } = await getSupabase().rpc('mission_people_for_invite', {
    p_invite_code: inviteCode,
  });
  if (error) throw error;
  // `mine === true`: a server from before 20261119000000 has no `mine` column.
  return (data ?? []).map((row) => ({ id: row.person_id, name: row.name, mine: row.mine === true }));
}

/** "That's me." `personId` null gives your name back. */
export async function claimName(eventId: string, personId: string | null): Promise<void> {
  const { error } = await getSupabase().rpc('claim_mission_person', {
    p_event_id: eventId,
    // The generated types say string; SQL takes null as "give my name back".
    p_person_id: personId as string,
  });

  if (error) {
    if (error.hint === 'taken') throw new MissionNameTakenError();
    if (error.hint === 'already_dealt') throw new MissionsDealtError();
    throw error;
  }
}

// ---------------------------------------------------------------------------
// The host's side
// ---------------------------------------------------------------------------

/** Switch missions on (1–3 per guest) or off (null). Only before the event starts. */
export async function setMissionsPerGuest(
  eventId: string,
  perGuest: number | null
): Promise<void> {
  const { error } = await getSupabase().rpc('set_missions', {
    p_event_id: eventId,
    // The generated types say number; SQL takes null as "missions off".
    p_per_guest: perGuest as number,
  });
  if (error) throw describeLocked(error);
}

export type HostMissions = {
  /** The list guests are dealt from. */
  pool: EventMission[];
  people: (MissionPerson & { missions: EventMission[] })[];
};

/** Everything the host can edit: the list, and the named people with their missions. */
export async function listHostMissions(eventId: string): Promise<HostMissions> {
  const supabase = getSupabase();

  const [missions, people] = await Promise.all([
    supabase.from('event_missions').select('*').eq('event_id', eventId).order('seq'),
    supabase.from('mission_people').select('*').eq('event_id', eventId).order('created_at'),
  ]);
  if (missions.error) throw missions.error;
  if (people.error) throw people.error;

  const all = missions.data ?? [];
  return {
    pool: all.filter((m) => m.person_id === null),
    people: (people.data ?? []).map((p) => ({
      ...p,
      missions: all.filter((m) => m.person_id === p.id),
    })),
  };
}

/** Add a mission to the list, or — with `personId` — a personal one. */
export async function addMission(
  eventId: string,
  body: string,
  personId: string | null = null
): Promise<void> {
  const { error } = await getSupabase()
    .from('event_missions')
    .insert({ event_id: eventId, body: body.trim(), person_id: personId });
  if (error) throw describeLocked(error);
}

export async function updateMission(missionId: string, body: string): Promise<void> {
  const { error } = await getSupabase()
    .from('event_missions')
    .update({ body: body.trim() })
    .eq('id', missionId);
  if (error) throw describeLocked(error);
}

export async function deleteMission(missionId: string): Promise<void> {
  const { error } = await getSupabase().from('event_missions').delete().eq('id', missionId);
  if (error) throw describeLocked(error);
}

/** Delete several missions at once (Select mode). */
export async function deleteMissions(missionIds: string[]): Promise<void> {
  if (missionIds.length === 0) return;
  const { error } = await getSupabase().from('event_missions').delete().in('id', missionIds);
  if (error) throw describeLocked(error);
}

/**
 * Move a mission onto a named person (personal) or, with `personId` null, back
 * to the shared list. The foreign key keeps it inside its own event.
 */
export async function moveMission(missionId: string, personId: string | null): Promise<void> {
  const { error } = await getSupabase()
    .from('event_missions')
    .update({ person_id: personId })
    .eq('id', missionId);
  if (error) throw describeLocked(error);
}

/**
 * Top the shared list up until it covers the whole group (`max_members` ×
 * per guest), from the event's mission library. Returns how many were added;
 * 0 when the list was already long enough.
 */
export async function generateMissions(eventId: string): Promise<number> {
  const { data, error } = await getSupabase().rpc('generate_missions', { p_event_id: eventId });
  if (error) throw describeLocked(error);
  return data ?? 0;
}

/** List a name for personal missions. */
export async function addPerson(eventId: string, name: string): Promise<MissionPerson> {
  const { data, error } = await getSupabase()
    .from('mission_people')
    .insert({ event_id: eventId, name: name.trim() })
    .select()
    .single();
  if (error) throw describeLocked(error);
  return data;
}

/** Removing a person removes their personal missions too. */
export async function deletePerson(personId: string): Promise<void> {
  const { error } = await getSupabase().from('mission_people').delete().eq('id', personId);
  if (error) throw describeLocked(error);
}

/**
 * Link a name to a guest who has already joined, so they get its personal
 * missions without picking anything — or, with `userId` null, free a name
 * somebody claimed by mistake. A guest holds one name; linking moves them off
 * any other. Only before the event starts.
 */
export async function assignPerson(personId: string, userId: string | null): Promise<void> {
  const { error } = await getSupabase().rpc('assign_mission_person', {
    p_person_id: personId,
    p_user_id: userId ?? undefined,
  });
  if (error) throw describeLocked(error);
}

/**
 * The list is writable only while the event is in setup; after that the row
 * policies refuse, which reads as a bare RLS error. Say what happened instead.
 */
function describeLocked(error: unknown): unknown {
  const e = error as { code?: string; hint?: string; message?: string };
  if (e?.hint === 'started') return new MissionsLockedError();
  if (e?.code === '42501') return new MissionsLockedError();
  return error;
}
