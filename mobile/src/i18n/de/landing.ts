import type { landing as source } from '../en/landing';
import type { Translation } from '../types';

export const landing: Translation<typeof source> = {
  headline: 'Nur noch ein\n*Moment übrig?*',
  subcopy: 'Begrenzte Fotos für alle. Kein Spicken.\nAm Ende gemeinsam entwickelt.',
  joinGroup: 'Gruppe beitreten',
  finePrint: 'Wenn du fortfährst, stimmst du unseren *Nutzungsbedingungen* und der *Datenschutzerklärung* zu',

  // 1.3.0 · the showcase in the phone
  showcaseName: 'Samstagabend',
  showcaseDeveloping: 'Entwicklung in',
  showcaseDeveloped: 'Entwickelt',
  showcaseA11y: 'LEFT auf einem Telefon: die Kamera zählt einen Film herunter, der Film wird entwickelt, und alle Fotos erscheinen gemeinsam.',
};
