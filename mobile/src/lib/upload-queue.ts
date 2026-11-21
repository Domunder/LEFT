/**
 * The durable upload queue — every shot goes through here, online or not.
 *
 * The shutter does exactly one thing with a captured file: `enqueueShot()`. That
 * moves it out of the camera's cache into the app's documents and writes a queue
 * entry to AsyncStorage, and only then returns. From that moment the picture
 * survives an app kill, a dead battery and a venue with no signal.
 *
 * Each entry then walks four steps, in any number of sessions:
 *
 *     develop   bake the event's look, write original + thumbnail (local only,
 *               so it comes first: the guest sees their frame in the film's
 *               colours a moment after the shutter, signal or not)
 *     claim     claim_shot() with the id minted at the shutter — idempotent, so
 *               a retry never spends a second frame
 *     tag       only when a mission is owed: set_photo_mission(). It needs the
 *               photo's row, so it comes after the claim, and before the upload
 *               because the upload ends the entry. Idempotent like the claim.
 *     upload    both files, then markPhotoUploaded(); the entry and files go
 *
 * Every step is recorded before the next begins and is safe to repeat, so a
 * crash anywhere resumes rather than restarts.
 *
 * **A mission tag never costs a photo.** A tag the server refuses for good
 * (the film is developed, not the guest's mission, no such photo) is dropped
 * and the frame goes on to its upload; so is one that keeps failing with an
 * answer from the server. Only a tag that could not reach the server holds the
 * upload back, and only until the next pass.
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

import { track } from './analytics';
import { getSession } from './auth';
import type { FilmLook } from './events';
import { developPhoto } from './look-shader';
import { setPhotoMission } from './missions';
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

/**
 * A mission tag the server keeps refusing for a reason this file does not
 * know is dropped after this many answers. Failures that never reached the
 * server (no signal) do not count: they are retried for as long as it takes.
 */
const MAX_TAG_ATTEMPTS = 3;

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
  /**
   * The mission this photo is for; null for "none". Absent on entries written
   * before missions existed, which read as "nothing to tag".
   */
  missionId?: string | null;
  /**
   * Width / height of the viewfinder when the shutter fired. The developed
   * print is centre-cropped to it, so it holds what the guest saw. Absent: the
   * whole capture.
   */
  cropAspect?: number;
  /**
   * False while `missionId` still has to reach the server — the tag step's
   * flag. Absent (old entries) or true: nothing owed.
   */
  missionTagged?: boolean;
  /** Server answers to the tag that were neither a success nor a known refusal. */
  tagAttempts?: number;
  /**
   * Added from the phone's library, not shot (2026-11-21): developed without
   * the look. Counts against the roll like any frame.
   */
  imported?: boolean;
};

export type QueueEvent =
  /** The queue's contents changed — re-read the counts. */
  | { type: 'changed' }
  /** The server counted a frame. `roll` is the only number the camera may show. */
  | { type: 'claimed'; eventId: string; roll: RollState }
  /** The server refused a queued frame; it has been dropped. */
  | { type: 'refused'; eventId: string; reason: 'roll_empty' | 'event_closed' }
  /**
   * A mission tag reached the server, or was dropped. What the server holds
   * changed — re-read the missions.
   */
  | { type: 'mission'; eventId: string };

type Listener = (event: QueueEvent) => void;

let items: QueuedShot[] = [];
let hydrated: Promise<void> | null = null;
let draining = false;
/**
 * Set when `drain()` is asked for while it runs. The running pass works through
 * the ids it read at its start, so a frame enqueued meanwhile (a burst, or
 * several photos added from the library at once) would wait for the next
 * reconnect or foreground — hidden and unclaimed. A set flag runs one more
 * pass when this one ends (2026-11-21: added 4 photos, 3 showed).
 */
let drainAgain = false;
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

/**
 * Mission tags of this event the server does not have yet, oldest shot first —
 * so a caller laying them over the server's answer lets the newest win.
 */
export function owedMissionTags(
  eventId: string
): { photoId: string; missionId: string | null }[] {
  return items
    .filter((item) => item.eventId === eventId && item.missionTagged === false)
    .sort((a, b) => a.takenAt.localeCompare(b.takenAt))
    .map((item) => ({ photoId: item.id, missionId: item.missionId ?? null }));
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
  /** The mission the guest armed for this shot. Tagged once the frame is claimed. */
  missionId?: string | null;
  /** Width / height of the viewfinder; the print is cropped to it. */
  cropAspect?: number;
  /** From the library: kept as it is, no look. */
  imported?: boolean;
}): Promise<string> {
  const id = Crypto.randomUUID();

  await new File(shot.capturedUri).move(rawFile(id));

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
      ...(shot.cropAspect ? { cropAspect: shot.cropAspect } : {}),
      ...(shot.imported ? { imported: true } : {}),
      ...(shot.missionId
        ? { missionId: shot.missionId, missionTagged: false, tagAttempts: 0 }
        : {}),
    },
  ];
  emit({ type: 'changed' });
  await persist();

  track('photo_taken', { look: shot.look, imported: shot.imported === true });

  void drain();
  return id;
}

/**
 * "This photo was for that mission" — from "Your shots". `missionId` null
 * says it was for none.
 *
 *  - A frame not yet claimed has no row to tag: the tag is recorded on the
 *    entry and sent by the queue after the claim. Resolves `'queued'`.
 *  - A claimed frame still on the phone is sent straight away; the entry
 *    remembers it too, so a request that cannot get through is retried by the
 *    queue instead of lost (`'queued'` again).
 *  - A frame that has left the queue goes straight to the server (`'sent'`).
 *
 * Throws the server's refusal (`event_closed`, `not_yours`) when it gave one,
 * and, for a frame no longer in the queue, any failure.
 */
