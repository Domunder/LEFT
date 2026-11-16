/**
 * Copies the legal texts from the app into the site before a build.
 *
 * `mobile/src/constants/legal.ts` is the one source for the app and the
 * website. The site cannot import it in place: the bundler reads the nearest
 * tsconfig of every file it transforms, and the app's extends
 * `expo/tsconfig.base` — which only exists where the app's dependencies are
 * installed. Cloudflare Pages installs `web/` alone, so the build failed there
 * ("Tsconfig not found expo/tsconfig.base"). The copy lives under `web/`, where
 * the site's own tsconfig applies, and is never committed.
 */
import { copyFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const source = fileURLToPath(new URL('../../mobile/src/constants/legal.ts', import.meta.url));
const target = fileURLToPath(new URL('../src/generated/legal.ts', import.meta.url));

await mkdir(fileURLToPath(new URL('../src/generated/', import.meta.url)), { recursive: true });
await copyFile(source, target);
