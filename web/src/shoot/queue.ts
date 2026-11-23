/**
 * The web camera's upload queue — the browser's copy of
 * `mobile/src/lib/upload-queue.ts`, on IndexedDB.
 *
 * The shutter only develops the frame and writes it here; claim → tag →
 * upload → mark (with the thumbnail's blurhash, the smudge others see before
 * the reveal) happen in `drain()`, each step recorded, so a tab closed mid-upload or
 * a venue with no signal loses nothing that was taken: the next visit to the
 * link drains what is left. The photo id is minted at the shutter, which makes
 * the claim idempotent — a retry never spends a second frame.
 *
 * Accepted, as in the app: frames still unclaimed when the event ends are
 * refused by the server and dropped. And a guest who clears the browser's data
 * before the queue drained loses those frames.
 */

import { encode } from 'blurhash';

import {
  answeredByServer,
  claimShot,
  EventClosedError,
  markPhotoUploaded,
  photoPath,
  RollEmptyError,
  setPhotoMission,
  tagRefusedForGood,
  thumbPath,
  uploadJpeg,
} from './api';

export type Shot = {
  id: string;
  eventId: string;
  userId: string;
  takenAt: string;
  original: Blob;
  thumb: Blob;
  width: number;
  height: number;
  claimed: boolean;
  uploaded: boolean;
  /** The mission this photo is for; null "none". Absent on entries from before missions. */
  missionId?: string | null;
  /** False while `missionId` still has to reach the server. */
  missionTagged?: boolean;
  /** How often the server refused the tag; it is dropped after a few. */
  tagAttempts?: number;
};

/** How often the server may refuse a tag before it is dropped. A tag never costs a photo. */
const MAX_TAG_ATTEMPTS = 3;

const DB_NAME = 'left-shoot';
const STORE = 'shots';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const t = db.transaction(STORE, mode);
      const req = run(t.objectStore(STORE));
      t.oncomplete = () => resolve(req.result);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  } finally {
    db.close();
  }
}

export async function enqueue(shot: Shot): Promise<void> {
  await tx('readwrite', (s) => s.put(shot));
  void drain();
}

export async function pending(eventId: string, userId: string): Promise<Shot[]> {
  const all = (await tx('readonly', (s) => s.getAll())) as Shot[];
  return all
    .filter((shot) => shot.eventId === eventId && shot.userId === userId)
    .sort((a, b) => a.takenAt.localeCompare(b.takenAt));
}

async function put(shot: Shot) {
  await tx('readwrite', (s) => s.put(shot));
}

/**
 * Write some fields of a stored entry. Never `put` a whole entry held across an
 * await: the guest may have re-tagged it meanwhile from Your shots.
 */
async function update(id: string, patch: Partial<Shot>): Promise<Shot | undefined> {
  const stored = await get(id);
  if (!stored) return undefined;
  const next = { ...stored, ...patch };
  await put(next);
  return next;
}

async function remove(id: string) {
  await tx('readwrite', (s) => s.delete(id));
}

type Listener = (
  event:
    | { kind: 'claimed'; shotsLeft: number | null }
    | { kind: 'done' | 'dropped'; id: string; reason?: 'roll_empty' | 'event_closed' }
    | { kind: 'mission'; id: string }
) => void;
const listeners = new Set<Listener>();

