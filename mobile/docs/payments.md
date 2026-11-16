# Payments — one-time event charges

An event is free up to 50 guests on any finite roll (5–36 shots each). The
unlimited roll, or a group of more than 50, is a one-time charge per event —
one of four products, by group size (final, decided 2026-11-15) — paid when
the event is created, taken through the app store and brokered by RevenueCat.
There is no subscription.

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

## The four products

Create them in both stores, using the **same identifiers in both**.

| Event | Price | Product ID |
|---|---|---|
| Up to 50 guests, roll of 5–36 | free — nothing is bought | — |
| Up to 50 guests, unlimited roll | US$9.99 (set per storefront) | `left_small` |
| 51–100 guests, any roll | US$14.99 (set per storefront) | `left_medium` |
| 101–150 guests, any roll | US$19.99 (set per storefront) | `left_large` |
| 151–200 guests, any roll | US$24.99 (set per storefront) | `left_unlimited` |

In **App Store Connect**, create them under In-App Purchases with type
**Consumable**. In **Google Play Console**, create them under Products →
In-app products (one-time products, *not* subscriptions).

> **Do not rename an id once it has shipped.** Renaming a SKU strands every
> receipt bought under it. `public.unlock_max_members()` is the authority on which
> product ids the server accepts; `mobile/src/lib/tiers.ts` is the display mirror.

**The charge is at creation, on the group and roll the host picks.**
`create_event()` decides server-side whether the event needs a purchase and claims
it in the same transaction as the insert, so an event is paid for exactly once or
does not exist.

This table lives in two places in code, and they must be edited together:

| File | What it holds |
|---|---|
| `mobile/src/lib/tiers.ts` | `TIERS`, `tierFor()` and `FREE_MAX_MEMBERS` — what the app offers and quotes |
| `supabase/migrations/*_price_tiers.sql` | `unlock_max_members()`, `free_max_members()` — what the server will honour |

## RevenueCat setup

1. Create a project, then add an iOS app and an Android app with the bundle id
   and package name `com.leftmoment.app`.
2. Upload the App Store Connect shared secret and the Play service-account JSON,
   so RevenueCat can validate receipts.
3. Import the four products.
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

1. 05.1 decides with `tierFor()` whether the chosen group and roll are
   paid, and names the price on the button. A free event skips steps 2–4
   entirely.
2. `Purchases.logIn(<supabase user id>)` runs before anything is bought, or the
   receipt lands on an anonymous RevenueCat id and the ledger row matches nobody.
3. The store sheet takes the money. `purchaseTier()` returns a transaction id.
4. The app calls the `create-event` function, which asks RevenueCat's REST API
   whether that transaction exists for that user, writes the ledger row, and calls
   `create_event()` — all in one request.
5. `create_event()` claims an unconsumed purchase and marks it consumed **in the same transaction** as the insert,
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
-- Free: up to 50 guests on a finite roll.
select public.create_event('T','party','golden',now() + interval '1 day', 50, 36);

-- The unlimited roll, or more than 50 guests, with no purchase is refused.
select public.create_event('T','party','golden',now() + interval '1 day', 50, null);
select public.create_event('T','party','golden',now() + interval '1 day', 51, 24);
-- expect: no unspent purchase covers this event   (HINT: unsettled)
```

An anonymous caller is refused before any of that, free tier included — hosting
needs a full account, and the free tier consumes no purchase, so this is the only
thing standing in a guest's way. Run it as one:

```sql
set local request.jwt.claims = '{"sub":"<an anonymous user id>","role":"authenticated"}';
set local role authenticated;
select public.create_event('T','party','golden',now() + interval '1 day', 10, 24);
-- expect: hosting an event requires a full account   (HINT: anonymous)
```

The check reads `auth.users.is_anonymous`, not the JWT claim: `linkIdentity()`
upgrades the row in place and the claim stays stale until the token refreshes,
which would refuse the guest who just signed in.

Then the check that matters most — that a client cannot skip the RPC entirely:

```sql
set role authenticated;
insert into public.events (host_id, name, ends_at, max_members)
values (auth.uid(), 'bypass', now() + interval '1 day', 200);
-- expect: permission denied for table events
```

On device, with a sandbox account:

1. Create an event with the unlimited roll, pay, and confirm you reach the Invite screen.
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
| `no unspent purchase covers this event` right after paying | The reconciliation lookup missed. The app retries automatically; if it persists, check `REVENUECAT_SECRET_API_KEY` is set on the function. |
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
