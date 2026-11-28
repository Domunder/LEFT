/**
 * Add photos from the phone's library to a moment (2026-11-21, the user).
 *
 * Decided with the user:
 *  - **Apple's own picker** (`expo-image-picker`, PHPicker on iOS): no photo
 *    permission prompt, the guest sees their whole library.
 *  - **Any photo**, not only ones taken during the event.
 *  - **No look**: the photo keeps its colours; the queue only resizes it into
 *    the same original + thumbnail (`developPhoto(…, null)`).
 *  - **The roll is the limit**, during the event and after it, with no time
 *    window: every added photo is a claimed frame (`claim_shot()`, which since
 *    `20261121145855_claims_after_develop.sql` refuses only before the start).
 *    `max_members` still caps the group.
 *
 * The picker is asked for at most the shots left, so a guest cannot pick more
 * than the server would count; the server stays the authority (a refused
 * claim drops the entry, as for the camera).
 *
 * `expo-image-picker` is a native module that arrived after the last build, so
 * it is required lazily: in an older build `canImport()` is false and the
 * buttons stay hidden.
 */

import type * as ImagePickerTypes from 'expo-image-picker';

import { t } from '@/i18n';

import { getSession } from './auth';
import type { Event } from './events';
import { getSupabase } from './supabase';
import { enqueueShot, unclaimedCount } from './upload-queue';

type ImagePickerModule = typeof ImagePickerTypes;

/** Mirrors `unlimited_roll_cap()`: the fair-use ceiling of an unlimited roll. */
const UNLIMITED_ROLL_CAP = 150;

let picker: ImagePickerModule | null | undefined;

function loadPicker(): ImagePickerModule | null {
  if (picker === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      picker = require('expo-image-picker') as ImagePickerModule;
    } catch {
      picker = null;
    }
  }
  return picker;
}

/** Whether this build has the picker at all. */
export function canImport(): boolean {
  return loadPicker() !== null;
}

/**
 * How many photos this user may still add: the server's count of their frames,
 * minus the ones still waiting on this phone for their claim. Null when they
 * are not a member (or offline and unknown).
 */
export async function importAllowance(
  event: Pick<Event, 'id' | 'roll_size' | 'status'>
): Promise<number | null> {
  if (event.status === 'setup') return 0;
  const userId = (await getSession().catch(() => null))?.user.id;
  if (!userId) return null;

  const { data, error } = await getSupabase()
    .from('event_members')
    .select('shots_taken')
    .eq('event_id', event.id)
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data) return null;

  const limit = event.roll_size ?? UNLIMITED_ROLL_CAP;
  return Math.max(0, limit - data.shots_taken - unclaimedCount(event.id));
}

/** EXIF "2026:11:21 18:04:31" (local time) → a Date, or undefined. */
function exifDate(exif: Record<string, unknown> | null | undefined): Date | undefined {
  if (!exif) return undefined;
  const nested = exif['{Exif}'] as Record<string, unknown> | undefined;
  const raw = nested?.DateTimeOriginal ?? exif.DateTimeOriginal ?? exif.DateTime;
  if (typeof raw !== 'string') return undefined;
  const m = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/.exec(raw);
  if (!m) return undefined;
  const date = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/**
 * Open the picker for up to `limit` photos and queue the picked ones. Returns
 * how many were queued (0 when the guest cancelled).
 */
export async function importPhotos(
  event: Pick<Event, 'id' | 'look'>,
  limit: number
): Promise<number> {
  const ImagePicker = loadPicker();
  if (!ImagePicker || limit <= 0) return 0;

  const userId = (await getSession().catch(() => null))?.user.id;
  if (!userId) throw new Error(t('camera.importNotSignedIn'));

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    // 0 would mean "no limit" — `limit` is at least 1 here.
    selectionLimit: limit,
    orderedSelection: true,
    exif: true,
    quality: 1,
    // HEIC comes back as JPEG, which the developer (Skia) can always read.
    preferredAssetRepresentationMode:
      ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
  });
  if (result.canceled) return 0;

  let queued = 0;
  for (const asset of result.assets.slice(0, limit)) {
    await enqueueShot({
      eventId: event.id,
      userId,
      look: event.look,
      capturedUri: asset.uri,
      width: asset.width,
      height: asset.height,
      takenAt: exifDate(asset.exif),
      imported: true,
    });
    queued += 1;
  }
  return queued;
}

/**
 * One photo from the library, for the event image (2026-11-21) — a local file
 * URI, or null when cancelled or when this build has no picker.
 */
export async function pickOnePhoto(): Promise<string | null> {
  const ImagePicker = loadPicker();
  if (!ImagePicker) return null;
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: false,
    quality: 1,
    preferredAssetRepresentationMode:
      ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
  });
  if (result.canceled) return null;
  return result.assets[0]?.uri ?? null;
}
