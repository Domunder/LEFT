# Outreach — finding hosts

Decided 2026-11-18 with the user, after how ONCE got its first events: the
fastest way to real events is a short, personal message from the founder to
people who are planning one. Claude finds them and drafts; **the user sends,
by hand, from their personal account.**

The goal of phase 1 (STRATEGY.md): **10 real events with a date** before
launch, then 10 more a month.

## The daily routine (~20 minutes)

1. Run the `prospect-finder` agent ("find prospects"). It writes
   `prospects/YYYY-MM-DD.md`: up to 30 people with a public post about an
   upcoming event, and a draft message for each.
2. Instagram is searched **by you** (it needs a login): open a few hashtags on
   your phone (`#engaged2026`, `#weddingplanning2027`, `#30thbirthday`, …), and
   paste handles + what their post said into the chat ("write messages for
   these"). The agent drafts them the same way.
3. Read each draft, change a word so it is yours, send it from your personal
   account. **20–30 a day at most.**
4. Tick it in `log.md` (sent / replied / event booked). The agent reads the
   log so nobody is messaged twice.

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
