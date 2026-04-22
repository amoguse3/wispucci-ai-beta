// ─── i18n core ─────────────────────────────────────────────────────────────────
// Lightweight translation function. No external dependencies.
// Usage: t('onboarding.hello', lang) → "Hi! I'm Wispucci AI."

export type AppLanguage = 'en' | 'ru' | 'ro'

export const DEFAULT_LANGUAGE: AppLanguage = 'en'

export const LANGUAGE_OPTIONS: { code: AppLanguage; label: string }[] = [
  { code: 'en', label: 'English 🇬🇧' },
  { code: 'ru', label: 'Русский 🇷🇺' },
  { code: 'ro', label: 'Română 🇷🇴' },
]

// String catalog type — flat keys, string values (may contain {placeholders})
export type StringCatalog = Record<string, string>

import { strings as en } from './strings/en'
import { strings as ru } from './strings/ru'
import { strings as ro } from './strings/ro'

const catalogs: Record<AppLanguage, StringCatalog> = { en, ru, ro }

/**
 * Translate a key.
 * Falls back: requested lang → EN → raw key.
 * Supports {name}-style placeholders via optional params.
 */
export function t(key: string, lang: AppLanguage = DEFAULT_LANGUAGE, params?: Record<string, string | number>): string {
  const raw = catalogs[lang]?.[key] ?? catalogs.en[key] ?? key
  if (!params) return raw
  return raw.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? `{${k}}`))
}

/**
 * Get the full string catalog for a language (used by main process).
 */
export function getCatalog(lang: AppLanguage): StringCatalog {
  return catalogs[lang] ?? catalogs.en
}
