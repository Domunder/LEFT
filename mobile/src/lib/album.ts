/**
 * The album — what `(library)/album/[id]` shows, before and after the reveal.
 *
 * Reads only. Who may see what is decided by RLS: before the event is developed
 * `listPhotos()` returns the caller's own frames and nothing else, so the
 * "developing" state counts photos from the roster (`shots_taken`), which every
 * member can read, never from the photo rows.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { Share } from 'react-native';

import { track } from './analytics';
import { getSession } from './auth';
import { getEvent, isDeveloped, listMembers, type Event } from './events';
import { listPhotos, type Photo } from './photos';
import { signedUrls } from './storage';

export type AlbumPhoto = {
  id: string;
  /** The row, for moderation (`deletePhoto`). */
  row: Photo;
  thumbUri: string;
  storagePath: string;
  width: number | null;
  height: number | null;
  /** The photographer's name; undefined once their account is gone. */
  author?: string;
  mine: boolean;
};

export type Album = {
  event: Event;
  developed: boolean;
  isHost: boolean;
  memberCount: number;
  /** Frames taken by everyone, from the roster — known before the reveal. */
  shotsTaken: number;
  /** Empty until the event is developed. */
  photos: AlbumPhoto[];
};

/** Storage signs this many paths per request without complaint. */
const SIGN_BATCH = 200;

async function signAll(paths: string[]): Promise<Map<string, string>> {
  const urls = new Map<string, string>();
  for (let i = 0; i < paths.length; i += SIGN_BATCH) {
    const batch = await signedUrls(paths.slice(i, i + SIGN_BATCH));
    batch.forEach((url, path) => urls.set(path, url));
  }
  return urls;
}

export async function loadAlbum(eventId: string): Promise<Album> {
  const [event, members, session] = await Promise.all([
    getEvent(eventId),
    listMembers(eventId),
    getSession(),
  ]);
  const userId = session?.user.id;
  const developed = isDeveloped(event);

  const base = {
    event,
    developed,
    isHost: event.host_id === userId,
    memberCount: members.length,
    shotsTaken: members.reduce((sum, member) => sum + member.shots_taken, 0),
  };
  if (!developed) return { ...base, photos: [] };

  const rows = await listPhotos(eventId);
  const urls = await signAll(rows.flatMap((row) => (row.thumb_path ? [row.thumb_path] : [])));
  const names = new Map(members.map((member) => [member.user_id, member.display_name]));

  const photos = rows.flatMap((row): AlbumPhoto[] => {
    const thumbUri = row.thumb_path ? urls.get(row.thumb_path) : undefined;
    if (!thumbUri || !row.storage_path) return [];
    return [
      {
        id: row.id,
        row,
        thumbUri,
        storagePath: row.storage_path,
        width: row.width,
        height: row.height,
        author: row.user_id ? names.get(row.user_id) : undefined,
        mine: row.user_id === userId,
      },
    ];
  });

  return { ...base, photos };
}

/** A signed URL for one original, or undefined when it cannot be had. */
export async function originalUrl(photo: AlbumPhoto): Promise<string | undefined> {
  return (await signedUrls([photo.storagePath])).get(photo.storagePath);
}

// --- save and share ---------------------------------------------------------

/** Originals fetched for saving or sharing. The system may clear it. */
function exportDir(): Directory {
  const dir = new Directory(Paths.cache, 'album-export');
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

/** The original on disk, downloaded once. */
async function localOriginal(photo: AlbumPhoto): Promise<File> {
  const file = new File(exportDir(), `${photo.id}.jpg`);
  if (file.exists && file.size > 0) return file;

  const url = await originalUrl(photo);
  if (!url) throw new Error('The photo could not be loaded');
  if (file.exists) file.delete();
  return File.downloadFileAsync(url, file);
}

export class PhotoAccessDeniedError extends Error {
  constructor() {
    super('Photo access was not granted');
    this.name = 'PhotoAccessDeniedError';
  }
}

/** Ask once for write-only access to the photo library. */
export async function ensureCanSave(): Promise<void> {
  const permission = await MediaLibrary.requestPermissionsAsync(true);
  if (!permission.granted) throw new PhotoAccessDeniedError();
}

/** Save one original to the phone's photo library. Call `ensureCanSave()` first. */
export async function savePhoto(photo: AlbumPhoto): Promise<void> {
  const file = await localOriginal(photo);
  await MediaLibrary.Asset.create(file.uri);
}

/**
 * Open the system share sheet for one original.
 *
 * RN's own `Share` rather than `expo-sharing`: it needs no native module. On
 * Android it can only share text, so the sheet is iOS-only for now.
 */
export async function sharePhoto(photo: AlbumPhoto): Promise<void> {
  const file = await localOriginal(photo);
  await Share.share({ url: file.uri });
}

// --- the reveal, once per film and phone -------------------------------------

const REVEAL_PREFIX = 'left:reveal-seen:';

export async function hasSeenReveal(eventId: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(REVEAL_PREFIX + eventId)) === '1';
  } catch {
    // Playing it twice is better than never.
    return false;
  }
}

export async function markRevealSeen(eventId: string, photoCount: number): Promise<void> {
  track('reveal_seen', { photos: photoCount });

  try {
    await AsyncStorage.setItem(REVEAL_PREFIX + eventId, '1');
  } catch {
    // It plays again next time; nothing to do about it here.
  }
}
