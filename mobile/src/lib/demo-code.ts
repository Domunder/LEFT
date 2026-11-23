/**
 * The demo's reserved code, on its own so `+native-intent.ts` — which runs
 * before anything else — can ask about it without importing the Supabase
 * client. The rest of the demo is `lib/demo.ts`.
 */

/** It has the shape of an invite code and never is one. */
export const DEMO_CODE = 'TRYLEFT';

export function isDemoCode(code: string | null | undefined): boolean {
  return (code ?? '').trim().toUpperCase() === DEMO_CODE;
}
