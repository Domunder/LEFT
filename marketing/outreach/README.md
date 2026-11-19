# Outreach — finding hosts

Decided 2026-11-18 with the user, after how ONCE got its first events: the
fastest way to real events is a short, personal message from the founder to
people who are planning one. Claude finds them and drafts; **the user sends,
by hand, from their personal account.**

The goal of phase 1 (STRATEGY.md): **10 real events with a date** before
launch, then 10 more a month.

## The daily routine (~20 minutes)

**You find, Claude drafts** (switched 2026-11-19, after the first automatic
run found 1 prospect: Reddit and TikTok block automated reading, and
Instagram needs a login).

1. **Find on your phone (~10 min).** Scroll the searches below and copy, for
   each fitting post: the handle, the platform, and what the post says
   (a screenshot's text or a short summary is enough).
2. **Paste it into Claude:** "write messages for these" + your list. The
   `prospect-finder` agent writes `prospects/YYYY-MM-DD.md` with a draft per
   person. It also checks the open wedding forums by itself, which adds a
   few.
3. **Send (~10 min).** Read each draft, change a word so it is yours, send it
   from your personal account. **20–30 a day at most.**
4. **Tick it in `log.md`** (sent / replied / declined / no answer / booked).
   The agent reads the log so nobody is messaged twice.

### Where to look

| Platform | Search | Good sign |
|---|---|---|
| Instagram | `#engaged2026`, `#bride2027`, `#weddingplanning2027`, `#30thbirthday`, `#bachelorette2027`, German: `#verlobt`, `#hochzeit2027`, `#brautpaar2027` | a recent post about their own engagement or planning, with a date or season |
| TikTok | "wedding guest photos", "disposable cameras wedding", "planning my wedding 2027", "30th birthday plans", "bachelorette trip" | the creator talks about their own upcoming event |
| Reddit | r/weddingplanning, r/wedding, r/Weddingsunder10k, r/bachelorette — sort by **New**, search "photos", "disposable", "photo booth", "QR" | someone asking what to do about guest photos |
| Your network | contacts on Instagram, WhatsApp, LinkedIn with an engagement, a big birthday or a trip coming up | anyone you know — the warmest messages of all |

Skip: private accounts, minors, vendors, anything sad or sensitive, people
who only commented on someone else's post.

## Rules

- **The user sends every message by hand.** No bot, no auto-DM tool, no
  scheduled sending — it breaks Instagram's, TikTok's and Reddit's rules and
  gets the account banned.
- **Personal account, honest sender.** "I built this", never "a friend
  recommended", never posing as a guest or a fan. Never from the official
  LEFT accounts.
- **Only public posts the person made about their own event.** No private
  accounts, no minors, no posts about grief, illness or breakups, no people
  who only commented on someone else's post.
- **Minimum data:** handle, platform, link to the post, event type, rough
  date, one detail for the message. No real names, addresses, phone numbers,
  e-mails, no combining sources to learn more about a person.
- **Delete after 30 days.** `prospects/` and `log.md` are gitignored; the
  agent removes prospect files older than 30 days on every run. Somebody who
  says "no" or does not answer within 14 days is never messaged again.
- **Respect community rules.** Many subreddits ban promotion: never post or
  comment an ad there. A Reddit DM is only for someone who asked for ideas
  or recommendations about photos at their event.

## Files

```
outreach/
  README.md        this file
  MESSAGES.md      voice and templates the agent writes from
  prospects/       (gitignored) one file per run
  log.md           (gitignored) who was messaged, and what happened
```
