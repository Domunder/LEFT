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
 * Full-bleed video treatment, shared by Landing (01), Format (03) and Sign Up (06).
 *
 * The gradient darkens the frame from top to bottom so the glass panel pinned at
 * the bottom has something solid to sit against.
 */
export const VideoOverlay = {
  /** Video opacity on Landing. Sign Up uses 0.55. */
  videoOpacity: 0.85,
  signUpVideoOpacity: 0.55,
  /** linear-gradient(to bottom, ...) — colors and their stops, in order. */
  gradientColors: [
    'rgba(6,6,8,0.25)',
    'rgba(6,6,8,0.15)',
    'rgba(6,6,8,0.7)',
    'rgba(6,6,8,0.97)',
  ] as const,
  gradientLocations: [0, 0.4, 0.68, 1] as const,
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
 * 04 · Event End — the two label/value rows and the pill that opens each picker.
 *
 * The pill is close to ChoicePill but not equal (paddingY 10 vs 11, a fill, and a
 * lighter border), so it carries its own metrics rather than bending that one.
 */
export const EndRow = {
  paddingY: 20,
  paddingX: 2,
  /** Subcopy -> first row. */
  topGap: 34,
  /**
   * Back button -> headline. The prototype uses 44 here where 02/03 use 52 — this
   * screen has subcopy the others lack, which absorbs the difference.
   */
  headerGap: 44,
  pill: {
    paddingY: 10,
    paddingX: 16,
    gap: 8,
    iconSize: 14,
    bg: 'rgba(255,255,255,0.06)',
    border: 'rgba(255,255,255,0.12)',
  },
} as const;

/**
 * The month grid behind 04's Ending Date pill.
 *
 * Drawn in-app rather than by the platform picker, so its geometry is ours. Cells
 * are laid out `flex: 1` inside fixed-count rows rather than at a fixed width —
 * RN has no CSS Grid, and a fraction of the panel is the only thing that survives
 * the popover being narrowed on a small screen. `cellSize` is therefore the
 * *circle* drawn inside a cell, not the cell itself.
 */
export const Picker = {
  /** The tappable circle in a cell. 38 plus the row gap clears a 40pt target. */
  cellSize: 38,
  /** Gap between grid rows. Horizontal spacing comes from `flex: 1`, not a gap. */
  rowGap: 2,
  /** Days to a week. */
  columns: 7,
  /** The month title row: an arrow either side of the month name. */
  header: {
    buttonSize: 30,
    iconSize: 15,
    height: 30,
    /** Title row -> weekday row. */
    gap: 12,
  },
  /** Height of the weekday-initials row, and its gap to the first week. */
  weekdayHeight: 18,
  weekdayGap: 6,
  /** Ring width on today's cell when it is not the selection. */
  todayRing: 1,
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
  inset: 16,
  bottom: 36,
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

/**
 * The popover the pickers sit in (04) — anchored under the pill that opened it,
 * rather than pinned to the bottom of the screen as a sheet.
 */
export const Popover = {
  /** Gap between the anchor pill and the popover's top edge. */
  offset: 10,
  /** Inset from the screen edges, so it never touches the sides. */
  margin: Spacing.screenX,
  paddingX: Spacing.md,
  paddingY: Spacing.md,
  /** Widest the popover grows; narrower screens fall back to the margins. */
  maxWidth: 320,
  bg: 'rgba(28,26,30,0.96)',
} as const;

/** Vertical padding on a primary/secondary pill button. */
export const PillPaddingY = 17;

/**
 * The two side-by-side provider buttons — Landing (01) and the guest's keep screen.
 *
 * Close to PillButton but smaller on every axis (16/12 padding vs 17/28, 15px
 * weight 600 vs 16px weight 500) and sized by `flex: 1` rather than full width,
 * so it carries its own metrics — the same call already made for EndRow.pill and
 * LengthChoice.
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
 * The video preview cards on 03 · Format.
 *
 * The design framed these as strips of film with sprocket-hole bands; that and a
 * later colour-halo treatment were both dropped at the user's request, leaving
 * the footage in a plain rounded frame. Geometry only — the two-state palette is
 * FilmStripState.
 */
export const FilmStrip = {
  /** Gap between the two cards. */
  gap: 16,
  /** Gap between the row of format names and the cards under it. */
  labelGap: 20,
  /** Corner radius of the video window. */
  radius: 18,

  vertical: {
    /** Fixed width; the horizontal card takes the remaining row. */
    width: 130,
    aspectRatio: 9 / 16,
    ratioLabel: '9:16',
    ratioFontSize: 13,
  },
  horizontal: {
    aspectRatio: 16 / 9,
    ratioLabel: '16:9',
    ratioFontSize: 11,
  },

  /** Format label under each card. */
  labelFontSize: 12,
} as const;

/**
 * Selected / unselected pairs for a preview card.
 *
 * Ordered [unselected, selected] so a card can pick its end with one flag and
 * animate between them.
 */
export const FilmStripState = {
  border: ['rgba(255,255,255,0.07)', 'rgba(255,255,255,0.22)'] as const,
  ratioText: ['rgba(240,237,232,0.4)', 'rgba(240,237,232,0.9)'] as const,
  label: ['rgba(240,237,232,0.2)', 'rgba(240,237,232,0.55)'] as const,
  /** Flat dim laid over the video — heavier when the card is not chosen. */
  dim: ['rgba(0,0,0,0.6)', 'rgba(0,0,0,0.35)'] as const,
  videoOpacity: [0.3, 0.75] as const,
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
  /** "FILM LENGTH" -> the row. */
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
 * 17 · The unlock bar — the app's only paywall, and it sits after the film.
 *
 * **Not in the artboard**, which was drawn when the money changed hands during
 * onboarding. It is a panel rather than a bare button because it has to say two
 * things before it asks for anything: what the viewer is watching now, and what
 * paying changes. A lone "Unlock $14.99" would be asking them to guess.
 *
 * Deliberately quiet. It sits under a film someone just watched for the first
 * time, and shouting over that moment is how you lose it — so it borrows the
 * glass panel treatment rather than the primary accent, and the CTA carries the
 * only strong colour on it.
 */
export const UnlockBar = {
  paddingX: Spacing.md,
  paddingY: Spacing.md,
  radius: Radii.sheetSm,
  bg: 'rgba(255,255,255,0.05)',
  border: 'rgba(255,255,255,0.09)',
  /** Pitch -> CTA. */
  gap: Spacing.md,
  /** Between the two lines of the pitch. */
  lineGap: 4,
  marginTop: Spacing.lg,
} as const;


/**
 * 08 · Join Group Sheet — the glass panel and the two cards inside it.
 *
 * The panel is `GlassPanel` with the artboard's own padding rather than the
 * Landing panel's 32/24/28, and its blur is 48 where Landing's is 40.
 */
export const JoinSheet = {
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

export const GroupInfo = {
  /** The artboard's `left:16px; right:16px; bottom:24px`. */
  inset: 16,
  bottom: 24,
  paddingTop: 28,
  paddingX: 24,
  paddingBottom: 24,
  /** Drag handle -> headline. */
  handleGap: 22,
  /** Headline -> body copy. */
  headlineGap: 10,
  /** Body -> the bar. */
  bodyGap: 22,
  /** Bar -> its caption row. */
  barGap: 8,
  /**
   * Height held for the caption row while the event loads.
   *
   * The numbers stay hidden until they are real — "0s used · shared by 0" is a
   * claim, not a loading state — so the row reserves one line of Typography.caption
   * to keep the "Got it" button still.
   */
  captionHeight: 18,
  /** Caption row -> the "Got it" button. */
  captionGap: 24,
  /**
   * The worked example the bar plays through — two people filming into one pool.
   *
   * Paced to be read, not raced: each entry lands well clear of the last so a
   * host watching sees two separate events rather than one blur. The whole
   * script runs in about two and a half seconds.
   */
  demo: {
    /** Beat before the first clip lands, so the sheet settles first. */
    startDelay: 620,
    /**
     * Between one clip landing and the next.
     *
     * Longer than the fill it follows, so each person's contribution is a
     * separate event with a pause after it rather than one continuous slide.
     */
    stepInterval: 1500,
    /** How long the bar takes to travel to its new width. */
    fillDuration: 700,
    /**
     * How long the finished state rests before the loop starts over.
     *
     * The whole point of the last frame — both people listed, the bar showing
     * what they jointly spent — is the thing being taught, so it gets the
     * longest beat in the cycle.
     */
    holdDuration: 2600,
    /**
     * The bar's collapse back to empty at the start of a new cycle.
     *
     * Quicker than a fill and eased the same way: it should read as a reset, not
     * as time being given back.
     */
    resetDuration: 420,
    /** Bar -> the list of entries. */
    entriesGap: 14,
    /** Between entries. */
    entryGap: 4,
    /** One entry's row, held empty before it arrives so nothing below shifts. */
    entryHeight: 18,
    /** The leading dot and its gap to the text. */
    dotSize: 4,
    dotGap: 8,
    /**
     * The gradient's laid-out width inside the clipping fill.
     *
     * Comfortably wider than any phone, so the ramp is anchored to the track and
     * does not re-run as the fill grows.
     */
    gradientWidth: 500,
  },
  /** The button is 16px tall here where PillButton uses 17. */
  buttonPaddingY: 16,
  bar: {
    height: 8,
    track: 'rgba(255,255,255,0.07)',
    /** `linear-gradient(90deg, #f0ede8, #cfc9bd)`. */
    fill: ['#f0ede8', '#cfc9bd'] as const,
    /**
     * Shortest visible fill, as a fraction of the track.
     *
     * A few seconds against a ten-minute budget rounds to a sliver too small to
     * see, which reads as "nothing filmed" when something was. The floor keeps a
     * small amount visibly present, and zero is still drawn as truly empty.
     */
    minFill: 0.02,
  },
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
 * 14 · Creating Your Film.
 *
 * From the artboard's `14 · Neu` frame: an 88px ring spinner over a centred
 * headline, with a 220×3 bar beneath it.
 *
 * The bar is **determinate** where the artboard draws it at a fixed 64%, and it
 * was indeterminate before that. There is now a real quantity to report: the
 * screen waits for every clip to finish uploading, so the bar is `uploaded /
 * total` and the number is the truth. It falls back to the old sweeping segment
 * only while that count is still unknown — see `IndeterminateBar`'s `progress`.
 *
 * (Historically this screen waited on `compile_film()`, which returned
 * immediately and had nothing honest to say. There is no compile any more; the
 * film is played as a sequence of clips, so what matters is that the clips have
 * all arrived.)
 */
export const Processing = {
  /** The ring. */
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
  /** Spinner -> headline. */
  spinnerGap: 32,
  /** Headline -> subcopy. */
  headlineGap: 10,
  /** Subcopy -> the bar. */
  copyGap: 28,
  /** The subcopy is held narrow so it breaks where the artboard breaks it. */
  copyMaxWidth: 260,
  bar: {
    width: 220,
    height: 3,
    track: 'rgba(255,255,255,0.08)',
    fill: Colors.text,
    /**
     * The travelling segment's share of the track, and how long one sweep takes.
     *
     * Only used in the indeterminate fallback, while the clip count is unknown.
     */
    segment: 0.4,
    duration: 1400,
    /** How long the determinate fill takes to ease to a new value. */
    fillDuration: 400,
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
  pingSize: 10,
  dotSize: 6,
  /** Nudged down to sit on the copy's first baseline. */
  pingOffset: 2,
  /** The artboard's `wait-ping 2s cubic-bezier(0,0,0.2,1) infinite`. */
  pingDuration: 2000,
  pingScale: 2.2,
  pingOpacity: 0.4,
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
 * 13 · Camera — the recording screen.
 *
 * Transcribed from the artboard (`design/LEFT App.dc.html`, the frame labelled
 * `13 · Camera`). Two deviations from it, both noted at their token:
 * `criticalFraction` and `minClipSeconds`.
 *
 * Note the viewfinder is **inset and rounded**, not full-bleed. `design/README.md`
 * says "full-bleed camera viewfinder"; the artboard insets it 10px with a 26px
 * radius. The prototype wins, per the spec-authority rule.
 */
export const Camera = {
  /** The artboard's `padding-top:58px; padding-bottom:10px; padding-inline:20px`. */
  headerPaddingTop: 58,
  headerPaddingBottom: 10,
  headerPaddingX: 20,

  /** The shared-budget bar, directly under the event name. */
  bar: {
    paddingX: 20,
    marginBottom: 8,
    /** Thin enough to read as a measure rather than a container. */
    height: 3,
    track: 'rgba(255,255,255,0.07)',
    /**
     * The fill, and what it becomes when the group is nearly out.
     *
     * The artboard uses a `linear-gradient` for each; a flat colour is used here
     * because at 3px tall a horizontal ramp is not perceptible, and it saves a
     * LinearGradient per frame on the app's most performance-sensitive screen.
     */
    fill: Colors.text,
    fillCritical: '#ff5555',
    /**
     * How long one second of a running take takes to appear in the fill.
     *
     * Short and linear. The bar sits directly above a counter incrementing once
     * a second, and easing a tick over the standard 550ms leaves the two visibly
     * out of step with each other.
     */
    pendingDuration: 240,
    /** Bar -> the "Ns used" / "Ns remaining" row. */
    labelGap: 5,
    labelSize: 10,
    /** "Ns used" — always dim; it is the less useful of the two numbers. */
    usedColor: 'rgba(240,237,232,0.2)',
    /** "Ns remaining", at rest and when critical. */
    remainingColor: 'rgba(240,237,232,0.2)',
    remainingColorCritical: 'rgba(255,100,100,0.6)',
    /**
     * Shortest visible fill, as a fraction of the track — the same floor the
     * other budget bars use, for the same reason: the first few seconds of a 10m
     * budget round to an empty bar, which reads as "nothing recorded".
     */
    minFill: 0.02,
    /**
     * When the bar turns red, as a fraction of the whole budget.
     *
     * **A deviation from the prototype**, which hardcodes `remaining <= 9`
     * against its 60s demo budget. That is 15% there, but on the 10m films the
     * top tiers sell it would mean a bar that stays calm until the last nine
     * seconds of ten minutes. Expressed as a fraction so it scales, with an
     * absolute floor so a 30s film still gets a warning at a useful moment.
     */
    criticalFraction: 0.15,
    criticalFloorSeconds: 5,
  },

  /** The viewfinder — inset and rounded, per the artboard. */
  viewfinder: {
    paddingX: 10,
    radius: 26,
    /** Behind the preview, and what shows while permission is still unresolved. */
    bg: '#0a0a0c',
  },

  /** The "REC 12s" pill, pinned inside the viewfinder's top-left corner. */
  recPill: {
    inset: 14,
    bg: 'rgba(0,0,0,0.52)',
    border: 'rgba(255,255,255,0.09)',
    blur: 16,
    paddingY: 5,
    paddingX: 12,
    dotSize: 7,
    /** Dot -> label. */
    gap: 6,
    /** The blink's floor. Fully off reads as a dropped frame, not a pulse. */
    dotDimOpacity: 0.25,
  },

  /** Flash, zoom and flip. */
  controls: {
    paddingX: 24,
    paddingTop: 16,
    paddingBottom: 4,
    /** The flash and flip buttons — 44pt, the minimum comfortable target. */
    buttonSize: 44,
    flashIconSize: 20,
    flipIconSize: 21,
    /** Flash off, and flash on. */
    flashColor: ['rgba(240,237,232,0.32)', Colors.text] as const,
    flipColor: 'rgba(240,237,232,0.32)',
  },

  /** The glass segmented zoom control between them. */
  zoom: {
    bg: 'rgba(0,0,0,0.48)',
    border: 'rgba(255,255,255,0.08)',
    blur: 24,
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

  /** Countdown, record button, clip badge. */
  bottom: {
    paddingX: 24,
    paddingTop: 10,
    paddingBottom: 46,
  },

  /** The record button. */
  record: {
    /** The tap target. The visible dot is smaller and lives inside it. */
    size: 76,
    /** The inner dot at rest — a circle — and while recording — a rounded square. */
    idleSize: 60,
    recordingSize: 28,
    idleRadius: 30,
    recordingRadius: 8,
    color: Colors.rec,
    /** Out of budget: still drawn, plainly inert. */
    disabledOpacity: 0.3,
    /**
     * The morph's timing.
     *
     * Deliberately **not** `Motion.bezier`: the artboard specifies
     * `cubic-bezier(0.34,1.56,0.64,1)`, whose control point above 1 overshoots.
     * The button snaps past its target and settles — a shutter, not a fade.
     */
    duration: 220,
    bezier: [0.34, 1.56, 0.64, 1] as const,
    /**
     * The take's countdown ring, drawn around the tap target while recording.
     *
     * **Not in the artboard**, which was drawn before takes were capped. A cap
     * you cannot see is not a cap — without this the button gives no warning
     * before the camera stops itself, which reads as a crash rather than a rule.
     *
     * Sized to sit *inside* the 76pt target rather than outside it, so the
     * control's footprint does not change when a take starts and the row below
     * does not reflow.
     */
    ringWidth: 3,
    ringTrack: 'rgba(255,255,255,0.18)',
    ringColor: Colors.rec,
  },

  /** The clip-count badge, bottom-right. */
  badge: {
    size: 58,
    radius: 13,
    borderWidth: 2,
    border: 'rgba(255,255,255,0.16)',
    bg: 'rgba(255,255,255,0.04)',
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

  /**
   * Shortest take that is worth charging the group for, in seconds.
   *
   * **Not in the artboard**, which has no notion of a discarded take. A stray tap
   * produces a fraction of a second of footage that is unusable in the finished
   * film, and charging the shared pool for it takes time away from everyone else.
   * Anything under this releases its hold instead of committing.
   */
  minClipSeconds: 1,

  /**
   * Longest single take, in seconds.
   *
   * **Not in the artboard**, and not a display value — it is a product rule that
   * happens to need a fast local copy, the same exception `minClipSeconds` makes.
   * `public.max_take_seconds()` is the authority; a take is capped there whatever
   * the client asks for. This copy exists because the countdown and the record
   * ring have to be drawn on the frame the finger lands, not a round trip later.
   *
   * The two must agree. If the SQL changes, change this — a client that thinks
   * the cap is higher than it is draws a ring that never fills.
   *
   * Why a cap at all: the budget is shared, so an uncapped take lets one member
   * spend the group's whole pool in one go. Short takes also cut better — a film
   * made of many brief shots feels like the group; one made of four long holds
   * feels like whoever pressed record first.
   */
  maxTakeSeconds: 20,
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

  /** 15 · the centred empty state. */
  empty: {
    paddingX: 40,
    tileSize: 64,
    tileIconSize: 26,
    /** Tile -> headline. */
    tileGap: 22,
    /** Headline -> subcopy. */
    headlineGap: 8,
    /** Subcopy -> CTA. */
    subcopyGap: 28,
    /**
     * The CTA is auto-width (`padding: 15px 26px`), not the full-width
     * `PillButton` every other screen uses — the same call `EndRow.pill` and
     * 05.1's duration legend made rather than bending a full-width primitive.
     */
    ctaPaddingY: 15,
    ctaPaddingX: 26,
    ctaGap: 8,
    ctaIconSize: 15,
    /** `rgba(240,237,232,0.95)` — a touch softer than the flat `Colors.text`. */
    ctaBg: 'rgba(240,237,232,0.95)',
    /** CTA -> the "Or join a group" link beneath it. Not in the artboard. */
    joinGap: 18,
    /** The link is one short line of text, so it needs the target padded out. */
    joinHitSlop: 12,
  },

  /** 16 · the scrolling list. */
  list: {
    paddingX: 20,
    paddingTop: 20,
    paddingBottom: 32,
    /** Between cards. */
    gap: 14,
  },

  /** 16 · one event card. */
  card: {
    /** The artboard's `padding: 16px 16px 0` on the title block. */
    titlePaddingX: 16,
    titlePaddingTop: 16,
    /** Title -> cover. */
    coverGap: 12,
    coverHeight: 160,
    /** How long a film's poster takes to fade in over the card's tint. */
    coverTransitionMs: 220,
    /**
     * The cover's bottom scrim — `linear-gradient(to top, rgba(0,0,0,0.45) 0%,
     * transparent 45%)`, so the badges have something to sit against.
     */
    scrim: ['rgba(0,0,0,0.45)', 'transparent'] as const,
    scrimLocations: [0, 0.45] as const,
    /** Badge inset from the cover's bottom corners. */
    badgeInset: 10,
    badgePaddingY: 4,
    badgePaddingX: 9,
    /** Press feedback, matching FilmStripCard. */
    pressScale: 0.97,
    pressSpring: { damping: 18, stiffness: 260 },
  },

  /**
   * 16's ambient backdrop — a blurred, scaled-up wash of the first event's tint.
   *
   * The artboard blurs the event's cover photo at `blur(60px) saturate(140%)`.
   * Nothing in the app produces imagery yet (`compile_film()` is a stub and no
   * thumbnail is ever extracted), so this is built from the same deterministic
   * tint the card covers use — see lib/film-tint.ts. It *replaces* the ambient
   * glow on this state rather than joining it, as drawn.
   */
  backdrop: {
    opacity: 0.55,
    scale: 1.1,
  },
} as const;

/**
 * 17 · Clip Detail — the finished-film screen for an event.
 *
 * Transcribed from the artboard, which draws a 280px hero player over a blurred
 * backdrop, a Download/Share row, and a grid of contributor clips. Four things
 * it draws that the app cannot yet produce, all of them the same gap:
 *
 *  - the backdrop is a blurred *cover photo* in the artboard. Nothing extracts a
 *    frame from a clip, so it is built from `tintFor(event.id)` — the third
 *    instance of the deviation `Films.backdrop` and lib/film-tint.ts document.
 *  - the hero plays *a compiled film*. Nothing compiles one — it needs ffmpeg,
 *    which nothing in this stack can run — so it plays the group's clips back to
 *    back instead, in `recorded_at` order. Same footage, same order, no file.
 *    That brings a "now playing" pill and an ended state the artboard has no
 *    need of, since it drew one film by nobody in particular.
 *  - the tiles carry photographs; they carry gradients here, for the same reason.
 *  - the artboard scrims **only the first tile** and leaves white-on-image badges
 *    unbacked on the other three. That reads as an oversight rather than intent,
 *    so `grid.scrim` is applied to every tile — flagged in clip-tile.tsx.
 *
 * The header pads to 24 and the body to 18, neither of which is `Spacing.screenX`
 * (28), so the screen sets its own horizontal padding — the same call `Films` made.
 */
export const ClipDetail = {
  /** The blurred wash behind everything. Matches `Films.backdrop` by construction. */
  backdrop: {
    /** The artboard over-scans by 20px a side so a 60px blur shows no edges. */
    inset: -20,
    opacity: 0.55,
    scale: 1.1,
  },

  header: {
    /** The artboard's `padding: 58px 24px 14px`. */
    paddingTop: Spacing.screenTop,
    paddingX: 24,
    paddingBottom: 14,
    /** Back button -> title block. */
    gap: 12,
    titleSize: 14,
    subSize: 11,
    /** Title -> "5 clips · 1m 0s". */
    subGap: 1,
  },

  /** The artboard's `padding: 6px 18px 40px` on the scroll body. */
  body: {
    paddingTop: 6,
    paddingX: 18,
    paddingBottom: 40,
  },

  hero: {
    /**
     * The artboard's fixed height, now a floor rather than the whole story.
     *
     * The hero is sized by the film's aspect ratio — `events.format`, which the
     * app read nowhere until the renderer's shape was brought forward into
     * playback. A horizontal film is 16:9 and lands near this number anyway; a
     * vertical one is 9:16 and would run the full height of the screen if
     * nothing stopped it, hence `maxHeightRatio`.
     */
    height: 280,
    /**
     * The tallest the hero may get, as a fraction of the window.
     *
     * A 9:16 film at full width is taller than most phones, and a hero that
     * filled the screen would push the actions and the whole grid below the
     * fold — the film would look like the only thing on the page. Just over half
     * leaves the "Save clips" row visible on every device, which is what tells
     * someone there is more here than a video.
     */
    maxHeightRatio: 0.56,
    radius: 22,
    /** Two points off `Colors.bg` — the letterbox behind a contained video. */
    bg: '#0a0a0b',
    marginBottom: 14,

    /** The expand button, top-right over the picture. */
    expand: { inset: 12, size: 34, iconSize: 15 },

    /**
     * Laid over a real poster frame so the play button and note read against it.
     *
     * Much lighter than `Colors.backdropScrim`: that one is hiding a blurred
     * wash, this one is on top of the picture someone came here to see.
     */
    posterScrim: 'rgba(0,0,0,0.34)',

    play: {
      size: 64,
      bg: 'rgba(240,237,232,0.14)',
      borderWidth: 1.5,
      border: 'rgba(255,255,255,0.22)',
      iconSize: 24,
      /** The artboard's `padding-left: 4px` — optical centring for a triangle. */
      iconOffsetX: 4,
      /** The poster's inert play button. */
      posterOpacity: 0.4,
    },

    /**
     * The scrub bar. A **readout, not a scrubber**: the artboard draws a 3px
     * track with no thumb, and a 3px hit target is not a control. Its 38% fill
     * is a static mock; the real one is bound to playback position.
     */
    scrub: {
      stripHeight: 32,
      paddingBottom: 10,
      trackHeight: 3,
      track: 'rgba(255,255,255,0.12)',
      marginX: 14,
    },

    /** The idle and ended states, neither of which the artboard draws. */
    poster: { copyPaddingX: 32, copyGap: 14 },

    /**
     * The "now playing" pill, bottom-left above the scrub strip.
     *
     * Invented, like the ended state: the artboard drew one film by one nobody,
     * so it had no author to name. Here the hero runs several people's clips in
     * sequence and the pill changing at each cut is the only thing that says so.
     * Geometrically `grid.badge`, so a pill on the hero and a badge on a tile
     * read as the same object — duplicated rather than aliased for the reason
     * `grid.badge` gives about `Films.card.badge`.
     */
    nowPlaying: {
      inset: 12,
      paddingY: 5,
      paddingX: 10,
      /** Name -> "3 of 8". */
      gap: 6,
      bg: 'rgba(0,0,0,0.4)',
      blurIntensity: 10,
      /** Cross-faded on advance so the name does not pop at a cut. */
      fadeMs: 200,
    },

    /**
     * The clip-to-clip boundary.
     *
     * `replaceAsync` takes a moment to load the next source, and an unmasked
     * swap shows the previous clip's last frame stretched under a new one. A
     * short opaque cover reads as a cut rather than a stall.
     */
    advance: {
      scrimFadeMs: 150,
      /**
       * A spinner only past this. A boundary normally clears well inside it, and
       * a spinner that flashed at every cut would make a finished film look like
       * it was struggling.
       */
      spinnerDelayMs: 600,
    },

    /** The replay button on the ended state. */
    ended: { iconSize: 22 },
  },

  /**
   * The large view — the film filling the screen, without leaving the app.
   *
   * Deliberately not `expo-video`'s native fullscreen. That would rotate the
   * device for a landscape film, and the app is portrait-locked in `app.json`;
   * unlocking it to serve one control would mean re-locking every other screen
   * with `expo-screen-orientation`. So the stage stays portrait and offers to
   * rotate *the picture* instead, which needs nothing from the OS.
   *
   * There are almost no tokens here because there is almost nothing to style:
   * playback is drawn by the platform (`nativeControls`), and the app supplies
   * only a close button, a title and the rotate toggle.
   *
   * It borrows the hero's player rather than making one — see the one-surface
   * rule in `use-clip-playlist`. The hero unmounts its `VideoView` while this is
   * open, which is why playback carries across without a reload.
   */
  stage: {
    /** Near-black, a shade under the hero's letterbox. */
    bg: '#050506',
    /** Close, title and rotate — the only chrome the app draws here. */
    closeInset: 16,
    chromeGap: 12,
    /** Rotate-to-fill, offered only when the picture is wider than the screen. */
    rotate: { size: 38, iconSize: 16 },
    /** How long the picture takes to turn. */
    rotateMs: 220,
  },

  actions: {
    gap: 10,
    marginBottom: 28,
    paddingY: 16,
    paddingX: 18,
    /** The artboard draws Download at 17 and Share at 16. Followed as drawn. */
    downloadIconSize: 17,
    shareIconSize: 16,
  },

  /** "Contributing Clips" -> the grid. */
  sectionLabel: { marginBottom: 12 },

  /**
   * The contributor grid.
   *
   * The artboard draws exactly four clips in one fixed arrangement: a full-width
   * feature tile, then a 2-up row, then a full-width tile spanning `1 / -1`. The
   * rule below reproduces that pixel-for-pixel at four clips and extends to any
   * count — first full-width at 200, the rest 2-up at 148, a trailing odd one
   * full-width at 160. The extension is inferred; the artboard shows one case.
   *
   * `badge` repeats `Films.card.badge*` exactly. Kept separate rather than
   * aliased: those are 16's cards and these are 17's tiles, they merely coincide
   * today, and either should be free to move without dragging the other.
   */
  grid: {
    gap: 10,
    marginTop: 10,
    radius: 16,
    featureHeight: 200,
    pairHeight: 148,
    wideHeight: 160,
    /** Shows through until a cover exists. */
    placeholder: 'rgba(255,255,255,0.04)',
    /**
     * How long a thumbnail takes to fade in over its tint.
     *
     * They arrive one at a time and out of step with the render — a grid that
     * popped eight frames in at eight different moments would flicker. A short
     * cross-fade makes each one land as a tile settling rather than changing.
     */
    coverTransitionMs: 220,
    /** `linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 50%)`. */
    scrim: ['rgba(0,0,0,0.5)', 'transparent'] as const,
    scrimLocations: [0, 0.5] as const,
    /** Dimming on a clip whose file has not landed. */
    unavailableOpacity: 0.45,

    /**
     * The dot marking the clip the hero is playing right now.
     *
     * Distinct from the `selected` ring, which says "this is where the film is"
     * and stays put while paused. This says "and it is running", so the grid can
     * be read at a glance without looking up at the hero.
     */
    nowPlayingDotSize: 6,
    nowPlayingColor: Colors.text,

    /** The per-tile download chip, top-right. */
    chip: {
      size: 26,
      bg: 'rgba(0,0,0,0.4)',
      iconSize: 12,
      inset: 10,
    },

    badge: {
      inset: 10,
      paddingY: 4,
      paddingX: 9,
      fontSize: 11,
      /** The artboard's `backdrop-filter: blur(10px)` on both badges. */
      blurIntensity: 10,
    },

    /**
     * A half-width cell.
     *
     * `flexBasis` rather than `flex: 1`: on a row holding a single tile, `flex`
     * would stretch it the full width and break the two-column rhythm. 48% plus
     * `flexGrow` lets a pair share the row exactly once the 10pt gap is taken out.
     */
    halfBasis: '48%',
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

  motion: {
    duration: 320,
    bezier: [0.32, 1.08, 0.58, 1] as const,
    exitDuration: 200,
    travelY: -14,
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
 * 19 · Lockscreen Live Activity — the iOS-only budget widget.
 *
 * Identity strings only. The widget extension runs in a **separate process** and
 * cannot import from JavaScript, so its palette is duplicated in Swift by
 * necessity — see plugins/live-activity/LeftBudgetLiveActivity.swift, which must
 * be edited in lockstep with `Colors` whenever the palette moves.
 */
export const LiveActivity = {
  /** Must match the app group configured in plugins/withLiveActivity.js. */
  appGroup: 'group.com.leftmoment.app',
  /** iOS floor. Live Activities landed in 16.1; ActivityContent in 16.2. */
  minimumIosVersion: 16.2,
} as const;
