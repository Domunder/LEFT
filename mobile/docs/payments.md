# Payments — one-time event charges

Groups of five or more are a one-time charge per event, paid when the event is
created, taken through the app store and brokered by RevenueCat. There is no
subscription. Groups of four or fewer are free.

Two decisions shape everything below, and both are easy to get wrong:

> **The products are consumables, and they are attached to no entitlement.** A
> host creates many events over time and pays for each one. A non-consumable can
> be bought once ever, so the second event would be free. And a consumable placed
> inside a RevenueCat entitlement makes RevenueCat report that entitlement
> unlocked forever after the first purchase — the same bug wearing a hat.

RevenueCat is the payment rail and the receipt validator. It cannot tell us
whether a purchase has already been *spent*, because consumable redemption is
explicitly the app's problem. `public.purchases` is that record.

> **In-app purchases need a development build.** Expo Go and the web build have no
> store; the buttons cannot work there.

## What you will end up with

| Value | Where it goes | Secret |
|---|---|---|
| RevenueCat iOS SDK key (`appl_…`) | `mobile/.env` | no |
| RevenueCat Android SDK key (`goog_…`) | `mobile/.env` | no |
| RevenueCat secret key (`sk_…`) | Supabase function secrets | **yes** |
| Webhook Authorization header | Supabase function secrets + RevenueCat | **yes** |

The rule is the same as `social-sign-in.md`: anything prefixed `EXPO_PUBLIC_` is
compiled into the bundle and readable by anyone who downloads the app. RevenueCat's
SDK keys are designed for that. The secret key can refund purchases and read any
customer's history — it never goes near `mobile/`.

## Prerequisites

- A paid Apple Developer Program membership, with the **Paid Applications
  Agreement** signed and banking and tax details complete.
- A Google Play Console account with a **merchant profile** set up.
- A RevenueCat account.
- A development build. See `social-sign-in.md` for the EAS commands.

> **The agreements are not optional and not instant.** Until the paid-apps
> agreement is active and banking is filled in, both stores return an **empty
> product list** rather than an error. An empty `getProducts()` result is almost
> always this, not a bug in the app.

## The three products

Create each one in both stores, using the **same identifier in both**. The id is
keyed on the tier's upper bound, so a price change never needs a new SKU.

| Group size on 05.1 | Price | Product ID |
|---|---|---|
| Up to 4 | free — nothing is bought | — |
| Up to 10 | $4.99 | `left_film_unlock_10` |
| Up to 50 | $14.99 | `left_film_unlock_50` |
| Any group | $29.99 | `left_film_unlock_unlimited` |

In **App Store Connect**, create them under In-App Purchases with type
**Consumable**. In **Google Play Console**, create them under Products →
In-app products (a one-time product, *not* a subscription).

> **These ids have outlived two pricing models and are deliberately unchanged.**
> They replaced six group-size tiers (`left_event_tier_*`), then briefly meant
> "unlock the finished film" rather than "create the event". Renaming a SKU that
> has ever shipped strands every receipt bought under it, and `unlock_max_members()`
> still maps the six legacy ids for exactly that reason. Do not remove them.

**The charge is at creation, on the group size the host picks.** That is a guess
made before the party, and it is the buyer's own guess — the alternative is
billing them afterwards for who turned up. `create_event()` compares the receipt
against `max_members` server-side and claims it in the same transaction as the
insert, so an event is paid for exactly once or does not exist.

This table lives in two places in code, and they must be edited together:

| File | What it holds |
|---|---|
| `mobile/src/lib/tiers.ts` | `EVENT_TIERS` and `FREE_MAX_MEMBERS` — what the app offers and quotes |
| `supabase/migrations/*_unlock_the_film.sql` | `unlock_max_members()` — what the server will honour, including the legacy ids |

## RevenueCat setup

1. Create a project, then add an iOS app and an Android app with the bundle id
   and package name `com.leftmoment.app`.
2. Upload the App Store Connect shared secret and the Play service-account JSON,
   so RevenueCat can validate receipts.
