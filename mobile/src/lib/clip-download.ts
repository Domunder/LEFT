/**
 * Taking a clip off the screen and into someone's own hands.
 *
 * 17's two actions. They look symmetrical on the artboard and are not: one is a
 * real file operation, the other is a text message with a link in it.
 *
 * **Download** is the honest one. The signed URL streams to the cache, the
 * photo library takes a copy, and the cache copy is deleted — the same
 * permission call and the same web guard 09 already makes for its QR code, so
 * the two "save to your phone" flows in the app behave identically.
 *
 * **Share is a compromise, and the compromise is worth stating plainly.**
 * `expo-sharing` is not installed, and React Native's built-in `Share` carries a
 * message, not a file. So Share sends the signed URL as text. Two consequences:
 *
 *  1. It deviates from the artboard, which implies the video itself travels.
 *  2. **That URL is a capability.** Anyone the message reaches — or anyone who
 *     sees the message — can watch the clip for as long as the signature lives,
 *     with no account and no membership in the event. Private group footage
 *     leaves the group the moment this button is pressed.
 *
 * `CLIP_URL_TTL_SECONDS` being one hour rather than the week the API would grant
 * is the mitigation, and the reason it is that short. The real fix is adding
 * `expo-sharing` so the file travels instead of a link to it; until then this is
 * a product decision the user has been told about rather than a hidden one.
 */

import { Directory, File, Paths } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { Platform, Share } from 'react-native';

import type { PlayableClip } from './clip-media';

/** Matching 09: the photo library does not exist on web. */
const CAN_SAVE = Platform.OS !== 'web';

/** Where the download lands before the library takes it. */
const CACHE_DIR = 'clips';

export type DownloadOutcome =
  /** In the photo library. */
  | { kind: 'saved' }
  /** Photo permission refused — recoverable, and the copy should say how. */
  | { kind: 'denied' }
  /** No photo library here at all. */
  | { kind: 'unavailable' }
  | { kind: 'failed' };

/**
 * Pull a clip down and hand it to the photo library.
 *
 * `File.downloadFileAsync` streams to disk. Deliberately not the arrayBuffer
 * round trip `uploadClip` uses in the other direction — that one has to produce
 * bytes for the storage API, whereas this only has to produce a file, and a
 * multi-minute 4K take held in memory to accomplish that would be the same
 * mistake lib/clips.ts documents avoiding on upload.
 *
 * The cache copy is deleted in a `finally`: the library holds its own copy the
 * moment `saveToLibraryAsync` returns, and clips are large enough that leaving
 * one behind per download would quietly fill the device.
 */
export async function downloadClip(
  playable: PlayableClip,
  filename: string
): Promise<DownloadOutcome> {
  if (!CAN_SAVE) return { kind: 'unavailable' };
  if (!(await requestSavePermission())) return { kind: 'denied' };

  return writeToLibrary(playable, filename);
}

/**
 * Ask for write access to the photo library.
 *
 * Split out of `downloadClip` so `saveAllClips` can ask **once** for a whole
 * film. Asking per clip would be the same prompt over and over on the first run
 * and a pointless round trip on every run after it.
 */
async function requestSavePermission(): Promise<boolean> {
  // Write-only: LEFT adds a file here, it never reads the library.
  const permission = await MediaLibrary.requestPermissionsAsync(true).catch(() => null);
  return permission?.granted === true;
}

/** The download itself, with permission already established. */
async function writeToLibrary(
  playable: PlayableClip,
  filename: string
): Promise<DownloadOutcome> {
  /*
    Inferred, never annotated as `File`: that name is also a DOM global, and an
    explicit annotation binds to the lib.dom one rather than expo's, which fails
    to typecheck for reasons that read as nonsense ("missing 8 properties").
  */
  let file: Awaited<ReturnType<typeof File.downloadFileAsync>> | null = null;

  try {
    const directory = new Directory(Paths.cache, CACHE_DIR);
    if (!directory.exists) directory.create({ intermediates: true });

    file = await File.downloadFileAsync(playable.url, new File(directory, filename));
    await MediaLibrary.saveToLibraryAsync(file.uri);

    return { kind: 'saved' };
  } catch {
    return { kind: 'failed' };
  } finally {
    try {
      file?.delete();
    } catch {
      // A stranded cache file is not worth surfacing; the OS clears this directory.
    }
  }
}

/**
 * Share a clip as a link.
 *
 * See the header: this sends a live signed URL as text. The message names the
 * event so the link is not a bare URL arriving with no context — and so the
 * person sending it can see what they are about to hand over.
 */
export async function shareClip(
  eventName: string,
  authorName: string,
  playable: PlayableClip
): Promise<void> {
  try {
    await Share.share({
      message: `${authorName}'s clip from ${eventName}\n\n${playable.url}`,
    });
  } catch {
    // Dismissing the sheet rejects on some platforms. Nothing to report.
  }
}

/** What a whole-film save came to. Partial success is ordinary, not a failure. */
export type SaveAllOutcome = {
  saved: number;
  /** Clips that had a file and still did not make it. */
  failed: number;
  kind: 'saved' | 'partial' | 'denied' | 'unavailable' | 'failed';
};

/**
 * Save every clip of a film to the photo library, in playlist order.
 *
 * 17's primary action, and the only shape it comes in. There is no single file
 * to hand over — nothing in this project can stitch one, which is the constraint
 * the whole film design is built around — so "save the film" means saving the
 * clips it is made of, as separate files, in the order they play.
 *
 * **Sequential, not parallel.** These are multi-minute 4K takes; a `Promise.all`
 * over twenty of them would open twenty streams against a venue's network and
 * finish slower than doing them in turn, having spiked memory on the way. It
 * also lets `onProgress` report a position that means something.
 *
 * **Partial success is the expected outcome, not an error.** One clip failing on
 * a bad connection should not discard the nineteen that worked, so every clip is
 * attempted and the tally is returned for the caller to report honestly.
 */
export async function saveAllClips(
  clips: { playable: PlayableClip; filename: string }[],
  onProgress?: (completed: number, total: number) => void
): Promise<SaveAllOutcome> {
  if (!CAN_SAVE) return { kind: 'unavailable', saved: 0, failed: 0 };
  if (clips.length === 0) return { kind: 'failed', saved: 0, failed: 0 };
  if (!(await requestSavePermission())) return { kind: 'denied', saved: 0, failed: 0 };

  let saved = 0;
  let failed = 0;

  for (const [index, { playable, filename }] of clips.entries()) {
    onProgress?.(index, clips.length);

    const outcome = await writeToLibrary(playable, filename);
    if (outcome.kind === 'saved') saved++;
    else failed++;
  }

  onProgress?.(clips.length, clips.length);

  if (saved === 0) return { kind: 'failed', saved, failed };
  return { kind: failed > 0 ? 'partial' : 'saved', saved, failed };
}
