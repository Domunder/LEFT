import type { landing as source } from '../en/landing';
import type { Translation } from '../types';

export const landing: Translation<typeof source> = {
  headline: '¿Solo queda\n*un momento?*',
  subcopy: 'Fotos limitadas para cada uno. Sin espiar.\nReveladas juntas al terminar.',
  joinGroup: 'Unirse a un grupo',
  finePrint: 'Al continuar aceptas nuestros *Términos* y la *Política de privacidad*',

  // 1.3.0 · the showcase in the phone
  showcaseName: 'Sábado noche',
  showcaseDeveloping: 'Revelado en',
  showcaseDeveloped: 'Revelado',
  showcaseA11y: 'LEFT en un teléfono: la cámara va gastando un carrete, se revela, y todas las fotos aparecen a la vez.',
};
