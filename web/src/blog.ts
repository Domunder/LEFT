/** What the blog's two pages share: the posts in order, photos, dates, links. */
import type { ImageMetadata } from 'astro';
import { getCollection, type CollectionEntry } from 'astro:content';
import { GUIDES } from './guides';

export type Post = CollectionEntry<'blog'>;

const PHOTOS = import.meta.glob<{ default: ImageMetadata }>('./assets/photos/*.jpg', { eager: true });

/** Newest first. */
export async function allPosts(): Promise<Post[]> {
  const posts = await getCollection('blog');
  return posts.sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

export function photoFor(post: Post): ImageMetadata {
  const found = PHOTOS[`./assets/photos/${post.data.photo}.jpg`];
  if (!found) throw new Error(`blog/${post.id}: no photo "${post.data.photo}" in src/assets/photos/`);
  return found.default;
}

const DATE = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

export const formatDate = (date: Date) => DATE.format(date);

/** At 220 words a minute, never less than one. */
export function readingMinutes(post: Post): number {
  const words = (post.body ?? '').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

/** A `related` slug is another article or one of the search pages. */
export function resolveRelated(slugs: string[], posts: Post[]): { href: string; label: string }[] {
  return slugs.flatMap((slug) => {
    const post = posts.find((other) => other.id === slug);
    if (post) return [{ href: `/blog/${post.id}/`, label: post.data.title }];
    const guide = GUIDES.find((other) => other.slug === slug);
    if (guide) return [{ href: `/${guide.slug}/`, label: guide.short }];
    return [];
  });
}
