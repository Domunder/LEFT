/**
 * The web camera, screen by screen: join → (waiting) → camera → developing →
 * album. The page's markup is `src/pages/j/index.astro`; this file switches
 * `data-view` and fills it.
 *
 * Every number shown comes from the server (`api.ts`): the roll is
 * `rollSize − shots_taken` minus the frames still waiting in the queue to be
 * claimed, floored at zero — as `useCameraSession` counts it in the app.
 */

import {
  currentUserId,
  deletePhoto,
  ensureGuest,
  getEvent,
  getMyMember,
  isConfigured,
  isDeveloped,
  joinEvent,
  listMembers,
  listPhotos,
  MAX_NAME_LENGTH,
  messageFor,
  reportPhoto,
  signedUrls,
  type Event,
  type Photo,
} from './api';
import { BrowserCamera, CameraError, type CameraFailure } from './camera';
import { develop, LookRenderer } from './look-gl';
import { drain, enqueue, onQueue, pending, startQueue, type Shot } from './queue';

type View = 'loading' | 'join' | 'waiting' | 'camera' | 'developing' | 'album' | 'error';

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

  const open = $<HTMLAnchorElement>('open-app');
  if (state.code) {
    open.href = `${root().dataset.scheme}://j/${state.code}`;
    open.hidden = false;
  }

  if (!CODE_SHAPE.test(state.code)) {
    return fail('This link is <em>incomplete.</em>', 'The invite code is missing. Scan the QR code again or ask the host for the link.');
  }
  if (!isConfigured()) {
    return fail('The camera is <em>not ready.</em>', 'Shooting in the browser is not switched on for this site yet.');
  }

  setUpJoin();
  setUpCamera();
  setUpDeveloping();
  setUpViewer();

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
  show('join');
  $<HTMLInputElement>('join-name').focus({ preventScroll: true });
}

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

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = input.value.trim();
    if (!name || submit.disabled) return;

    submit.disabled = true;
    submit.textContent = 'Joining…';
    error.textContent = '';
    try {
      state.userId = await ensureGuest();
      const eventId = await joinEvent(state.code, name);
      store.set(`left:web:event:${state.code}`, eventId);
      store.set('left:web:name', name);
      await enter(eventId);
    } catch (err) {
      error.textContent = messageFor(err);
      submit.textContent = 'Start shooting';
      sync();
    }
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
    void refreshRoll();
  });

  if (state.poll) clearInterval(state.poll);
  // No realtime here: a light poll is enough to notice the host starting or
  // developing early. The clock is checked every second by the countdown.
  state.poll = setInterval(() => void refreshEvent(), 15_000);
  await route();
}

async function refreshEvent() {
  if (!state.event || document.visibilityState !== 'visible') return;
  try {
    const next = await getEvent(state.event.id);
    const changed = next.status !== state.event.status || next.ends_at !== state.event.ends_at;
    state.event = next;
    if (changed) await route();
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
  if (event.status === 'setup') return show('waiting');

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

    const shot: Shot = { id, eventId: event.id, userId: state.userId, takenAt, ...print, claimed: false, uploaded: false };
    await enqueue(shot);
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
// Developing
// ---------------------------------------------------------------------------

function setUpDeveloping() {
  $('dev-shots').addEventListener('click', () => void openMyShots());
  $('dev-camera').addEventListener('click', () => void showCamera());
}

function showDeveloping(empty: boolean) {
  const event = state.event!;
  $('dev-title').innerHTML = empty ? 'That’s your <em>roll.</em>' : 'Your film is <em>developing.</em>';
  const when = new Date(event.ends_at);
  const day = when.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  const time = when.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  $('dev-lede').textContent =
    `Everyone’s photos appear on ${day} at ${time}. Open this link again then — ` +
    'the web has no notifications, so set a reminder.';
  $('dev-camera').hidden = empty || event.status !== 'live';
  setCalendar(event, when);
  show('developing');
  renderCountdown();
  startTick();
  void drain();
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

function renderCountdown() {
  const ms = remaining();
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  $('countdown').textContent = d > 0 ? `${d}d ${h}h ${pad(m)}m` : `${h}:${pad(m)}:${pad(sec)}`;
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
  const prints = await myShots().catch(() => []);
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
    const [rows, members] = await Promise.all([listPhotos(event.id), listMembers(event.id)]);
    photos = rows;
    names = new Map(members.map((m) => [m.user_id, m.display_name]));
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
