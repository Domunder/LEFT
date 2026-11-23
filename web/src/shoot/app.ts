/**
 * The web camera, screen by screen: join → (intro) → (waiting) → camera →
 * developing (the gallery before the reveal) → album. The intro is shown once per moment and browser, as the
 * app's `(guest)/intro` is once per moment and phone. The page's markup is `src/pages/j/index.astro`; this file switches
 * `data-view` and fills it.
 *
 * Every number shown comes from the server (`api.ts`): the roll is
 * `rollSize − shots_taken` minus the frames still waiting in the queue to be
 * claimed, floored at zero — as `useCameraSession` counts it in the app.
 */

import { decode } from 'blurhash';

import {
  claimName,
  currentUserId,
  deletePhoto,
  ensureGuest,
  eventCoverUrl,
  eventGallery,
  LOOK_SAMPLE,
  samplesFor,
  getEvent,
  getMyMember,
  getMyMissions,
  isConfigured,
  isDeveloped,
  joinEvent,
  listMembers,
  listPhotoMissions,
  listPhotos,
  listUnclaimedNames,
  MAX_NAME_LENGTH,
  messageFor,
  MissionNameTakenError,
  reportPhoto,
  setPhotoMission,
  signedUrls,
  type Event,
  type GalleryPhoto,
  type Mission,
  type MissionName,
  type Photo,
} from './api';
import { BrowserCamera, CameraError, type CameraFailure } from './camera';
import { develop, LookRenderer, lookStill } from './look-gl';
import { drain, enqueue, onQueue, pending, setQueuedMission, startQueue, type Shot } from './queue';

type View = 'loading' | 'get-app' | 'join' | 'intro' | 'waiting' | 'camera' | 'developing' | 'album' | 'error';

/**
 * Loose on purpose: the server decides whether a code exists. (The app's
 * alphabet has no I, O, 0 or 1, but the seed's `DEV123` and old codes must open.)
 */
const CODE_SHAPE = /^[A-Z0-9]{4,12}$/;

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const root = () => document.querySelector<HTMLElement>('.shoot')!;
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

const store = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* private mode: the session still works for this visit */
    }
  },
};

const state = {
  code: '',
  userId: '',
  event: null as Event | null,
  serverLeft: null as number | null,
  queued: 0,
  poll: null as ReturnType<typeof setInterval> | null,
  tick: null as ReturnType<typeof setInterval> | null,
  /** The guest's missions, with the queue's not-yet-sent tags applied. */
  missions: [] as Mission[],
  /** The mission the next shot is for. */
  armedId: null as string | null,
  /** Which mission each photo is for, as text — the viewer's caption. */
  captions: new Map<string, string>(),
};

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------

function show(view: View) {
  const el = root();
  if (el.dataset.view === view) return;
  el.dataset.view = view;
  if (view !== 'camera') stopCamera();
  window.scrollTo(0, 0);
}

function bindEventName(name: string) {
  document.querySelectorAll<HTMLElement>('[data-bind="event-name"]').forEach((el) => (el.textContent = name));
  document.title = `${name} — LEFT`;
}

function fail(title: string, text: string, retry?: () => void) {
  $('error-title').innerHTML = title;
  $('error-text').textContent = text;
  const button = $('error-retry');
  button.hidden = !retry;
  button.onclick = retry ? () => retry() : null;
  show('error');
}

let toastTimer: ReturnType<typeof setTimeout> | null = null;
function toast(text: string) {
  const el = $('toast');
  el.textContent = text;
  el.classList.add('in');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('in'), 2600);
}

function haptic(pattern: number | number[]) {
  // Android only; iOS browsers have no vibration API.
  navigator.vibrate?.(pattern);
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

export async function start() {
  const fromPath = location.pathname.match(/^\/j\/([^/?#]+)/i);
  const raw = (fromPath ? decodeURIComponent(fromPath[1]) : new URLSearchParams(location.search).get('c')) ?? '';
  state.code = raw.trim().toUpperCase();

  // iOS Safari only applies :active (the press-in) when a touch listener exists.
  document.addEventListener('touchstart', () => undefined, { passive: true });

  if (!CODE_SHAPE.test(state.code)) {
    return fail('This link is <em>incomplete.</em>', 'The invite code is missing. Scan the QR code again or ask the host for the link.');
  }
  if (!isConfigured()) {
    return fail('The camera is <em>not ready.</em>', 'Shooting in the browser is not switched on for this site yet.');
  }

  setUpGetApp();
  setUpJoin();
  setUpCamera();
  setUpDeveloping();
  setUpViewer();
  setUpIntro();
  setUpWaiting();

  try {
    const userId = await currentUserId();
    const known = store.get(`left:web:event:${state.code}`);
    if (userId && known) {
      const member = await getMyMember(known, userId);
      if (member) {
        state.userId = userId;
        return enter(known);
      }
    }
  } catch {
    /* fall through to the join form */
  }
  // The app first; the browser only on request. A guest who already joined
  // here went straight back in above.
  show('get-app');
}

function openJoin() {
  show('join');
  showJoin();
  $<HTMLInputElement>('join-name').focus({ preventScroll: true });
}

function setUpGetApp() {
  $('use-browser').addEventListener('click', openJoin);
  $('back-to-app').addEventListener('click', () => show('get-app'));
}

let showJoin = () => undefined as void;

// ---------------------------------------------------------------------------
// Join
// ---------------------------------------------------------------------------

function setUpJoin() {
  const form = $<HTMLFormElement>('join-form');
  const input = $<HTMLInputElement>('join-name');
  const submit = $<HTMLButtonElement>('join-submit');
  const error = $('join-error');

  input.maxLength = MAX_NAME_LENGTH;
  input.value = store.get('left:web:name') ?? '';
  const sync = () => (submit.disabled = input.value.trim().length === 0);
  input.addEventListener('input', sync);
  sync();

  // Missions: a name the host listed ("Tom") for personal missions. Reading the
  // list needs a session, so the anonymous sign-in starts as the form shows.
  // Nothing about joining depends on it: no list, no section.
  let chosen: MissionName | null = null;
  let joined: { eventId: string; name: string } | null = null;
  const fieldset = $('join-names');
  const chips = $('join-name-chips');

  const renderNames = (names: MissionName[]) => {
    fieldset.hidden = names.length === 0;
    const option = (label: string, person: MissionName | null) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip press';
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String((chosen?.id ?? null) === (person?.id ?? null)));
      b.textContent = label;
      b.addEventListener('click', () => {
        // Over an empty field or the previous chip's name only — never over what the guest typed.
        const typed = input.value.trim();
        if (person && (typed === '' || (chosen && typed === chosen.name))) input.value = person.name;
        chosen = person;
        error.textContent = '';
        sync();
        renderNames(names);
      });
      return b;
    };
    chips.replaceChildren(...names.map((n) => option(n.name, n)), option('None of these', null));
    chips.setAttribute('role', 'radiogroup');
  };
  const loadNames = async () => {
    try {
      await ensureGuest();
      renderNames(await listUnclaimedNames(state.code));
    } catch {
      renderNames([]);
    }
  };
  showJoin = () => void loadNames();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = input.value.trim();
    if (!name || submit.disabled) return;

    submit.disabled = true;
    submit.textContent = 'Joining…';
    error.textContent = '';
    let eventId = joined?.name === name ? joined.eventId : null;
    try {
      if (!eventId) {
        state.userId = await ensureGuest();
        eventId = await joinEvent(state.code, name);
        joined = { eventId, name };
        store.set(`left:web:event:${state.code}`, eventId);
        store.set('left:web:name', name);
      }
    } catch (err) {
      error.textContent = messageFor(err);
      submit.textContent = 'Start shooting';
      sync();
      return;
    }

    if (chosen) {
      try {
        await claimName(eventId, chosen.id);
      } catch (err) {
        if (err instanceof MissionNameTakenError) {
          // Still a member. Show who is left; choose again or continue without.
          chosen = null;
          error.textContent = 'Someone already picked that name. Choose another, or continue without.';
          await loadNames();
          submit.textContent = 'Start shooting';
          sync();
          return;
        }
        // Already dealt, or anything else: never in the way of joining.
      }
    }
    await enter(eventId);
  });
}

