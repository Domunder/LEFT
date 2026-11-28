# LEFT

A disposable camera for events. Guests at a wedding, birthday, trip or party
join by link or QR, each gets a **limited roll of photos**, and nothing is visible
until the event ends and the group's film is developed together. Photos only —
no video.

> **Built, not launched.** App, backend and website exist; what is left needs
> accounts, a domain and a device. See [docs/LAUNCH.md](docs/LAUNCH.md) (the
> launch runbook), [docs/MILESTONES.md](docs/MILESTONES.md) and
> [CLAUDE.md](CLAUDE.md).

```
LEFT/
├── mobile/      the Expo app — code, assets, design spec   → mobile/README.md
├── supabase/    schema, RLS, storage, cron jobs, edge functions
├── web/         leftmoment.com (Astro, static)             → web/README.md
└── docs/        milestones and the launch runbook
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
| `npm run use:local` / `use:staging` / `use:prod` | point the app and the website at a backend |
| `npm run db:push:staging` / `db:push:prod` | migrations + edge functions to a hosted project |
| `npm run db:types` | regenerate `mobile/src/types/database.ts` from the schema |

Rerun `db:types` after every schema change — it is what makes queries type-checked.

New migrations on an existing local stack: `npx supabase migration up --local`
(keeps your data). New or changed edge functions: restart the stack once
(`npm run db:stop && npm run db:start`) — the edge runtime only learns its
function list at start.

**Push and retention locally.** pg_cron wakes the `send-notifications` and
`purge-expired-events` functions through pg_net and reads the address and key
from Vault. `seed.sql` sets `project_url`; add the key once:

```sql
select vault.create_secret('<service_role key from npm run db:status>', 'service_role_key');
```

## Staging and production

Two hosted projects: staging for testing, production for real users only.
Switching and migrating: [docs/ENVIRONMENTS.md](docs/ENVIRONMENTS.md).

Migrations in `supabase/migrations/` are the source of truth and apply
identically to local and hosted. Never change schema by clicking in the
dashboard — make the change locally, `npm run db:diff` it into a migration,
then push.
