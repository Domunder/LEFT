/**
 * LEFT design tokens.
 *
 * Transcribed from design/README.md ("Global Design Tokens") and the values used
 * in design/LEFT App.dc.html. Nothing here is invented — if a value is missing,
 * check the prototype rather than guessing.
 *
 * The app is dark-only. There is no light theme.
 */

import { Platform } from 'react-native';

import { DisplaySize } from './typography';

export const Colors = {
  /** Page background (near-black) */
  bg: '#101010',
  /** Card / phone-frame background */
  card: '#141316',

  /** Primary text & accent (off-white) */
  text: '#f0ede8',
  /** Secondary copy */
  textMuted: 'rgba(240,237,232,0.55)',
  /** Body copy under a headline */
  textDim: 'rgba(240,237,232,0.42)',
  /** Uppercase eyebrow labels */
  textFaint: 'rgba(240,237,232,0.32)',
  /** Fine print */
  textGhost: 'rgba(240,237,232,0.22)',
  /** Text/icon sitting on a light (#f0ede8) surface */
  onLight: '#0b0b0c',
  /**
   * 10's "Start the Event" label. The artboard uses #060608 here where every
   * other light-surface button uses #0b0b0c — two points darker, on the one
   * button that commits the whole group to filming. Followed as drawn.
   */
  onLightDeep: '#060608',

  /** Status dot — "1 spot left" */
  gold: 'rgba(240,180,120,0.85)',
  /** Status dot — success */
  green: 'rgba(140,220,120,0.85)',
  /** Recording indicator */
  rec: '#ff3b3b',

  /** Glass panel fill, sits under a BlurView */
  glass: 'rgba(20,18,16,0.4)',
  /** Circular glass icon button fill */
  glassButton: 'rgba(255,255,255,0.11)',
  /** Flat (unblurred) button fill, e.g. onboarding back button */
  surfaceSubtle: 'rgba(255,255,255,0.08)',
  /** 15's icon tile and its gear button — a step below `surfaceSubtle` */
  surfaceFaint: 'rgba(255,255,255,0.04)',
  /** 16's event-card fill — the faintest surface in the app */
  surfaceGhost: 'rgba(255,255,255,0.03)',

  /** 1px borders */
  hairline: 'rgba(255,255,255,0.1)',
  hairlineStrong: 'rgba(255,255,255,0.14)',

  /** Scrim behind a modal sheet */
  scrim: 'rgba(4,4,5,0.72)',
  /** 16's blurred backdrop scrim — the same near-black as `bg`, at 72% */
  backdropScrim: 'rgba(16,16,16,0.72)',
  /** Fill behind a badge pill sitting over imagery (16's card overlays) */
  badgeScrim: 'rgba(0,0,0,0.35)',

  /** Landing wordmark — slightly brighter than textMuted */
  textSoft: 'rgba(240,237,232,0.7)',
  /** Icon inside a glass circle button */
  iconGlass: 'rgba(240,237,232,0.6)',
  /** Inline link inside fine print (Terms, Privacy Policy) */
  link: 'rgba(240,237,232,0.4)',
  /** A progress dot for a step already completed — dimmer than active, brighter
   *  than the upcoming steps' `surfaceSubtle`. */
  dotCompleted: 'rgba(240,237,232,0.3)',

  /**
   * A notch brighter than `textSoft` (0.7). 20's settings-row labels and both
   * screens' avatar initials sit here — copy that is neither a headline nor
   * secondary, and would read as either at the neighbouring steps.
   */
  textStrong: 'rgba(240,237,232,0.75)',
  /** 20's "Log Out". The only destructive-coloured text in the app. */
  destructive: 'rgba(255,120,110,0.85)',
} as const;

/**
 * Full-bleed backdrop treatment, shared by Landing (01), the join sheet (08) and
 * the auth screens. The backdrop was a video until 2026-11-16 — hence the name.
 *
 * The gradient darkens the frame from top to bottom so the glass panel pinned at
 * the bottom has something solid to sit against.
 */
export const VideoOverlay = {
  /** Backdrop opacity on Landing. The auth screens use 0.55. */
  videoOpacity: 0.95,
  signUpVideoOpacity: 0.55,
  /** linear-gradient(to bottom, ...) — colors and their stops, in order. */
  /*
    Landing only. Since 2026-11-16 its copy and buttons stand on this gradient
    alone, with no glass panel: dark behind the logo, clear over the upper half
    where the people in the photos are, and dark again from where the headline
    starts.
  */
  gradientColors: [
    'rgba(6,6,8,0.35)',
    'rgba(6,6,8,0)',
    'rgba(6,6,8,0.1)',
    'rgba(6,6,8,0.78)',
    'rgba(6,6,8,0.97)',
  ] as const,
  gradientLocations: [0, 0.2, 0.42, 0.64, 1] as const,
  /*
    06 Sign Up darkens differently from Landing: it starts far darker at the top
    (0.55 vs 0.25) and lifts in the upper third rather than the middle, because its
    headline sits in the vertical centre where Landing's sits low. Reusing Landing's
    curve washes the headline out.
  */
  signUpGradientColors: [
    'rgba(6,6,8,0.55)',
    'rgba(6,6,8,0.3)',
    'rgba(6,6,8,0.65)',
    'rgba(6,6,8,0.96)',
  ] as const,
  signUpGradientLocations: [0, 0.3, 0.62, 1] as const,
  /** Tiling noise overlay — 160x160 tile at 3.5% opacity. */
  grainTile: 160,
  grainOpacity: 0.035,
} as const;

/**
 * The photo backdrop's motion (`BackgroundSlideshow`): each photo travels
 * slowly while it is shown and the next one dissolves in over it.
 */
export const Backdrop = {
  /** How long a photo is shown before the next one starts to fade in. */
  holdMs: 4800,
  /** The dissolve. Long on purpose — it should be noticed late, if at all. */
  fadeMs: 1800,
  /** The slow zoom. `zoomFrom` is above 1 so the drift never shows an edge. */
  zoomFrom: 1.06,
  zoomTo: 1.16,
  /** Sideways travel over one showing, in points. */
  drift: 14,
} as const;

/**
 * The ambient glow — a large soft light that travels across the onboarding flow.
 *
 * In the design this is a blurred radial gradient, mostly offscreen, that moves and
 * dims as the user advances: brightest and low on the right at step 1, sweeping up
 * and left, settling centered overhead by the pricing screen.
 *
 * `top`/`left` are fractions of the screen (left: 0.9 = the design's `left:90%`), so
 * the motif scales across device sizes instead of being pinned to a 390x844 frame.
 * `size` stays in points — it is a light source, not a layout element.
 */
export const Glow = {
  /**
   * The light's color, as an `rgba(` prefix awaiting an alpha. AmbientGlow builds each
   * concentric ring's fill from this.
   */
  core: 'rgba(240,237,232,',
  /**
   * The design's shared falloff: peak at centre, ~1/3 peak at 42%, transparent at 74%.
   * Recorded here as the spec; the ring alphas that approximate it are solved in
   * components/ui/ambient-glow.tsx.
   */
  midStop: 0.42,
  edgeStop: 0.74,
  midRatio: 1 / 3,
} as const;

/**
 * Where the glow sits on each screen, transcribed from the prototype.
 * `left`/`top` are screen fractions; `top` may be negative (above the viewport).
 */
export const GlowPreset = {
  /** 02 · Event — brightest, low and to the right. */
  event: { size: 600, opacity: 0.18, left: 0.9, top: 0.07 },
  /** 03 · Format — sweeps up and to the left. */
  format: { size: 560, opacity: 0.16, left: 0.1, top: -0.26 },
  /** 04 · Event End */
  ending: { size: 600, opacity: 0.16, left: 0.2, top: -0.19 },
  /** 05.1 · Group, Length & Price — settles centered overhead. */
  groupSize: { size: 600, opacity: 0.16, left: 0.5, top: -0.19 },
  /** 09 · Invite / Share */
  invite: { size: 520, opacity: 0.12, left: 0.5, top: -0.19 },
  /** 14 · Creating Your Film */
  processing: { size: 560, opacity: 0.14, left: 0.5, top: -0.19 },
  /** 15 · Your Films (empty) */
  films: { size: 520, opacity: 0.1, left: 0.5, top: -0.19 },
  /** 20 · Settings */
  settings: { size: 480, opacity: 0.1, left: 0.5, top: -0.19 },
} as const;

export type GlowPresetName = keyof typeof GlowPreset;

/**
 * The onboarding step indicator.
 *
 * Every slot is `activeWidth` wide so the row's layout never changes as the
 * active pill travels through it — see components/ui/progress-dots.tsx.
 */
export const StepDots = {
  height: 5,
  /** An inactive or completed step. */
  dotWidth: 6,
  /** The active pill, and therefore the width of every slot. */
  activeWidth: 24,
  gap: 0,
  /**
   * Distance from the top of a screen's safe area to the centre of the indicator.
   *
   * The dots are rendered by (onboarding)/_layout.tsx, outside any screen, so
   * they cannot be centred by the header row itself. This lines them up with the
   * middle of the 38px back button that each screen still draws — half the button
   * minus half the dot height.
   */
  headerCenterOffset: 38 / 2 - 5 / 2,
} as const;

/** Selectable icon+label chip — the event-type picker (02), duration legend (05.1). */
export const ChoicePill = {
  paddingY: 11,
  paddingX: 16,
  gap: 8,
  iconSize: 16,
} as const;

/** Labeled text input — film name (02), the name prompt (06), guest name (11). */
export const Field = {
  paddingY: 15,
  paddingX: 16,
  fontSize: 15,
  /** Gap between the uppercase label and the input. */
  labelGap: 6,
  bg: 'rgba(255,255,255,0.06)',
} as const;

/**
 * 04 · Event End, rebuilt 2026-11-15. Top to bottom: the question, the answer
 * written large, and the two
 * wheels (days, sideways; time, upright). Nothing behind a popover.
 */
export const Ending = {
  /** Back button -> headline -> answer -> card -> CTA. */
  headerGap: 28,
  headlineGap: 22,
  answerGap: 22,
  ctaGap: 20,
  /** The answer: the chosen moment, and how far away it is. */
  answer: {
    gap: 6,
    /** The line under it once the moment lies in the past. */
    pastColor: 'rgba(255,170,150,0.9)',
  },
  /** The rule between the two wheels — there is no surface around them. */
  hairline: 'rgba(255,255,255,0.08)',
  /** One day on the sideways wheel: weekday, numeral, month. */
  day: {
    width: 56,
    height: 78,
    gap: 4,
    radius: 16,
    /** How many days the wheel offers — two months covers any real event. */
    count: 60,
    /** Opacity and scale under the band, one day out, and at the card's edge. */
    fade: [1, 0.5, 0] as const,
    scale: [1, 0.86, 0.7] as const,
  },
} as const;

