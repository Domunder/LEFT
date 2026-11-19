/**
 * Copies the app's shared sources into the site before a build.
 *
 * `mobile/src/` is the one source for what the app and the website must agree
 * on: the legal texts, the film looks (the web camera bakes the same recipes
 * into its photos) and the database types. The site cannot import them in
 * place: the bundler reads the nearest tsconfig of every file it transforms,
 * and the app's extends `expo/tsconfig.base` — which only exists where the
 * app's dependencies are installed. Cloudflare Pages installs `web/` alone, so
 * the build failed there ("Tsconfig not found expo/tsconfig.base"). The copies
 * live under `web/src/generated/`, where the site's own tsconfig applies, and
 * are never committed.
 *
 * `looks.ts` takes its `FilmLook` type from the app's `@/lib/events`, which
 * does not exist here; that one import is rewritten to the generated types. If
 * the line changes in the app, this script fails rather than copy a file that
 * cannot compile.
 */
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const app = (path) => fileURLToPath(new URL(`../../mobile/src/${path}`, import.meta.url));
const out = (path) => fileURLToPath(new URL(`../src/generated/${path}`, import.meta.url));

await mkdir(out(''), { recursive: true });

await copyFile(app('constants/legal.ts'), out('legal.ts'));
await copyFile(app('types/database.ts'), out('database.ts'));

const LOOK_IMPORT = "import type { FilmLook } from '@/lib/events';";
const looks = await readFile(app('constants/looks.ts'), 'utf8');
if (!looks.includes(LOOK_IMPORT)) {
  throw new Error(`sync-legal: mobile/src/constants/looks.ts no longer contains \`${LOOK_IMPORT}\``);
}
await writeFile(
  out('looks.ts'),
  looks.replace(
    LOOK_IMPORT,
    "import type { Database } from './database';\n\ntype FilmLook = Database['public']['Enums']['film_look'];"
  )
);