// ---------------------------------------------------------------------------
// Routing between the event's states
// ---------------------------------------------------------------------------

let listening: (() => void) | null = null;

async function enter(eventId: string) {
  show('loading');
  try {
    state.event = await getEvent(eventId);
  } catch (e) {
    return fail('Couldn’t <em>open the film.</em>', messageFor(e), () => void enter(eventId));
  }
  bindEventName(state.event.name);
  startQueue();
  if (!listening) listening = onQueue((change) => {
    if (change.kind === 'dropped' && change.reason === 'roll_empty') toast('Your roll was already used up.');
    if (change.kind === 'dropped' && change.reason === 'event_closed') toast('The film was developed before that photo was sent.');
    if (change.kind === 'mission' || change.kind === 'done') void loadMissions();
    if (change.kind !== 'mission') void refreshRoll();
    if ((change.kind === 'done' || change.kind === 'dropped') && root().dataset.view === 'developing') void loadGallery();
  });

  if (state.poll) clearInterval(state.poll);
  // No realtime here: a light poll is enough to notice the host starting or
  // developing early. The clock is checked every second by the countdown.
  state.poll = setInterval(() => void refreshEvent(), 15_000);
  if (!isDeveloped(state.event) && store.get(introKey(state.event.id)) !== '1') return showIntro();
  await route();
}

async function refreshEvent() {
  if (!state.event || document.visibilityState !== 'visible') return;
  try {
    const next = await getEvent(state.event.id);
    const changed = next.status !== state.event.status || next.ends_at !== state.event.ends_at;
    state.event = next;
    // The intro is not interrupted; it continues to the right screen when it ends.
    if (changed && root().dataset.view !== 'intro') await route();
    else if (root().dataset.view === 'camera') void loadMissions();
    else if (root().dataset.view === 'developing') {
      await refreshRoll();
      renderDevActions();
      void loadGallery();
    }
  } catch {
    /* offline: try again on the next tick */
  }
}

async function route() {
  const event = state.event!;
  if (isDeveloped(event)) {
    if (state.poll) clearInterval(state.poll);
    return showAlbum();
  }
  if (event.status === 'setup') return showWaiting();

  await refreshRoll();
  if (shotsLeft() === 0) return showDeveloping(true);
  return showCamera();
}

/** What the counter shows: the server's last word minus frames not yet claimed. */
function shotsLeft(): number | null {
  if (state.serverLeft === null) return null;
  return Math.max(0, state.serverLeft - state.queued);
}

async function refreshRoll() {
  const event = state.event;
  if (!event) return;
  try {
    const [member, queue] = await Promise.all([
      getMyMember(event.id, state.userId),
      pending(event.id, state.userId),
    ]);
    if (member && event.roll_size !== null) state.serverLeft = Math.max(0, event.roll_size - member.shots_taken);
    else state.serverLeft = null;
    state.queued = queue.filter((s) => !s.claimed).length;
  } catch {
    /* offline: keep the last count */
  }
  renderCount();
}

function renderCount() {
  const left = shotsLeft();
  $('shots-left').textContent = left === null ? '∞' : String(left);
  ($('shutter') as HTMLButtonElement).disabled = left === 0 || !camera.ready;
}

// ---------------------------------------------------------------------------
// Camera
// ---------------------------------------------------------------------------

const camera = new BrowserCamera();
let viewfinder: LookRenderer | null = null;
let frame = 0;
let flashOn = false;
let busy = false;
let wakeLock: { release(): Promise<void> } | null = null;

function setUpCamera() {
  $('shutter').addEventListener('click', () => void shoot());
  $('flip').addEventListener('click', async () => {
    await openCamera(camera.facing === 'user' ? 'environment' : 'user');
  });
  $('flash').addEventListener('click', () => {
    flashOn = !flashOn;
    const b = $('flash');
    b.setAttribute('aria-pressed', String(flashOn));
    b.setAttribute('aria-label', flashOn ? 'Flash on' : 'Flash off');
  });
  $('my-shots').addEventListener('click', () => void openMyShots());
  $('invite').addEventListener('click', () => void invite());
  $('ends-in').addEventListener('click', () => showDeveloping(false));
  $('missions').addEventListener('click', () => openMissionList(false));
  $('armed-clear').addEventListener('click', () => arm(null));
  setUpMissionSheet();

  document.addEventListener('visibilitychange', () => {
    if (root().dataset.view !== 'camera') return;
    if (document.visibilityState === 'hidden') stopCamera();
    else void openCamera();
  });
}

async function showCamera() {
  show('camera');
  renderCount();
  renderEndsIn();
  startTick();
  void showLastShot();
  void loadMissions().then(() => {
    // First time on this event: the list opens once, with the explanation.
    const key = `left:web:missions-intro:${state.event!.id}`;
    if (state.missions.length && store.get(key) === null && root().dataset.view === 'camera') {
      store.set(key, '1');
      openMissionList(true);
    }
  });
  await openCamera();
}

