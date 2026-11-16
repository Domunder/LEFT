import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Pages that exist but must stay out of the index: the invite landing (one
// page for every code). The legal texts are listed since LEGAL_DRAFT went off
// (mobile/src/constants/legal.ts, 2026-11-16).
const UNLISTED = ['/j/'];

/**
 * The pages the store screenshots are taken from (src/store/Shot.astro). They
 * only exist while `npm run store` runs — never in a build of the site.
 */
const storeAssets = {
  name: 'store-assets',
  hooks: {
    'astro:config:setup': ({ injectRoute }) => {
      injectRoute({ pattern: '/store-shot/[id]', entrypoint: './src/store/Shot.astro' });
    },
  },
};

export default defineConfig({
  site: 'https://leftmoment.com',
  trailingSlash: 'always',
  build: { format: 'directory', inlineStylesheets: 'always' },
  integrations: [
    sitemap({
      filter: (page) => !UNLISTED.some((path) => new URL(page).pathname === path),
    }),
    ...(process.env.STORE_ASSETS ? [storeAssets] : []),
  ],
});
