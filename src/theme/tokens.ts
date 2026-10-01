/**
 * SnapPlate design tokens — the single source of truth for the visual system.
 *
 * Aesthetic: "Warm Editorial". A warm charcoal base makes food photography the
 * hero. Depth comes from subtle surface ramps and restrained shadows, not from
 * heavy borders or neon tints.
 *
 * Anything that cannot be expressed as a Tailwind class (SVG `fill`/`stroke`,
 * `StatusBar` colours, Reanimated style objects, haptic config) reads from here.
 * Anything that can be a class should use the semantic Tailwind names defined in
 * `tailwind.config.js` (`bg-surface`, `border-subtle`, `bg-canvas`, …).
 */
export const palette = {
  /** Page background — warm near-black. */
  canvas: '#1A1814',
  /** Overlay / sheet backdrop — one step deeper than canvas. */
  canvasSunken: '#13110E',
  /** Default card / panel surface. */
  surface: '#252220',
  /** Interactive / pressed / raised surfaces sitting on top of `surface`. */
  surfaceRaised: '#302C29',
  /** Inset wells inside a card: progress tracks, input fields. */
  surfaceSunken: '#1F1C19',
  /** Subtle hairline border for cards. */
  border: '#302C29',
  /** Emphasised border for inputs and secondary buttons. */
  borderStrong: '#3D3834',
  /** Primary accent — burnt orange. Used for primary CTAs and key progress. */
  accent: '#E8722A',
  /** Lighter accent for hover / pressed state. */
  accentLight: '#F08A4A',
  /** Muted accent for backgrounds (10% opacity equivalent). */
  accentMuted: '#E8722A1A',
  /** Ink colour for text on an accent fill — white for AA contrast on orange. */
  accentInk: '#FFFFFF',
  /** Positive / success — muted sage green. */
  positive: '#4CAF82',
  /** Warning — warm amber. */
  warning: '#D4A24C',
  /** Danger / destructive — warm red. */
  danger: '#D4513F',
  /** Macro: Protein — golden. */
  protein: '#D4A24C',
  /** Macro: Carbs — soft sky blue. */
  carbs: '#7BADE2',
  /** Macro: Fat — warm mauve. */
  fat: '#C97BB2',
  /** Chart bars: active non-today day, and idle day. */
  chartBar: '#3D3834',
  chartBarIdle: '#252220',
  /** Neutral text ramp: warm whites and greys. */
  textPrimary: '#F5F0EB',
  textSecondary: '#A8A09A',
  textTertiary: '#6E6862',
  textSubtle: '#6E6862',
  accentBright: '#F08A4A',
} as const;

/**
 * Motion language. One easing family (`out(cubic)` for entrances, `in-out` for
 * loops) and a small set of springs keeps the app feeling like one product.
 *
 * Spring notes:
 * - `fill` is critically damped for progress bars (damping 26 ≈ 2·√(k·m)) so a
 *   nearly-complete goal settles *on* 100 % instead of overshooting past it.
 * - `brand` matches the requested `springify().damping(15).stiffness(120)` used
 *   by the splash wordmark: a visible but calm bounce.
 */
export const motion = {
  duration: {
    /** Colour/opacity swaps that should feel instant. */
    instant: 120,
    /** Small UI acknowledgements: press states, tab switches. */
    fast: 200,
    /** Default enter/exit for inline content (inline editors, chips). */
    base: 320,
    /** Larger surfaces: sheets, reticle sweeps. */
    slow: 480,
    /** Tagline fade-in specified by the brand motion spec. */
    tagline: 400,
    /** Progress/number counting so the fill reads as "filling up". */
    count: 900,
    /** Ambient loops: skeleton shimmer, camera scan pulse. */
    loop: 1500,
  },
  spring: {
    /** Brand wordmark letters. */
    brand: { damping: 15, stiffness: 120, mass: 1 },
    /** Progress fills — no overshoot. */
    fill: { damping: 26, stiffness: 150, mass: 1 },
    /** Expand/collapse of inline editors. */
    reveal: { damping: 20, stiffness: 180, mass: 0.9 },
    /** Press feedback — quick in, quick out. */
    press: { damping: 18, stiffness: 260, mass: 0.8 },
  },
  /** Press-scale values. Never scale below 0.92 — below that it reads as a bug. */
  press: {
    button: 0.96,
    /** The camera shutter, which should feel like a physical button. */
    shutter: 0.92,
  },
} as const;

/**
 * Spacing + radius rhythm.
 *
 * Three radii with clear meaning:
 * - `card` (20pt): primary containers and cards
 * - `inner` (12pt): buttons, inputs, nested elements inside cards
 * - `pill` (999): chips, tags, badges
 */
export const layout = {
  screenGutter: 20,
  cardRadius: 20,
  innerRadius: 12,
  pillRadius: 999,
  /** Minimum tappable size, per Apple HIG. */
  minTouchTarget: 44,
} as const;

/**
 * Typography scale — editorial pairing.
 *
 * Display face: DM Serif Display — serif numerals are distinctive in a
 * nutrition app and read as editorial/premium.
 *
 * Text face: Inter — excellent screen legibility with proper tabular figures.
 *
 * Font family constants for use in style objects. In NativeWind className,
 * use `font-display` and `font-sans` (configured in tailwind.config.js).
 */
export const fontFamily = {
  display: 'DMSerifDisplay_400Regular',
  sans: 'Inter_400Regular',
  sansMedium: 'Inter_500Medium',
  sansSemiBold: 'Inter_600SemiBold',
  sansBold: 'Inter_700Bold',
} as const;

export const type = {
  /** Big calorie number on the dashboard — DM Serif. */
  hero: { fontSize: 48, letterSpacing: -1.5, fontFamily: fontFamily.display },
  /** Section headlines — DM Serif. */
  display: { fontSize: 32, letterSpacing: -1.0, fontFamily: fontFamily.display },
  /** Screen titles, card headers — Inter Bold. */
  title: { fontSize: 22, letterSpacing: -0.4, fontFamily: fontFamily.sansBold },
  /** Subsection titles — Inter SemiBold. */
  subtitle: { fontSize: 17, letterSpacing: -0.2, fontFamily: fontFamily.sansSemiBold },
  /** Default copy — Inter Regular, bumped to 15px for readability. */
  body: { fontSize: 15, letterSpacing: 0, fontFamily: fontFamily.sans },
  /** Metadata, timestamps — Inter Medium. */
  caption: { fontSize: 13, letterSpacing: 0.1, fontFamily: fontFamily.sansMedium },
  /** Sparingly-used section labels (sentence case, not uppercase). */
  label: { fontSize: 11, letterSpacing: 0.5, fontFamily: fontFamily.sansSemiBold },
  /** Keeps counter digits from jittering horizontally while they animate. */
  tabularNums: { fontVariant: ['tabular-nums' as const] },
};