async function openCamera(facing = camera.facing) {
  const shutter = $<HTMLButtonElement>('shutter');
  shutter.disabled = true;
  note(null);

  try {
    if (!viewfinder) viewfinder = new LookRenderer($<HTMLCanvasElement>('viewfinder'));
  } catch (e) {
    return note((e as Error).message);
  }

  try {
    await camera.start(facing);
  } catch (e) {
    const kind: CameraFailure = e instanceof CameraError ? e.kind : 'unavailable';
    return note(cameraMessage(kind), kind === 'denied' || kind === 'unavailable' ? () => void openCamera(facing) : undefined);
  }

  $('flash').classList.remove('absent');
  $('flip').classList.toggle('absent', !(await camera.canFlip()));
  try {
    wakeLock = (await (navigator as Navigator & { wakeLock?: { request(t: 'screen'): Promise<{ release(): Promise<void> }> } }).wakeLock?.request('screen')) ?? null;
  } catch {
    wakeLock = null;
  }
  sizeViewfinder();
  loop();
  renderCount();
}

function cameraMessage(kind: CameraFailure): string {
  switch (kind) {
    case 'denied':
      return 'LEFT needs your camera to take photos. Allow camera access for this site in your browser’s settings, then try again.';
    case 'insecure':
      return 'The camera only opens on a secure (https) page.';
    case 'unsupported':
      return 'This browser can’t open the camera. Open the link in Safari or Chrome.';
    default:
      return 'The camera didn’t start. Close other apps that use it and try again.';
  }
}

function note(text: string | null, action?: () => void) {
  const box = $('frame-note');
  box.hidden = text === null;
  $('frame-note-text').textContent = text ?? '';
  const button = $('frame-note-action');
  button.hidden = !action;
  button.textContent = 'Try again';
  button.onclick = action ?? null;
}

function sizeViewfinder() {
  const canvas = $<HTMLCanvasElement>('viewfinder');
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const w = Math.round(canvas.clientWidth * dpr);
  canvas.width = Math.min(w, 1080);
  canvas.height = Math.round((canvas.width * 4) / 3);
}
addEventListener('resize', () => {
  if (root()?.dataset.view === 'camera') sizeViewfinder();
});

function loop() {
  cancelAnimationFrame(frame);
  const draw = () => {
    if (!camera.running) return;
    if (camera.ready && viewfinder && state.event) {
      viewfinder.draw(camera.video, camera.width, camera.height, state.event.look, {
        grain: false,
        mirror: camera.facing === 'user',
      });
    }
    frame = requestAnimationFrame(draw);
  };
  frame = requestAnimationFrame(draw);
}

