/**
 * The app's languages (1.3.0): English, German, French, Spanish, Italian.
 *
 * **App only.** The web camera, the App Clip, push notifications, the mission
 * library the server hands out and the legal texts are English.
 *
 * How it works:
 *
 *  - `en/` is the source of truth, one file per namespace. Every other
 *    language is typed against it (`Translation<typeof source>`), so a missing
 *    or misspelt key is a type error, not a blank label.
 *  - `t('settings.title')` reads the active language; `{name}` in a string is
 *    filled from the params, and a `{ one, other }` entry is chosen by
 *    `count`.
 *  - The language follows the phone unless the user picked one in Settings
 *    (kept in AsyncStorage). The device language comes from `Intl`, so no
 *    native module is needed.
 *  - **Changing the language remounts the app's tree** (the root layout keys
 *    its Stack on `useLanguage()`). That is what lets every file call the
 *    plain `t()` without subscribing — and it is why **no translated string
 *    may be computed at module scope**: a constant built at import time keeps
 *    the language the app started in. Call `t()` inside components and
 *    functions.
 *  - Dates and numbers go through `locale()`, never `undefined` or 'en-US'.
 *
 * Emphasis in headlines is written `*like this*` in the string and drawn by
 * `em()` (components/ui/rich.tsx); a line break is a real `\n`.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

import { de } from './de';
import { en } from './en';
import { es } from './es';
import { fr } from './fr';
import { it } from './it';
import type { Plural } from './types';

export const LANGUAGES = ['en', 'de', 'fr', 'es', 'it'] as const;
export type Language = (typeof LANGUAGES)[number];

/** Each language in its own words — never translated. */
export const LANGUAGE_NAMES: Record<Language, string> = {
  en: 'English',
  de: 'Deutsch',
  fr: 'Français',
  es: 'Español',
  it: 'Italiano',
};

type Dictionary = typeof en;

export type TKey = {
  [NS in keyof Dictionary]: `${NS & string}.${keyof Dictionary[NS] & string}`;
}[keyof Dictionary];

type Params = Record<string, string | number>;

const DICTIONARIES: Record<Language, Record<string, Record<string, string | Plural>>> = {
  en,
  de,
  fr,
  es,
  it,
};

const STORAGE_KEY = 'left:language';

function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value);
}

/** The phone's own locale tag ("de-CH"), or 'en' where the engine cannot say. */
function deviceTag(): string {
  try {
    return new Intl.DateTimeFormat().resolvedOptions().locale || 'en';
  } catch {
    return 'en';
  }
}

function deviceLanguage(): Language {
  const code = deviceTag().slice(0, 2).toLowerCase();
  return isLanguage(code) ? code : 'en';
}

/** What the user picked in Settings; null follows the phone. */
let choice: Language | null = null;
let active: Language = deviceLanguage();

const listeners = new Set<() => void>();

/** Read the saved choice. Awaited by the root layout before anything renders. */
export async function initLanguage(): Promise<void> {
  try {
    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    choice = isLanguage(saved) ? saved : null;
  } catch {
    choice = null;
  }
  active = choice ?? deviceLanguage();
}

/** Pick a language, or pass null to follow the phone again. */
export function setLanguage(next: Language | null): void {
  choice = next;
  const resolved = next ?? deviceLanguage();
  // Best effort: a failed write costs the choice on the next launch, not now.
  void (next ? AsyncStorage.setItem(STORAGE_KEY, next) : AsyncStorage.removeItem(STORAGE_KEY)).catch(
    () => undefined
  );
  if (resolved === active) return;
  active = resolved;
  listeners.forEach((listener) => listener());
}

export function getLanguage(): Language {
  return active;
}

export function getLanguageChoice(): Language | null {
  return choice;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The active language, re-rendering on change. Only the root layout needs it. */
export function useLanguage(): Language {
  return useSyncExternalStore(subscribe, getLanguage, getLanguage);
}

/**
 * The tag for `Intl` and `toLocale…`: the phone's full locale while the app
 * speaks the phone's language (so "de-CH" keeps its formats), the bare
 * language once the user picked another.
 */
export function locale(): string {
  const tag = deviceTag();
  return tag.slice(0, 2).toLowerCase() === active ? tag : active;
}

/** French counts 0 and 1 as singular; the other four only 1. */
function pluralForm(count: number): keyof Plural {
  if (active === 'fr') return count >= 0 && count < 2 ? 'one' : 'other';
  return count === 1 ? 'one' : 'other';
}

export function t(key: TKey, params?: Params): string {
  const dot = key.indexOf('.');
  const namespace = key.slice(0, dot);
  const name = key.slice(dot + 1);

  // English is the floor: a hole in a translation shows English, never a key.
  const entry = DICTIONARIES[active][namespace]?.[name] ?? DICTIONARIES.en[namespace]?.[name];
  if (entry === undefined) return key;

  const text =
    typeof entry === 'string' ? entry : entry[pluralForm(Number(params?.count ?? 0))];

  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (match, param: string) =>
    param in params ? String(params[param]) : match
  );
}
