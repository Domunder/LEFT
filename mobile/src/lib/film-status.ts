/**
 * What an event card says, and where tapping it goes.
 *
 * One module so the badge and the tap target cannot disagree — the same "single
 * shared answer" call `isCritical()` in live-budget-bar.tsx makes for screen 13's
 * threshold.
 *
 * **This reads five states where the artboard draws two.** 16's cards show only
 * "1d 23m left" and "Completed", which works for the two events it happens to
 * draw and is wrong for the rest: an event still in `setup` has not completed,
 * and one still gathering its clips is neither. There is also a fifth case the status column
 * cannot express — `ends_at` passing while the event is still `live`. Nothing
 * closes that window today (`finish_event()` refuses while budget remains, so a
 * client cannot cut a group short), which leaves a real event whose countdown
 * would otherwise sit at "00m 00s left" indefinitely. It reads "Ended" instead.
 */

import { countdownParts, hasEnded } from './event-end';
import type { Event } from './events';

/** The route a card opens, matching where that event's flow actually continues. */
export type FilmDestination =
  | { pathname: '/(host)/invite'; params: { eventId: string } }
  | { pathname: '/(guest)/waiting'; params: { eventId: string } }
  | { pathname: '/(capture)/camera'; params: { eventId: string } }
  | { pathname: '/(capture)/processing'; params: { eventId: string } }
  | { pathname: '/(library)/clip/[id]'; params: { id: string } };

/**
 * The card's right-hand badge.
 *
 * `live` is the only one that changes on its own, which is what tells the screen
 * whether it needs to tick at all.
 */
export function statusLabel(event: Event, now: Date = new Date()): string {
  switch (event.status) {
    case 'setup':
      return 'Not started';
    case 'live': {
      const endsAt = new Date(event.ends_at);
      if (hasEnded(endsAt, now)) return 'Ended';
      const [first, second] = countdownParts(endsAt, now);
      return `${first.value}${first.unit} ${second.value}${second.unit} left`;
    }
    case 'processing':
      return 'Creating film…';
    case 'ready':
      return 'Completed';
  }
}

/** Whether this card's badge counts down, and so needs a ticking clock. */
export function isTicking(event: Event, now: Date = new Date()): boolean {
  return event.status === 'live' && !hasEnded(new Date(event.ends_at), now);
}

/** Under an hour left, `countdownParts` steps down to minutes and seconds. */
const SHOWS_SECONDS_WITHIN_MS = 3_600_000;

/**
 * How often the list has to re-render to keep its badges honest.
 *
 * The badge's smallest unit is not fixed: `countdownParts` steps down from d/h to
 * h/m to m/s as the deadline nears, so a card in its final hour is showing
 * seconds and a once-a-minute tick would leave it visibly stale. Returns null
 * when nothing is counting down at all — a library of finished films should not
 * be waking the screen to re-render the identical thing.
 */
export function tickIntervalMs(events: Event[], now: Date = new Date()): number | null {
  const live = events.filter((event) => isTicking(event, now));
  if (live.length === 0) return null;

  const soonest = Math.min(
    ...live.map((event) => new Date(event.ends_at).getTime() - now.getTime())
  );
  return soonest < SHOWS_SECONDS_WITHIN_MS ? 1_000 : 60_000;
}

/**
 * Where a tap goes.
 *
 * The artboard treats every card the same, but the library is the app's home
 * screen for a returning user — the root layout replaces onto it — so a card is
 * the way back into whatever that event is currently doing. Sending a live event
 * to the clip detail would land on a screen with nothing to show.
 *
 * A setup event splits on role: the host still owes their group an invite, while
 * a guest can only wait for them to start.
 */
export function destinationFor(event: Event, userId: string | undefined): FilmDestination {
  switch (event.status) {
    case 'setup':
      return event.host_id === userId
        ? { pathname: '/(host)/invite', params: { eventId: event.id } }
        : { pathname: '/(guest)/waiting', params: { eventId: event.id } };
    case 'live':
      return { pathname: '/(capture)/camera', params: { eventId: event.id } };
    case 'processing':
      return { pathname: '/(capture)/processing', params: { eventId: event.id } };
    case 'ready':
      /*
        The param is named `id` and carries an **event** id, not a clip id. 17 is
        the destination for a finished event and there is no single film object to
        have an id of its own — so the route's name is a misnomer, kept because
        renaming it would churn this union, its exported type and the generated
        typed-route surface for nothing a user could see. 17's own header says
        the same thing from the other end.
      */
      return { pathname: '/(library)/clip/[id]', params: { id: event.id } };
  }
}

/** "5 people" / "1 person" — the card's left-hand badge. */
export function memberLabel(count: number): string {
  return `${count} ${count === 1 ? 'person' : 'people'}`;
}