function stopCamera() {
  cancelAnimationFrame(frame);
  camera.stop();
  void wakeLock?.release().catch(() => undefined);
  wakeLock = null;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function shoot() {
  const event = state.event;
  if (!event || busy || !camera.ready || shotsLeft() === 0) return;
  busy = true;
  const shutter = $<HTMLButtonElement>('shutter');
  shutter.disabled = true;

  const front = camera.facing === 'user';
  try {
    // The flash first, then the exposure: the LED as a torch on the back
    // camera where the browser allows it, a white screen on the front.
    let lit = false;
    if (flashOn && !front) {
      lit = await camera.torch(true);
      if (lit) await wait(350);
    }
    if (flashOn && front) {
      $('front-flash').classList.add('on');
      await wait(180);
    }

    // Shutter, haptic and veil on the same frame.
    haptic(12);
    const veil = $('veil');
    veil.classList.remove('fire');
    void veil.offsetWidth;
    veil.classList.add('fire');

    const id = crypto.randomUUID();
    const takenAt = new Date().toISOString();
    const print = await develop(camera.video, camera.width, camera.height, event.look, front);

    if (lit) void camera.torch(false);
    $('front-flash').classList.remove('on');

    const missionId = state.armedId;
    const shot: Shot = {
      id,
      eventId: event.id,
      userId: state.userId,
      takenAt,
      ...print,
      claimed: false,
      uploaded: false,
      ...(missionId ? { missionId, missionTagged: false, tagAttempts: 0 } : {}),
    };
    await enqueue(shot);
    if (missionId) {
      arm(null);
      void loadMissions();
    }
    state.queued += 1;
    renderCount();
    setLastShot(URL.createObjectURL(print.thumb));

    if (shotsLeft() === 0) {
      haptic([20, 60, 20]);
      await wait(900);
      showDeveloping(true);
    }
  } catch (e) {
    $('front-flash').classList.remove('on');
    void camera.torch(false);
    toast(e instanceof Error ? e.message : 'That photo didn’t work. Try again.');
  } finally {
    busy = false;
    renderCount();
  }
}

let lastShotUrl: string | null = null;
function setLastShot(url: string) {
  const img = $<HTMLImageElement>('last-shot');
  if (lastShotUrl?.startsWith('blob:')) URL.revokeObjectURL(lastShotUrl);
  lastShotUrl = url;
  img.src = url;
  img.hidden = false;
}

async function showLastShot() {
  const shots = await myShots().catch(() => []);
  const last = shots[shots.length - 1];
  if (last) setLastShot(last.thumb);
}

async function invite() {
  const url = `${location.origin}/j/${state.code}`;
  const text = `Join "${state.event?.name ?? 'the film'}" on LEFT — one roll of photos each, developed together when it ends.`;
  try {
    if (navigator.share) {
      await navigator.share({ title: 'LEFT', text, url });
      return;
    }
    await navigator.clipboard.writeText(url);
    toast('Invite link copied.');
  } catch {
    /* the guest closed the share sheet */
  }
}

// ---------------------------------------------------------------------------
// Intro — the app's `(guest)/intro`: the roll, hidden until the end, the
// missions (only when on), the end. Once per moment and browser.
// ---------------------------------------------------------------------------

const introKey = (eventId: string) => `left:intro-seen:${eventId}`;

let introPage = 0;

function introPages(): HTMLElement[] {
  return [...$('intro-pager').children].filter((el): el is HTMLElement => !(el as HTMLElement).hidden);
}

function setUpIntro() {
  const pager = $('intro-pager');
  $('intro-skip').addEventListener('click', finishIntro);
  $('intro-next').addEventListener('click', () => {
    const pages = introPages();
    if (introPage >= pages.length - 1) return finishIntro();
    goToIntroPage(introPage + 1);
  });
  pager.addEventListener('scroll', () => {
    const index = Math.round(pager.scrollLeft / Math.max(1, pager.clientWidth));
    if (index !== introPage) renderIntroPage(index);
  }, { passive: true });
  addEventListener('keydown', (e) => {
    if (root().dataset.view !== 'intro') return;
    if (e.key === 'ArrowRight') goToIntroPage(introPage + 1);
    if (e.key === 'ArrowLeft') goToIntroPage(introPage - 1);
  });
}

function goToIntroPage(index: number) {
  const pager = $('intro-pager');
  const i = Math.max(0, Math.min(introPages().length - 1, index));
  pager.scrollTo({ left: i * pager.clientWidth, behavior: reducedMotion() ? 'auto' : 'smooth' });
}

/** The dots, the button and Skip follow the page; nothing else moves. */
function renderIntroPage(index: number) {
  const pages = introPages();
  introPage = Math.max(0, Math.min(pages.length - 1, index));
  const last = introPage === pages.length - 1;
  pages.forEach((page, i) => page.setAttribute('aria-hidden', String(i !== introPage)));
  $('intro-dots').replaceChildren(
    ...pages.map((_, i) => {
      const dot = document.createElement('span');
      if (i === introPage) dot.className = 'on';
      return dot;
    })
  );
  $('intro-next').textContent = last ? 'Got it' : 'Next';
  $('intro-skip').hidden = last;
}

function showIntro() {
  const event = state.event!;
  const unlimited = event.roll_size === null;

  // 1 · the roll, written huge
  $('intro-roll').textContent = unlimited ? '∞' : String(event.roll_size);
  $('intro-roll').setAttribute('aria-label', unlimited ? 'Unlimited' : String(event.roll_size));
  $('intro-roll-title').innerHTML = unlimited ? 'Shoot <em>freely.</em>' : 'photos. That’s your <em>whole roll.</em>';
  $('intro-roll-text').textContent = unlimited ? 'No roll to run out of. Use the camera.' : 'No retakes. Use the camera.';
  $('intro-cam-count').textContent = unlimited ? '∞' : `${event.roll_size} left`;
  $('intro-cam').setAttribute(
    'aria-label',
    `The camera: a photo in this film’s look, ${unlimited ? 'an unlimited roll' : `${event.roll_size} photos left`}.`
  );

  // 2 · hidden until the end: the guest's own print clear, the others dark
  const [a, b] = samplesFor(event.id, 2);
  $<HTMLImageElement>('intro-other-a').src = a;
  $<HTMLImageElement>('intro-other-b').src = b;
  void lookSample(event).then((url) => {
    for (const id of ['intro-cam-img', 'intro-cam-tile', 'intro-yours']) $<HTMLImageElement>(id).src = url;
  });

  // 3 · missions, only when the moment has them
  const n = event.missions_per_guest;
  $('intro-missions').hidden = n === null;
  if (n !== null) {
    $('intro-capsule').textContent = 'Example';
    $('intro-missions-text').textContent =
      `Your missions for this film: ${n === 1 ? 'one photo' : `${n} photos`} to take, like this one. ` +
      'They show up in the camera when it starts.';
  }

  // 4 · developed together
  const ends = new Date(event.ends_at);
  $('intro-date').textContent = formatEndDate(ends);
  $('intro-time').textContent = formatEndTime(ends);

  show('intro');
  $('intro-pager').scrollLeft = 0;
  renderIntroPage(0);
  $('intro-next').focus({ preventScroll: true });
}

/** Seen (also when skipped); then wherever the moment is now — 12, the camera or the album. */
function finishIntro() {
  const event = state.event;
  if (!event) return;
  store.set(introKey(event.id), '1');
  void route();
}

/** The app's `look-sample.jpg` through this moment's look, once per look. */
const looked = new Map<string, Promise<string>>();
function lookSample(event: Event): Promise<string> {
  let url = looked.get(event.look);
  if (!url) {
    url = lookStill(LOOK_SAMPLE, event.look, 800).catch(() => LOOK_SAMPLE);
    looked.set(event.look, url);
  }
  return url;
}

// "Sat, 22 Nov" · "23:00" — the app's `formatEndDate` / `formatEndTime`, except
// for `hour: 'numeric'`: "2:46 PM" rather than "02:46 PM" on a 12-hour clock.
const endDate = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
const endTime = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
const formatEndDate = (d: Date) => endDate.format(d);
const formatEndTime = (d: Date) => endTime.format(d);

// ---------------------------------------------------------------------------
// Waiting — the app's 12: the event image in the look, the wait, the facts
// ---------------------------------------------------------------------------

function setUpWaiting() {
  $('waiting-invite').addEventListener('click', () => void invite());
  $('waiting-how').addEventListener('click', () => showIntro());
}

function showWaiting() {
  const event = state.event!;
  $('waiting-roll').textContent = event.roll_size === null ? 'Unlimited photos each' : `${event.roll_size} photos each`;
  const ends = new Date(event.ends_at);
  $('waiting-ends').textContent = `Develops ${formatEndDate(ends)} at ${formatEndTime(ends)}`;
  show('waiting');

  void listMembers(event.id)
    .then((members) => {
      const host = members.find((m) => m.user_id === event.host_id);
      if (host?.display_name) $('waiting-host').textContent = host.display_name;
    })
    .catch(() => undefined);

  paintCover($<HTMLImageElement>('waiting-cover'), event);
}

/**
 * The host's pick (03.1), or a stock picture, through the look; drawn once per
 * image element, event, cover and look.
 */
function paintCover(img: HTMLImageElement, event: Event) {
  const key = `${event.id}:${event.cover ?? ''}:${event.look}`;
  if (img.dataset.cover === key) return;
  img.dataset.cover = key;
  img.hidden = true;
  void eventCoverUrl(event).then(async (url) => {
    // Without WebGL (or a cover the browser will not hand to it) the picture without the look.
    const src = await lookStill(url, event.look).catch(() => url);
    if (img.dataset.cover !== key) return;
    img.onload = () => (img.hidden = false);
    img.src = src;
  });
}

// ---------------------------------------------------------------------------
// Developing — the gallery before the reveal (2026-11-23): the event image,
// the countdown, and every photo so far. The guest's own are sharp (RLS hands
// out their own files; frames still queued are local blobs); everyone else's
// are their blurhash — a colour smudge — with the name and the time left.
// ---------------------------------------------------------------------------

function setUpDeveloping() {
  $('dev-camera').addEventListener('click', () => void showCamera());
}

function showDeveloping(empty: boolean) {
  const event = state.event!;
  $('dev-title').textContent = empty ? 'That’s your roll · developing in' : 'Developing in';
  const when = new Date(event.ends_at);
  $('dev-lede').textContent =
    `Everyone’s photos appear ${formatEndDate(when)} at ${formatEndTime(when)}. ` +
    'The web has no notifications, so set a reminder and open this link again then.';
  devEmpty = empty;
  renderDevActions();
  paintCover($<HTMLImageElement>('dev-cover'), event);
  setCalendar(event, when);
  show('developing');
  renderCountdown();
  startTick();
  void loadGallery();
  void drain();
}

let devEmpty = false;

/** "Back to the camera" while the guest still has frames and the cameras are open — as before. */
function renderDevActions() {
  const event = state.event;
  $('dev-camera').hidden = devEmpty || !event || event.status !== 'live' || shotsLeft() === 0;
}

type Tile =
  | { kind: 'mine'; id: string; takenAt: string; print: Print }
  | { kind: 'theirs'; id: string; takenAt: string; userId: string; author: string; blurhash: string | null };

/** Thumbnails already signed (`photoId → url, signed at`), so a poll does not reload every image. */
const signedThumbs = new Map<string, { url: string; at: number }>();
/** Object URLs for frames still in the queue, one per frame. */
const queuedThumbs = new Map<string, string>();
const SIGNED_FOR_MS = 50 * 60_000;

let galleryKey = '';
let galleryLoading: Promise<void> | null = null;

function loadGallery(): Promise<void> {
  galleryLoading ??= buildGallery().finally(() => (galleryLoading = null));
  return galleryLoading;
}

async function buildGallery() {
  const event = state.event;
  if (!event) return;
  let rows: GalleryPhoto[];
  let names: Map<string, string>;
  let queue: Shot[];
  let mine: Photo[];
  try {
    const [gallery, members, queued, own] = await Promise.all([
      eventGallery(event.id),
      listMembers(event.id),
      pending(event.id, state.userId),
      // Before the reveal RLS returns only the caller's own rows — with their paths.
      listPhotos(event.id).catch(() => [] as Photo[]),
    ]);
    rows = gallery;
    names = new Map(members.map((m) => [m.user_id, m.display_name]));
    queue = queued;
    mine = own.filter((p) => p.user_id === state.userId);
  } catch {
    // Offline, or a server without event_gallery() yet: keep what is on screen.
    return;
  }
  if (state.event?.id !== event.id || root().dataset.view !== 'developing') return;

  // Sign the thumbnails not signed yet (or about to expire).
  const now = Date.now();
  const unsigned = mine.filter((p) => p.thumb_path && !(now - (signedThumbs.get(p.id)?.at ?? 0) < SIGNED_FOR_MS));
  if (unsigned.length) {
    const urls = await signedUrls(unsigned.map((p) => p.thumb_path!)).catch(() => new Map<string, string>());
    for (const p of unsigned) {
      const url = urls.get(p.thumb_path!);
      if (url) signedThumbs.set(p.id, { url, at: now });
    }
  }
  const byId = new Map(mine.map((p) => [p.id, p]));
  const queuedById = new Map(queue.map((shot) => [shot.id, shot]));
  const localThumb = (shot: Shot) => {
    let url = queuedThumbs.get(shot.id);
    if (!url) {
      url = URL.createObjectURL(shot.thumb);
      queuedThumbs.set(shot.id, url);
    }
    return url;
  };
  const ownPrint = (id: string): Print => {
    const shot = queuedById.get(id);
    const row = byId.get(id) ?? null;
    return {
      id,
      thumb: shot ? localThumb(shot) : (signedThumbs.get(id)?.url ?? ''),
      original: shot
        ? async () => URL.createObjectURL(shot.original)
        : row?.storage_path
          ? () => signOne(row.storage_path!)
          : () => Promise.reject(new Error('This photo is still on its way.')),
      author: 'You',
      photo: row,
    };
  };

  const tiles: Tile[] = rows.map((row) =>
    row.user_id === state.userId
      ? { kind: 'mine', id: row.id, takenAt: row.taken_at, print: ownPrint(row.id) }
      : {
          kind: 'theirs',
          id: row.id,
          takenAt: row.taken_at,
          userId: row.user_id ?? row.id,
          author: names.get(row.user_id ?? '') ?? 'A guest',
          blurhash: row.blurhash,
        }
  );
  // Frames the server has not seen yet (not claimed) are the guest's own too.
  const seen = new Set(rows.map((r) => r.id));
  for (const shot of queue) {
    if (!seen.has(shot.id)) tiles.push({ kind: 'mine', id: shot.id, takenAt: shot.takenAt, print: ownPrint(shot.id) });
  }
  tiles.sort((a, b) => b.takenAt.localeCompare(a.takenAt) || a.id.localeCompare(b.id));

  // Frames that left the queue no longer need their object URL.
  for (const [id, url] of queuedThumbs) {
    if (!queuedById.has(id)) {
      URL.revokeObjectURL(url);
      queuedThumbs.delete(id);
    }
  }

  const people = new Set(tiles.map((t) => (t.kind === 'mine' ? state.userId : t.userId))).size;
  $('dev-counts').textContent =
    `${tiles.length} ${tiles.length === 1 ? 'photo' : 'photos'} so far from ${people} ${people === 1 ? 'person' : 'people'}`;
  $('dev-counts').hidden = tiles.length === 0;
  $('gallery-empty').hidden = tiles.length > 0;

  // Redraw only when something changed: a poll that brings nothing new leaves the grid alone.
  const key = tiles
    .map((t) => (t.kind === 'mine' ? `m:${t.id}:${t.print.thumb}` : `t:${t.id}:${t.blurhash ?? ''}:${t.author}`))
    .join('|');
  if (key === galleryKey) return;
  galleryKey = key;
  renderGallery(tiles);
}

function renderGallery(tiles: Tile[]) {
  const list = $('gallery');
  const own = tiles.filter((t): t is Extract<Tile, { kind: 'mine' }> => t.kind === 'mine').map((t) => t.print);
  const time = tileCountdown();
  list.replaceChildren(
    ...tiles.map((tile, i) => {
      const li = document.createElement('li');
      if (tile.kind === 'mine') {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'gtile press';
        button.setAttribute('aria-label', 'Your photo');
        if (tile.print.thumb) {
          const img = document.createElement('img');
          img.src = tile.print.thumb;
          img.alt = '';
          img.loading = i < 12 ? 'eager' : 'lazy';
          img.decoding = 'async';
          button.append(img);
        }
        button.append(label('gtile-name', 'You'));
        const index = own.indexOf(tile.print);
        button.addEventListener('click', () => openViewer(own, index, button));
        li.append(button);
      } else {
        const frame = document.createElement('div');
        frame.className = 'gtile';
        frame.setAttribute('role', 'img');
        frame.setAttribute('aria-label', `Photo by ${tile.author}, hidden until the film is developed`);
        const smudge = tile.blurhash ? smudgeCanvas(tile.blurhash) : null;
        if (smudge) frame.append(smudge);
        frame.append(label('gtile-name', tile.author), label('gtile-time glass', time));
        li.append(frame);
      }
      return li;
    })
  );
}

function label(className: string, text: string): HTMLElement {
  const span = document.createElement('span');
  span.className = className;
  span.textContent = text;
  return span;
}

/** Blurhash drawn at 24x32 into a canvas the tile stretches; null when the hash does not decode. */
function smudgeCanvas(hash: string): HTMLCanvasElement | null {
  try {
    const w = 24;
    const h = 32;
    const pixels = decode(hash, w, h);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const image = ctx.createImageData(w, h);
    image.data.set(pixels);
    ctx.putImageData(image, 0, 0);
    canvas.setAttribute('aria-hidden', 'true');
    return canvas;
  } catch {
    return null;
  }
}

function setCalendar(event: Event, when: Date) {
  const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const end = new Date(when.getTime() + 15 * 60_000);
  const url = `${location.origin}/j/${state.code}`;
  const escape = (s: string) => s.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, '\\n');
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//LEFT//Web camera//EN',
    'BEGIN:VEVENT',
    `UID:${event.id}@leftmoment.com`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(when)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${escape(`${event.name}: the photos are developed`)}`,
    `DESCRIPTION:${escape(url)}`,
    `URL:${url}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
  const link = $<HTMLAnchorElement>('calendar');
  if (link.href.startsWith('blob:')) URL.revokeObjectURL(link.href);
  link.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
  link.download = `left-${state.code}.ics`;
}

