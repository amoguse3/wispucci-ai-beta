// ─── Theme system ──────────────────────────────────────────────────────────
// Each theme controls: font family, background style, orb tint, accent color.
// User can also override orb-glow, orb-opacity, bg-opacity, custom PNG uploads.

export type ThemeId =
  | 'cosmos'
  | 'sunset'
  | 'ocean'
  | 'forest'
  | 'retro'
  | 'minimal'
  | 'sakura'

export type BackgroundMode = 'cosmos' | 'solid' | 'gradient' | 'image'

export interface ThemeDef {
  id: ThemeId
  name: string
  emoji: string
  /** Primary font stack used across the app chrome. */
  fontFamily: string
  /** Pixel-display font used for labels/buttons (keep tiny). */
  pixelFont: string
  /** Accent used for button borders, orb highlight, focus glow. */
  accent: string
  /** 0–1 rgba channel for the accent. */
  accentRgb: string
  /** What drives the background layer. */
  background:
    | { mode: 'cosmos' }
    | { mode: 'solid'; color: string }
    | { mode: 'gradient'; css: string }
    | { mode: 'image'; src: string }
  /** Optional orb tint hex used when there's no custom orb PNG. */
  orbTint?: string
  /** Optional text color override for typewriter body. */
  textColor?: string
}

export interface ThemeOverrides {
  /** 0–1. Multiplies orb drop-shadow intensity. 0 = no glow, 1 = default, 1.5 = extra. */
  orbGlow: number
  /** 0–1. Orb opacity. */
  orbOpacity: number
  /** 0–1. Background opacity (dimming the bg). */
  bgOpacity: number
  /** Optional font override (user pick from presets). */
  fontOverride?: string | null
  /** Base64 data URL for a user-uploaded background PNG. */
  customBgDataUrl?: string | null
  /** Base64 data URL for a user-uploaded orb PNG. */
  customOrbDataUrl?: string | null
}

export const DEFAULT_OVERRIDES: ThemeOverrides = {
  orbGlow: 1,
  orbOpacity: 1,
  bgOpacity: 1,
  fontOverride: null,
  customBgDataUrl: null,
  customOrbDataUrl: null,
}

export const FONT_PRESETS: Array<{ id: string; label: string; stack: string }> = [
  { id: 'georgia',  label: 'Georgia',     stack: "Georgia, 'Times New Roman', serif" },
  { id: 'pixel',    label: 'Pixel',       stack: "'Press Start 2P', monospace" },
  { id: 'mono',     label: 'Mono',        stack: "'JetBrains Mono', 'Courier New', monospace" },
  { id: 'sans',     label: 'Sans',        stack: "system-ui, -apple-system, 'Segoe UI', sans-serif" },
  { id: 'serif',    label: 'Serif',       stack: "'Iowan Old Style', 'Apple Garamond', Baskerville, serif" },
  { id: 'rounded',  label: 'Rotund',      stack: "'Nunito', 'Quicksand', system-ui, sans-serif" },
]

export const THEMES: Record<ThemeId, ThemeDef> = {
  cosmos: {
    id: 'cosmos',
    name: 'Cosmos',
    emoji: '🌌',
    fontFamily: "Georgia, 'Times New Roman', serif",
    pixelFont: "'Press Start 2P', monospace",
    accent: '#d97706',
    accentRgb: '217,119,6',
    background: { mode: 'cosmos' },
    orbTint: '#d97706',
    textColor: 'rgba(255,250,235,0.9)',
  },
  sunset: {
    id: 'sunset',
    name: 'Apus',
    emoji: '🌅',
    fontFamily: "'Iowan Old Style', Baskerville, serif",
    pixelFont: "'Press Start 2P', monospace",
    accent: '#f97316',
    accentRgb: '249,115,22',
    background: {
      mode: 'gradient',
      css: 'linear-gradient(180deg, #2b0e1a 0%, #501a1a 30%, #8a3b20 60%, #d97706 90%, #fbbf24 100%)',
    },
    orbTint: '#fb923c',
    textColor: 'rgba(255,240,225,0.92)',
  },
  ocean: {
    id: 'ocean',
    name: 'Ocean',
    emoji: '🌊',
    fontFamily: "'Nunito', system-ui, sans-serif",
    pixelFont: "'Press Start 2P', monospace",
    accent: '#38bdf8',
    accentRgb: '56,189,248',
    background: {
      mode: 'gradient',
      css: 'radial-gradient(ellipse at 50% 30%, #082f49 0%, #031b2e 50%, #020915 100%)',
    },
    orbTint: '#38bdf8',
    textColor: 'rgba(220,240,255,0.92)',
  },
  forest: {
    id: 'forest',
    name: 'Forest',
    emoji: '🌲',
    fontFamily: "'Iowan Old Style', Georgia, serif",
    pixelFont: "'Press Start 2P', monospace",
    accent: '#65a30d',
    accentRgb: '101,163,13',
    background: {
      mode: 'gradient',
      css: 'radial-gradient(ellipse at 40% 40%, #1a2e1f 0%, #0b1a10 55%, #020905 100%)',
    },
    orbTint: '#84cc16',
    textColor: 'rgba(220,240,220,0.92)',
  },
  retro: {
    id: 'retro',
    name: 'Retro',
    emoji: '🕹️',
    fontFamily: "'Press Start 2P', monospace",
    pixelFont: "'Press Start 2P', monospace",
    accent: '#ec4899',
    accentRgb: '236,72,153',
    background: {
      mode: 'gradient',
      css: 'linear-gradient(180deg, #0b0320 0%, #1a0540 40%, #3a0f60 70%, #ec4899 100%)',
    },
    orbTint: '#f472b6',
    textColor: 'rgba(255,220,240,0.92)',
  },
  minimal: {
    id: 'minimal',
    name: 'Minimal',
    emoji: '◻️',
    fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
    pixelFont: "'Press Start 2P', monospace",
    accent: '#a3a3a3',
    accentRgb: '163,163,163',
    background: { mode: 'solid', color: '#0a0a0a' },
    orbTint: '#cbd5e1',
    textColor: 'rgba(230,230,230,0.92)',
  },
  sakura: {
    id: 'sakura',
    name: 'Sakura',
    emoji: '🌸',
    fontFamily: "'Nunito', 'Quicksand', system-ui, sans-serif",
    pixelFont: "'Press Start 2P', monospace",
    accent: '#f9a8d4',
    accentRgb: '249,168,212',
    background: {
      mode: 'gradient',
      css: 'radial-gradient(ellipse at 40% 30%, #2a0a1a 0%, #1a0510 50%, #0a0208 100%)',
    },
    orbTint: '#f9a8d4',
    textColor: 'rgba(255,225,240,0.92)',
  },
}

export const THEME_LIST: ThemeDef[] = Object.values(THEMES)

export function getTheme(id: ThemeId | string | null | undefined): ThemeDef {
  if (id && (THEMES as Record<string, ThemeDef>)[id]) {
    return (THEMES as Record<string, ThemeDef>)[id]
  }
  return THEMES.cosmos
}
