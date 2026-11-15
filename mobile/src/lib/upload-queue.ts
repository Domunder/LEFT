/**
 * The durable upload queue — every shot goes through here, online or not.
 *
 * The shutter does exactly one thing with a captured file: `enqueueShot()`. That
 * moves it out of the camera's cache into the app's documents and writes a queue
 * entry to AsyncStorage, and only then returns. From that moment the picture
 * survives an app kill, a dead battery and a venue with no signal.
 *
 * Each entry then walks three steps, in any number of sessions:
 *
 *     develop   bake the event's look, write original + thumbnail (local only,
 *               so it comes first: the guest sees their frame in the film's
 *               colours a moment after the shutter, signal or not)
 *     claim     claim_shot() with the id minted at the shutter — idempotent, so
 *               a retry never spends a second frame
 *     upload    both files, then markPhotoUploaded(); the entry and files go
 *
 * Every step is recorded before the next begins and is safe to repeat, so a
 * crash anywhere resumes rather than restarts.
 *
 * **Shooting works offline.** The claim is then still owed, and the camera
 * shows the server's last count minus `unclaimedCount()` — it never lets that
 * go below zero, so the roll cannot be overdrawn. The server stays the judge:
 * a claim it refuses (`roll_empty`, `event_closed`) drops the entry and its
 * files, and tells listeners so the camera can say what happened.
 *
 * One entry at a time. Developing a 12MP frame takes real memory, and uploads
 * on venue Wi-Fi do not get faster in parallel.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import * as Network from 'expo-network';
import { AppState } from 'react-native';

import { getSession } from './auth';
import type { FilmLook } from './events';
import { developPhoto } from './look-shader';
import {
  claimShot,
  EventClosedError,
  markPhotoUploaded,
  RollEmptyError,
  type RollState,
} from './photos';
import { photoPath, thumbPath, uploadJpeg } from './storage';
import { isSupabaseConfigured } from './supabase';

const STORAGE_KEY = 'left.upload-queue.v1';

/** Where queued files live. Documents, not cache: the OS may empty a cache. */
const FOLDER = 'shots';

/** First retry after a failure, doubling up to the ceiling. */
const RETRY_BASE_MS = 2_000;
const RETRY_MAX_MS = 60_000;

/**
 * A frame the phone cannot develop is uploaded as shot after this many tries.
 * It has already cost the guest a frame; an undeveloped picture beats none.
 */
const MAX_DEVELOP_ATTEMPTS = 3;

export type QueuedShot = {
  /** The photo id, minted at the shutter. Also the claim's idempotency key. */
  id: string;
  eventId: string;
  userId: string;
  look: FilmLook;
  /** When the shutter fired, ISO. */
  takenAt: string;
  claimed: boolean;
  developed: boolean;
  developAttempts: number;
  /** The capture's size until developed, the original's after. */
  width: number;
  height: number;
};

export type QueueEvent =
  /** The queue's contents changed — re-read the counts. */
  | { type: 'changed' }
  /** The server counted a frame. `roll` is the only number the camera may show. */
  | { type: 'claimed'; eventId: string; roll: RollState }
  /** The server refused a queued frame; it has been dropped. */
  | { type: 'refused'; eventId: string; reason: 'roll_empty' | 'event_closed' };

type Listener = (event: QueueEvent) => void;

let items: QueuedShot[] = [];
let hydrated: Promise<void> | null = null;
let draining = false;
let failures = 0;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let started = false;
const listeners = new Set<Listener>();

function emit(event: QueueEvent) {
  for (const listener of listeners) listener(event);
}

