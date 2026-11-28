/**
 * `em()` — a translated headline with its italic run.
 *
 * LEFT's headlines carry one emphasised phrase ("What are you *capturing?*").
 * Where it falls differs per language, so the translation marks it with
 * asterisks and this turns the marked runs into `<Em>`:
 *
 *   <Display size="xl">{em(t('onboarding.eventHeadline'))}</Display>
 *
 * A line break is a real `\n` in the string. Text without asterisks comes back
 * as it is.
 */

import type { ReactNode } from 'react';

import { Em } from './typography';

export function em(text: string): ReactNode {
  const parts = text.split('*');
  if (parts.length === 1) return text;
  // Odd indexes sit between a pair of asterisks.
  return parts.map((part, index) => (index % 2 === 1 ? <Em key={index}>{part}</Em> : part));
}