/**
 * The time wheel behind 04's Ending Time pill.
 *
 * Modelled on the iOS Clock app: short columns of numerals running under one
 * fixed selection band, the rows tilting away as they leave the centre as though
 * wrapped around a cylinder.
 *
 * RN cannot draw a real cylinder, so the curve is approximated per row from a
 * `perspective` + `rotateX` + `scale` keyed on distance from the centre — the
 * same class of approximation `ambient-glow.tsx` and the 05.1 dial make, and at
 * five rows it is close enough that the seams do not show.
 *
 * The columns are a fixed width and centred rather than `flex: 1` across the
 * panel: hour and minute are one reading, and spreading them to the panel's
 * edges would read as two unrelated lists.
 */
export const Wheel = {
  /** Height of one row, and the scroll snap interval. */
  itemHeight: 40,
  /** Rows visible at once. Odd, so exactly one is centred in the band. */
  visibleCount: 5,
  columnWidth: 64,
  /** Matches Spacing.sm, which is declared below this. */
  columnGap: 10,
  /** The band behind the centre row, drawn once across all the columns. */
  band: {
    radius: 12,
    bg: 'rgba(255,255,255,0.06)',
  },
  /** Opacity at 0, 1 and 2 rows from the centre. */
  fade: [1, 0.5, 0.22] as const,
  /** Scale at the same three distances — the cylinder turning away. */
  scale: [1, 0.92, 0.84] as const,
  /** Tilt per row of distance, and the cap once the rows are edge-on. */
  degreesPerRow: 24,
  maxDegrees: 62,
  /** Viewing distance for that tilt. Lower is a more pronounced curve. */
  perspective: 620,
} as const;


/** Landing header (01): logo mark + wordmark row. */
export const LandingHeader = {
  paddingTop: 68,
  paddingX: 32,
  logoSize: 22,
  logoGap: 10,
  /** Glass icon button is 36px here, not the standard 38px back button. */
  actionSize: 36,
} as const;

/** Landing bottom glass panel (01) — pinned, not padded by Screen. */
export const LandingPanel = {
  /** Side inset of the copy and buttons, which stand directly on the photos (= Spacing.screenX). */
  inset: 28,
  bottom: 44,
  /** Headline -> subcopy. */
  headlineGap: 6,
  /** Subcopy -> the provider row. */
  subcopyGap: 28,
  /** Provider row -> "Join a Group", the artboard's gap between its two CTAs. */
  ctaGap: 10,
  /** The actions block -> whatever follows it (a note, or the fine print). */
  actionsGap: 20,
  /** A note or error line -> the fine print. Matches SignUp.noteGap. */
  noteGap: 14,
} as const;

export const Radii = {
  /** Fully rounded pill buttons */
  pill: 999,
  /** Bottom sheets & glass panels */
  sheet: 28,
  /** Sheet variant used by the group-info popup */
  sheetSm: 26,
  /** Cards */
  card: 20,
  /** 16's event cards — larger than the 20 used elsewhere, as drawn. */
  cardLg: 24,
  /** 15's 64px empty-state icon tile */
  tile: 18,
  /** Text inputs */
  field: 14,
  /** 11's guest-name input — larger than the 14px used elsewhere, as drawn. */
  fieldLg: 18,
} as const;

export const Spacing = {
  /** Standard horizontal screen padding */
  screenX: 28,
  /** Standard top padding below the status bar */
  screenTop: 58,
  /** Standard bottom padding */
  screenBottom: 52,
  xs: 6,
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  xxl: 44,
} as const;

/** Vertical padding on a primary/secondary pill button. */
export const PillPaddingY = 17;

/**
 * The two side-by-side provider buttons — Landing (01) and the guest's keep screen.
 *
 * Close to PillButton but smaller on every axis (16/12 padding vs 17/28, 15px
 * weight 600 vs 16px weight 500) and sized by `flex: 1` rather than full width,
 * so it carries its own metrics — the same call already made for StatusPill.
 */
export const AuthButton = {
  paddingY: 16,
  paddingX: 12,
  /** Icon to label. */
  gap: 8,
  iconSize: 17,
  /** Between the two buttons. */
  rowGap: 10,
} as const;

/**
 * Terms and Privacy (not in the prototype — these screens have no artboard).
 *
 * Long-form reading rather than a designed frame, so the values are set for
 * legibility: a wider line height than Typography.body's default and generous
 * separation between sections, which is what makes a wall of clauses scannable.
 */
export const LegalPage = {
  /** Headline to the "last updated" line. */
  headlineGap: 6,
  /** Between one section and the next. */
  sectionGap: 28,
  /** A section's heading to its first paragraph. */
  headingGap: 10,
  /** Between paragraphs inside one section. */
  paragraphGap: 12,
  /** Body line height for sustained reading. */
  lineHeight: 22,
  /** Bullet glyph to its text. */
  bulletGap: 10,
  /** Trailing space so the last line clears the home indicator. */
  paddingBottom: 44,
} as const;

/**
 * The centred-headline auth screens — `(auth)/name` and `(auth)/keep`.
 *
 * Named for screen 06, whose artboard these values come from; that screen became
 * the name step when sign-in moved to Landing, and the keep screen reuses its
 * layout so the two read as the same kind of moment.
 */
export const SignUp = {
  /** The artboard's `padding: 58px 28px 40px`; 02-05.1 use Spacing.screenBottom (52). */
  paddingBottom: 40,
  /** Headline to subcopy. */
  headlineGap: 14,
  /** The centred block's own `padding: 0 6px`. */
  centerPaddingX: 6,
  /** Button row to the note or error line beneath it. */
  noteGap: 14,
} as const;

/**
 * 09 · Invite / Share — the QR card, the two share pills and the screen's spacing.
 *
 * The artboard draws no back button here: the header is a bare 38px spacer, which
 * is the footprint of one, followed by 02/03's gap of 52. That is kept as drawn —
 * 05.1 reaches this screen with `router.replace`, so there is nothing to go back to.
 */
export const Invite = {
  /** The event image behind the top of 09 (2026-11-21), gone before the code. */
  backdrop: {
    heightRatio: 0.42,
    fade: ['rgba(16,16,16,0.35)', 'rgba(16,16,16,0.55)', 'rgba(16,16,16,0.9)', '#101010'],
    fadeLocations: [0, 0.4, 0.8, 1],
  },
  /** The artboard's `padding: 58px 28px 46px`; 02-05.1 use 52, 06 uses 40. */
  paddingBottom: 46,
  /** The empty header spacer — a back button's height, with no button in it. */
  headerHeight: 38,
  /** Spacer -> headline. */
  headerGap: 52,
  /** Headline -> subcopy. */
  headlineGap: 10,
  /** The headline block -> the QR card. */
  blockGap: 36,
  /** QR card -> the share button row. */
  qrGap: 32,
  /** The QR matrix itself, inside the card's padding. */
  qrSize: 180,
  /** The card's radius. Radii has 20/26/28 — the artboard uses 24 here. */
  qrRadius: 24,
  /** The light card's padding, which doubles as the QR's quiet zone. */
  qrPadding: 20,
  /** The artboard's subcopy is 0.38; Colors.textDim is 0.42. */
  subcopy: 'rgba(240,237,232,0.38)',
  /**
   * The two side-by-side pills. Full PillButton height (17), but `flex: 1` and a
   * 14px label rather than 16 — the same near-miss that produced AuthButton.
   */
  button: {
    gap: 8,
    iconSize: 15,
    /** Between the two buttons. */
    rowGap: 10,
  },
} as const;

export const Shadows = {
  /** Primary pill: inset top highlight + drop shadow. RN has no inset shadow, so
   *  the highlight is rendered as a separate overlay view inside PillButton. */
  pill: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOpacity: 0.3,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
    },
    default: { elevation: 4 },
  }),
  /** Glass panel: 0 32px 64px rgba(0,0,0,0.5) */
  panel: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOpacity: 0.5,
      shadowRadius: 32,
      shadowOffset: { width: 0, height: 32 },
    },
    default: { elevation: 12 },
  }),
  /**
   * 09's QR card: 0 24px 64px rgba(0,0,0,0.6). Heavier than `panel` — it is a
   * light surface on a near-black screen and needs the separation.
   */
  qrCard: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOpacity: 0.6,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 24 },
    },
    default: { elevation: 10 },
  }),
  /**
   * 18's toast: 0 16px 40px rgba(0,0,0,0.5). Applied to a wrapper *outside* the
   * BlurView, for the same reason GlassPanel splits them — a BlurView clips its
   * own shadow on iOS.
   */
  toast: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOpacity: 0.5,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 16 },
    },
    default: { elevation: 14 },
  }),
} as const;

/** Blur intensity for glass surfaces (design: backdrop-filter blur 40–48px). */
export const BlurIntensity = {
  panel: 40,
  button: 28,
  scrim: 6,
} as const;

/**
 * Standard transition: 0.5–0.6s, cubic-bezier(0.22, 0.8, 0.2, 1).
 * Feed `Motion.bezier` into Reanimated's `Easing.bezier(...)`.
 */
export const Motion = {
  duration: 550,
  bezier: [0.22, 0.8, 0.2, 1] as const,
  /** Recording pulse / blink cycle */
  pulseDuration: 1100,
} as const;

/**
 * 03 · Film — the four look cards, in a two-by-two grid.
 *
 * Not in the prototype: this screen replaced "Format" when LEFT became a photo
 * app. Geometry only — the two-state palette is LookCardState; the artwork is a
 * sample photo drawn by `LookPreview`.
 */
export const LookCard = {
  /** Between cards, both axes. */
  gap: 12,
  radius: 18,
  /** A little taller than wide, like a print — the tallest a card gets. */
  aspectRatio: 4 / 5,
  /**
   * The shortest a card may be squeezed to so both rows fit without scrolling.
   * Below this (a small phone at a large text size) the grid scrolls instead.
   */
  minHeight: 132,
  /** Name and blurb sit inside the card, bottom-left. */
  padding: 14,
  /** Name -> blurb. */
  textGap: 3,
  nameSize: 19,
  blurbSize: 11,
  blurbLineHeight: 15,
  /** Press-in scale. Feedback lands on touch-down, not on release. */
  pressedScale: 0.97,
  pressSpring: { damping: 18, stiffness: 260 },
  /** Headline -> grid, and the eyebrow/headline rhythm 02 uses. */
  headerGap: 52,
  eyebrowGap: 14,
  /** Behind the preview while the sample photo decodes. */
  bg: '#141316',
  /** Bottom-up darkening under the name and blurb, so they read over any photo. */
  textScrim: ['rgba(8,8,10,0)', 'rgba(8,8,10,0.55)', 'rgba(8,8,10,0.9)'] as const,
  textScrimLocations: [0.35, 0.7, 1] as const,
} as const;

