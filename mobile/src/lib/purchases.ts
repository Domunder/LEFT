/**
 * Purchase seam for 05.1's paid tiers.
 *
 * Every paid tier is a *consumable*, deliberately attached to no RevenueCat
 * entitlement. A host creates many events over time and pays for each one, so
 * "does this user own the product" is the wrong question — non-consumables can
 * be bought once ever, and a consumable placed inside an entitlement makes
 * RevenueCat report that entitlement unlocked forever after the first purchase.
 * The right question is "does this user have an unspent purchase", and only our
 * own database can answer it. RevenueCat is the payment rail and the receipt
 * validator; `public.purchases` is the ledger.
 *
 * Nothing here grants anything. A resolved purchase means only that the store
 * took the money — the event is created by `create_event()`, which verifies
 * against that ledger server-side. A modified client cannot talk its way in.
 */

import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

import type { EventTier } from './tiers';

/** Same test lib/auth.ts makes for the providers. Constant for the process lifetime. */
const IS_EXPO_GO = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

/**
 * True wherever there is no store to buy from.
 *
 * The SDK detects both cases itself and quietly falls back to "browser mode"
 * rather than throwing, so without this check a purchase would appear to be
 * attempted and then fail somewhere less obvious.
 */
export const PURCHASES_UNAVAILABLE = IS_EXPO_GO || Platform.OS === 'web';

/**
 * Backing out of the store sheet is not a failure — mirrors SignInCancelledError.
 * Screens catch this and return to idle silently.
 */
export class PurchaseCancelledError extends Error {
  constructor() {
    super('Purchase was cancelled');
    this.name = 'PurchaseCancelledError';
  }
}

export function isPurchaseCancelled(e: unknown): e is PurchaseCancelledError {
  return e instanceof PurchaseCancelledError;
}

type PurchasesModule = typeof import('react-native-purchases');

/**
 * Unlike `@react-native-google-signin`, this package reads
 * `NativeModules.RNPurchases` rather than calling
 * `TurboModuleRegistry.getEnforcing`, so importing it in Expo Go returns
 * undefined instead of throwing. The lazy require is kept anyway: it matches
 * `lib/auth.ts`, it survives the SDK changing that behaviour, and it keeps
 * native code off the app's boot path.
 */
function loadPurchases(): PurchasesModule {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('react-native-purchases') as PurchasesModule;
}

let configured = false;

function apiKey(): string {
  const isIos = Platform.OS === 'ios';
  const key = isIos
    ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY
    : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;

  if (!key) {
    throw new Error(
      `EXPO_PUBLIC_REVENUECAT_${isIos ? 'IOS' : 'ANDROID'}_API_KEY is not set — see docs/payments.md`
    );
  }
  return key;
}

/**
 * Configure once, anonymously.
 *
 * The real user id arrives later through `identify()`. Configuring is cheap and
 * happens on the first purchase path; there is no uid to bind at module load.
 */
function ensureConfigured(): PurchasesModule {
  if (PURCHASES_UNAVAILABLE) {
    throw new Error('In-app purchases need a development build — see docs/payments.md');
  }

  const mod = loadPurchases();
  if (configured) return mod;

  mod.default.configure({ apiKey: apiKey() });
  configured = true;
  return mod;
}

/**
 * Bind purchases to the Supabase user.
 *
 * Must run immediately after sign-in and *before* `purchaseTier()`, or the
 * receipt lands on an anonymous RevenueCat id and the webhook writes a ledger
 * row whose `user_id` matches nobody. RevenueCat aliases an anonymous id into
 * the identified one, so an earlier purchase is not lost — but we never make one
 * before this runs.
 */
export async function identify(userId: string): Promise<void> {
  const mod = ensureConfigured();
  await mod.default.logIn(userId);
}

/**
 * Called on sign-out so the next person on this device starts clean.
 *
 * Silent when purchases were never configured — signing out of a build that has
 * not bought anything is the common case, not an error.
 */
export async function forgetUser(): Promise<void> {
  if (!configured || PURCHASES_UNAVAILABLE) return;
  await loadPurchases().default.logOut();
}

/**
 * The store product for an event tier, carrying the store's own localised price.
 *
 * Throws when the store has no such product — which in practice means the SKU is
 * not approved yet, or the paid-apps agreement is not active, far more often than
 * it means a typo.
 *
 * **The free tier never reaches here.** 05.1 checks `isFreeGroup()` before it
 * charges anything, so every tier arriving is one somebody is buying — which is
 * why this throws on a missing product rather than returning null.
 */
export async function getTierProduct(tier: EventTier) {
  const mod = ensureConfigured();
  const products = await mod.default.getProducts(
    [tier.productId],
    mod.PRODUCT_CATEGORY.NON_SUBSCRIPTION
  );

  const product = products.find((p) => p.identifier === tier.productId);
  if (!product) {
    throw new Error(
      `${tier.productId} is not available in this store — check it is approved and the bundle id matches.`
    );
  }
  return product;
}

export type TierPurchase = {
  /** The store's id for this transaction — the ledger's idempotency key. */
  transactionId: string;
  productId: string;
};

/**
 * Charge for an event. Resolves only once the store has taken the money.
 *
 * The returned `transactionId` is a *lookup hint* for the server, not a claim of
 * payment: `create-event` uses it to ask RevenueCat directly about a purchase the
 * webhook has not delivered yet. It is never trusted on its own.
 */
export async function purchaseTier(tier: EventTier): Promise<TierPurchase> {
  const product = await getTierProduct(tier);

  const mod = ensureConfigured();

  try {
    const { customerInfo } = await mod.default.purchaseStoreProduct(product);

    /*
      Newest transaction for this product. RevenueCat lists every consumable the
      user has ever bought, so someone creating their fourth event has four
      entries here — taking the first would spend the wrong one.
    */
    const latest = customerInfo.nonSubscriptionTransactions
      .filter((t) => t.productIdentifier === tier.productId)
      .sort((a, b) => Date.parse(b.purchaseDate) - Date.parse(a.purchaseDate))[0];

    if (!latest) throw new Error('The purchase completed but returned no transaction.');

    return { transactionId: latest.transactionIdentifier, productId: latest.productIdentifier };
  } catch (e) {
    if ((e as { userCancelled?: boolean }).userCancelled) throw new PurchaseCancelledError();
    throw e;
  }
}

/**
 * Re-sync receipts after a reinstall or a failed hand-off.
 *
 * Restoring does not un-spend anything by itself — the ledger decides what is
 * still unconsumed. This only pushes the store's receipts back up to RevenueCat;
 * `restorePurchases()` in lib/events.ts is what then rebuilds our own rows.
 */
export async function restore(): Promise<void> {
  const mod = ensureConfigured();
  await mod.default.restorePurchases();
}
