# Environments

Three backends, one schema. **Production holds only real users.** Test data
goes to the local stack or to staging.

| name | what | who uses it |
|---|---|---|
| `local` | Supabase in Docker on this PC (`npm run db:start`) | Expo dev on a phone on the same Wi-Fi, the website's `npm run dev` |
| `staging` | hosted project **LEFT staging** (`nxnrqqwstiydznkriidk`), free plan | dev/preview builds, TestFlight builds from the `staging` profile, the App Clip in TestFlight |
| `prod` | hosted project **LEFT** (`ervrxomceqactmrqmkeq`) | App Store builds (`production` profile), leftmoment.com |

URLs and publishable keys live in `supabase/targets.json` (they are public).

## Switch

From the repo root:

```bash
npm run use:local      # local stack — finds this PC's LAN IP itself
npm run use:staging
npm run use:prod       # only to look at something live; never to test
npm run use            # which one is active
```

This rewrites the Supabase pair in `mobile/.env` and `web/.env`, nothing
else. Then restart Expo with `npx expo start --clear`: the values are baked
into the bundle.

`use:local` needs Docker Desktop running and `npm run db:start`. If the
phone says "Network request failed" after a Wi-Fi change, run
`npm run use:local` again.

## Migrate

A schema change is a new file in `supabase/migrations/`. It goes
local → staging → prod, always in that order:

```bash
npm run db:migrate:local   # into the running local stack, keeps data
                           # (or npm run db:reset: rebuilds and reseeds, wipes local data)
npm run db:push:staging    # migrations + edge functions to staging
npm run db:push:prod       # the same to production — shows the plan, asks you to type "prod"
```

Each hosted push links the CLI to that project first, so it never goes to
the wrong one by accident. No database password needed: the CLI logs in
through `supabase login`. After a schema change also run `npm run db:types`
(local) or `npm run db:types:staging`.

## Test data

- **Local:** `supabase/seed.sql`, applied by `npm run db:reset`.
- **Staging:** the same seed, `npm run db:seed:staging` (safe to repeat).
  Host `devhost@left.local` / `devpassword`; invites `DEV123` (app only) and
  `DEVTEST` (also App Clip). The demo template's sample guests:
  `SUPABASE_URL=… SUPABASE_KEY=… node web/scripts/seed-demo.mjs LEFTDEMPLATE`
  (done once on 2026-11-24).
- **Production:** never seeded. Only the demo template's sample guests live
  there, because the demo is a real feature.

## App builds (EAS)

| profile | backend | goes to |
|---|---|---|
| `development`, `development-simulator` | staging (EAS env `development`) — the JS comes from Metro, i.e. whatever `npm run use:*` set | install link |
| `preview` | staging (EAS env `preview`) | install link |
| `staging` | staging (EAS env `preview`) | TestFlight |
| `production` | prod (EAS env `production`) | TestFlight → App Store |

The App Clip gets its backend from the same variables at prebuild.
**Submit only a `production` build for review** — a `staging` build in
TestFlight looks identical but talks to staging.

The EAS variables are managed on expo.dev (or `eas env:list --environment preview`).

## Staging: set up once (already done on 2026-11-24 unless marked)

- [x] Migrations, edge functions, auth settings (anonymous sign-in, manual
      linking, Google, Apple — `supabase config push --project-ref …`)
- [x] Vault `project_url`
- [x] Seed, demo template
- [ ] Vault `service_role_key` (push and purge on staging): Dashboard →
      LEFT staging → Settings → API keys → copy the service_role key, then in
      the SQL editor
      `select vault.create_secret('<key>', 'service_role_key');`
- [ ] Edge function secrets for purchases, if you test paying on staging:
      `npx supabase secrets set --project-ref nxnrqqwstiydznkriidk REVENUECAT_SECRET_API_KEY=… REVENUECAT_WEBHOOK_SECRET=…`
      (the RevenueCat webhook itself only points at production)

The free plan pauses a project after a week without requests; resume it in
the dashboard.