/**
 * Selected / unselected pairs for a look card.
 *
 * Ordered [unselected, selected] so a card can pick its end with one flag and
 * animate between them.
 */
export const LookCardState = {
  border: ['rgba(255,255,255,0.07)', 'rgba(255,255,255,0.55)'] as const,
  /** Flat dim over the photo — light, so an unchosen look can still be judged. */
  dim: ['rgba(0,0,0,0.28)', 'rgba(0,0,0,0)'] as const,
  name: ['rgba(240,237,232,0.72)', 'rgba(240,237,232,1)'] as const,
  blurb: ['rgba(240,237,232,0.5)', 'rgba(240,237,232,0.8)'] as const,
} as const;

/**
 * 05.1 · Group Size — the "Up to N people" line and the row of preset circles.
 *
 * The circles grow 14 → 31px across the seven presets, so size *is* the value:
 * the diameters are data, not decoration, and they pair with GROUP_PRESETS in
 * lib/pricing.ts index for index.
 */
export const GroupRow = {
  /**
   * Back button -> headline. The prototype uses 36 here, between 02/03's 52 and
   * 04's 44 — this screen is the densest in the flow and needs the room.
   */
  headerGap: 36,
  /** Headline -> subcopy. */
  headlineGap: 10,
  /** Subcopy -> the "Up to N people" row. */
  subcopyGap: 26,
  /** Summary row -> circle row. */
  headingGap: 12,
  /** Circle row -> divider. */
  bottomGap: 26,
  /** The prototype's `padding: 4px 2px 0` on the circle row. */
  rowPaddingTop: 4,
  rowPaddingX: 2,
  /** Circle diameters, one per GROUP_PRESETS entry. */
  sizes: [14, 17, 20, 23, 26, 28, 31] as const,
  /** Circle -> its numeral. */
  labelGap: 7,
  labelSize: 9,
  labelLetterSpacing: 9 * 0.02,
  borderWidth: 1.5,
  /**
   * The selected circle's `0 0 0 4px rgba(240,237,232,0.14)` halo. RN has no
   * spread-only shadow, so it is a second circle behind the first, 8px wider.
   */
  ringWidth: 4,
  ringColor: 'rgba(240,237,232,0.14)',
  /** Price beside the group summary. */
  priceSize: 14,
  /** Divider under the circle row — the prototype is 0.08, lighter than hairline. */
  divider: 'rgba(255,255,255,0.08)',
  dividerGap: 24,
} as const;

/** Ordered [unselected, selected], the same idiom as FilmStripState. */
export const GroupCircleState = {
  // Zero-alpha cream, not the keyword `transparent` — see LengthChoiceState for
  // why. `transparent` is rgba(0,0,0,0), so animating it to the opaque cream of
  // the selected state drags the circle through grey on the way in.
  fill: ['rgba(240,237,232,0)', Colors.text] as const,
  border: ['rgba(255,255,255,0.18)', Colors.text] as const,
  label: ['rgba(240,237,232,0.3)', 'rgba(240,237,232,0.9)'] as const,
  /** The halo's opacity, so it fades in rather than popping. */
  ring: [0, 1] as const,
} as const;

/**
 * 05.1 · The film-length options — one card per length the group may choose.
 *
 * This replaces a meter *and* an "Adjust" popover. The meter drew the chosen
 * length as a bar against a fixed 10-minute scale, which answered a question
 * nobody asked ("how does my film compare to the longest one possible?") and
 * left every small group staring at a bar that could never fill. The popover
 * then hid the actual choice behind a second tap, so the one thing on the
 * screen that *was* adjustable was the one thing you could not see.
 *
 * Both are now the same object: the options are laid out face-up, and the
 * selected one is the readout. A card carries the length above the only number
 * that distinguishes the choices — roughly how long each person gets to film —
 * because that is the trade, and without it the longest option is strictly
 * better and the control is decoration.
 *
 * Two or three cards, from `adjustOptionsFor()`. They share the row's width
 * equally, so the row stays a row at every group size.
 */
export const LengthChoice = {
  /** Inside a card. Tall enough that two lines of text are not cramped. */
  paddingY: 14,
  paddingX: 10,
  radius: Radii.card,
  /** Between cards. */
  gap: 8,
  /** Section label -> the row. */
  labelGap: 14,
  /** The duration -> the per-person line inside a card. */
  lineGap: 5,
  /** The big duration on a card — DM Serif, a little under `Typography.numeric`'s 28. */
  durationSize: 22,
  /** The "~18s each" line under it. */
  perPersonSize: 11,
  /** Row -> the sentence that explains what the per-person number is. */
  footnoteGap: 14,
} as const;

/**
 * 05.1's roll cards — six in one row (5 · 10 · 16 · 24 · 36 · ∞), so they are
 * narrower than the cards LengthChoice was first drawn for.
 */
export const RollChoice = {
  ...LengthChoice,
  paddingX: 2,
  gap: 6,
  /** The numeral. DM Serif; "36" has to fit a ~46px card. */
  numeralSize: 21,
} as const;

/**
 * Ordered [unselected, selected], the same idiom as `GroupCircleState`.
 *
 * The unselected background is a zero-alpha *cream*, not the keyword
 * `transparent`. They look identical at rest — both invisible — but they do not
 * animate identically. `transparent` parses as `rgba(0,0,0,0)`, so interpolating
 * it toward the opaque cream of the selected state sweeps RGB from black to
 * cream as alpha rises, darkening the card through the middle of the transition
 * while the label animates toward near-black. That collision is what made a
 * newly-selected card's number vanish on a group change. Matching the RGB to the
 * destination leaves alpha as the only channel that moves.
 */
export const LengthChoiceState = {
  bg: ['rgba(240,237,232,0)', Colors.text] as const,
  border: ['rgba(240,237,232,0.28)', Colors.text] as const,
  duration: ['rgba(240,237,232,0.75)', Colors.onLight] as const,
  /** The per-person line, a step quieter than the duration at both ends. */
  perPerson: ['rgba(240,237,232,0.4)', 'rgba(11,11,12,0.6)'] as const,
} as const;

/**
 * 08 · Join Group Sheet — the glass panel and the two cards inside it.
 *
 * The panel is `GlassPanel` with the artboard's own padding rather than the
 * Landing panel's 32/24/28, and its blur is 48 where Landing's is 40.
 */
export const JoinSheet = {
  /** 08 opens straight into the scanner (2026-11-21): its title and the link note. */
  scanner: {
    /** Over the screen below while the camera starts. */
    scrim: 'rgba(16,16,16,0.72)',
    cameraFadeMs: 220,
    titleTop: 64,
    hintBottom: 16,
    hintRadius: 20,
    hintPaddingX: 16,
    hintPaddingY: 14,
    hintGap: 12,
    hintIcon: 16,
  },
  /** The artboard's `padding: 12px 24px 52px` on the panel. */
  paddingTop: 12,
  paddingX: 24,
  paddingBottom: 52,
  /** Video dim behind the panel — heavier than Landing's gradient, which this replaces. */
  scrim: 'rgba(0,0,0,0.55)',
  /** Drag handle -> headline row. */
  handleGap: 28,
  /** Headline row -> the QR card. */
  headerGap: 36,
  /** Headline -> its subcopy. */
  headlineGap: 6,
  /** The circular close button, smaller than the standard 38px back button. */
  closeSize: 34,
  /** Its fill — lighter than Colors.glassButton, which would read as a CTA here. */
  closeBg: 'rgba(255,255,255,0.05)',
  /** Close button -> the headline block. */
  closeGap: 12,
  card: {
    /** The artboard's `padding: 32px 24px` on the QR card. */
    paddingY: 32,
    paddingX: 24,
    bg: 'rgba(255,255,255,0.03)',
    border: 'rgba(255,255,255,0.08)',
    /** The ring around the QR glyph. */
    ringSize: 88,
    ringBorder: 'rgba(240,237,232,0.08)',
    glyphSize: 52,
    /** Ring -> title. */
    ringGap: 18,
    /** Title -> its explanation. */
    titleGap: 6,
  },
  /** The OR divider's own vertical margin. */
  dividerGap: 20,
  dividerColor: 'rgba(255,255,255,0.06)',
  dividerTextGap: 12,
  /** The non-interactive "Shared Link" row. */
  linkRow: {
    paddingY: 20,
    paddingX: 22,
    gap: 16,
    bg: 'rgba(255,255,255,0.025)',
    border: 'rgba(255,255,255,0.07)',
    /** The rounded-square icon tile. */
    tileSize: 44,
    tileRadius: 12,
    tileBg: 'rgba(255,255,255,0.04)',
    iconSize: 24,
    /** Title -> its explanation. */
    titleGap: 4,
  },
} as const;

/**
 * 10 · Your Group — the roster chips, the spots-left pill and the screen's spacing.
 */
export const Group = {
  /** The artboard's `padding: 58px 28px 40px`. */
  paddingBottom: 40,
  /** Header row -> eyebrow. */
  headerGap: 40,
  /** Eyebrow -> headline. */
  eyebrowGap: 12,
  /** Headline -> the chip row. */
  headlineGap: 36,
  /**
   * Height reserved for the two-line headline while the roster loads.
   *
   * The headline is held back until the count is real — flashing "0 people" and
   * correcting it reads as a bug — so something has to hold its place or the
   * chips jump up the screen. Two lines of DisplaySize.lg at the 1.15 leading
   * `displayBase` applies.
   */
  headlineHeight: Math.round(DisplaySize.lg * 1.15) * 2,
  /** Chip row -> the status pill. */
  chipsGap: 32,
  /** Status pill -> the CTA. */
  statusGap: 12,
  /** The film-camera icon on "Start the Event" — 17px, larger than PillButton's 16. */
  ctaIconSize: 17,
  chip: {
    /** The artboard's asymmetric `padding: 9px 14px 9px 9px` — tighter on the avatar side. */
    paddingY: 9,
    paddingLeft: 9,
    paddingRight: 14,
    /** Avatar -> name, and between chips. */
    gap: 8,
    avatarSize: 26,
    avatarBg: 'rgba(255,255,255,0.1)',
    bg: 'rgba(255,255,255,0.06)',
    border: 'rgba(255,255,255,0.12)',
    /** A chip for someone who joins while the host watches grows from this size. */
    enterScale: 0.6,
    /** Reduced motion: it fades in instead. */
    fadeMs: 200,
  },
  status: {
    paddingY: 6,
    paddingX: 13,
    gap: 6,
    dotSize: 6,
    bg: 'rgba(255,255,255,0.05)',
    /** Between the joined counter and the spots-left pill. */
    rowGap: 8,
  },
  /**
   * The empty state — the host alone, waiting for anyone to arrive.
   *
   * Not in the artboard, which draws a group of five already assembled. But the
   * host reaches this screen straight from sharing the invite, so *nobody has
   * joined yet* is the state they actually see first, and an empty screen with a
   * live "Start the Event" button reads as broken rather than as waiting.
   */
  waiting: {
    /** Spinner -> its label. */
    gap: 14,
    /** The roster above -> the waiting row. */
    rosterGap: 28,
  },
} as const;

