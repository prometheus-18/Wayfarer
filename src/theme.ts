/**
 * Wayfarer "Cosmic Glass" design tokens.
 *
 * A deep-space, Apple-dark system: near-black backgrounds, translucent frosted
 * surfaces with hairline borders, one electric accent per feature, and soft
 * glow on active elements. Token NAMES are stable so every screen/component
 * re-themes by swapping values here.
 */
export const colors = {
  // Deep space backgrounds
  bg: '#070B14',
  bgElevated: '#0E1422',
  // Frosted-glass surfaces (translucent white over the near-black bg)
  surface: 'rgba(255,255,255,0.05)',
  surfaceStrong: 'rgba(255,255,255,0.08)',
  surfaceAlt: 'rgba(255,255,255,0.07)',
  // Opaque elevated surface for modals/sheets that need solid readability
  sheet: '#121A2B',

  text: '#F2F6FF',
  textMuted: '#9AA7BD',
  textFaint: '#5C6A82',
  border: 'rgba(255,255,255,0.10)',
  borderStrong: 'rgba(255,255,255,0.16)',

  // Electric cyan primary (Translate)
  primary: '#22D3EE',
  primaryDark: '#0EA5C4',
  primarySoft: 'rgba(34,211,238,0.14)',

  // Per-feature accents, tuned for dark
  translate: '#22D3EE', // cyan
  scan: '#A78BFA', // violet
  assistant: '#34D399', // emerald

  success: '#34D399',
  warning: '#FBBF24',
  danger: '#F87171',

  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(3,7,15,0.78)',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

export const typography = {
  display: { fontSize: 30, fontWeight: '800' as const, letterSpacing: -0.6 },
  title: { fontSize: 20, fontWeight: '700' as const, letterSpacing: -0.2 },
  heading: { fontSize: 17, fontWeight: '700' as const },
  body: { fontSize: 16, fontWeight: '400' as const },
  bodyStrong: { fontSize: 16, fontWeight: '600' as const },
  label: { fontSize: 13, fontWeight: '600' as const, letterSpacing: 0.4 },
  caption: { fontSize: 12, fontWeight: '500' as const },
} as const;

export const shadow = {
  /** Soft depth for glass cards. */
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 18,
    elevation: 6,
  },
  /** Floating sheets/overlays. */
  floating: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
    elevation: 12,
  },
} as const;

/**
 * Colored glow for an accented, active element. On iOS this renders as a
 * true colored shadow; on Android `elevation` gives depth and the translucent
 * accent border/halo carries the glow.
 */
export function glow(color: string, intensity = 0.55) {
  return {
    shadowColor: color,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: intensity,
    shadowRadius: 16,
    elevation: 10,
  } as const;
}
