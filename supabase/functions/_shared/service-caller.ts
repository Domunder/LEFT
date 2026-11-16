/**
 * "Was this request made with the project's service-role key?"
 *
 * The scheduled functions (`send-notifications`, `purge-expired-events`) are
 * woken by Postgres with the service-role JWT from Vault. Comparing that JWT
 * to `SUPABASE_SERVICE_ROLE_KEY` as a string is not enough on the hosted
 * platform: the key in the function's environment and the one the dashboard
 * and the API hand out are two different tokens for the same role (seen
 * 2026-11-16 — every wake-up was answered 401), so the comparison only ever
 * held on the local stack.
 *
 * So: an exact match passes, and otherwise the token's `role` claim decides.
 * **That is only sound because these functions keep `verify_jwt = true`**
 * (supabase/config.toml): the gateway has verified the signature before the
 * request gets here, so the claim can be trusted. Never use this in a function
 * that turns the gate off.
 */
export function isServiceCaller(req: Request): boolean {
  const header = req.headers.get('Authorization') ?? '';
  if (!header.startsWith('Bearer ')) return false;
  const token = header.slice('Bearer '.length);

  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (serviceKey && token === serviceKey) return true;

  try {
    const payload = token.split('.')[1];
    if (!payload) return false;

    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const claims = JSON.parse(atob(padded)) as { role?: unknown };

    return claims.role === 'service_role';
  } catch {
    return false;
  }
}