/**
 * 10.1 · Your Group — Info. The sheet is inset from the screen edges and floats
 * above the bottom, unlike the other modals which are pinned flush to it.
 */
/**
 * The delete-account confirmation sheet.
 *
 * Not in the artboard — the prototype has no account deletion at all, which is
 * itself the reason this exists (Apple 5.1.1(v) requires it). Built on the same
 * `Sheet` chrome as 08 and 10.1 rather than an `Alert`: the consequences take
 * three sentences to state honestly, and an alert that long stops being read.
 *
 * Geometrically follows `GroupInfo`, which is the sheet it sits closest to.
 */
export const DeleteAccount = {
  paddingTop: 28,
  paddingX: 24,
  paddingBottom: 24,
  /** Drag handle -> headline. */
  handleGap: 22,
  /** Headline -> the consequences. */
  headlineGap: 12,
  /** Between the bullet lines. */
  bulletGap: 10,
  /** Bullet glyph -> its text. */
  bulletTextGap: 8,
  /** The consequences -> the buttons. */
  actionsGap: 26,
  /** Between the two buttons. */
  buttonGap: 10,
  buttonPaddingY: 16,
} as const;

/**
 * 11 · Guest — Your Name.
 *
 * The only screen in the app with no header row at all: a guest arriving by link
 * has nothing behind them to go back to.
 */
export const Guest = {
  /** The artboard's `padding: 72px 28px 48px` — a deeper top than the standard 58. */
  paddingTop: 72,
  paddingBottom: 48,
  /** Eyebrow -> headline. */
  eyebrowGap: 14,
  /** Headline -> the input. */
  headlineGap: 52,
  /** Input -> the helper line. */
  helperGap: 16,
  field: {
    /** Roomier than Field's 15/16 — this is the screen's only control. */
    paddingY: 18,
    paddingX: 20,
    fontSize: 18,
    border: 'rgba(255,255,255,0.16)',
    bg: 'rgba(255,255,255,0.05)',
  },
  /** The helper line sits at 0.2 alpha, dimmer than Colors.textGhost's 0.22. */
  helper: 'rgba(240,237,232,0.2)',
} as const;

/**
 * The ring spinner (`components/ui/spinner.tsx`). The name is what is left of
 * the old "14 · Creating Your Film" frame, whose screen and bar are gone.
 */
export const Processing = {
  spinner: {
    size: 88,
    borderWidth: 2,
    /** The three-quarters of the ring that stays dim. */
    track: 'rgba(255,255,255,0.1)',
    /** The leading edge, which is what reads as motion. */
    head: Colors.text,
    /** One full rotation. Linear — an eased spin looks like it is struggling. */
    duration: 1000,
  },
} as const;

/**
 * 12 · Guest — Waiting for Host.
 *
 * From the artboard's waiting card: `padding:18px 20px`, radius 16, a hairline at
 * 0.06 and a fill at 0.025 — fainter than `Colors.card`, because this sits on the
 * page rather than floating above it.
 */
export const Waiting = {
  /** Headline -> the card. */
  headlineGap: 40,
  cardPadding: 18,
  cardRadius: 16,
  cardBorder: 'rgba(255,255,255,0.06)',
  cardBg: 'rgba(255,255,255,0.025)',
  /** Ping -> copy. */
  cardGap: 14,
  /**
   * The waiting card -> the shared-budget explainer beneath it.
   *
   * Not in the artboard, which draws the wait and nothing else. Wider than the
   * gaps inside the card because it separates two subjects — what is happening
   * now, and how the thing they have joined works — rather than two parts of one.
   */
  explainerGap: 36,
  /** The expanding ring's footprint, and the solid dot inside it. */
  /** Larger since 2026-11-21 (the user: "a little more present"). */
  pingSize: 22,
  dotSize: 11,
  /** Nudged down to sit on the copy's first baseline. */
  pingOffset: 2,
  /** The artboard's `wait-ping 2s cubic-bezier(0,0,0.2,1) infinite`. */
  pingDuration: 2000,
  pingScale: 2.4,
  pingOpacity: 0.45,

  /** The moment's look on the sample photo, fading into the page (2026-11-21). */
  backdrop: {
    heightRatio: 0.5,
    /** Where the title starts, as a share of the backdrop's height. */
    titleAt: 0.62,
    /** Headline -> the card, tighter than the old 40 now that the page is full. */
    headlineGap: 24,
    fade: ['rgba(16,16,16,0.25)', 'rgba(16,16,16,0.1)', 'rgba(16,16,16,0.75)', '#101010'],
    fadeLocations: [0, 0.3, 0.75, 1],
  },
  /** "24 photos each" · "Develops Sat, 22 Nov at 23:00" under the wait. */
  fact: {
    top: 24,
    gap: 12,
    iconSize: 16,
    iconGap: 10,
  },
  /** Names prompt -> the "How it works" button at the foot. */
  footGap: 16,
  /** The QR button, top right over the event image. */
  chromeInset: 8,
  qrIconSize: 20,
} as const;

/** 03.1 · Event image — the creation step after the look (2026-11-21). */
export const CoverStep = {
  headerGap: 8,
  eyebrowGap: 12,
  headlineGap: 10,
  enterDelayMs: 120,
  previewPaddingY: 20,
  previewMaxHeight: 420,
  previewRadius: 18,
  tile: 64,
  tileGap: 10,
  tileRadius: 12,
  selectedWidth: 2,
  iconSize: 18,
  badge: 30,
  badgeBg: 'rgba(16,16,16,0.6)',
} as const;

/**
 * The iPhone the app draws around a preview (`components/ui/phone-frame.tsx`,
 * 1.3.0): the website's own frame — Mockify's iPhone 17 Pro (MIT, from
 * Apple's design resources), `assets/images/device/iphone-frame.png` — with
 * the display's place in it as fractions of the picture. What is shown inside
 * is laid out on a canvas `canvasWidth` points wide and scaled to fit, so it
 * is the real layout, small.
 */
export const PhoneFrame = {
  frameWidth: 1350,
  frameHeight: 2760,
  screenLeft: 0.054815,
  screenTop: 0.025725,
  screenWidth: 0.88963,
  screenHeight: 0.948188,
  /** The display's corner radius, as a share of the frame's width. */
  screenRadius: 0.146667,
  canvasWidth: 402,
} as const;

/**
 * The invitation (1.3.0): what a guest sees on 11 when they open the link —
 * the event image, who invites, the name, when it develops and the roll —
 * and the host's designer for it (creation step 4, "Change image").
 */
export const InviteCard = {
  /** The picture's share of the card's height, in the preview. */
  imageShare: 0.66,
  /** The picture's share of the window on 11, where the keyboard needs room. */
  joinShare: 0.46,
  /** The picture dissolves into the page under the text. */
  fade: ['rgba(16,16,16,0)', 'rgba(16,16,16,0.7)', '#101010'] as const,
  fadeLocations: [0.38, 0.78, 1] as const,
  paddingX: 28,
  paddingBottom: 6,
  chip: {
    paddingX: 12,
    paddingY: 6,
    gap: 6,
    icon: 12,
    bg: 'rgba(16,16,16,0.5)',
    border: 'rgba(255,255,255,0.14)',
    marginBottom: 12,
  },
  nameGap: 10,
  meta: { gap: 16, itemGap: 6, icon: 13 },
  /** The stand-in field and button under the picture in the preview. */
  form: { paddingTop: 22, gap: 12, buttonHeight: 54 },
  designer: {
    /** The phone never grows past this, however tall the screen. */
    maxPhoneWidth: 260,
    paddingY: 16,
    /** The row of text links under "Change image". */
    linksHeight: 44,
    linksGap: 28,
    linkHitSlop: 10,
  },
  preview: { closeInset: 16 },
  /** 11, under the picture: picture -> headline -> field. */
  join: { top: 22, headlineGap: 20 },
} as const;

/**
 * 05.1's group picker (1.3.0): one bar, seven segments, a light thumb that
 * slides to the choice on a spring. Replaces the row of growing circles.
 */
export const GroupSegments = {
  height: 44,
  padding: 3,
  bg: 'rgba(255,255,255,0.06)',
  border: 'rgba(255,255,255,0.1)',
  fontSize: 14,
  /** [unselected, selected] — the selected numeral stands on the light thumb. */
  label: ['rgba(240,237,232,0.55)', '#0b0b0c'] as const,
  /** "Up to 25 people" + price -> the bar. */
  headingGap: 14,
  priceSize: 19,
} as const;

/**
 * LEFT's camera as a still inside `PhoneFrame` (1.3.0) — laid out on the
 * frame's 402 pt canvas, so the values are real-screen sizes. On 05.1 its
 * counter rolls to the roll the host picks.
 */
export const CameraMock = {
  viewfinderRadius: 32,
  /** Under the Dynamic Island. */
  top: 74,
  nameGap: 6,
  topFade: ['rgba(10,10,11,0.6)', 'rgba(10,10,11,0)'] as const,
  topFadeHeight: 240,
  bar: { paddingX: 40, paddingTop: 26, paddingBottom: 52 },
  tile: 52,
  tileRadius: 14,
  tileIcon: 20,
  shutter: 78,
  shutterRing: 4,
  shutterGap: 4,
} as const;

/** 05.1's roll section (1.3.0): the mock camera beside the roll cards, three to a row. */
export const RollSetup = {
  phoneWidth: 124,
  gap: 20,
  /** Share of the row one card takes when three stand side by side. */
  cardBasis: '28%',
  summaryGap: 12,
  footnoteGap: 4,
} as const;

/** "Your film is ready" — the sheet after an event was created (1.3.0). */
export const FilmReady = {
  cardHeight: 250,
  cardRadius: 22,
  cardBorder: 'rgba(255,255,255,0.1)',
  textGap: 6,
  ctaGap: 6,
} as const;

/**
 * 01's showcase (1.3.0): LEFT running inside the phone — camera, developing,
 * reveal. Sizes inside the phone are on `PhoneFrame`'s 402 pt canvas.
 */
