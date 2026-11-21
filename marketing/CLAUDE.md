# LEFT — marketing

Everything that grows LEFT on Instagram and TikTok. The plan is
[`STRATEGY.md`](STRATEGY.md); each account has a file in [`accounts/`](accounts/).
This file holds the rules every marketing agent follows. When the app changes,
the facts below must change with it — the app's own `CLAUDE.md` at the root wins.

## The product, in facts a caption may use

- A disposable camera for events: weddings, parties, trips. Guests join by
  **link or QR code, no sign-up** (they do install the app — never write "no
  download").
- Each guest gets a **limited roll**: 5, 10, 16, 24, 36 or unlimited shots,
  chosen by the host. The app shows "17 left".
- Every photo gets an **analog look**, chosen by the host for the whole event:
  Golden (warm), Chrome (cool), Faded (washed out), Mono (black and white).
- **Nobody sees any photo until the event ends.** Then the whole group's film is
  **developed** at once — the reveal.
- **Missions** (free, optional): small photo challenges per guest, e.g. "A photo
  with someone you have never met".
- **Price:** free up to 50 guests on a limited roll. One-time per event, no
  subscription: US$9.99 (unlimited roll, up to 50), $14.99 (up to 100), $19.99
  (up to 150), $24.99 (up to 200).
- **Photos only.** No video. Photos are kept 6 months after the reveal.
- iOS and Android. Website: leftmoment.com.

If a caption needs a fact that is not here, check the app's root `CLAUDE.md` or
leave it out. Never invent features, numbers, user counts or reviews.

## Vocabulary

An event is a **moment** or **event**, a guest's allowance is their **roll**, the
end is **developed** / **the reveal**. Say "photos", never "pics" in official
copy (niche accounts may be looser). Never "video", "clips", "reels of your
event".

## Rules — never break these

1. **Every account is disclosed.** Bio contains "by LEFT 📷" and links to
   leftmoment.com. No account pretends to be independent, a customer or a
   reviewer. No fake comments, no fake testimonials, no comments from one of our
   accounts on another's post posing as a stranger.
2. **Stock is never presented as real users.** No "Anna and Ben shot this at
   their wedding" over stock. Allowed framings: "the vibe", "what your film
   could look like", "POV", "imagine", "idea for your wedding". Once real event
   photos exist (with the people's permission), they replace stock.
3. **Only licensed images.** Every stock photo is logged in
   [`stock/LICENSES.md`](stock/LICENSES.md) with source and licence before it is
   used. Unsplash and Pexels licences allow commercial use but not implying that
   the people pictured endorse LEFT — no quotes or opinions put in their mouths.
4. **AI-generated images are labelled** with the platform's AI label, and
   flagged `ai_generated: true` in the post file. Prefer stock over AI.
5. **No trend-jacking of tragedies, politics or real people's names.** No
   copyrighted music added by us — sounds are picked in the app from the
   platform's own library when the post is published.
6. **The user posts everything by hand** (since 2026-11-21; see STRATEGY.md →
   Weekly loop) — posting is the approval. No agent publishes to Instagram
   or TikTok. **Exception (the user,
   2026-11-21): the SEO blog publishes on its own**, behind the gate in
   `web/scripts/check-blog.mjs` — see [`seo/README.md`](seo/README.md).
7. **No personal data** of the user or anyone else in posts, files or requests
   to outside services.

## Voice

- **Official:** calm, warm, a little nostalgic. Short sentences. Newsreader-like
  tone: "Nothing to see yet. That's the point."
- **Niche accounts:** their own voice (see each account file), but the same
  values: presence over screens, the surprise of the reveal, everyone's view of
  the night instead of one photographer's.
- Lowercase hooks are fine on TikTok. No more than 2 emojis per caption. No
  clickbait that the post does not pay off.

## Visual rules

- The brand look: dark `#101010`, off-white `#f0ede8`, serif headlines with
  italic emphasis (Newsreader), clean sans for small text (Inter).
- Every photo in a post is graded with one of the four LEFT looks, so all
  accounts look like LEFT prints. The recipes live in
  `mobile/src/constants/looks.ts` (`LOOK_RECIPES`) — the generator ports those
  values; never invent a fifth look.
- Format: 1080×1920 (TikTok slideshow, IG story/reel cover), 1080×1350 (IG
  carousel). Text inside the safe area: 120 px from top, 320 px from bottom,
  60 px sides.

## Files

```
marketing/
  CLAUDE.md          this file
  STRATEGY.md        the plan: phases, cadence, formats, weekly loop, metrics
  accounts/          one file per account: audience, pillars, hooks, hashtags
  trends/            trend reports, one per run (trend-researcher)
  plans/             weekly content plans (content-strategist)
  posts/             post files for the week, one per post (content-writer)
  stock/             source photos + LICENSES.md
  queue/             (gitignored) rendered images waiting for approval
  results/           weekly performance notes, fed back into the next plan
  outreach/          founder outreach to hosts: guide, messages, prospects (gitignored)
  seo/               the blog: keyword backlog and rules (articles live in web/src/content/blog/)
```

Agents (in the repo's `.claude/agents/`): `trend-researcher`,
`content-strategist`, `content-writer`, and `prospect-finder` for founder
outreach to hosts (`outreach/README.md` — the first channel, before content).
The renderer is `web/scripts/social-posts.mjs` (`cd web && npm run social`);
there is no publisher — the user posts by hand (STRATEGY.md → Automation).
