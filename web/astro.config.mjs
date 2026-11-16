import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Pages that exist but must stay out of the index: the invite landing (one
// page for every code). The legal texts are listed since LEGAL_DRAFT went off
// (mobile/src/constants/legal.ts, 2026-11-16).
const UNLISTED = ['/j/'];

export default defineConfig({
  site: 'https://leftmoment.com',
  trailingSlash: 'always',
  build: { format: 'directory', inlineStylesheets: 'always' },
  integrations: [
    sitemap({
      filter: (page) => !UNLISTED.some((path) => new URL(page).pathname === path),
    }),
  ],
});