export function onQueue(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

let running: Promise<void> | null = null;
let retry: ReturnType<typeof setTimeout> | null = null;
let backoff = 2000;

/** Work through every queued frame, oldest first. One drain at a time. */
export function drain(): Promise<void> {
  if (running) return running;
  running = (async () => {
    try {
      const all = ((await tx('readonly', (s) => s.getAll())) as Shot[]).sort((a, b) =>
        a.takenAt.localeCompare(b.takenAt)
      );
      for (const shot of all) await send(shot);
      backoff = 2000;
    } catch {
      // Offline or a dropped request: try again later, slower each time.
      if (retry) clearTimeout(retry);
      retry = setTimeout(() => void drain(), backoff);
      backoff = Math.min(backoff * 2, 60_000);
    } finally {
      running = null;
    }
  })();
  return running;
}

async function send(shot: Shot) {
  if (!shot.claimed) {
    try {
      const roll = await claimShot(shot.eventId, shot.id, shot.takenAt);
      shot.claimed = true;
      await update(shot.id, { claimed: true });
      listeners.forEach((l) => l({ kind: 'claimed', shotsLeft: roll.shotsLeft }));
    } catch (e) {
      if (e instanceof RollEmptyError || e instanceof EventClosedError) {
        await remove(shot.id);
        const reason = e instanceof RollEmptyError ? 'roll_empty' : 'event_closed';
        listeners.forEach((l) => l({ kind: 'dropped', id: shot.id, reason }));
        return;
      }
      throw e;
    }
  }

  await tag(shot);

  // The smudge the others see before the reveal. Never in the way of the photo.
  const smudge = await blurhashOf(shot.thumb);

  if (!shot.uploaded) {
    try {
      await uploadJpeg(photoPath(shot.eventId, shot.userId, shot.id), shot.original);
      await uploadJpeg(thumbPath(shot.eventId, shot.userId, shot.id), shot.thumb);
    } catch (e) {
      // The bucket refuses to overwrite a print once it is attached. A retry
      // that meets the refusal may be one whose mark already went through:
      // ask the server, and drop the entry if it holds the photo.
      try {
        await markPhotoUploaded(shot.id, shot.width, shot.height, smudge);
        await finish(shot);
        return;
      } catch {
        throw e;
      }
    }
    shot.uploaded = true;
    await update(shot.id, { uploaded: true });
  }

  await markPhotoUploaded(shot.id, shot.width, shot.height, smudge);
  await finish(shot);
}

/** Width of the canvas the thumbnail is shrunk into before encoding. */
const SMUDGE_WIDTH = 32;

/**
 * The thumbnail's blurhash (4x3 components): ~30
 * characters of colour, no recognisable picture. Null when the browser cannot
 * decode or draw the thumbnail — the photo is sent without it.
 */
async function blurhashOf(thumb: Blob): Promise<string | null> {
  try {
    const bitmap = await createImageBitmap(thumb);
    const w = SMUDGE_WIDTH;
    const h = Math.max(1, Math.round((SMUDGE_WIDTH * bitmap.height) / Math.max(1, bitmap.width)));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close();
      return null;
    }
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    return encode(ctx.getImageData(0, 0, w, h).data, w, h, 4, 3);
  } catch {
    return null;
  }
}

/**
 * The tag step, after the claim (the tag needs the photo's row) and before the
 * upload (the upload ends the entry). Unreachable server: throws, the entry
 * keeps owing it. A refusal for good, or one too many: the tag is dropped and
 * the photo goes on untagged.
 */
async function tag(shot: Shot) {
  for (let round = 0; round < 4; round += 1) {
    const stored = await get(shot.id);
    if (!stored || stored.missionTagged !== false) return;
    const missionId = stored.missionId ?? null;
    let dropped = false;
    try {
      await setPhotoMission(shot.id, missionId);
    } catch (e) {
      const attempts = (stored.tagAttempts ?? 0) + (answeredByServer(e) ? 1 : 0);
      if (!tagRefusedForGood(e) && attempts < MAX_TAG_ATTEMPTS) {
        await update(shot.id, { tagAttempts: attempts });
        throw e;
      }
      dropped = true;
    }
    // Re-tagged while this one was on its way: send that instead.
    const now = await get(shot.id);
    if (!dropped && now && (now.missionId ?? null) !== missionId) continue;
    await update(shot.id, { missionTagged: true, tagAttempts: 0 });
    listeners.forEach((l) => l({ kind: 'mission', id: shot.id }));
    return;
  }
  throw new Error('The mission kept changing; it is sent on the next pass.');
}

async function get(id: string): Promise<Shot | undefined> {
  return (await tx('readonly', (s) => s.get(id))) as Shot | undefined;
}

/**
 * "This queued photo was for that mission" — from Your shots. Returns false
 * when the photo is no longer in the queue (it was uploaded): the caller then
 * tags it on the server directly.
 */
export async function setQueuedMission(id: string, missionId: string | null): Promise<boolean> {
  const next = await update(id, { missionId, missionTagged: false, tagAttempts: 0 });
  if (!next) return false;
  void drain();
  return true;
}

async function finish(shot: Shot) {
  // A tag the guest changed during the upload goes out before the entry ends.
  await tag(shot);
  await remove(shot.id);
  listeners.forEach((l) => l({ kind: 'done', id: shot.id }));
}

let started = false;

/** Drain now, on reconnect and whenever the page comes back. */
export function startQueue() {
  if (started) return;
  started = true;
  addEventListener('online', () => void drain());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void drain();
  });
  void drain();
}
