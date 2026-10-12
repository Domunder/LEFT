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
 */

import type { Feather } from '@expo/vector-icons';

import type { EventType } from '@/lib/events';

export type EventTypeOption = {
  value: EventType;
  label: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  /** Pre-filled placeholder for the "Name your film" field. */
  placeholder: string;
};

export const EVENT_TYPES: readonly EventTypeOption[] = [
  { value: 'wedding', label: 'Wedding', icon: 'heart', placeholder: "Sam & Alex's Wedding" },
  { value: 'birthday', label: 'Birthday', icon: 'gift', placeholder: "Maya's 30th" },
  { value: 'trip', label: 'Trip', icon: 'send', placeholder: 'Lisbon 2026' },
  { value: 'party', label: 'Party', icon: 'music', placeholder: "New Year's Eve" },
  { value: 'company', label: 'Company Event', icon: 'briefcase', placeholder: 'Summer Offsite' },
  { value: 'graduation', label: 'Graduation', icon: 'award', placeholder: 'Class of 2026' },
  { value: 'other', label: 'Other', icon: 'circle', placeholder: 'Our Film' },
] as const;

/** The placeholder for a type, or a neutral fallback when nothing is picked yet. */
export function placeholderFor(type: EventType | undefined): string {
  return EVENT_TYPES.find((t) => t.value === type)?.placeholder ?? 'Our Film';
}
