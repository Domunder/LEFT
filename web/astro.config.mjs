import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Pages that exist but must stay out of the index: the invite landing (one
// page for every code) and the legal placeholders until M6 writes the texts.
const UNLISTED = ['/j/', '/terms/', '/privacy/'];

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