export function subscribeToQueue(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Frames shot but not yet counted by the server — what the counter subtracts. */
export function unclaimedCount(eventId: string): number {
  return items.filter((item) => item.eventId === eventId && !item.claimed).length;
}

/** Everything of this event still on the phone, claimed or not. */
export function pendingCount(eventId: string): number {
  return items.filter((item) => item.eventId === eventId).length;
}

// --- files -----------------------------------------------------------------

function folder(): Directory {
  const dir = new Directory(Paths.document, FOLDER);
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

/*
  Paths are rebuilt from the id every time rather than stored: on iOS the app
  container's absolute path changes between installs, and a stored URI from last
  week points at nothing.
*/
const rawFile = (id: string) => new File(folder(), `${id}_raw.jpg`);
const originalFile = (id: string) => new File(folder(), `${id}.jpg`);
const thumbFile = (id: string) => new File(folder(), `${id}_thumb.jpg`);

function removeFilesOf(id: string) {
  for (const file of [rawFile(id), originalFile(id), thumbFile(id)]) {
    try {
      if (file.exists) file.delete();
    } catch {
      // A leftover file costs disk space, not correctness.
    }
  }
}

/** A frame still on the phone, for the "Your shots" screen. */
export type LocalShot = {
  id: string;
  takenAt: string;
  thumbUri: string;
  fullUri: string;
};

/**
 * This event's queued frames as files that can be shown.
 *
 * Developed frames only: the raw capture is in plain colour, and showing it
 * for the moment before the look is baked reads as the filter having failed.
 */
export function localShots(eventId: string): LocalShot[] {
  return items
    .filter((item) => item.eventId === eventId && item.developed)
    .map((item) => ({
      id: item.id,
      takenAt: item.takenAt,
      thumbUri: thumbFile(item.id).uri,
      fullUri: originalFile(item.id).uri,
    }));
}

// --- persistence -----------------------------------------------------------

let writes: Promise<void> = Promise.resolve();

/** Serialised, so two saves cannot land out of order. */
function persist(): Promise<void> {
  const snapshot = JSON.stringify(items);
  writes = writes.then(() => AsyncStorage.setItem(STORAGE_KEY, snapshot)).catch(() => {});
  return writes;
}

function hydrate(): Promise<void> {
  hydrated ??= (async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      const parsed: unknown = stored ? JSON.parse(stored) : [];
      if (Array.isArray(parsed)) {
        // Anything enqueued before hydration finished stays, after what was stored.
        const known = new Set(items.map((item) => item.id));
        items = [...(parsed as QueuedShot[]).filter((item) => !known.has(item.id)), ...items];
      }
    } catch {
      // An unreadable queue is an empty queue; the files stay on disk.
    }
    emit({ type: 'changed' });
  })();
  return hydrated;
}

async function update(id: string, patch: Partial<QueuedShot>) {
  items = items.map((item) => (item.id === id ? { ...item, ...patch } : item));
  await persist();
}

async function remove(id: string) {
  items = items.filter((item) => item.id !== id);
  await persist();
  removeFilesOf(id);
  emit({ type: 'changed' });
}

// --- the shutter's side ----------------------------------------------------

/**
 * Take ownership of a captured file. Resolves once it is safe on disk and in
 * the queue; everything after that happens in the background.
 *
 * `capturedUri` is the camera's temporary file and is gone afterwards.
 */
export async function enqueueShot(shot: {
  eventId: string;
  userId: string;
  look: FilmLook;
  capturedUri: string;
  /** As the camera reported them. */
  width: number;
  height: number;
  takenAt?: Date;
}): Promise<string> {
  const id = Crypto.randomUUID();

  new File(shot.capturedUri).move(rawFile(id));

  items = [
    ...items,
    {
      id,
      eventId: shot.eventId,
      userId: shot.userId,
      look: shot.look,
      takenAt: (shot.takenAt ?? new Date()).toISOString(),
      claimed: false,
      developed: false,
      developAttempts: 0,
      width: shot.width,
      height: shot.height,
    },
  ];
  emit({ type: 'changed' });
  await persist();

  void drain();
  return id;
}

// --- the worker ------------------------------------------------------------

/** Thrown to stop a pass without counting it as a failure of the entry. */
class Dropped extends Error {}

async function claim(item: QueuedShot) {
  try {
    const roll = await claimShot(item.eventId, item.id, new Date(item.takenAt));
    await update(item.id, { claimed: true });
    emit({ type: 'claimed', eventId: item.eventId, roll });
    emit({ type: 'changed' });
  } catch (e) {
    if (e instanceof RollEmptyError || e instanceof EventClosedError) {
      await remove(item.id);
      emit({
        type: 'refused',
        eventId: item.eventId,
        reason: e instanceof RollEmptyError ? 'roll_empty' : 'event_closed',
      });
      throw new Dropped();
    }
    throw e;
  }
}

