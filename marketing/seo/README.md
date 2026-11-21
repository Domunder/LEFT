# SEO blog

Decided with the user 2026-11-21: **two articles a week** on leftmoment.com/blog/,
written by Claude from a keyword backlog and **published without a human
read** (the one exception to rule 6 in `../CLAUDE.md`). Real articles, one
search intent each — not near-copies. That is what keeps this on the right
side of Google's scaled-content policy, and it is why a run may publish nothing.

| What | Where |
|---|---|
| The backlog (keyword, slug, angle, status) | [`keywords.md`](keywords.md) |
| Search Console exports, if the user drops any | `gsc/*.csv` |
| The articles | `web/src/content/blog/{slug}.md` |
| The schema | `web/src/content.config.ts` |
| The gate (prices, competitors, links, length) | `web/scripts/check-blog.mjs` |
| The writer | `.claude/agents/blog-writer.md` |

## Scheduled run (Tuesday and Friday)

1. `git pull`. Read this file, `../CLAUDE.md` (the product facts) and `keywords.md`.
2. Take the first row with status `todo`. If its topic is no longer distinct
   from an article or page that exists, mark it `skipped` with the reason and
   take the next. No `todo` rows left: research ten more the way the file's
   header describes, append them, and continue.
3. Write the article with the `blog-writer` agent (or by its rules).
4. In `web/`: `npm ci` if needed, then `npm run build`. It must pass — fix
   the article, never the gate.
5. Set the row to `done YYYY-MM-DD`, commit both files
   (`Blog: {title}`) and push to `main`. Cloudflare Pages deploys.
6. If the build cannot be made to pass, push nothing and say why.

One article per run. Never touch anything outside `web/src/content/blog/` and
`marketing/seo/` in a scheduled run.

## Rules for every article

**Facts.** Everything said about LEFT comes from `../CLAUDE.md` → "The
product, in facts". Guests need no account and can shoot in the browser; the
host needs the app. Never write that the Android app is available until
`web/src/site.ts` has a `playStoreUrl`. No invented numbers, studies,
statistics, quotes, reviews or "we tested". No first-person stories of events
that did not happen, no named couples. No prices of anything but LEFT. No
competitor names — comparisons live in `web/src/compare.ts` with sources. No
legal, tax or safety advice.

**Useful first.** The article answers the search on its own: someone who never
installs LEFT still got what they came for. LEFT appears where it honestly
fits — usually one section and the closing line, never every paragraph. Where
a real disposable camera, a photographer or a photo booth is the better
answer, say so.

**Shape.** 800–1,200 words. The keyword in the title, the first paragraph and
one `##`. Open with the answer, not with "In today's world". `##` sections a
reader can scan, lists where the content is a list, short paragraphs. Two to
four internal links (`/wedding/`, `/missions/`, a search page, another
article), every path ending in `/`. No external links, no images in the body,
no raw HTML. Two or three FAQ entries in the front matter that people really
ask — not the body repeated.

**Voice.** `../CLAUDE.md` → Voice, official: calm, warm, concrete. "Photos",
"guests", "roll", "developed", "the reveal". American spelling.
No exclamation marks, no emoji, no "elevate", "unforgettable", "game-changer".

**Photo.** One file from `web/src/assets/photos/` (licensed, see
`web/CREDITS.md`) that fits the topic, with a look that fits the photo. Do
not download new photos in a scheduled run; vary the picks so the newest
articles do not share a cover.

## Front matter

```yaml
---
title: Unplugged wedding ceremony wording that guests respect   # ≤ 62 characters, contains the keyword
description: 110–160 characters, says what the reader gets.
date: 2026-11-24
keyword: unplugged wedding wording
cluster: Weddings            # Weddings | Parties | Trips | Photo ideas | Film look
photo: wedding-toast         # file in web/src/assets/photos/ without .jpg
photoAlt: Wedding guests raising their glasses at a long table
look: golden                 # golden | chrome | faded | mono
faq:
  - q: A question?
    a: A short answer.
related: [qr-code-for-wedding-photos, another-article-slug]
---
```

## Results

Once a month, with a Search Console export in `gsc/`: which articles get
impressions, which queries they show for, and which backlog rows to move up.
An article that ranks on page two for a query gets improved before new ones
are written on the same cluster.