export const LandingShowcase = {
  /** The roll the camera starts on, and how many frames it takes per loop. */
  roll: 24,
  shots: 4,
  /** One beat of the story. */
  stepMs: 950,
  /** Beats the developed album is held before the loop starts over. */
  holdSteps: 4,
  tiltDeg: -5,
  floatMs: 3200,
  floatTravel: 10,
  flashOpacity: 0.85,
  flashInMs: 60,
  flashOutMs: 320,
  columns: 3,
  rows: 4,
  gap: 6,
  /** (402 - 4 gaps of 6) / 3. */
  print: 126,
  printRadius: 10,
  blur: 36,
  dim: 'rgba(16,16,16,0.45)',
  revealMs: 520,
  revealStaggerMs: 70,
  header: { top: 74, paddingX: 22, bottom: 18, gap: 4, titleSize: 30, countGap: 10 },
  /** The phone between the logo and the copy: never wider, and room around it. */
  maxWidth: 230,
  marginY: 18,
  /** The glow behind the phone. */
  glow: 'films',
} as const;

/** Event settings (1.3.0) — the host's sheet: name, end, reveal, invitation. */
export const EventSettings = {
  loadingHeight: 160,
  sectionTop: 10,
  sectionGap: 4,
  pillGap: 8,
  pillTop: 8,
  rowIcon: 17,
  rowGap: 12,
  rowPaddingY: 16,
  errorHeight: 18,
} as const;

/** 04.2 · When the photos show (1.3.0): three prints, a caption, three choices. */
export const RevealStep = {
  headerGap: 44,
  headlineGap: 24,
  print: { width: 96, sideWidth: 78, gap: 10, radius: 12, dim: 'rgba(16,16,16,0.45)' },
  blur: 40,
  tag: { inset: 6, paddingX: 7, paddingY: 3, radius: 6, bg: 'rgba(16,16,16,0.6)' },
  captionGap: 14,
  /** Two lines, so the choices do not move when the sentence wraps. */
  captionMinHeight: 40,
  optionsGap: 18,
  option: {
    gap: 10,
    innerGap: 14,
    paddingY: 14,
    paddingX: 16,
    radius: 18,
    textGap: 3,
    border: 'rgba(255,255,255,0.12)',
    bg: 'rgba(255,255,255,0.03)',
    selectedBg: 'rgba(255,255,255,0.07)',
  },
  radio: { size: 20, border: 1.5, dot: 10, top: 2, color: 'rgba(240,237,232,0.35)' },
  delaysGap: 8,
  delaysTop: 10,
} as const;

/** 11.5 · the guest's swipe-through intro (`(guest)/intro`, 2026-11-21). */
export const GuestIntro = {
  headerTop: 8,
  headerHeight: 44,
  skipHitSlop: 12,
  /** Picture -> text on a page. */
  visualGap: 28,
  /** Every page's picture gets the same height, so the text holds still while paging. */
  visualHeight: 272,
  /** Page 1's little iPhone: 130 wide is 268 tall, inside `visualHeight`. */
  cameraWidth: 130,
  textGap: 12,
  printWidth: 110,
  /** The others' prints beside the guest's own, smaller. */
  sideScale: 0.82,
  printGap: 10,
  printRadius: 10,
  hiddenBlur: 40,
  hiddenDim: 'rgba(8,8,10,0.45)',
  chip: 'rgba(16,16,16,0.55)',
  tagInset: 8,
  tagHeight: 20,
  tagPaddingX: 8,
  missionGap: 12,
  missionCapsuleHeight: 30,
  missionPaddingX: 14,
  missionPaddingY: 9,
  missionNoteRadius: 14,
  missionNoteMax: 300,
  missionIcon: 14,
  missionIconGap: 8,
  footerGap: 20,
  footerBottom: 12,
} as const;

/** The intro's little iPhone showing the camera (`components/ui/mini-camera.tsx`, 2026-11-21). */
export const MiniCamera = {
  width: 130,
  /** Height / width of a current iPhone. */
  aspect: 2.06,
  /** Outer corner radius as a share of the width. */
  cornerRatio: 0.2,
  bezel: 5,
  body: '#0a0a0b',
  frame: 'rgba(255,255,255,0.16)',
  frameWidth: 1.5,
  islandRatio: 0.3,
  islandTop: 6,
  islandHeight: 9,
  /** A soft fade under the counter, not a band: a share of the phone's height. */
  topFadeRatio: 0.28,
  topFade: ['rgba(10,10,11,0.55)', 'rgba(10,10,11,0)'] as const,
  counterTop: 22,
  inset: 8,
  chip: 'rgba(16,16,16,0.55)',
  noteGap: 5,
  notePaddingX: 7,
  notePaddingY: 4,
  noteRadius: 8,
  noteIcon: 9,
  noteIconGap: 4,
  viewfinderRadius: 12,
  barPaddingX: 12,
  barPaddingTop: 10,
  barPaddingBottom: 16,
  tile: 22,
  tileRadius: 6,
  tileIcon: 11,
  shutter: 34,
  shutterRing: 2,
  shutterGap: 2.5,
  homeBottom: 5,
  homeWidth: 40,
  homeHeight: 3,
  home: 'rgba(240,237,232,0.5)',
} as const;

/**
 * Ordered [unselected, selected] — 13's zoom pills.
 *
 * The same shape and the same caution as `LengthChoiceState`: the unselected
 * background is a zero-alpha *cream*, not `transparent`, so the transition moves
 * alpha alone. `transparent` parses as `rgba(0,0,0,0)` and would sweep the pill
 * through black on its way to the selected cream.
 *
 * Lighter than the duration pills' full-cream selection, because these sit on the
 * camera image rather than on the page: an opaque white pill over live video
 * pulls the eye off the thing being filmed.
 */
export const ZoomPillState = {
  bg: ['rgba(240,237,232,0)', 'rgba(240,237,232,0.16)'] as const,
  text: ['rgba(240,237,232,0.55)', Colors.text] as const,
} as const;

/**
 * 13 · Camera — the disposable camera.
 *
 * **Not in the prototype.** Frame 13 drew a video recorder; this screen is
 * designed in the same language for one shutter and a roll that counts down.
 * What carries over from the artboard is the inset, rounded viewfinder and the
 * flash / zoom / flip row beneath it.
 */
export const Camera = {
  /** Close button, the event's name and the countdown. The roll counter is in the viewfinder. */
  header: {
    paddingX: 20,
    paddingTop: 8,
    paddingBottom: 12,
    /** Both side slots, equal so the counter sits on the centre line: close, countdown. */
    sideWidth: 76,
    /** Event name -> counter. */
    nameGap: 2,
    /** The countdown is a button (to the film's developing state): its chevron and reach. */
    chevronSize: 12,
    chevronGap: 2,
    countdownHitSlop: 14,
    /** The countdown's top padding: level with the 44pt close button's middle. */
    countdownTop: 12,
    /** Under the safe area: where the "Next photo" note starts, below name, counter and capsule. */
    armedOffset: 104,
    armedSlotHeight: 80,
  },

  /** Soft darkening where text sits on the picture: the header, and the controls row. */
  scrim: {
    top: ['rgba(0,0,0,0.45)', 'rgba(0,0,0,0)'] as const,
    topHeight: 130,
    bottom: ['rgba(0,0,0,0)', 'rgba(0,0,0,0.4)'] as const,
    bottomHeight: 110,
  },

  /** "17 left" — the roll. */
  counter: {
    /** Numeral -> "left". */
    gap: 6,
    suffixColor: 'rgba(240,237,232,0.55)',
    /** From this many shots down the numeral warms, as a film counter's last frames do. */
    lowAt: 3,
    lowColor: 'rgba(240,180,120,0.95)',
    /**
     * A changed digit rolls: the old one rises out, the new one rises in from
     * below — the clip's `.numericText()` transition, with its spring
     * (response 0.3, critically damped). Only the digits that change move.
     */
    roll: {
      spring: { dampingRatio: 1, duration: 300 },
      /** How far a digit travels, as a fraction of the line height. */
      travel: 0.55,
    },
  },

  /** The viewfinder — full width and height down to the shutter bar, bottom corners rounded. */
  viewfinder: {
    radius: 32,
    /** Behind the preview, and what shows while permission is still unresolved. */
    bg: '#0a0a0c',
  },

  /** The shutter closing over the viewfinder. */
  blackout: {
    color: '#000000',
    /** Closed for this long, then it opens. */
    holdMs: 70,
    openMs: 240,
    /** With reduced motion: a dip instead of a full close. */
    reducedOpacity: 0.55,
  },

  /** The flash. */
  flash: {
    /**
     * How long the light is on before the exposure. The LED is lit as a torch
     * for the shot, and the camera needs a moment to meter for it.
     */
    leadMs: 320,
    /** Front camera: the screen itself is the flash. */
    screenColor: '#ffffff',
  },

  /**
   * The glass chrome floating inside the viewfinder (2026-11-15): flash, the
   * roll counter and flip along the top; "Your shots", zoom and invite along
   * the bottom. Only the shutter sits outside the picture.
   */
  /** "Your shots", left of the shutter — a tile like a print leaning in the corner. */
  shots: {
    size: 46,
    radius: 12,
    iconSize: 18,
    iconColor: 'rgba(240,237,232,0.85)',
    /** The last photo fading in once it exists. */
    fadeMs: 180,
  },

  /** The invite tile, right of the shutter — the same tile as "Your shots". */
  invite: {
    iconSize: 22,
    /** Between the upload count and the tile. */
    queueGap: 10,
  },

  /** The status pill inside the viewfinder's bottom edge — offline, a missed shot. */
  note: {
    inset: 14,
    bg: 'rgba(0,0,0,0.52)',
    border: 'rgba(255,255,255,0.09)',
    paddingY: 6,
    paddingX: 12,
    gap: 6,
    iconSize: 12,
    color: 'rgba(240,237,232,0.8)',
  },

  /** Flash and flip — glass buttons (`GlassButton`, 44pt) either side of the zoom, under the viewfinder. */
  controls: {
    paddingX: 24,
    /** The row's height along the frame's bottom edge; its content sits `paddingBottom` above it. */
    height: 76,
    paddingBottom: 16,
    /** Flash off, and flash on. */
    flashColor: ['rgba(240,237,232,0.6)', Colors.text] as const,
  },

  /** The glass segmented zoom control between them. */
  zoom: {
    gap: 3,
    paddingY: 4,
    paddingX: 5,
    pillMinWidth: 42,
    pillHeight: 30,
    fontSize: 13,
    /*
      The stops themselves are not a design token: what a phone can offer depends
      on its lenses, so they are computed per device in `lib/zoom.ts`.
    */
  },

  /** Countdown, shutter, upload status. */
  bottom: {
    paddingX: 24,
    paddingTop: 10,
    paddingBottom: 16,
    /** Both side slots, equal so the shutter sits on the centre line. */
    sideWidth: 96,
  },

  /** The shutter — a cream disc in a ring. Cream, not red: nothing is recording. */
  shutter: {
    /** The tap target and the ring. */
    size: 76,
    ringWidth: 3,
    ringColor: 'rgba(240,237,232,0.5)',
    discSize: 60,
    discColor: Colors.text,
    /** Gives under the finger on touch-down. */
    pressedScale: 0.86,
    /** Critically damped: a shutter button does not bounce. */
    pressSpring: { damping: 26, stiffness: 420 },
    /** Roll empty or camera not ready: still drawn, plainly inert. */
    disabledOpacity: 0.3,
  },

  /** Uploads still on the phone, bottom-right. */
  queue: {
    gap: 5,
    iconSize: 13,
    color: 'rgba(240,237,232,0.45)',
  },

  /** The countdown to `ends_at`, bottom-left. */
  countdown: {
    /** Between the two units ("01 d" -> "23 h"). */
    gap: 8,
    /** Between a numeral and its unit letter. */
    unitGap: 2,
    unitSize: 9,
    /** The leading unit is brighter than the trailing one, as drawn. */
    valueColor: [Colors.text, 'rgba(240,237,232,0.55)'] as const,
    unitColor: ['rgba(240,237,232,0.3)', 'rgba(240,237,232,0.2)'] as const,
    /** Ticks once a minute — the smallest unit shown is minutes. */
    tickMs: 60_000,
  },

  /** The full-screen states: permission, roll empty, developed, error. */
  state: {
    /** Eyebrow -> headline -> copy. */
    gap: 14,
    /** Copy -> the countdown or the button below it. */
    blockGap: 28,
    buttonGap: 12,
  },
} as const;

