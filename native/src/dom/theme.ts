// The web's design tokens (web/src/index.css @theme) as the app paints them, and its fonts as the
// phone loaded them (App.tsx): a family and a weight make one font file here, never a synthetic bold.

/** The CSS variables the game's styles read (var(--color-ink)…); a scope (.street) changes some. */
export const VARS: Record<string, string> = {
  '--color-ink': '#161a2b',
  '--color-ink-soft': '#5b6178',
  '--color-line': '#e7e9f2',
  '--color-surface': '#ffffff',
  '--color-canvas': '#f4f5fa',
  '--color-orange': '#ff7a00',
  '--color-orange-deep': '#e05a00',
  '--color-emerald': '#00b86b',
  '--color-emerald-deep': '#00894f',
  '--color-gold': '#ffc233',
  '--color-gold-deep': '#e09a00',
  '--color-sky': '#3ba7ff',
  '--color-rose': '#ff4d6d',
  '--color-violet': '#7b5cff',
  '--color-dusk': '#1b1f4b',
  '--color-night': '#0f1230',
  '--color-white': '#ffffff',
  '--color-black': '#000000',
  '--shadow-card': '0 1px 0 rgba(22,26,43,0.04), 0 8px 24px -8px rgba(22,26,43,0.18)',
  '--shadow-float': '0 2px 0 rgba(22,26,43,0.05), 0 18px 40px -12px rgba(22,26,43,0.35)',
}

/** The painted wall of the wish list (.street): its colours, and the game's own boxes in them. */
export const STREET_VARS: Record<string, string> = {
  '--wall': '#efe4cc',
  '--turq': '#1f8f88',
  '--rust': '#b5432c',
  '--ochre': '#dda233',
  '--mint': '#9ccfb4',
  '--ci-orange': '#f07a12',
  '--ci-green': '#0b6b3d',
  '--brown': '#2b1d14',
  '--cream': '#fbf5e6',
  '--color-canvas': '#e9dcc0',
  '--color-line': 'rgba(43,29,20,0.22)',
  '--color-ink': '#2b1d14',
  '--color-ink-soft': '#6b5a4c',
}

export type FontKey = 'sans' | 'display' | 'anton' | 'slab' | 'chalk' | 'mono'

/** The font files loaded, by family and weight (App.tsx loads the same). */
const FILES: Record<FontKey, Record<number, string>> = {
  sans: { 400: 'Nunito_400Regular', 600: 'Nunito_600SemiBold', 700: 'Nunito_700Bold', 800: 'Nunito_800ExtraBold', 900: 'Nunito_900Black' },
  display: { 600: 'Baloo2_600SemiBold', 700: 'Baloo2_700Bold', 800: 'Baloo2_800ExtraBold' },
  anton: { 400: 'Anton_400Regular' },
  slab: { 400: 'AlfaSlabOne_400Regular' },
  chalk: { 700: 'Caveat_700Bold' },
  mono: {},
}

/** The font file for a family at a weight: the nearest weight loaded. */
export function fontFile(key: FontKey, weight: number): string | undefined {
  const files = FILES[key]
  if (files[weight]) return files[weight]
  let best: string | undefined
  let gap = Infinity
  for (const [w, f] of Object.entries(files)) {
    const d = Math.abs(Number(w) - weight) + (Number(w) < weight ? 0.5 : 0)
    if (d < gap) {
      gap = d
      best = f
    }
  }
  return best
}

/** A CSS font family (« 'Baloo 2', system-ui ») as one of ours. */
export function fontKeyOf(family: string): FontKey | undefined {
  const f = family.toLowerCase()
  if (f.includes('baloo') || f.includes('--font-display')) return 'display'
  if (f.includes('nunito') || f.includes('--font-sans')) return 'sans'
  if (f.includes('anton')) return 'anton'
  if (f.includes('alfa slab') || f.includes('georgia')) return 'slab'
  if (f.includes('caveat') || f.includes('cursive')) return 'chalk'
  if (f.includes('mono')) return 'mono'
  if (f.includes('system-ui') || f.includes('sans-serif')) return 'sans'
  return undefined
}

/** Tailwind's sizes (v4): text-* (size, line height), max-w-*, rounded-*, shadow-*, blur. */
export const TEXT: Record<string, [number, number]> = {
  xs: [12, 16],
  sm: [14, 20],
  base: [16, 24],
  lg: [18, 28],
  xl: [20, 28],
  '2xl': [24, 32],
  '3xl': [30, 36],
  '4xl': [36, 40],
  '5xl': [48, 48],
  '6xl': [60, 60],
  '7xl': [72, 72],
  '8xl': [96, 96],
  '9xl': [128, 128],
}
export const CONTAINER: Record<string, number> = { '3xs': 256, '2xs': 288, xs: 320, sm: 384, md: 448, lg: 512, xl: 576, '2xl': 672, '3xl': 768, '4xl': 896, '5xl': 1024, '6xl': 1152, '7xl': 1280 }
export const RADIUS: Record<string, number> = { none: 0, xs: 2, sm: 4, '': 4, md: 6, lg: 8, xl: 12, '2xl': 16, '3xl': 24, '4xl': 32, full: 9999 }
export const SHADOW: Record<string, string> = {
  '2xs': '0 1px rgba(0,0,0,0.05)',
  xs: '0 1px 2px 0 rgba(0,0,0,0.05)',
  sm: '0 1px 3px 0 rgba(0,0,0,0.1), 0 1px 2px -1px rgba(0,0,0,0.1)',
  '': '0 1px 3px 0 rgba(0,0,0,0.1), 0 1px 2px -1px rgba(0,0,0,0.1)',
  md: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)',
  lg: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)',
  xl: '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
  '2xl': '0 25px 50px -12px rgba(0,0,0,0.25)',
  card: 'var(--shadow-card)',
  float: 'var(--shadow-float)',
  none: 'none',
}
export const LEADING: Record<string, number> = { none: 1, tight: 1.25, snug: 1.375, normal: 1.5, relaxed: 1.625, loose: 2 }
export const TRACKING: Record<string, number> = { tighter: -0.05, tight: -0.025, normal: 0, wide: 0.025, wider: 0.05, widest: 0.1 }
export const WEIGHT: Record<string, number> = { thin: 100, extralight: 200, light: 300, normal: 400, medium: 500, semibold: 600, bold: 700, extrabold: 800, black: 900 }
export const BREAKPOINT: Record<string, number> = { sm: 640, md: 768, lg: 1024, xl: 1280, '2xl': 1536 }
