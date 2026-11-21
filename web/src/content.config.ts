/**
 * The blog (/blog/): one Markdown file per article in src/content/blog/, the
 * file name is the URL. Written by the `blog-writer` agent from the backlog in
 * marketing/seo/keywords.md; the rules are in marketing/seo/README.md and
 * scripts/check-blog.mjs enforces the mechanical ones on every build.
 */
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const blog = defineCollection({
  loader: glob({ base: './src/content/blog', pattern: '*.md' }),
  schema: z.object({
    /** The headline and the title tag (" | LEFT" is appended). */
    title: z.string().max(62),
    description: z.string().min(110).max(160),
    date: z.coerce.date(),
    updated: z.coerce.date().optional(),
    /** The one search phrase this article is for (marketing/seo/keywords.md). */
    keyword: z.string(),
    /** Shown above the headline: Weddings, Parties, Trips, … */
    cluster: z.string(),
    /** A file in src/assets/photos/, without ".jpg". */
    photo: z.string(),
    photoAlt: z.string(),
    look: z.enum(['golden', 'chrome', 'faded', 'mono']),
    faq: z.array(z.object({ q: z.string(), a: z.string() })).default([]),
    /** Slugs of other articles or of search pages (src/guides.ts). */
    related: z.array(z.string()).default([]),
  }),
});

export const collections = { blog };