/**
 * Your shots — a guest's own frames, reachable from 13's bottom-left tile.
 *
 * Not in the prototype. A contact sheet: tight grid, small radius, no chrome.
 */
export const Shots = {
  headerPaddingTop: 8,
  /** Header -> title block -> grid. */
  titleGap: 20,
  gridGap: 3,
  columns: 3,
  /** The same 3:4 as the viewfinder. */
  tileAspectRatio: 3 / 4,
  tileRadius: 4,
  tileBg: '#141316',
  /** Title -> the line under it. */
  metaGap: 6,
  /** The enlarged photo. */
  viewer: {
    scrim: 'rgba(8,8,10,0.96)',
    padding: 12,
  },
} as const;

/**
 * 15/16 · Your Films — the library's header, empty state and event cards.
 *
 * Transcribed from the artboard. Two things it draws that no other screen does:
 * a header padded to 24 rather than `Spacing.screenX` (28), and a list padded to
 * 20 — so this screen sets its own horizontal padding instead of using `Screen`'s.
 */
export const Films = {
  header: {
    /** The artboard's `padding: 58px 24px`. */
    paddingTop: Spacing.screenTop,
    paddingX: 24,
    /** Header -> list. The empty state has no gap; the list has 16. */
    gap: 16,
    /** Between the gear and the plus. */
    buttonGap: 10,
    /** The artboard draws the gear at 17 and the plus at 18. */
    gearIconSize: 17,
    plusIconSize: 18,
  },

  /**
   * The "start a moment" stack, shown while there are no moments yet
   * (replaces 15's centred empty state).
   */
  fresh: {
    padding: 24,
    plusSize: 68,
    plusIconSize: 28,
    /** Plus -> headline -> subcopy -> the join capsule. */
    plusGap: 22,
    headlineGap: 8,
    joinGap: 22,
  },

  /** The guest's "Keep your films" panel, above the moments. */
  prompt: {
    paddingX: 20,
    paddingTop: 4,
    paddingBottom: 12,
  },

  /** 15 · no moments yet: the one large "start a moment" stack, alone on the screen. */
  empty: {
    /** Stack inset from the screen edge — room for its fan. */
    sideInset: 46,
    /** Room above the stack for the photos that lift out behind it. */
    paddingTop: 20,
    paddingBottom: 38,
  },

  /**
   * 16 · the list (redesigned 2026-11-21, the user, replacing the cards of
   * 2026-11-16): no cards, rows on the page with a hairline between them.
   */
  list: {
    paddingBottom: 32,
    /** The "Developed" label above its rows. */
    sectionPaddingTop: 14,
    /** Between the spotlight and the rows under it (2026-11-21, the user: they ran together). */
    afterHero: 28,
    sectionPaddingBottom: 2,
  },

  /**
   * 16 · the moment in the spotlight, full-bleed from the screen's top edge:
   * the running one, or the last developed one until the next starts. Its
   * photo, "Moments" and the buttons over it, two numbers and one action,
   * fading into the page.
   */
  hero: {
    /** Of the window's height. */
    heightRatio: 0.6,
    minHeight: 440,
    paddingX: 20,
    paddingBottom: 18,
    /** "Live now" -> the name -> the numbers -> the button. */
    capsuleGap: 10,
    titleGap: 10,
    actionGap: 16,
    capsuleHeight: 26,
    capsulePaddingX: 10,
    capsuleDot: 7,
    /** Between the two counts of a quiet hero ("212 photos   6 people"). */
    statsGap: 22,
    /** The chevron after "until it develops". */
    chevronSize: 12,
    chevronGap: 2,
    /** The slow drift over the photo: scale at rest -> scale at the far end, and back. */
    drift: { from: 1.02, to: 1.1, ms: 14000 },
    fadeMs: 320,
    shade: {
      colors: [
        'rgba(16,16,16,0.55)',
        'rgba(16,16,16,0)',
        'rgba(16,16,16,0)',
        'rgba(16,16,16,0.78)',
        '#101010',
      ],
      locations: [0, 0.24, 0.42, 0.74, 1],
    },
  },

  /** 16 · one moment's row: name, counts, when, and a small stack of its prints. */
  row: {
    paddingX: 20,
    paddingY: 14,
    gap: 14,
    pressScale: 0.98,
    /** Name -> counts -> when. */
    lineGap: 4,
    liveDot: 6,
    liveDotGap: 6,
    /** The stack's box, and its three prints, back left, back right, front. */
    stack: {
      width: 118,
      height: 100,
      prints: [
        { width: 64, height: 84, left: 4, top: 10, rotate: -9 },
        { width: 64, height: 84, left: 50, top: 6, rotate: 8 },
        { width: 68, height: 88, left: 26, top: 4, rotate: -1 },
      ],
      radius: 7,
      /** No border (the user): depth comes from the shadow and the dimmer prints behind. */
      behindDim: 'rgba(8,8,10,0.3)',
      shadow: { color: '#000', opacity: 0.55, radius: 10, offsetY: 6, elevation: 8 },
      emptyIconSize: 16,
      fadeMs: 220,
    },
    /** The glass "+209" (or "Sample") on the stack's corner. */
    badge: { height: 24, paddingX: 9, right: -2, bottom: 2 },
  },

  /**
   * The photos fanned out behind a stack's front picture, nearest first. Each
   * is the front's size, turned and shifted so an edge shows left or right.
   * `spread` scales all of it; the one stack left (the empty state) is
   * always fully open.
   */
  stack: {
    behind: [
      { rotate: -6, shiftX: -18, lift: -6, scale: 0.95 },
      { rotate: 5, shiftX: 18, lift: -12, scale: 0.93 },
    ] as const,
    /** Depth: the photos behind are darker than the one in front. */
    behindDim: 'rgba(8,8,10,0.38)',
    /** Sample pictures are dimmed again, so they never read as the group's own. */
    sampleDim: 'rgba(8,8,10,0.34)',
    sampleTag: { inset: 14, height: 22, paddingX: 9, bg: 'rgba(8,8,10,0.5)' },
  },

  /** The front print of a stack. */
  poster: {
    radius: 30,
    pressScale: 0.975,
    /** How long a cover takes to fade in over the poster's tint. */
    coverTransitionMs: 260,
  },

  /**
   * The empty state's ambient backdrop — its front print, blurred and dimmed,
   * so the screen reads as lit by its own content.
   */
  backdrop: {
    opacity: 0.5,
    blurRadius: 60,
    transitionMs: 420,
  },
} as const;

/**
 * 18 · In-App Notification — the banner raised when someone else films.
 *
 * Transcribed from the artboard's toast, with four deliberate departures:
 *
 *  - the `toast-in` keyframe carries `translate(-50%, …)`, a leftover from a
 *    draft that centred the card with `left: 50%`. The shipped card is pinned
 *    `left: 16 / right: 16` with no base transform, so porting the -50% would
 *    shove it half off screen mid-animation. Only translateY and opacity here.
 *  - there is **no `toast-out` keyframe**; the prototype dismisses by unmounting
 *    instantly, which reads as a glitch. `exitDuration` is invented.
 *  - `autoDismissMs` is chosen. The prototype specifies no duration anywhere —
 *    its only guidance is prose ("verschwindet automatisch nach ein paar
 *    Sekunden"), and no timer drives the toast in the prototype at all.
 *  - the artboard's `top: 112` is measured inside a 390x844 frame whose top 58px
 *    is status bar. Re-derived as an inset-relative offset so it lands under the
 *    header on any device rather than at a fixed 112 from the top.
 *
 * The motion is an intentional exception to `Motion`: 320ms on a slightly
 * overshooting curve, where the app's standard is 550ms on an ease-out. A
 * notification that takes half a second to arrive reads as sluggish.
 */
export const Toast = {
  /** Offset below the safe-area top. The artboard's 112 minus its 58px status inset. */
  topOffset: 54,
  insetX: 16,
  paddingY: 14,
  paddingX: 16,
  radius: 18,
  /** Avatar -> text -> dismiss. */
  gap: 12,
  /** Far more opaque than `Colors.glass` — it sits over a live viewfinder. */
  bg: 'rgba(20,18,16,0.85)',
  border: 'rgba(255,255,255,0.12)',
  blurIntensity: 30,

  /** A rounded *rect*, unlike every other avatar in the app, which are circles. */
  avatar: {
    size: 36,
    radius: 10,
    bg: 'rgba(240,237,232,0.1)',
    border: 'rgba(255,255,255,0.12)',
    fontSize: 11,
  },

  title: { fontSize: 13 },
  sub: { fontSize: 11, gap: 1 },

  dismiss: {
    size: 26,
    bg: 'rgba(255,255,255,0.07)',
    /**
     * The artboard draws an 11px X at stroke-width 2.4. Feather ships a fixed
     * 2px path and exposes no stroke prop, so the weight is approximate.
     */
    iconSize: 11,
  },

  /**
   * Arrives and leaves on `Springs.settle` (a spring since 2026-11-15, replacing
   * the artboard's 320ms curve). Reduced motion: no travel, a cross-fade.
   */
  motion: {
    travelY: -14,
    /** The cross-fade under reduced motion. */
    fadeMs: 200,
  },

  /** Chosen, not transcribed — see the note above. */
  autoDismissMs: 4000,
  /**
   * One at a time. A second arrival replaces the first rather than queueing:
   * two people filming in the same minute is ordinary, and a queue would show a
   * stale "42s left" after a newer arrival had already made it wrong.
   */
  maxVisible: 1,
} as const;