export async function setShotMission(
  eventId: string,
  photoId: string,
  missionId: string | null
): Promise<'queued' | 'sent'> {
  await hydrate();

  const item = current(photoId);
  if (!item) {
    await setPhotoMission(photoId, missionId);
    emit({ type: 'mission', eventId });
    return 'sent';
  }

  await update(photoId, { missionId, missionTagged: false, tagAttempts: 0 });
  emit({ type: 'changed' });
  if (!item.claimed) return 'queued';

  let outcome: TagOutcome;
  try {
    outcome = await tag(photoId);
  } catch (e) {
    // Did not get through. The entry still owes it; the queue will send it.
    if (current(photoId)?.missionTagged === false) {
      void drain();
      return 'queued';
    }
    throw e;
  }
  if (outcome.refused) throw outcome.error;
  return current(photoId)?.missionTagged === false ? 'queued' : 'sent';
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

/** The server said no to a tag, and will say it again: the film is developed, or the mission or photo is not the guest's. */
function refusedForGood(error: unknown): boolean {
  const e = error as { code?: string; hint?: string } | null;
  return e?.hint === 'event_closed' || e?.hint === 'not_yours' || e?.code === 'P0002';
}

/** An error the server answered with. Supabase reports an unreachable server with an empty code. */
function answeredByServer(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' && code.length > 0;
}

type TagOutcome = { refused: false } | { refused: true; error: unknown };

/** How often one pass re-sends a tag the guest changed while it was on its way. */
const MAX_TAG_ROUNDS = 4;

/**
 * The tag step: send the entry's mission until the server holds what the
 * entry says. Throws when the server could not be reached (or has not settled
 * after a few rounds of re-tagging) — the entry then keeps owing it, and the
 * upload waits, since the upload ends the entry.
 *
 * A refusal for good, or one answer too many, drops the tag: the entry stops
 * owing it and the photo goes on as an untagged one.
 */
async function tag(id: string): Promise<TagOutcome> {
  for (let round = 0; round < MAX_TAG_ROUNDS; round += 1) {
    const item = current(id);
    if (!item || !item.claimed || item.missionTagged !== false) return { refused: false };

    const missionId = item.missionId ?? null;
    const unchanged = () => (current(id)?.missionId ?? null) === missionId;

    try {
      await setPhotoMission(item.id, missionId);
    } catch (e) {
      const attempts = (item.tagAttempts ?? 0) + (answeredByServer(e) ? 1 : 0);
      const drop = refusedForGood(e) || attempts >= MAX_TAG_ATTEMPTS;
      if (drop) {
        // Re-tagged meanwhile: that is a new request, not this refusal.
        if (!unchanged()) continue;
        if (__DEV__) console.warn('[queue] mission tag dropped', { id, error: e });
        await update(id, { missionTagged: true, tagAttempts: 0 });
        emit({ type: 'mission', eventId: item.eventId });
        emit({ type: 'changed' });
        return { refused: true, error: e };
      }
      if (attempts !== (item.tagAttempts ?? 0)) await update(id, { tagAttempts: attempts });
      throw e;
    }

    if (unchanged()) {
      await update(id, { missionTagged: true, tagAttempts: 0 });
      emit({ type: 'mission', eventId: item.eventId });
      emit({ type: 'changed' });
      return { refused: false };
    }
    // The guest picked another mission while this one was on its way: send that.
  }
  throw new Error('The mission kept changing; it is sent on the next pass.');
}

/** Before an entry leaves the queue: a tag it still owes goes first. */
async function settleTagBeforeRemoving(id: string) {
  if (current(id)?.missionTagged === false) await tag(id);
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
  const result = developPhoto(bytes, item.imported ? null : item.look, item.cropAspect);
  if (__DEV__) console.log('[queue] develop done', { width: result.width, height: result.height });

  await originalFile(item.id).write(result.original);
  await thumbFile(item.id).write(result.thumb);
  await update(item.id, { developed: true, width: result.width, height: result.height });
  raw.delete();
}

async function upload(item: QueuedShot) {
  const storagePath = photoPath(item.eventId, item.userId, item.id);
  const thumbStoragePath = thumbPath(item.eventId, item.userId, item.id);

  const original = await originalFile(item.id).bytes();
  const thumb = await thumbFile(item.id).bytes();

  const size = { width: item.width, height: item.height };

  try {
    await uploadJpeg(storagePath, original.buffer);
    await uploadJpeg(thumbStoragePath, thumb.buffer);
  } catch (e) {
    /*
      Once a frame is attached the bucket refuses to replace its files. That is
      what a retry meets when the app died between the attach and `remove()`
      below — so before treating a refused upload as a failure, ask the server:
      attaching again succeeds only if both files are there, and changes nothing
      if the row is already attached. Anything else rethrows the upload's error.
    */
    try {
      await markPhotoUploaded(item.id, size);
    } catch {
      throw e;
    }
    await settleTagBeforeRemoving(item.id);
    await remove(item.id);
    return;
  }

  // The server writes the paths itself; it only needs to be told the size.
  await markPhotoUploaded(item.id, size);

  // Re-tagged from "Your shots" while the files were on their way.
  await settleTagBeforeRemoving(item.id);
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

  // A refusal is not an error of the frame: `tag` drops it, and the upload goes on.
  item = current(id);
  if (item?.claimed && item.missionTagged === false) await tag(id);

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
  await raw.copy(originalFile(item.id));
  await raw.copy(thumbFile(item.id));
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
  if (!isSupabaseConfigured()) return;
  if (draining) {
    drainAgain = true;
    return;
  }
  draining = true;
  drainAgain = false;

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
    if (drainAgain) {
      drainAgain = false;
      void drain();
    }
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