function startTick() {
  if (state.tick) clearInterval(state.tick);
  state.tick = setInterval(() => {
    const event = state.event;
    if (!event) return;
    if (isDeveloped(event)) {
      clearInterval(state.tick!);
      // The reveal is by the clock: the photos are readable at ends_at.
      void route();
      return;
    }
    renderCountdown();
    renderEndsIn();
  }, 1000);
}

function remaining(): number {
  return Math.max(0, new Date(state.event!.ends_at).getTime() - Date.now());
}

/** Days, hours, minutes; seconds only in the last hour. */
function renderCountdown() {
  const s = Math.floor(remaining() / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  $('countdown').textContent =
    d > 0 ? `${d}d ${h}h ${pad(m)}m` : h > 0 ? `${h}h ${pad(m)}m` : `${pad(m)}m ${pad(sec)}s`;
  if (root().dataset.view === 'developing') {
    const time = tileCountdown();
    document.querySelectorAll<HTMLElement>('#gallery .gtile-time').forEach((el) => (el.textContent = time));
  }
}

/** The small one on each hidden photo: "01d 23h", or "12m 05s" in the last hour. */
function tileCountdown(): string {
  const s = Math.floor(remaining() / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad = (n: number) => String(n).padStart(2, '0');
  if (d > 0) return `${pad(d)}d ${pad(h)}h`;
  if (h > 0) return `${pad(h)}h ${pad(m)}m`;
  return `${pad(m)}m ${pad(s % 60)}s`;
}

function renderEndsIn() {
  const s = Math.floor(remaining() / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  $('ends-in').textContent = `Develops in ${d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${Math.max(1, m)}m`}`;
}

// ---------------------------------------------------------------------------
// Photos: the guest's own (before the reveal) and the album (after)
// ---------------------------------------------------------------------------

type Print = {
  id: string;
  thumb: string;
  /** Resolved on demand: a signed URL, or a local blob for a frame still queued. */
  original: () => Promise<string>;
  author: string;
  photo: Photo | null;
};

/** The guest's own frames, oldest first: uploaded rows + frames still in the queue. */
async function myShots(): Promise<Print[]> {
  const event = state.event!;
  const [rows, queue] = await Promise.all([
    listPhotos(event.id).catch(() => [] as Photo[]),
    pending(event.id, state.userId),
  ]);
  const mine = rows.filter((p) => p.user_id === state.userId);
  const thumbs = await signedUrls(mine.map((p) => p.thumb_path!).filter(Boolean)).catch(() => new Map());
  const prints: Print[] = mine.map((p) => ({
    id: p.id,
    thumb: thumbs.get(p.thumb_path!) ?? '',
    original: () => signOne(p.storage_path!),
    author: 'You',
    photo: p,
  }));
  for (const shot of queue) {
    if (prints.some((p) => p.id === shot.id)) continue;
    const thumb = URL.createObjectURL(shot.thumb);
    prints.push({ id: shot.id, thumb, original: async () => URL.createObjectURL(shot.original), author: 'You', photo: null });
  }
  return prints;
}

async function signOne(path: string): Promise<string> {
  const urls = await signedUrls([path]);
  const url = urls.get(path);
  if (!url) throw new Error('The photo could not be loaded.');
  return url;
}

async function openMyShots() {
  const [prints] = await Promise.all([myShots().catch(() => []), loadMissions()]);
  if (prints.length === 0) return toast('No photos yet.');
  openViewer(prints, prints.length - 1, null);
}

let album: Print[] = [];

async function showAlbum() {
  stopCamera();
  if (state.tick) clearInterval(state.tick);
  show('loading');
  const event = state.event!;
  let photos: Photo[];
  let names: Map<string, string>;
  try {
    const [rows, members, captions] = await Promise.all([
      listPhotos(event.id),
      listMembers(event.id),
      listPhotoMissions(event.id).catch(() => new Map<string, string>()),
    ]);
    photos = rows;
    names = new Map(members.map((m) => [m.user_id, m.display_name]));
    state.captions = captions;
  } catch (e) {
    return fail('Couldn’t <em>open the album.</em>', messageFor(e), () => void showAlbum());
  }

  const thumbs = new Map<string, string>();
  const paths = photos.map((p) => p.thumb_path!).filter(Boolean);
  for (let i = 0; i < paths.length; i += 500) {
    const batch = await signedUrls(paths.slice(i, i + 500)).catch(() => new Map<string, string>());
    batch.forEach((v, k) => thumbs.set(k, v));
  }

  album = photos.map((p) => ({
    id: p.id,
    thumb: thumbs.get(p.thumb_path!) ?? '',
    original: () => signOne(p.storage_path!),
    author: p.user_id === state.userId ? 'You' : (names.get(p.user_id ?? '') ?? 'A guest'),
    photo: p,
  }));

  const people = new Set(photos.map((p) => p.user_id)).size;
  $('album-counts').textContent = `${photos.length} ${photos.length === 1 ? 'photo' : 'photos'} · ${people} ${people === 1 ? 'person' : 'people'}`;
  $('album-empty').hidden = photos.length > 0;

  const firstVisit = store.get(`left:reveal-seen:${event.id}`) === null;
  store.set(`left:reveal-seen:${event.id}`, '1');

  renderHero();
  renderPrints(firstVisit);
  show('album');
  if (firstVisit && album.length) haptic(20);
}

function renderHero() {
  const hero = $('hero');
  const img = $<HTMLImageElement>('hero-img');
  if (album.length === 0) {
    hero.classList.add('empty');
    img.removeAttribute('src');
    return;
  }
  hero.classList.remove('empty');
  // One of the album's photos, drawn at random per visit; the thumbnail first,
  // the original over it.
  const index = Math.floor(Math.random() * album.length);
  const pick = album[index];
  img.src = pick.thumb;
  void pick.original().then((url) => {
    const full = new Image();
    full.onload = () => (img.src = url);
    full.src = url;
  }).catch(() => undefined);
  hero.onclick = () => openViewer(album, index, $('hero'));
}

function renderPrints(reveal: boolean) {
  const list = $('prints');
  list.replaceChildren();
  const animate = reveal && !reducedMotion();
  album.forEach((print, i) => {
    const li = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'print press';
    button.setAttribute('aria-label', `Photo by ${print.author}`);
    const img = document.createElement('img');
    img.src = print.thumb;
    img.alt = '';
    img.loading = i < 6 ? 'eager' : 'lazy';
    img.decoding = 'async';
    const name = document.createElement('span');
    name.textContent = print.author;
    button.append(img, name);
    if (reveal) {
      button.classList.add(animate ? 'developing' : 'fading');
      button.style.setProperty('--i', String(Math.min(i, 24)));
    }
    button.addEventListener('click', () => openViewer(album, i, button));
    li.append(button);
    list.append(li);
  });
}

// ---------------------------------------------------------------------------
// Viewer
// ---------------------------------------------------------------------------

let viewing: Print[] = [];
let current = 0;
let returnFocus: HTMLElement | null = null;

function setUpViewer() {
  const track = $('viewer-track');
  $('viewer-close').addEventListener('click', closeViewer);
  addEventListener('keydown', (e) => {
    if ($('viewer').hidden) return;
    if (e.key === 'Escape') closeViewer();
    if (e.key === 'ArrowRight') goTo(current + 1);
    if (e.key === 'ArrowLeft') goTo(current - 1);
  });
  track.addEventListener('scroll', () => {
    const index = Math.round(track.scrollLeft / track.clientWidth);
    if (index !== current) {
      current = index;
      updateViewer();
    }
  }, { passive: true });
  $('viewer-save').addEventListener('click', () => void save());
  $('viewer-delete').addEventListener('click', () => void remove());
  $('viewer-report').addEventListener('click', () => void report());
  $('viewer-tag').addEventListener('click', () => {
    const print = viewing[current];
    if (print) openMissionList(false, print.id);
  });
}

function openViewer(prints: Print[], index: number, from: HTMLElement | null) {
  viewing = prints;
  current = index;
  returnFocus = from;
  const track = $('viewer-track');
  track.replaceChildren(
    ...prints.map((print) => {
      const slide = document.createElement('figure');
      slide.className = 'slide';
      const img = document.createElement('img');
      img.src = print.thumb;
      img.alt = `Photo by ${print.author}`;
      slide.append(img);
      return slide;
    })
  );
  const viewer = $('viewer');
  viewer.hidden = false;
  document.body.style.overflow = 'hidden';
  track.scrollLeft = index * track.clientWidth;
  updateViewer();
  $('viewer-close').focus({ preventScroll: true });
}

function closeViewer() {
  $('viewer').hidden = true;
  document.body.style.overflow = '';
  returnFocus?.focus({ preventScroll: true });
  // Return to the current photo's tile.
  const tile = document.querySelectorAll<HTMLElement>('#prints .print')[current];
  if (viewing === album && tile) tile.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
}

function goTo(index: number) {
  const track = $('viewer-track');
  const i = Math.max(0, Math.min(viewing.length - 1, index));
  track.scrollTo({ left: i * track.clientWidth, behavior: reducedMotion() ? 'auto' : 'smooth' });
}

const loaded = new Set<string>();

function updateViewer() {
  const print = viewing[current];
  if (!print) return;
  $('viewer-caption').textContent = `${print.author} · ${current + 1} of ${viewing.length}`;
  const mission = state.captions.get(print.id);
  $('viewer-mission').textContent = mission ? `Mission · ${mission}` : '';
  $('viewer-mission').hidden = !mission;
  // Your shots, before the reveal: say which mission a photo was for.
  const tagging = viewing !== album && state.missions.length > 0 && !!state.event && !isDeveloped(state.event);
  $('viewer-tag').hidden = !tagging;

  const host = state.event?.host_id === state.userId;
  const mine = print.photo?.user_id === state.userId;
  $('viewer-delete').hidden = !print.photo || !(mine || host);
  $('viewer-report').hidden = !print.photo || mine || host;

  // The original for this photo and its neighbours.
  for (const i of [current, current - 1, current + 1]) {
    const p = viewing[i];
    if (!p || loaded.has(p.id)) continue;
    loaded.add(p.id);
    const img = $('viewer-track').children[i]?.querySelector('img');
    void p.original().then((url) => {
      if (img) img.src = url;
    }).catch(() => loaded.delete(p.id));
  }
}

async function save() {
  const print = viewing[current];
  if (!print) return;
  try {
    const url = await print.original();
    const blob = await (await fetch(url)).blob();
    const file = new File([blob], `left-${print.id.slice(0, 8)}.jpg`, { type: 'image/jpeg' });
    // On a phone the share sheet is where "Save Image" lives.
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file] });
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file);
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  } catch (e) {
    if ((e as { name?: string }).name !== 'AbortError') toast('The photo could not be saved.');
  }
}

async function remove() {
  const print = viewing[current];
  if (!print?.photo) return;
  if (!confirm('Delete this photo? It is removed from the album for everyone.')) return;
  try {
    await deletePhoto(print.photo);
    viewing.splice(current, 1);
    if (root().dataset.view === 'developing') void loadGallery();
    if (viewing === album) {
      renderPrints(false);
      $('album-counts').textContent = `${album.length} ${album.length === 1 ? 'photo' : 'photos'}`;
    }
    if (viewing.length === 0) return closeViewer();
    openViewer(viewing, Math.min(current, viewing.length - 1), returnFocus);
    toast('Photo deleted.');
  } catch (e) {
    toast(messageFor(e));
  }
}

async function report() {
  const print = viewing[current];
  if (!print?.photo) return;
  if (!confirm('Report this photo?\n\nWe look at reported photos within 24 hours and remove what breaks the rules. The host of this event can delete it right away.')) return;
  try {
    await reportPhoto(print.photo.id);
    toast('Thanks — we’ll take a look.');
  } catch (e) {
    toast(messageFor(e));
  }
}

// ---------------------------------------------------------------------------
// Missions — as on the app's 13: a capsule, the list, the armed next shot
// ---------------------------------------------------------------------------

/**
 * The guest's missions from the server, with the queue's tags that have not
 * reached it yet applied: a mission armed for a frame still in the queue is
 * done already, as far as the guest is concerned.
 */
let serverMissions: Mission[] = [];

async function loadMissions() {
  const event = state.event;
  if (!event || event.missions_per_guest === null || event.status !== 'live') {
    state.missions = [];
    return renderMissions();
  }
  try {
    // Offline, the last list the server gave; the queue is local and always readable.
    const [fresh, queue] = await Promise.all([
      getMyMissions(event.id).catch(() => null),
      pending(event.id, state.userId),
    ]);
    if (fresh) serverMissions = fresh;
    const missions = serverMissions.map((m) => ({ ...m }));
    for (const shot of queue) {
      if (shot.missionTagged !== false) continue;
      for (const m of missions) if (m.photoId === shot.id) m.photoId = null;
      const target = missions.find((m) => m.id === shot.missionId);
      if (target) target.photoId = shot.id;
    }
    state.missions = missions;
  } catch {
    /* offline: keep what we had */
  }
  state.captions = new Map(state.missions.filter((m) => m.photoId).map((m) => [m.photoId!, m.body]));
  if (state.armedId && !state.missions.some((m) => m.id === state.armedId && m.photoId === null)) state.armedId = null;
  renderMissions();
}

function renderMissions() {
  const capsule = $('missions');
  const total = state.missions.length;
  const done = state.missions.filter((m) => m.photoId !== null).length;
  capsule.hidden = total === 0;
  capsule.textContent = `Missions ${done}/${total}`;
  capsule.setAttribute('aria-label', `Missions, ${done} of ${total} done`);

  const armed = state.missions.find((m) => m.id === state.armedId);
  $('armed').hidden = !armed;
  $('armed-text').textContent = armed?.body ?? '';
  if (!$('viewer').hidden) updateViewer();
}

function arm(missionId: string | null) {
  state.armedId = missionId;
  renderMissions();
}


function setUpMissionSheet() {
  $('mission-scrim').addEventListener('click', closeMissionList);
  $('mission-done').addEventListener('click', closeMissionList);
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('mission-sheet').hidden) {
      e.stopImmediatePropagation();
      closeMissionList();
    }
  }, { capture: true });
}

function missionRow(body: string, opts: { personal?: boolean; detail?: string; state?: string; current?: boolean; disabled?: boolean; done?: boolean }, onPick: () => void) {
  const li = document.createElement('li');
  const b = document.createElement('button');
  b.type = 'button';
  b.className = `mission press${opts.done ? ' done' : ''}`;
  b.disabled = !!opts.disabled;
  if (opts.current) b.setAttribute('aria-current', 'true');
  const text = document.createElement('span');
  text.className = 'mission-body';
  if (opts.personal) {
    const tag = document.createElement('small');
    tag.textContent = 'Just for you';
    text.append(tag);
  }
  text.append(document.createTextNode(body));
  if (opts.detail) {
    const d = document.createElement('i');
    d.textContent = opts.detail;
    text.append(d);
  }
  b.append(text);
  if (opts.state) {
    const st = document.createElement('span');
    st.className = 'mission-state';
    st.textContent = opts.state;
    b.append(st);
  }
  b.addEventListener('click', onPick);
  li.append(b);
  return li;
}

function openMissionList(intro: boolean, photoId: string | null = null) {
  const missions = state.missions;
  const list = $('mission-list');
  const done = missions.filter((m) => m.photoId !== null).length;

  if (photoId) {
    $('mission-title').innerHTML = 'Which <em>mission?</em>';
    $('mission-lede').textContent = 'Pick the mission this photo was for.';
    const held = missions.find((m) => m.photoId === photoId)?.id ?? null;
    list.replaceChildren(
      ...missions.map((m) =>
        missionRow(
          m.body,
          {
            personal: m.personal,
            current: m.id === held,
            state: m.id === held ? 'This photo' : undefined,
            detail: m.photoId && m.id !== held ? 'Done with another photo. Picking it moves it here.' : undefined,
          },
          () => void tagPhoto(photoId, m.id)
        )
      ),
      missionRow('Not a mission', { current: held === null, state: held === null ? 'This photo' : undefined }, () => void tagPhoto(photoId, null))
    );
  } else {
    $('mission-title').innerHTML = 'Your <em>missions.</em>';
    $('mission-lede').textContent = intro
      ? `Small challenges from the host — ${missions.length === 1 ? 'one' : missions.length} for you. Tap Missions, pick one, then take the photo. Already took it? Mark it in Your shots. Nobody sees them until the film is developed.`
      : done === missions.length
        ? 'All done. Nobody sees them until the film is developed.'
        : 'Pick one, then take the photo. Already took it? Mark it in Your shots.';
    list.replaceChildren(
      ...missions.map((m) => {
        const isDone = m.photoId !== null;
        const isArmed = m.id === state.armedId;
        return missionRow(
          m.body,
          { personal: m.personal, done: isDone, disabled: isDone, current: isArmed, state: isDone ? 'Done' : isArmed ? 'Next photo' : undefined },
          () => {
            arm(m.id);
            closeMissionList();
          }
        );
      })
    );
  }
  $('mission-done').hidden = !intro;
  $('mission-sheet').hidden = false;
  list.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({ preventScroll: true });
}

function closeMissionList() {
  $('mission-sheet').hidden = true;
}

/** From Your shots: the queue carries it if the photo is still there, else the server directly. */
async function tagPhoto(photoId: string, missionId: string | null) {
  closeMissionList();
  try {
    const queued = await setQueuedMission(photoId, missionId);
    if (!queued) await setPhotoMission(photoId, missionId);
  } catch (e) {
    toast(messageFor(e));
  }
  await loadMissions();
  updateViewer();
}
