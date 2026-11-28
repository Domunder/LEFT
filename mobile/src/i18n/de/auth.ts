import type { auth as source } from '../en/auth';
import type { Translation } from '../types';

export const auth: Translation<typeof source> = {
  working: 'Einen Moment…',
  createHeadline: 'Starte deinen eigenen\n*Moment.*',
  createBody: 'Als Gastgeber brauchst du ein Konto. Melde dich an, und alles, was du als Gast fotografiert hast, kommt mit.',
  keepHeadline: 'Dein Film ist\n*fertig.*',
  keepBody: 'Du warst als Gast dabei, deshalb liegt er nur auf diesem Telefon. Melde dich an, und er bleibt deiner.',
  keepPanelTitle: 'Behalte deine Momente',
  keepPanelBody: 'Du fotografierst als Gast. Melde dich an, damit deine Filme deine bleiben, falls du dieses Telefon verlierst.',
  dismiss: 'Schließen',
  nameHeadline: 'Wie sollen wir\ndich nennen?',
  nameBody: 'So sieht dich deine Gruppe.',
  nameLabel: 'Dein Name',
  deleteHeadline: 'Dein Konto *löschen?*',
  deleteEvents: 'Events, die du gestartet hast, werden für alle gelöscht, mit allen Fotos.',
  deletePhotos: 'Fotos, die du in anderen Events gemacht hast, bleiben, aber ohne Bezug zu dir.',
  deletePurchases: 'Käufe werden nicht erstattet.',
  deleting: 'Wird gelöscht…',
  deleteConfirm: 'Konto löschen',
  deleted: 'Dein Konto wurde gelöscht.',
  deleteFailed: 'Dein Konto konnte nicht gelöscht werden.',
  legalUpdated: 'Zuletzt aktualisiert am {date}',
  pushChannel: 'Deine Events',
};