3. Import the three products.
4. **Attach them to no entitlement, and create no offering.** The app fetches by
   product id directly, which keeps the tier-to-SKU mapping in `lib/tiers.ts`
   rather than split across a remote dashboard.
5. Copy the public SDK keys into `mobile/.env`.

## The webhook

Under Integrations → Webhooks, add a destination pointing at:

```
https://<project-ref>.supabase.co/functions/v1/revenuecat-webhook
```

Set the Authorization header to a long random string, and give Supabase the same
value:

```bash
npx supabase secrets set REVENUECAT_WEBHOOK_SECRET='<the same string>'
npx supabase secrets set REVENUECAT_SECRET_API_KEY='sk_...'
npx supabase functions deploy revenuecat-webhook
npx supabase functions deploy create-event
```

> **RevenueCat signs nothing.** That header is the only thing between the open
> internet and a function running as `service_role`. Treat it as a password.

Add **two** destinations — one filtered to PRODUCTION and one to SANDBOX, both
pointing at the same function. Sandbox purchases are written as real rows so
TestFlight works end to end, but they are marked `environment = 'SANDBOX'` and can
be swept before launch:

```sql
delete from public.purchases where environment = 'SANDBOX';
```

The function must return 200 or RevenueCat retries up to five times with
increasing delay — the first retry is about five minutes out.

## How a purchase becomes an event

1. 05.1 quotes the price for the group size on screen, from `tierFor()`. At four
   people or fewer it says "Free for groups of four or fewer" and steps 2–4 are
   skipped entirely.
2. `Purchases.logIn(<supabase user id>)` runs before anything is bought, or the
   receipt lands on an anonymous RevenueCat id and the ledger row matches nobody.
3. The store sheet takes the money. `purchaseTier()` returns a transaction id.
4. The app calls the `create-event` function, which asks RevenueCat's REST API
   whether that transaction exists for that user, writes the ledger row, and calls
   `create_event()` — all in one request.
5. `create_event()` claims the cheapest unconsumed purchase that covers
   `max_members` and marks it consumed **in the same transaction** as the insert,
   so it can never be spent twice and a failed insert never burns a receipt.
6. RevenueCat's webhook arrives later and hits the unique index on
   `store_transaction_id`, which is a no-op.

Step 4 exists because the webhook is asynchronous and the app reaches step 5
within milliseconds. Waiting for the webhook would mean a visible stall on every
purchase, and a five-minute one whenever a delivery fails. If the lookup does miss,
the app shows "Confirming your purchase…" and retries on a backoff for about 15
seconds.

> **Pay first, then create.** A purchase that exists but is never spent is
> recoverable — it stays unconsumed and pays for the next attempt. An event that
> exists but was never paid for is not.

> **The group size can change while the store sheet is open.** `create_event()`
> therefore accepts any receipt bought in the last 15 minutes regardless of the
> tier it names. Without that window, a host who bumps the group from 10 to 25
> mid-purchase has a receipt that is too small and creation is refused *after* the
> money is taken.

> **A retry never charges twice.** `use-event-creation.ts` holds the paid
> transaction in a ref for the life of the screen, so re-entering `submit()` after
> a settling failure reuses the receipt instead of buying a second one.

**The purchase is never lost, only delayed.** It sits unconsumed in the ledger, and
the next attempt spends it rather than charging again.

## Environment variables

| Name | Side | Where | Secret |
|---|---|---|---|
| `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` | client | `mobile/.env` | no |
| `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` | client | `mobile/.env` | no |
| `REVENUECAT_WEBHOOK_SECRET` | server | `supabase secrets set` | **yes** |
| `REVENUECAT_SECRET_API_KEY` | server | `supabase secrets set` | **yes** |

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are injected
into edge functions automatically. Do not set them by hand.

## Verifying

Check the server enforcement first — it needs no store at all. In Studio:

