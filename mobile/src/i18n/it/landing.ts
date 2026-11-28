import type { landing as source } from '../en/landing';
import type { Translation } from '../types';

export const landing: Translation<typeof source> = {
  headline: 'Resta solo\n*un momento?*',
  subcopy: 'Foto limitate per tutti. Niente sbirciatine.\nSviluppate insieme alla fine.',
  joinGroup: 'Unisciti a un gruppo',
  finePrint: 'Continuando accetti i nostri *Termini* e l’*Informativa sulla privacy*',

  // 1.3.0 · the showcase in the phone
  showcaseName: 'Sabato sera',
  showcaseDeveloping: 'Sviluppo tra',
  showcaseDeveloped: 'Sviluppato',
  showcaseA11y: 'LEFT su un telefono: la fotocamera consuma un rullino, il rullino si sviluppa e tutte le foto compaiono insieme.',
};
