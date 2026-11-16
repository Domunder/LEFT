/**
 * A guest's own frames in one event — for "Your shots" and the camera's
 * last-photo tile.
 *
 * Two sources, merged: frames already uploaded (rows + signed thumbnail URLs)
 * and frames still in the upload queue, read straight from the phone so the
 * list is complete with no signal. Other people's frames never appear: before
 * the event is developed RLS returns only the caller's own.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { getSession } from './auth';
import { getMyMissions, type Mission } from './missions';
import { listMyPhotos } from './photos';
import { signedUrls } from './storage';
import { localShots, owedMissionTags } from './upload-queue';

export type MyShot = {
  id: string;
  takenAt: string;
  thumbUri: string;
  /** A local file, or a storage path to sign when the frame is opened. */
  full: { uri: string } | { path: string };
};

function queued(eventId: string): MyShot[] {
  return localShots(eventId).map((shot) => ({
    id: shot.id,
    takenAt: shot.takenAt,
    thumbUri: shot.thumbUri,
    full: { uri: shot.fullUri },
  }));
}

const newestFirst = (a: MyShot, b: MyShot) => b.takenAt.localeCompare(a.takenAt);

/** Every frame, newest first. Offline, only what is still on the phone. */
export async function loadMyShots(eventId: string): Promise<MyShot[]> {
  const local = queued(eventId);

  let uploaded: MyShot[] = [];
  try {
    const userId = (await getSession())?.user.id;
    if (userId) {
      const photos = await listMyPhotos(eventId, userId);
      const urls = await signedUrls(photos.flatMap((p) => (p.thumb_path ? [p.thumb_path] : [])));
      uploaded = photos.flatMap((photo) => {
        const thumbUri = photo.thumb_path ? urls.get(photo.thumb_path) : undefined;
        return thumbUri && photo.storage_path
          ? [{ id: photo.id, takenAt: photo.taken_at, thumbUri, full: { path: photo.storage_path } }]
          : [];
      });
    }
  } catch {
    // Offline: the frames still on the phone are all that can be shown.
  }

  // A frame is briefly in both lists between its upload and leaving the queue.
  const ids = new Set(local.map((shot) => shot.id));
  return [...local, ...uploaded.filter((shot) => !ids.has(shot.id))].sort(newestFirst);
}

/**
 * The newest frame's thumbnail, or null when there is none.
 *
 * Answers from the queue without touching the network whenever the newest
 * frame is still on the phone — which is always the case right after a shot.
 */
export async function latestShotThumb(eventId: string): Promise<string | null> {
  const local = queued(eventId).sort(newestFirst)[0];
  if (local) return local.thumbUri;
  return (await loadMyShots(eventId))[0]?.thumbUri ?? null;
}

// --- missions ----------------------------------------------------------------
//
// A guest's missions as the camera and "Your shots" show them: the server's
// last answer, with the tags still in the upload queue laid over it. The
// server stays the judge of what was dealt; the overlay only says which photo
// the guest has already marked, so a mission reads as done the moment the
// shutter fires, with or without a signal.

const missionsKey = (eventId: string, userId: string) => `left.missions.${eventId}.${userId}`;

/** The last answer this phone had, for opening with no signal. */
export async function cachedMissions(eventId: string, userId: string): Promise<Mission[] | null> {
  try {
    const stored = await AsyncStorage.getItem(missionsKey(eventId, userId));
    const parsed: unknown = stored ? JSON.parse(stored) : null;
    return Array.isArray(parsed) ? (parsed as Mission[]) : null;
  } catch {
    return null;
  }
}

/** Ask the server (which deals on the first call of a live event) and keep the answer. */
export async function fetchMissions(eventId: string, userId: string): Promise<Mission[]> {
  const missions = await getMyMissions(eventId);
  void AsyncStorage.setItem(missionsKey(eventId, userId), JSON.stringify(missions)).catch(() => {});
  return missions;
}

/**
 * Mark `photoId` as the photo for `missionId` (null: for none), as the server
 * does it: the photo leaves whatever mission it held, and the mission drops
 * whatever photo it had.
 */
export function applyMissionTag(
  missions: readonly Mission[],
  photoId: string,
  missionId: string | null
): Mission[] {
  return missions.map((mission) => {
    if (mission.id === missionId) return { ...mission, photoId };
    if (mission.photoId === photoId) return { ...mission, photoId: null };
    return mission;
  });
}

/** The server's answer with the queue's owed tags over it, newest last. */
export function withQueuedTags(eventId: string, missions: readonly Mission[]): Mission[] {
  return owedMissionTags(eventId).reduce<Mission[]>(
    (current, owed) => applyMissionTag(current, owed.photoId, owed.missionId),
    [...missions]
  );
}

/** The mission a photo is for, if any. */
export function missionOf(missions: readonly Mission[], photoId: string): Mission | undefined {
  return missions.find((mission) => mission.photoId === photoId);
}
