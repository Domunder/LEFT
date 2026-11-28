/**
 * The seven event types offered on screen 02, in the design's display order.
 *
 * `value` must match the `public.event_type` enum in the database — see
 * supabase/migrations/20260818053120_init_schema.sql. Adding a type here without
 * adding it to the enum will fail at insert time.
 *
 * Only the Wedding placeholder ("Sam & Alex's Wedding") comes from the design; the
 * other six are authored in the same voice — a specific, personal-sounding name that
 * shows the user what kind of thing to write.
 *
 * Icons are Feather, which is what the rest of the app uses. Feather has no cake,
 * mortarboard or cocktail glyph, so a few are the nearest available match rather
 * than the prototype's custom SVGs.
 *
 * Labels and placeholders are translation keys, read with `t()` where they are
 * drawn: text built here, at import time, would keep the language the app
 * started in.
 */

import type { Feather } from '@expo/vector-icons';

import { t, type TKey } from '@/i18n';
import type { EventType } from '@/lib/events';

export type EventTypeOption = {
  value: EventType;
  labelKey: TKey;
  icon: React.ComponentProps<typeof Feather>['name'];
  /** Pre-filled placeholder for the "Name your film" field. */
  placeholderKey: TKey;
};

export const EVENT_TYPES: readonly EventTypeOption[] = [
  { value: 'wedding', labelKey: 'onboarding.typeWedding', icon: 'heart', placeholderKey: 'onboarding.placeholderWedding' },
  { value: 'birthday', labelKey: 'onboarding.typeBirthday', icon: 'gift', placeholderKey: 'onboarding.placeholderBirthday' },
  { value: 'trip', labelKey: 'onboarding.typeTrip', icon: 'send', placeholderKey: 'onboarding.placeholderTrip' },
  { value: 'party', labelKey: 'onboarding.typeParty', icon: 'music', placeholderKey: 'onboarding.placeholderParty' },
  { value: 'company', labelKey: 'onboarding.typeCompany', icon: 'briefcase', placeholderKey: 'onboarding.placeholderCompany' },
  { value: 'graduation', labelKey: 'onboarding.typeGraduation', icon: 'award', placeholderKey: 'onboarding.placeholderGraduation' },
  { value: 'other', labelKey: 'onboarding.typeOther', icon: 'circle', placeholderKey: 'onboarding.placeholderOther' },
] as const;

/** The placeholder for a type, or a neutral fallback when nothing is picked yet. */
export function placeholderFor(type: EventType | undefined): string {
  return t(EVENT_TYPES.find((option) => option.value === type)?.placeholderKey ?? 'onboarding.placeholderOther');
}