async function develop(item: QueuedShot) {
  const raw = rawFile(item.id);
  if (!raw.exists) {
    // Developed files without a flag: the app died between writing and saving.
    if (originalFile(item.id).exists && thumbFile(item.id).exists) {
      await update(item.id, { developed: true });
      return;
    }
    // The frame is gone. Nothing can be uploaded; do not block the queue on it.
    await remove(item.id);
    throw new Dropped();
  }

  await update(item.id, { developAttempts: item.developAttempts + 1 });

  const bytes = await raw.bytes();
  if (__DEV__) console.log('[queue] develop start', { id: item.id, bytes: bytes.length });
  const result = developPhoto(bytes, item.look);
  if (__DEV__) console.log('[queue] develop done', { width: result.width, height: result.height });

  originalFile(item.id).write(result.original);
  thumbFile(item.id).write(result.thumb);
  await update(item.id, { developed: true, width: result.width, height: result.height });
  raw.delete();
}

async function upload(item: QueuedShot) {
  const storagePath = photoPath(item.eventId, item.userId, item.id);
  const thumbStoragePath = thumbPath(item.eventId, item.userId, item.id);

  const original = await originalFile(item.id).bytes();
  const thumb = await thumbFile(item.id).bytes();

  await uploadJpeg(storagePath, original.buffer);
  await uploadJpeg(thumbStoragePath, thumb.buffer);
  await markPhotoUploaded(item.id, {
    storagePath,
    thumbPath: thumbStoragePath,
    width: item.width,
    height: item.height,
  });

  await remove(item.id);
}

const current = (id: string) => items.find((item) => item.id === id);

/** One entry, as far as it will go. Throws if it must be retried later. */
async function process(id: string) {
  let item = current(id);
  if (!item) return;

  // Develop first: it needs no network, and it is what the guest sees next.
  if (!item.developed) {
    try {
      await develop(item);
    } catch (e) {
      if (e instanceof Dropped) return;
      item = current(id);
      if (item && item.developAttempts >= MAX_DEVELOP_ATTEMPTS) {
        await sendUndeveloped(item);
      } else {
        throw e;
      }
    }
    emit({ type: 'changed' });
  }

  item = current(id);
  if (!item) return;

  if (!item.claimed) {
    try {
      await claim(item);
    } catch (e) {
      if (e instanceof Dropped) return;
      throw e;
    }
  }

  item = current(id);
  if (item?.claimed && item.developed) await upload(item);
}

/**
 * The fallback for a frame this phone cannot develop: the raw capture stands in
 * for both files. Unstyled, but the guest keeps the picture they spent a frame on.
 */
async function sendUndeveloped(item: QueuedShot) {
  const raw = rawFile(item.id);
  if (!raw.exists) {
    await remove(item.id);
    throw new Dropped();
  }
  raw.copy(originalFile(item.id));
  raw.copy(thumbFile(item.id));
  await update(item.id, { developed: true });
  raw.delete();
}

function scheduleRetry() {
  if (retryTimer) return;
  const delay = Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** Math.min(failures, 10));
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void drain();
  }, delay);
}

/**
 * Work through the queue. Safe to call from anywhere, any number of times.
 *
 * Only the signed-in user's entries are touched: another account's frames on a
 * shared phone wait for that account to come back.
 */
export async function drain(): Promise<void> {
  if (draining || !isSupabaseConfigured()) return;
  draining = true;

  try {
    await hydrate();

    let userId: string | undefined;
    try {
      userId = (await getSession())?.user.id;
    } catch {
      userId = undefined;
    }
    if (!userId) return;

    let failed = false;
    for (const id of items.filter((item) => item.userId === userId).map((item) => item.id)) {
      try {
        await process(id);
      } catch {
        // Keep going: one stuck frame must not hold the others back.
        failed = true;
      }
    }

    if (failed) {
      failures += 1;
      scheduleRetry();
    } else {
      failures = 0;
    }
  } finally {
    draining = false;
  }
}

/**
 * Start the queue for this app run — once, from the root layout.
 *
 * Resumes whatever a previous run left, and drains again whenever there is a
 * reason to think it will go better: the network came back, or the app did.
 */
export function startUploadQueue(): void {
  if (started) return;
  started = true;

  const kick = () => {
    failures = 0;
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
    void drain();
  };

  kick();

  Network.addNetworkStateListener((state) => {
    if (state.isConnected && state.isInternetReachable !== false) kick();
  });

  AppState.addEventListener('change', (state) => {
    if (state === 'active') kick();
  });
}
