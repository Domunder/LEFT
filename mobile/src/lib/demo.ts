/**
 * The demo — "try LEFT" from the website (2026-11-23).
 *
 * `leftmoment.com/j/TRYLEFT` is not an invite: nobody is joined to anything.
 * `start_demo()` hands the caller a moment of their own — live, a roll of five,
 * a few sample guests already in it — and makes them its host, so "Develop
 * now" is the ordinary `end_event()`. The same door serves the web camera and
 * the App Clip (`web/src/shoot/api.ts`, `targets/clip/Server.swift`); the
 * server half is `supabase/migrations/20261123010000_demo.sql`.
 */

import { t } from '@/i18n';
import type { Event } from '@/lib/events';
import { getSupabase } from '@/lib/supabase';

export { DEMO_CODE, isDemoCode } from '@/lib/demo-code';

/** The server allows a handful of demos a day per user (`hint = 'demo_limit'`). */
export class DemoLimitError extends Error {
  constructor() {
    super(t('errors.demoLimit'));
    this.name = 'DemoLimitError';
  }
}

/**
 * The caller's demo: the one still running, the one they just developed, or a
 * new one. Needs a session — anonymous is enough.
 */
export async function startDemo(): Promise<Event> {
  const { data, error } = await getSupabase().rpc('start_demo', {});
  if (error) {
    if ((error as { hint?: string }).hint === 'demo_limit') throw new DemoLimitError();
    throw error;
  }
  return data as unknown as Event;
}
