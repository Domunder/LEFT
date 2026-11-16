/**
 * The web camera's upload queue — the browser's copy of
 * `mobile/src/lib/upload-queue.ts`, on IndexedDB.
 *
 * The shutter only develops the frame and writes it here; claim → upload →
 * mark happen in `drain()`, each step recorded, so a tab closed mid-upload or
 * a venue with no signal loses nothing that was taken: the next visit to the
 * link drains what is left. The photo id is minted at the shutter, which makes
 * the claim idempotent — a retry never spends a second frame.
 *
 * Accepted, as in the app: frames still unclaimed when the event ends are
 * refused by the server and dropped. And a guest who clears the browser's data
 * before the queue drained loses those frames.
 */

import {
  claimShot,
  EventClosedError,
  markPhotoUploaded,
  photoPath,
  RollEmptyError,
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
};

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

async function remove(id: string) {
  await tx('readwrite', (s) => s.delete(id));
}

type Listener = (event: { kind: 'claimed'; shotsLeft: number | null } | { kind: 'done' | 'dropped'; id: string; reason?: 'roll_empty' | 'event_closed' }) => void;
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
      await put(shot);
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

  if (!shot.uploaded) {
    try {
      await uploadJpeg(photoPath(shot.eventId, shot.userId, shot.id), shot.original);
      await uploadJpeg(thumbPath(shot.eventId, shot.userId, shot.id), shot.thumb);
    } catch (e) {
      // The bucket refuses to overwrite a print once it is attached. A retry
      // that meets the refusal may be one whose mark already went through:
      // ask the server, and drop the entry if it holds the photo.
      try {
        await markPhotoUploaded(shot.id, shot.width, shot.height);
        await finish(shot);
        return;
      } catch {
        throw e;
      }
    }
    shot.uploaded = true;
    await put(shot);
  }

  await markPhotoUploaded(shot.id, shot.width, shot.height);
  await finish(shot);
}

async function finish(shot: Shot) {
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
