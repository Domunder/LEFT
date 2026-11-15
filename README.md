# LEFT

A disposable camera for events. Guests at a wedding, birthday, trip or party
join by link or QR, each gets a **limited roll of photos**, and nothing is visible
until the event ends and the group's film is developed together. Photos only —
no video.

> **Mid-build.** The backend and onboarding are on the photo model; the camera
> and the album are the next milestones. See
> [docs/MILESTONES.md](docs/MILESTONES.md) and [CLAUDE.md](CLAUDE.md).

Two top-level concerns:

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
