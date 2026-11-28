import type { auth as source } from '../en/auth';
import type { Translation } from '../types';

export const auth: Translation<typeof source> = {
  working: 'Un attimo…',
  createHeadline: 'Crea il tuo\n*momento.*',
  createBody: 'Per organizzare serve un account. Accedi e tutto ciò che hai scattato come ospite viene con te.',
  keepHeadline: 'Il tuo rullino è\n*pronto.*',
  keepBody: 'Hai partecipato come ospite, quindi esiste solo su questo telefono. Accedi e resterà tuo.',
  keepPanelTitle: 'Conserva i tuoi momenti',
  keepPanelBody: 'Stai scattando come ospite. Accedi per conservare i tuoi rullini se perdi questo telefono.',
  dismiss: 'Chiudi',
  nameHeadline: 'Come ti\nchiamiamo?',
  nameBody: 'Così ti vedrà il tuo gruppo.',
  nameLabel: 'Il tuo nome',
  deleteHeadline: 'Eliminare il tuo *account?*',
  deleteEvents: 'Gli eventi che hai creato vengono eliminati per tutti, con tutte le foto.',
  deletePhotos: 'Le foto che hai scattato in altri eventi restano, ma senza legame con te.',
  deletePurchases: 'Gli acquisti non vengono rimborsati.',
  deleting: 'Eliminazione…',
  deleteConfirm: 'Elimina account',
  deleted: 'Il tuo account è stato eliminato.',
  deleteFailed: 'Impossibile eliminare il tuo account.',
  legalUpdated: 'Ultimo aggiornamento: {date}',
  pushChannel: 'I tuoi eventi',
};
