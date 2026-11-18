/**
 * Expo's push service, and the words LEFT sends through it.
 *
 * Kept free of Deno and Supabase so it can be read (and run) on its own: the
 * copy, the batching and the reading of Expo's answer are the parts worth
 * getting right, and none of them needs a database.
 */

export type NotificationKind = 'developed' | 'ending_soon';

export type Recipient = {
  token: string;
  /** Frames left on this guest's roll; null on an unlimited roll. */
  shots_left: number | null;
};

export type PushMessage = {
  to: string;
  title: string;
  body: string;
  sound: 'default';
  channelId: string;
  /** Read by the app when the notification is tapped — see lib/push.ts. */
  data: { eventId: string; kind: NotificationKind };
};

/** Expo accepts at most 100 messages per request. */
export const EXPO_BATCH = 100;

export const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/** Must match the channel the app creates on Android (lib/push.ts). */
export const ANDROID_CHANNEL = 'default';

/**
 * The words. The event's name is the title, so the body never has to repeat it
 * and a phone with three events can tell them apart at a glance.
 */
export function bodyFor(kind: NotificationKind, shotsLeft: number | null): string {
  if (kind === 'developed') {
    return 'Your photos are developed. Open the album.';
  }

  if (shotsLeft === null) return 'Ends in about an hour. Last chance to take a few more.';
  if (shotsLeft === 1) return 'Ends in about an hour. You have 1 photo left.';
  return `Ends in about an hour. You have ${shotsLeft} photos left.`;
}

export function buildMessages(
  kind: NotificationKind,
  eventId: string,
  eventName: string,
  recipients: Recipient[]
): PushMessage[] {
  return recipients.map((recipient) => ({
    to: recipient.token,
    title: eventName,
    body: bodyFor(kind, recipient.shots_left),
    sound: 'default',
    channelId: ANDROID_CHANNEL,
    data: { eventId, kind },
  }));
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

type Ticket =
  | { status: 'ok'; id?: string }
  | { status: 'error'; message?: string; details?: { error?: string } };

/**
 * What one batch came to.
 *
 * `dead` are tokens Expo says no longer belong to an installed app
 * (`DeviceNotRegistered`); they are deleted so the next event does not pay for
 * them. Every other per-message error is counted and logged, not retried — a
 * malformed token will not get better.
 */
export function readTickets(
  messages: PushMessage[],
  response: unknown
): { accepted: number; failed: number; dead: string[] } {
  const tickets: Ticket[] = Array.isArray((response as { data?: unknown })?.data)
    ? ((response as { data: Ticket[] }).data)
    : [];

  let accepted = 0;
  let failed = 0;
  const dead: string[] = [];

  messages.forEach((message, i) => {
    const ticket = tickets[i];
    if (ticket?.status === 'ok') {
      accepted += 1;
      return;
    }

    failed += 1;
    if (ticket?.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
      dead.push(message.to);
    }
  });

  return { accepted, failed, dead };
}
