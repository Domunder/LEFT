import type { host as source } from '../en/host';
import type { Translation } from '../types';

export const host: Translation<typeof source> = {
  closeToCamera: 'Chiudi, torna alla fotocamera',
  closeToGroup: 'Chiudi, torna al tuo gruppo',
  closeToMoments: 'Chiudi, torna ai tuoi momenti',
  inviteHeadline: 'Invita il tuo gruppo.\n*Falli entrare.*',
  inviteSubWaiting:
    'Mostra il QR o invia il link —\npossono unirsi prima dell’inizio, o durante.',
  inviteSubCamera: 'Mostra il QR o invia il link —\npossono unirsi mentre il rullino è in corso.',
  inviteSubHost:
    'Mostra il QR o invia il link —\nappena sono dentro, le fotocamere possono aprirsi.',
  shareLink: 'Invia il link',
  saveQr: 'Salva QR',
  savePermission: 'Consenti l’accesso alle foto in Impostazioni per salvare il codice.',
  saved: 'Salvato nelle tue foto.',
  saveFailed: 'Impossibile salvare il codice.',
  signInForInvite: 'Accedi per vedere l’invito di questo evento.',
  seeWhoJoined: 'Vedi chi si è unito',
  inviteMessage:
    'Unisciti a "{name}" su LEFT — un numero limitato di foto a testa, sviluppate insieme alla fine.\n\n{url}\n\nCodice: {code}',

  showQr: 'Mostra il codice QR dell’invito',
  groupEyebrow: 'Il tuo gruppo',
  groupHeadline: {
    one: '*{count}*/{capacity} persone\nsi è unita.',
    other: '*{count}*/{capacity} persone\nsi sono unite.',
  },
  loadingGroup: 'Carico il tuo gruppo…',
  groupLoadFailed: 'Impossibile caricare il tuo gruppo.\nControlla la connessione e riprova.',
  waitingForMembers: 'In attesa degli ospiti…',
  groupFull: 'Il gruppo è al completo',
  spotsLeft: { one: '{count} posto libero', other: '{count} posti liberi' },
  alreadyEnded: 'Questo evento è già finito.',
  startFailed: 'Impossibile avviare l’evento. Controlla la connessione e riprova.',
  startTitle: 'Avviare l’evento?',
  startBody: 'Da ora tutti possono scattare foto. Non si può annullare.',
  startBodyMissions:
    'Da ora tutti possono scattare foto. Le missioni vengono distribuite e non si possono più cambiare, e gli ospiti non possono più cambiare nome.',
  notYet: 'Non ancora',
  start: 'Avvia',
  starting: 'Avvio…',
  startEvent: 'Avvia l’evento',

  coverFailed: 'Impossibile cambiare l’immagine',
  coverHeadline: 'Il tuo *invito.*',
  coverBody: 'Ecco cosa vedono i tuoi ospiti quando aprono il link.',
  momentLoadFailed: 'Impossibile caricare questo momento.',
  saving: 'Salvataggio…',

  purchaseUnsettled: 'Il tuo acquisto non è ancora stato confermato',
  eventNotCreated: 'L’evento non è stato creato',
  momentDeleted: 'Questo momento è stato eliminato.',
  nameLength: 'Un nome ha da 1 a {max} caratteri.',
  onlyHostRename: 'Solo l’organizzatore può rinominare questo momento.',
  onlyHostDelete: 'Solo l’organizzatore può eliminare questo momento.',

  // 1.3.0 · event settings
  settingsTitle: 'Impostazioni dell’evento',
  settingsName: 'Nome',
  settingsEnds: 'Finisce',
  settingsEndOver: 'L’evento è finito.',
  settingsEndMinusHour: '1 ora prima',
  settingsEndPlusHour: '1 ora dopo',
  settingsEndPlusDay: '1 giorno dopo',
  settingsReveal: 'Foto visibili',
  settingsRevealFixed: 'Fissato da quando l’evento è iniziato.',
  settingsInvitation: 'Immagine dell’invito',

  // 1.3.0 · the guest book switch
  settingsGuestbook: 'Libro degli ospiti',
};
