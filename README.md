# LEFT

A group-video event app. Everyone at a wedding, birthday, trip or party films
into **one shared time budget** — if someone records 10s of a 60s budget, the
whole group has 50s left. The clips compile into a single shared film.

Pricing is one-time per event, tiered by group size. No subscription.

Two top-level concerns, nothing else:

```
LEFT/
├── mobile/      everything the app needs — code, assets, design spec
│                → mobile/README.md
└── supabase/    database schema, RLS, storage, realtime
```

## Getting started

**The app** — see [mobile/README.md](mobile/README.md).

```bash
cd mobile && npm install && npm start
```

**The database** — needs Docker Desktop running.

```bash
npm install          # installs the Supabase CLI
npm run db:start     # boots Postgres, Auth, Realtime, Storage and Studio
```

`db:start` prints an API URL and keys. Put them in `mobile/.env`:

```
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<the anon key it printed>
```

Studio is at http://127.0.0.1:54323.

> **Testing on a physical phone?** `127.0.0.1` is the phone itself, not your PC.
> Either use your PC's LAN IP (`http://192.168.x.x:54321`) or point `.env` at a
> hosted Supabase project. Hosted is the lower-friction option for device testing.

| script | what it does |
|---|---|
| `npm run db:start` / `db:stop` | boot / shut down the local stack |
| `npm run db:reset` | drop and rebuild from migrations (destroys local data) |
| `npm run db:diff` | generate a migration from changes made in Studio |
| `npm run db:push` | apply migrations to the linked hosted project |
| `npm run db:types` | regenerate `mobile/src/types/database.ts` from the schema |

Rerun `db:types` after every schema change — it is what makes queries type-checked.

## Going hosted

```bash
npx supabase link --project-ref <your-project-ref>
npm run db:push
```

Migrations in `supabase/migrations/` are the source of truth and apply
identically to local and hosted. Never change schema by clicking in the
dashboard — make the change locally, `npm run db:diff` it into a migration,
then push.

## How the shared budget works

This is the one design decision the whole app rests on, so it is worth reading
before touching the camera screen.

**The budget is server-authoritative.** A client never decrements it. If two
phones each trusted a local "20s left", both would film 20s and the group would
overspend by 20s.

Recording is a two-step transaction against `supabase/migrations/`:

1. **On record-start** — `reserve_budget(event_id, seconds)` takes a row lock on
   the event and places a *hold*. It returns `granted_seconds`, which may be less
   than requested: that is the real cap, and the camera must stop there. `0` means
   the group is out of time. Holds expire after 15 minutes so a crashed client
   does not strand the budget.

2. **On record-stop** — `commit_reservation(reservation_id, actual_seconds, path)`
   charges the true clip length, creates the clip row, and releases the hold in
   one transaction. The charge is **capped at what was held**, so a client cannot
   overspend by misreporting. Discarded takes call `release_reservation` instead.

`remaining_seconds(event_id)` is the single answer to "how much is left". Every
member's progress bar updates from realtime `UPDATE`s on `public.events`.

RLS keeps you to events you belong to. Guests join via `join_event(code, name)`
rather than a policy on `invite_code`, so a code resolves exactly one event
without letting anyone enumerate the rest. Budget columns are protected by
column-level grants — not even the host can write `used_seconds` directly.