/**
 * 20 · Settings.
 *
 * Transcribed from the artboard. What it draws: a profile card, a Notifications
 * group of two toggles, and an Account group. What it does not draw, and is
 * added here with reasons:
 *
 *  - an **off** state for the switch. Both switches are drawn on, and no off
 *    state appears anywhere in the prototype. Inverted from the on state.
 *  - a **guest** profile variant. The card draws a name and an email; an
 *    anonymous user has neither, and inventing one would be a lie on screen.
 *
 * design/README.md promises an "event management" group. The prototype draws no
 * such thing, and the prototype wins.
 */
export const Settings = {
  /** The artboard's `padding: 58px 28px 40px`. Top and sides come from `Screen`. */
  paddingBottom: 40,
  /** Back button -> headline. */
  backGap: 36,
  /** Headline -> profile card. */
  headlineGap: 28,

  profile: {
    gap: 14,
    paddingY: 16,
    paddingX: 18,
    radius: 18,
    marginBottom: 24,
    /** A circle here, where the toast's is a rounded rect at 36. */
    avatarSize: 44,
    avatarBg: 'rgba(240,237,232,0.1)',
    avatarBorder: 'rgba(255,255,255,0.1)',
    initialsSize: 13,
    nameSize: 15,
    emailSize: 12,
    /** Name -> email. */
    emailGap: 2,
  },

  /** Section label -> its group. */
  sectionGap: 10,
  /** Between groups. */
  groupGap: 24,

  group: {
    radius: 18,
    border: 'rgba(255,255,255,0.08)',
    bg: Colors.surfaceGhost,
    /**
     * Between rows. Deliberately *not* `Colors.hairline` (0.1) — a divider
     * inside an already-bordered card has to be lighter than the card's own edge
     * or the group reads as a stack of separate boxes.
     */
    divider: 'rgba(255,255,255,0.06)',
  },

  row: {
    paddingY: 16,
    paddingX: 18,
    labelSize: 14,
  },

  toggle: {
    trackWidth: 42,
    trackHeight: 25,
    knobSize: 21,
    /** Knob inset on all four sides: 25 - 21 - 2 = 2. */
    inset: 2,
    onTrack: Colors.text,
    onKnob: Colors.onLight,
    /** Invented — the artboard never draws a switch off. */
    offTrack: 'rgba(255,255,255,0.14)',
    offKnob: Colors.text,
    /** Faster than `Motion.duration`: a switch must feel immediate. */
    duration: 180,
  },
} as const;

/**
 * Glass — floating chrome over imagery (viewfinder, album, viewer, film covers).
 *
 * Not in the prototype. On iOS 26+ this is the system's Liquid Glass
 * (`expo-glass-effect`); everywhere else a blur with a tinted fill and a bright
 * top edge, which is what the fallback values below describe. Never put glass
 * on glass.
 */
export const Glass = {
  /** Fallback blur, by how large the surface is — bigger reads as thicker. */
  blur: { chip: 24, bar: 40 },
  /** Fallback fill over the blur. */
  fill: 'rgba(28,26,24,0.42)',
  /** Fallback when the user asked for reduced transparency. */
  solid: 'rgba(24,22,21,0.94)',
  border: 'rgba(255,255,255,0.16)',
  /** Round control. */
  buttonSize: 44,
  iconSize: 18,
  /** Capsule with a label. */
  capsuleHeight: 36,
  capsulePaddingX: 14,
  capsuleGap: 7,
  /** Press feedback on a glass control. */
  pressScale: 0.94,
} as const;

/**
 * Springs, in Apple's two parameters: damping ratio and response.
 *
 * `settle` is the default (critically damped, no overshoot). `momentum` is only
 * for motion a flick or a release carried into. `press` is touch-down feedback.
 */
export const Springs = {
  settle: { dampingRatio: 1, duration: 380 },
  momentum: { dampingRatio: 0.82, duration: 420 },
  press: { dampingRatio: 1, duration: 180 },
} as const;

/**
 * Moving between screens (1.3.0).
 *
 * Onboarding screens are transparent over the travelling glow, so a push slid
 * one screen's text through the other's. They cross-fade instead, and the
 * content arrives on its own (`Rise`): a short lift, block after block.
 * Not seen on a device.
 */
export const Transitions = {
  onboardingFadeMs: 260,
  rise: {
    /** How far a block lifts into place. */
    travel: 16,
    /** Wait per step of reading order. */
    stagger: 70,
  },
} as const;

/**
 * Touch-down feedback for anything that is not glass (`PressScale`): the
 * control gives under the finger on press-in and springs back on release.
 * Glass controls use `Glass.pressScale`.
 */
export const Press = {
  /** Pills and other wide controls: a wide surface needs little to read. */
  pillScale: 0.97,
  /** Round icon buttons and tiles: a small target needs a larger change. */
  iconScale: 0.9,
  /** Cards — 08's scan card. */
  cardScale: 0.98,
} as const;

/**
 * Dragging a bottom sheet (`SheetDrag`): 1:1 with the finger downwards,
 * resistance upwards, and a release that lands where the flick was going.
 */
export const SheetMotion = {
  /** Finger travel before the drag takes over from a tap. */
  slop: 8,
  /** Projected travel past which a release closes the sheet. */
  dismissDistance: 120,
  /** `rubberband()`'s constant for pulling the sheet up past its rest. */
  rubber: 0.12,
  /** How far up it can be pulled at most — and how far its surface is drawn past the screen edge. */
  overdraw: 48,
  /** Scroll-like deceleration used to project where a flick would land. */
  deceleration: 0.998,
} as const;

/**
 * The full-screen photo viewer — own shots and the album share it.
 *
 * Not in the prototype.
 */
export const Viewer = {
  backdrop: '#050506',
  /** Between pages while swiping. */
  pageGap: 16,
  maxZoom: 4,
  doubleTapZoom: 2.5,
  /** Finger travel before a drag picks its axis. */
  slop: 10,
  /** Projected travel past which a drag down (or in from the edge) closes the viewer. */
  dismissDistance: 140,
  /** A drag starting this close to the left edge is "back": it closes the viewer. */
  edgeWidth: 24,
  /** How far the photo shrinks while it is dragged down. */
  dismissMinScale: 0.72,
  /** `rubberband()`'s constant. */
  rubber: 0.55,
  /** Scroll-like deceleration used to project where a flick would land. */
  deceleration: 0.998,
  /** Chrome inset from the safe area. */
  chromeInset: 12,
  chromeGap: 10,
  /** Cross-fade used instead of travel under reduced motion. */
  fadeMs: 180,
} as const;

/** One thumbnail in a photo grid — "Your shots" and the album. */
export const PhotoTile = {
  /** The same 3:4 as the viewfinder. */
  aspectRatio: 3 / 4,
  radius: 4,
  placeholder: '#141316',
  pressScale: 0.96,
  fadeMs: 150,
} as const;

/**
 * 17 · Album — the event's photos: hidden while the film is still being shot,
 * a shared grid once it is developed.
 *
 * Not in the prototype (17 was the clip player).
 */
export const Album = {
  /** Three prints per row (2026-11-21, the user; two from 2026-11-16). */
  columns: 3,
  gap: 4,
  gridPaddingX: 8,
  /** Under the "couldn't load" copy and the blank-film note. */
  titlePaddingTop: 64,
  titlePaddingBottom: 20,
  listPaddingBottom: 48,
  /** Floating glass controls, inset from the safe area. */
  chromeInset: 12,
  /** The soft edge where the grid scrolls under the back button — no divider. */
  topFade: 96,
  topFadeColor: 'rgba(16,16,16,0.6)',

  /** The full-bleed photo that opens a developed album. */
  hero: {
    /** Of the window's height: the first row of prints still shows under it. */
    heightRatio: 0.66,
    minHeight: 420,
    paddingX: 24,
    paddingBottom: 20,
    /** Keeps a long title clear of the back button on a short phone. */
    contentPaddingTop: 120,
    /** Without a photo: room for the floating chrome above the title. */
    plainPaddingTop: 64,
    titleGap: 14,
    statsGap: 18,
    statLabelGap: 7,
    dividerHeight: 18,
    actionsGap: 22,
    /** Between "Save all" and "Share". */
    actionGap: 10,
    /** The thumbnail giving way to the original. */
    sharpenMs: 300,
    /** A trace of shade for the status bar, clear in the middle, the page's own dark at the foot. */
    shade: {
      colors: ['rgba(16,16,16,0.4)', 'rgba(16,16,16,0)', 'rgba(16,16,16,0.72)', '#101010'],
      locations: [0, 0.22, 0.68, 1],
    },
  },

  /** A print in the grid, with its photographer's name on it. */
  tile: {
    radius: 10,
    captionPaddingX: 7,
    captionPaddingBottom: 6,
    captionFadeHeight: 40,
    captionFade: ['rgba(0,0,0,0)', 'rgba(0,0,0,0.5)'],
    /** The glass badge on a mission photo, top right. */
    missionBadge: 24,
    missionIcon: 12,
    missionInset: 6,
  },
  /** The status capsule ("Saved", "Saving 12 / 124"). */
  status: {
    bottom: 76,
    showMs: 2200,
  },

  /**
   * Before the reveal (2026-11-23, the user): the gallery. The event image
   * with a large countdown heads it; under it every photo — the viewer's own
   * sharp, everyone else's a blurhash smudge with a small countdown.
   */
  developing: {
    countdownGap: 18,
    unitGap: 14,
    valueUnitGap: 5,
    statGap: 12,
    actionsGap: 22,
    /** Under an hour the countdown shows seconds. */
    fastTickMs: 1000,
    slowTickMs: 20_000,
    /** New photos from the others appear without a pull. */
    refreshMs: 30_000,
    /** A frame with no smudge yet. */
    frameFill: 'rgba(255,255,255,0.05)',
    /** Over the smudge, so the name and the countdown read. */
    smudgeDim: 'rgba(8,8,10,0.18)',
    smudgeFadeMs: 240,
    /** The small countdown on each hidden print. */
    badgeHeight: 22,
    badgePaddingX: 8,
    badgeIconGap: 4,
    badgeIcon: 10,
  },
} as const;

/**
 * Where a scrolling list meets the edge of its area: it blurs and dissolves
 * into the page instead of being cut off (`components/ui/scroll-edge.tsx`).
 */
