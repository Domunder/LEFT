# Marketing strategy

Decided 2026-11-18 with the user: **free to start**, **four accounts on both
Instagram and TikTok (eight in total), all disclosed "by LEFT"**, **stock photos
graded with LEFT's looks** until real events exist, **automated with Claude**
with one weekly approval.

**Two channels, in this order (2026-11-18, after studying ONCE):**
1. **Founder outreach to hosts** — short personal messages to people planning
   an event, found and drafted by Claude, sent by hand by the user
   (`outreach/README.md`). Gate: 10 real events with a date before launch.
2. **The content accounts below** — cheap, automated tests of hooks and
   niches. Judged after 6 weeks by events created, not views.

## Goal

Downloads and created events — not followers. A post works if people search
for LEFT, visit leftmoment.com or create a moment. Followers are a side effect.

## The accounts

| Account | Handle (suggested) | Audience | Job |
|---|---|---|---|
| Official | `leftmoment` | everyone who heard of LEFT | explains the product, shows the reveal, launch news, answers questions |
| Weddings | `left.weddings` | couples 25–35 planning a wedding, maid of honour, planners | wedding ideas around guest photos and the "unplugged but not photo-less" wedding |
| Parties | `left.afterdark` | 18–28, birthdays, house parties, festivals, uni | party POVs: limited shots, the morning-after reveal |
| Trips | `left.roadtrip` | 20–30, friend trips, gap years, interrail, ski weeks | "the trip we couldn't see until we got home" |

Same handle on Instagram and TikTok. Details per account in `accounts/`.

**Why these three niches:** each is a moment where people already want shared,
nostalgic photos and already use disposable cameras or photo-sharing apps.
Weddings bring the paying hosts; parties and trips bring volume and young
users who later host weddings.

A fifth niche (30+ birthdays, company parties, Christmas parties) comes only
after the first four run on schedule for a month.

## Phases

1. **Before launch (now → launch):** set up the accounts, build a backlog of 30
   posts per account, start posting 2–3 weeks before the app is in the stores
   ("coming soon" is fine; nothing may claim the app is available before it is).
2. **Launch (first 6 weeks):** full cadence. Every account points to the store.
   Measure which niche and which formats work.
3. **Real content (as soon as possible):** shoot 1–2 real events with friends on
   LEFT, with everyone's permission. Real reveals replace stock as the main
   content. Double down on the best niche, cut the weakest.

## Cadence

| | TikTok | Instagram |
|---|---|---|
| Official | 4 / week | 3 / week + stories |
| Each niche | 1 / day | 3–4 / week |

Total about 45 posts a week. All of them are produced in one weekly batch.
Posting times: 18:00–21:00 local time on weekdays, 11:00–13:00 on weekends,
for the main audience (DACH + English-speaking; see Language).

## Language

Start in **English** on every account (bigger reach, the app is English). If a
German-language test post outperforms in a niche, the strategist may propose a
German account later — never mix languages on one account.

## Formats

Ranked by expected reach for the effort:

1. **Photo slideshow (TikTok) / carousel (IG)** — 4–8 slides, a hook on slide 1,
   graded photos, short text per slide, the app or a call to action on the last.
   The main format, about 70 % of posts.
2. **POV text over one photo** — one strong graded print, one line ("POV: you
   have 3 shots left and the bride just started dancing on the table").
3. **List carousel** — "7 photos every wedding forgets", one per slide.
4. **App screen walk-through** (official only) — screenshots of the real app:
   the roll counter, the looks, the developing screen, the reveal.
5. **Question / poll posts** (stories, official) — "Would you rather: 10 shots
   or unlimited?"

**Hook patterns that work for this product:**
- Constraint: "we only had 10 photos each for the whole wedding"
- Delay: "we couldn't see a single photo until the next morning"
- Contrast: "400 guests, 400 cameras, 0 photos of the bride" (the problem) → LEFT
- POV / nostalgia: "POV: it's 2004 and you're waiting for your film to come back"
- Idea list: "wedding ideas your guests will actually talk about"

## Weekly loop

Everything runs once a week (Sunday), each step an agent:

1. **`trend-researcher`** → `trends/YYYY-MM-DD.md`: trending formats, hooks,
   hashtags and topics for each niche this week (free sources only).
2. **`content-strategist`** → `plans/YYYY-Www.md`: reads the trend report, the
   account files and last week's `results/`, decides what each account posts
   each day of the coming week and why.
3. **`content-writer`** → `posts/YYYY-Www/*.md`: one file per post with the
   slide text, caption, hashtags, which stock photos and which look.
4. **Renderer** (not built yet) → `queue/`: the finished images.
5. **Approval (the user, ~10 min):** approve or reject each post in the queue.
6. **Publisher** (not built yet) → posts approved items at their times.
7. **Results:** after a week, the numbers per post go into
   `results/YYYY-Www.md` and feed the next plan.

## Automation — what exists and what is next

| Step | State | How |
|---|---|---|
| Trend research | agent ready | `trend-researcher`, run weekly by a scheduled Claude task |
| Planning | agent ready | `content-strategist` |
| Writing | agent ready | `content-writer` |
| Rendering | **to build** | a Node script that grades stock with the ported look recipes and lays out the slides (1080×1920 / 1080×1350) |
| Approval | **to build** | a simple page listing the week's queue with approve / reject |
| Instagram publishing | **to build** | Meta Graph API, free. Needs Instagram Business accounts linked to a Facebook page and a Meta developer app |
| TikTok publishing | **to build** | Content Posting API, free. **Until TikTok audits our app, posts arrive as drafts in the TikTok inbox** and need one tap to publish |
| Results | **to build** | read back post insights through the same APIs |

**Only the user can:** create the eight accounts (email / phone verification),
create the Meta and TikTok developer apps, connect the accounts, and approve
posts. Claude does not create accounts or handle passwords.

## Costs

€0. Claude on the existing plan, free stock (Unsplash, Pexels), free APIs,
free trend sources (TikTok Creative Center, Google Trends, the platforms'
own search). Money comes in only when it is worth it: paid micro-creators
after launch, once one niche clearly works.

## Metrics

Per post: views, saves, shares, profile visits, link clicks. Per week and
account: follower growth, store visits (from the link in bio, UTM per account:
`?utm_source=tiktok&utm_campaign=left.weddings`). Per month: events created
(PostHog `event_created`).

A format is cut after 6 posts without beating the account's median views.
A niche is cut after 6 weeks if it stays the weakest on store visits.

## Not doing (and why)

- **Undisclosed "independent" accounts:** against platform rules
  (inauthentic behaviour) and advertising law (EU UCPD, Swiss UWG, FTC). One
  link-up can take down all accounts.
- **Fake comments, bought followers, engagement pods:** same reasons, and they
  poison the numbers the strategist learns from.
- **"Shot on LEFT" mark in the app:** postponed by the user (2026-11-18).
