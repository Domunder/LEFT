import type { landing as source } from '../en/landing';
import type { Translation } from '../types';

export const landing: Translation<typeof source> = {
  headline: 'Plus qu’un seul\n*moment ?*',
  subcopy: 'Des photos limitées. Pas de coup d’œil.\nDéveloppées ensemble à la fin.',
  joinGroup: 'Rejoindre un groupe',
  finePrint: 'En continuant, tu acceptes nos *Conditions* et notre *Politique de confidentialité*',

  // 1.3.0 · the showcase in the phone
  showcaseName: 'Samedi soir',
  showcaseDeveloping: 'Développement dans',
  showcaseDeveloped: 'Développée',
  showcaseA11y: 'LEFT sur un téléphone : l’appareil décompte une pellicule, elle se développe, et toutes les photos apparaissent ensemble.',
};
