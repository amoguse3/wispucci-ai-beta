import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import {
  THEMES,
  type ThemeId,
  type ThemeDef,
  type ThemeOverrides,
  DEFAULT_OVERRIDES,
  getTheme,
  FONT_PRESETS,
} from '../../../../shared/themes'

// ─── Storage keys ──────────────────────────────────────────────────────────
const THEME_KEY = 'wispucci_theme_id'
const OVERRIDES_KEY = 'wispucci_theme_overrides'

// ─── Context ───────────────────────────────────────────────────────────────
interface ThemeCtx {
  themeId: ThemeId
  theme: ThemeDef
  overrides: ThemeOverrides
  /** Effective font family (override > theme.fontFamily). */
  fontFamily: string
  /** Effective background CSS — either a colour, gradient, image URL, or 'cosmos' marker. */
  backgroundCss: string | 'cosmos'
  /** Effective orb image data-URL or null. */
  orbImage: string | null
  setThemeId: (id: ThemeId) => void
  patchOverrides: (patch: Partial<ThemeOverrides>) => void
  resetOverrides: () => void
}

const ThemeContext = createContext<ThemeCtx | null>(null)

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return { ...fallback, ...JSON.parse(raw) } as T
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* ignore quota */ }
}

// ─── Provider ──────────────────────────────────────────────────────────────
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeIdState] = useState<ThemeId>(() => {
    try {
      const raw = localStorage.getItem(THEME_KEY)
      if (raw && (THEMES as Record<string, ThemeDef>)[raw]) return raw as ThemeId
    } catch { /* ignore */ }
    return 'cosmos'
  })

  const [overrides, setOverrides] = useState<ThemeOverrides>(() =>
    readJson<ThemeOverrides>(OVERRIDES_KEY, DEFAULT_OVERRIDES),
  )

  const theme = useMemo(() => getTheme(themeId), [themeId])

  const setThemeId = useCallback((id: ThemeId) => {
    setThemeIdState(id)
    try { localStorage.setItem(THEME_KEY, id) } catch { /* ignore */ }
  }, [])

  const patchOverrides = useCallback((patch: Partial<ThemeOverrides>) => {
    setOverrides(prev => {
      const next = { ...prev, ...patch }
      writeJson(OVERRIDES_KEY, next)
      return next
    })
  }, [])

  const resetOverrides = useCallback(() => {
    setOverrides(DEFAULT_OVERRIDES)
    writeJson(OVERRIDES_KEY, DEFAULT_OVERRIDES)
  }, [])

  const fontFamily = useMemo(() => {
    if (overrides.fontOverride) {
      const preset = FONT_PRESETS.find(f => f.id === overrides.fontOverride)
      if (preset) return preset.stack
    }
    return theme.fontFamily
  }, [theme, overrides.fontOverride])

  const backgroundCss = useMemo<string | 'cosmos'>(() => {
    if (overrides.customBgDataUrl) {
      return `center / cover no-repeat url(${overrides.customBgDataUrl})`
    }
    const bg = theme.background
    switch (bg.mode) {
      case 'cosmos':  return 'cosmos'
      case 'solid':   return bg.color
      case 'gradient': return bg.css
      case 'image':   return `center / cover no-repeat url(${bg.src})`
    }
  }, [theme, overrides.customBgDataUrl])

  const orbImage = overrides.customOrbDataUrl || null

  // Write CSS variables on :root so every component can pick them up without
  // subscribing to the context.
  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--aura-font', fontFamily)
    root.style.setProperty('--aura-pixel-font', theme.pixelFont)
    root.style.setProperty('--aura-accent', theme.accent)
    root.style.setProperty('--aura-accent-rgb', theme.accentRgb)
    root.style.setProperty('--aura-text', theme.textColor || 'rgba(255,250,235,0.9)')
    root.style.setProperty('--aura-orb-tint', theme.orbTint || theme.accent)
    root.style.setProperty('--aura-orb-glow', String(overrides.orbGlow))
    root.style.setProperty('--aura-orb-opacity', String(overrides.orbOpacity))
    root.style.setProperty('--aura-bg-opacity', String(overrides.bgOpacity))
  }, [fontFamily, theme, overrides])

  const value: ThemeCtx = {
    themeId,
    theme,
    overrides,
    fontFamily,
    backgroundCss,
    orbImage,
    setThemeId,
    patchOverrides,
    resetOverrides,
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

// ─── Hook ──────────────────────────────────────────────────────────────────
export function useTheme(): ThemeCtx {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    // Graceful fallback during SSR / tests
    const theme = getTheme('cosmos')
    return {
      themeId: 'cosmos',
      theme,
      overrides: DEFAULT_OVERRIDES,
      fontFamily: theme.fontFamily,
      backgroundCss: 'cosmos',
      orbImage: null,
      setThemeId: () => {},
      patchOverrides: () => {},
      resetOverrides: () => {},
    }
  }
  return ctx
}