```sql
-- The free tier is capped server-side, not by the client.
select public.create_event('T','party','vertical',now() + interval '1 day', 4, 600);
-- expect: the free tier is limited to 60 seconds

-- A paid tier with no purchase is refused.
select public.create_event('T','party','vertical',now() + interval '1 day', 25, 240);
-- expect: no unconsumed purchase for this group size
```

An anonymous caller is refused before any of that, free tier included — hosting
needs a full account, and the free tier consumes no purchase, so this is the only
thing standing in a guest's way. Run it as one:

```sql
set local request.jwt.claims = '{"sub":"<an anonymous user id>","role":"authenticated"}';
set local role authenticated;
select public.create_event('T','party','vertical',now() + interval '1 day', 4, 60);
-- expect: hosting a memory requires a full account   (HINT: anonymous)
```

The check reads `auth.users.is_anonymous`, not the JWT claim: `linkIdentity()`
upgrades the row in place and the claim stays stale until the token refreshes,
which would refuse the guest who just signed in.

Then the check that matters most — that a client cannot skip the RPC entirely:

```sql
set role authenticated;
insert into public.events (host_id, name, ends_at, max_members, budget_seconds)
values (auth.uid(), 'bypass', now() + interval '1 day', 200, 600);
-- expect: permission denied for table events
```

On device, with a sandbox account:

1. Buy a paid tier and confirm you reach the Invite screen.
2. One `purchases` row, `environment = 'SANDBOX'`, `user_id` matching your
   `auth.users` id — **not** a `$RCAnonymousID:…` — and `consumed_at` set with
   `consumed_by_event_id` pointing at the new event.
3. Cancel a purchase sheet: no row is written, the screen returns to normal, and
   the draft survives.
4. Kill the app between paying and creating. Reopening and retrying must spend the
   existing row rather than charging again.

Sandbox notes: on iOS use a Sandbox Apple Account under Settings → Developer;
sandbox consumables can be re-bought indefinitely, which is what makes multi-event
testing possible. On Android use an internal testing track with licence testers.

## Troubleshooting

| Symptom | Cause |
|---|---|
| `getProducts()` returns an empty array | Products not approved, or the paid-apps agreement and banking are incomplete. This is the usual cause. |
| `... is not available in this store` | The SKU does not exist, or the build's bundle id does not match the store listing. |
| `no unconsumed purchase for this group size` right after paying | The reconciliation lookup missed. The app retries automatically; if it persists, check `REVENUECAT_SECRET_API_KEY` is set on the function. |
| Ledger row has a `$RCAnonymousID:…` user | `Purchases.logIn()` did not run before the purchase. Check the `identify()` calls in `app/index.tsx` and `hooks/use-event-creation.ts`. |
| Webhook returns 401 | The Authorization header in RevenueCat does not match `REVENUECAT_WEBHOOK_SECRET`. |
| `permission denied for table events` in the app | Expected — clients cannot insert events. Something is bypassing `createEvent()`. |
| In-app purchases need a development build | You are in Expo Go or on web. |

## Known missing

- **Refunds are not handled.** A `CANCELLATION` webhook for a refunded consumable
  should arguably mark the ledger row and possibly the event. Nothing does today.
- **Free events are capped but not rate-limited** — a user can create unlimited
  4-person events.
- **Restore Purchases is wired, but untested against a real store.** Settings ->
  Restore Purchases runs `identify()` -> `restore()` -> the `restore-purchases`
  edge function, which reads RevenueCat's `/v1/subscribers` and inserts whatever
  is missing from `public.purchases`. Both halves are needed: RevenueCat validates
  receipts but explicitly does not track whether a consumable has been *spent*, so
  the client half alone leaves a reinstalled device with an empty ledger and a
  user being charged twice. Deploy it with the others:

  ```bash
  npx supabase functions deploy restore-purchases
  ```

- **Deleting an account does not refund anything**, and the confirmation says so.
  `delete-account` cascades the user's `purchases` rows away with them; a
  purchase consumed by an event that is being destroyed is un-linked first so the
  `purchases_consumed_together` check cannot fire mid-cascade. Deploy:

  ```bash
  npx supabase functions deploy delete-account
  ```