export const ScrollEdge = {
  /** Heights of the two edges. The list is padded by the same amounts. */
  top: 40,
  /** Above the screen's bottom inset, which the edge covers as well. Lowered from 96 (2026-11-18). */
  bottom: 72,
  /**
   * `Colors.bg`, opaque -> clear on a smoothstep curve, in many stops so the
   * fade has no visible bands. Not 'transparent': that fades through black.
   * There is no blur any more: RN cannot mask a blur, and stacked blurs showed
   * as steps (the user, 2026-11-18).
   */
  colors: [
    'rgba(16,16,16,0.97)',
    'rgba(16,16,16,0.94)',
    'rgba(16,16,16,0.85)',
    'rgba(16,16,16,0.72)',
    'rgba(16,16,16,0.57)',
    'rgba(16,16,16,0.40)',
    'rgba(16,16,16,0.25)',
    'rgba(16,16,16,0.12)',
    'rgba(16,16,16,0.03)',
    'rgba(16,16,16,0)',
  ] as const,
} as const;

/**
 * 05.1 · The Missions section under the roll (`missions-setup.tsx`).
 *
 * Not in the prototype. Built from 05.1's own parts — the divider, the
 * eyebrow label, the roll cards — and 20's switch, so it reads as one more
 * answer on the same page rather than a new kind of control.
 */
export const MissionsSetup = {
  /** Roll section (or its "No subscription." line) -> divider. */
  dividerTop: 24,
  /** Divider -> the "Missions" row. Matches `GroupRow.dividerGap`. */
  dividerBottom: 24,
  /** Title -> switch, the least they are kept apart when large text wraps the title. */
  rowGap: 16,
  /** Title row -> the explanatory line. */
  explainerGap: 6,
  /** Explanatory line -> "Missions per guest". */
  countGap: 20,
  /** Three cards across the full width, so they get more air than the roll's six. */
  card: {
    ...RollChoice,
    gap: 8,
    paddingX: 8,
  },
  /** The count row fading in and out when the switch flips; opacity only. */
  fadeMs: 220,
} as const;

/**
 * 11 · Guest name — "Are you one of these?", the names a host listed for
 * personal missions (`NamePicker`). Not in the prototype. Since 2026-11-19
 * (the user) the names come first, one per row, and "Add your name" closes
 * the list — rows drawn like 02's choice pills, full width.
 */
export const MissionsJoin = {
  /** Headline -> the question (the field's `Guest.headlineGap` is too deep for a list). */
  sectionTop: 36,
  /** Question -> "The host planned something for you." */
  subGap: 4,
  /** Sub-line -> the first row. */
  rowsTop: 18,
  /** Between rows. */
  rowGap: 8,
  rowPaddingY: 15,
  rowPaddingX: 20,
  /** The check on a chosen row, the plus on "Add your name". */
  iconSize: 17,
  /** The rows -> the error line. */
  sectionBottom: 14,
  /** The section fading in once the names have loaded; opacity only. */
  fadeMs: 220,
  /** How often 11 asks again, so a name someone else took disappears. */
  refreshMs: 10_000,
} as const;

/**
 * The host's Missions screen (`(host)/missions`) and its entry row on 10.
 *
 * Not in the prototype. Built from 20's grouped cards (a hairline card of
 * rows, lighter dividers inside) and 02's choice pills, so it reads as the
 * same app; values chosen, not transcribed.
 */
export const MissionsEditor = {
  /** Trailing space so the last card clears the home indicator. */
  paddingBottom: 48,
  /** Back button -> headline. */
  backGap: 28,
  /** Headline -> the one-line explanation. */
  headlineGap: 8,
  /** Explanation -> the first section. */
  introGap: 24,
  /** Between sections. */
  sectionGap: 32,
  /** A section's label -> its caption or card. */
  labelGap: 8,
  /** A section's caption -> its card. */
  captionGap: 12,
  /** "24 missions · 18 people so far" -> its note. */
  summaryNoteGap: 2,
  /** Reached while creating the event: the list -> the pinned "Continue". */
  continueGap: 12,

  /** The "1 mission per guest" card: its sliders glyph and the 1·2·3 drawer. */
  count: {
    iconSize: 17,
    drawerGap: 14,
  },

  /** A row's assignee: a name pill, or a round "give to" button. */
  chip: {
    height: 30,
    paddingX: 11,
    maxWidth: 130,
    iconSize: 15,
    hitSlop: 8,
  },

  /** Swipe a row left: Delete behind it, filled as in Mail and Reminders. */
  swipe: {
    actionWidth: 84,
    iconSize: 16,
    gap: 4,
    /** The one filled red in the app: a destructive action you dragged out yourself. */
    bg: 'rgb(204,72,62)',
    /** The row slides over the action, so it must be opaque: the card over `bg`. */
    rowBg: '#151515',
  },

  /** The column in front of every mission: a bullet, "+", or Select's check. */
  lead: {
    size: 22,
    bulletSize: 6,
    bulletColor: 'rgba(240,237,232,0.28)',
    plusIconSize: 14,
  },

  /** Select mode: the round check in front of each row. */
  select: {
    size: 22,
    iconSize: 13,
    border: 'rgba(240,237,232,0.35)',
  },

  /** The bordered card a list of rows sits in — 20's settings card. */
  card: {
    radius: 18,
    border: 'rgba(255,255,255,0.08)',
    bg: Colors.surfaceGhost,
    /** Lighter than the card's own edge, as on 20. */
    divider: 'rgba(255,255,255,0.06)',
  },
  /** Between person cards. */
  cardGap: 12,

  /** One mission, or the "Add a mission" row. */
  row: {
    paddingY: 13,
    paddingX: 16,
    gap: 12,
    /** The trailing delete button: a 44pt target around a small glyph. */
    actionSize: 44,
    /** The action's glyph, and the composer's plus. */
    iconSize: 15,
    /** How far the action's touch target reaches into the row's padding. */
    actionInset: -12,
  },

  /** A row being edited. */
  editor: {
    /** Input -> the counter / Cancel / Save line. */
    footerGap: 8,
    /** Between Cancel and Save. */
    buttonGap: 18,
    /** The counter only shows this close to the limit (140). */
    counterFrom: 110,
    hitSlop: 10,
  },

  /** 1 · 2 · 3 per guest. */
  perGuest: {
    gap: 8,
  },

  /** A named person's card: header, their missions, their composer. */
  person: {
    headerGap: 12,
    /** Name -> "Joined" / "Will pick their name when joining". */
    statusGap: 3,
    dotSize: 6,
    dotGap: 6,
    /** Joined: the success green. Not yet: a quiet ring. */
    waitingDot: 'rgba(240,237,232,0.28)',
  },

  /** The joined guests offered as chips, to add or link a name. */
  roster: {
    gap: 8,
    /** Its caption -> the chips. */
    labelGap: 10,
    /** Chips -> whatever follows. */
    bottomGap: 14,
  },

  /** "Locked — the missions were dealt when the event started." */
  lockNote: {
    paddingY: 12,
    paddingX: 14,
    gap: 10,
    radius: 14,
    iconSize: 14,
    bg: 'rgba(255,255,255,0.04)',
    border: 'rgba(255,255,255,0.08)',
  },

  /** Missions off: a calm empty state. */
  empty: {
    paddingTop: 36,
    iconTile: 64,
    iconSize: 24,
    iconGap: 22,
    copyGap: 10,
    buttonGap: 28,
  },

  /** The "Switch missions off" link at the foot. */
  footer: {
    paddingTop: 36,
    hitSlop: 12,
  },

  /** Rows arriving and leaving: a short cross-fade; the list closes up on `Springs.settle`. */
  fadeMs: 180,

  /** 10's entry row, above "Start the Event". */
  entry: {
    paddingY: 13,
    paddingX: 16,
    gap: 12,
    radius: 18,
    iconSize: 16,
    chevronSize: 15,
    /** Row -> the error line / the CTA. */
    marginBottom: 12,
  },
} as const;

/**
 * Missions on the guest's side — 13's "Missions 1/3" capsule, the armed note
 * in the viewfinder, the mission sheets, and the mission caption in the
 * viewer and on "Your shots" tiles.
 *
 * Not in the prototype (missions came after it). Built from the camera's own
 * values: the capsule is a smaller `Glass` capsule so the header grows as
 * little as possible, and the armed note is the camera's status note.
 */
export const MissionsCamera = {
  /** The header capsule under the roll counter. */
  capsule: {
    /** Smaller than `Glass.capsuleHeight` (36): it sits under the 34pt numeral. */
    height: 28,
    paddingX: 11,
    gap: 5,
    iconSize: 12,
    /** Reach up to a 44pt target. */
    hitSlop: 8,
    /** Counter -> capsule. */
    marginTop: 6,
    /** All done. */
    doneColor: Colors.green,
    /** Large text must not push the capsule into the side slots. */
    maxFontScale: 1.3,
  },

  /** "Next photo: …" — at the viewfinder's top edge, under the capsule that armed it. */
  armed: {
    inset: 14,
    /** Keeps the note off the frame's rounded corners. */
    insetX: 18,
    paddingY: 7,
    paddingLeft: 12,
    paddingRight: 6,
    gap: 6,
    iconSize: 12,
    closeSize: 14,
    closeHitSlop: 12,
    /** The × answers on touch-down. */
    closePressedOpacity: 0.5,
    /** The mission's text may need two lines. */
    lines: 2,
    /** Arrives from the capsule's direction and leaves the same way. */
    travelY: -10,
    /** Reduced motion: a cross-fade. */
    fadeMs: 180,
  },

  /** The sheets: the list on 13, the picker in the viewer. */
  sheet: {
    /** Title -> copy -> list -> button. */
    gap: 14,
    /** The "0/1" beside "Your missions." — DM Serif, like the camera's counter. */
    countSize: 22,
    rowGap: 8,
    rowPaddingY: 14,
    rowPaddingX: 16,
    rowRadius: 16,
    rowBg: Colors.surfaceSubtle,
    rowBorder: Colors.hairline,
    /** Text -> trailing mark. */
    rowInnerGap: 12,
    iconSize: 16,
    /** A done mission steps back. */
    doneTextColor: Colors.textDim,
    /** The list scrolls past this share of the window — large text, three long missions. */
    maxListRatio: 0.5,
    /** The least space a sheet leaves under the status bar, keyboard up or not. */
    topGap: 24,
    /** The scrim leaving after a tap on it. */
    fadeMs: 200,
  },

  /** The small mark on a "Your shots" tile whose photo is for a mission. */
  tileMarker: {
    size: 22,
    inset: 6,
    iconSize: 11,
    bg: Colors.badgeScrim,
  },

  /** "Mission · …" over the viewer's actions. */
  caption: {
    paddingY: 8,
    paddingX: 14,
    gap: 6,
    iconSize: 12,
    lines: 2,
    radius: 16,
    /** Caption -> the row of actions. */
    marginBottom: 10,
    /** The album's status capsule moves up by this while a mission caption is shown. */
    statusLift: 64,
  },
} as const;
