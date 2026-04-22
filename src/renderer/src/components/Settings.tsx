import { useState } from 'react'
import { useEffect } from 'react'
import type { AgeGroup, CourseFeedbackAnalytics, TierLimitSnapshot, TierMode, UserProfile } from '../../../../shared/types'
import ThemePicker from './ThemePicker'
import { useLanguage } from '../contexts/LanguageContext'
import { LANGUAGE_OPTIONS } from '../../../../shared/i18n'

interface Props {
  onClose: () => void
  profile: UserProfile
  isWebRuntime?: boolean
}

const LANGUAGES = LANGUAGE_OPTIONS.map(o => ({ code: o.code, label: o.label }))

const MODES = [
  { code: 'standard', label: 'Standard' },
  { code: 'adhd',     label: 'ADHD' },
]

const AGE_GROUPS: Array<{ code: AgeGroup; label: string }> = [
  { code: 'under16', label: 'Under 16' },
  { code: '16to25', label: '16-25' },
  { code: '25plus', label: '25+' },
  { code: 'unknown', label: 'Unknown' },
]

const TIERS: Array<{ code: 'free' | 'premium'; label: string; note: string }> = [
  { code: 'free', label: 'Free', note: 'Compact and affordable: roughly a third of premium depth' },
  { code: 'premium', label: 'Premium', note: 'Deeper and more powerful: roughly 3x space and depth' },
]

function quotaLabel(value: number | null): string {
  return value === null ? '∞' : String(value)
}

function metricLabel(value: number, locale: string): string {
  return Number.isFinite(value) ? value.toLocaleString(locale) : '0'
}

function ratingLabel(value: number, locale: string): string {
  return Number.isFinite(value) ? value.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '0.0'
}

export default function Settings({ onClose, profile, isWebRuntime = false }: Props) {
  const { t, setLang: applyLang, lang: contextLang } = useLanguage()
  const initialStandardTierMode: 'free' | 'premium' = profile.tierMode === 'free' ? 'free' : 'premium'
  const [cleared, setCleared]     = useState(false)
  const [resetting, setResetting] = useState(false)
  const [lang, setLangValue]      = useState<string>(profile.language || contextLang)
  const [mode, setMode]           = useState<string>(profile.hasADHD ? 'adhd' : 'standard')
  const [ageGroup, setAgeGroup]   = useState<AgeGroup>(profile.ageGroup || 'unknown')
  const [orbOn, setOrbOn]         = useState(profile.orbEnabled !== false)
  const [orbSz, setOrbSz]         = useState<string>(profile.orbSize || 'medium')
  const [standardTierMode, setStandardTierMode] = useState<'free' | 'premium'>(initialStandardTierMode)
  const [tierMode, setTierMode]   = useState<TierMode>(profile.tierMode === 'dev-unlimited' ? 'dev-unlimited' : initialStandardTierMode)
  const [tierSnapshot, setTierSnapshot] = useState<TierLimitSnapshot | null>(null)
  const [feedbackAnalytics, setFeedbackAnalytics] = useState<CourseFeedbackAnalytics | null>(null)

  useEffect(() => {
    window.aura.limits.getState().then((snapshot) => {
      setTierSnapshot(snapshot)
      setTierMode(snapshot.tierMode)
      if (snapshot.tierMode !== 'dev-unlimited') {
        setStandardTierMode(snapshot.tierMode === 'free' ? 'free' : 'premium')
      }
    }).catch(() => null)

    window.aura.educator.getCourseFeedbackAnalytics().then(setFeedbackAnalytics).catch(() => null)
  }, [])

  useEffect(() => {
    setLangValue(contextLang)
  }, [contextLang])

  const locale = lang === 'ru' ? 'ru-RU' : lang === 'ro' ? 'ro-RO' : 'en-US'
  const modes = [
    { code: 'standard', label: t('settings.mode.standard') },
    { code: 'adhd', label: t('settings.mode.adhd') },
  ]
  const ageGroups: Array<{ code: AgeGroup; label: string }> = [
    { code: 'under16', label: t('settings.age.under16') },
    { code: '16to25', label: t('settings.age.16to25') },
    { code: '25plus', label: t('settings.age.25plus') },
    { code: 'unknown', label: t('settings.age.unknown') },
  ]
  const tiers: Array<{ code: 'free' | 'premium'; label: string; note: string }> = [
    { code: 'free', label: t('settings.tier.free'), note: t('settings.tier.freeNote') },
    { code: 'premium', label: t('settings.tier.premium'), note: t('settings.tier.premiumNote') },
  ]

  const saveAll = (patch: Partial<UserProfile>) => {
    const nextProfile: UserProfile = {
      ...profile,
      language: lang as any,
      hasADHD: mode === 'adhd',
      preferSoftMode: mode === 'adhd',
      ageGroup,
      orbEnabled: orbOn,
      orbSize: orbSz as any,
      tierMode,
      ...patch,
    }

    window.aura.profile.save(nextProfile).then(() => {
      window.aura.limits.getState().then(setTierSnapshot).catch(() => null)
    }).catch(() => null)
  }
  const toggleOrb = (enabled: boolean) => {
    setOrbOn(enabled)
    saveAll({ orbEnabled: enabled })
    window.aura.overlay.setEnabled(enabled)
  }
  const changeOrbSize = (sz: string) => {
    setOrbSz(sz)
    saveAll({ orbSize: sz as any })
    window.aura.overlay.setSize(sz)
  }
  const changeLang = (code: string) => {
    setLangValue(code)
    applyLang(code as any)
    saveAll({ language: code as any })
  }
  const changeMode = (code: string) => {
    setMode(code)
    saveAll({ hasADHD: code === 'adhd', preferSoftMode: code === 'adhd' })
  }
  const changeAgeGroup = (code: AgeGroup) => {
    setAgeGroup(code)
    saveAll({ ageGroup: code })
  }
  const changeTierMode = (code: TierMode) => {
    setTierMode(code)
    if (code !== 'dev-unlimited') {
      setStandardTierMode(code)
    }
    saveAll({ tierMode: code })
  }
  const toggleDevFullAccess = () => {
    changeTierMode(tierMode === 'dev-unlimited' ? standardTierMode : 'dev-unlimited')
  }

  const clearChat = async () => {
    await window.aura.chat.clearHistory()
    setCleared(true)
    setTimeout(() => setCleared(false), 2000)
  }

  const resetProfileFromZero = async () => {
    if (resetting) return

    const confirmed = window.confirm(t('settings.confirmReset'))
    if (!confirmed) return

    setResetting(true)

    try {
      await window.aura.overlay.setEnabled(false).catch(() => undefined)
      await window.aura.profile.resetAll()

      try {
        const keysToRemove: string[] = []
        for (let index = 0; index < localStorage.length; index += 1) {
          const key = localStorage.key(index)
          if (!key) continue
          if (key.startsWith('aura_') || key.startsWith('wispucci_')) {
            keysToRemove.push(key)
          }
        }
        keysToRemove.forEach((key) => localStorage.removeItem(key))
      } catch {
        // Ignore local storage cleanup failures and still reload into onboarding.
      }

      window.location.reload()
    } catch {
      setResetting(false)
      window.alert(t('settings.resetError'))
    }
  }

  // ── shared chip style ───────────────────────────────────────────────────────
  const chip = (active: boolean, color: string = '196,154,60') => ({
    padding: '7px 13px',
    borderRadius: '7px',
    fontFamily: "'Press Start 2P', monospace" as const,
    fontSize: '5px',
    lineHeight: 2,
    letterSpacing: '0.08em',
    cursor: 'pointer' as const,
    border: `1px solid rgba(${color},${active ? '0.32' : '0.12'})`,
    background: active ? `rgba(${color},0.1)` : 'rgba(13,29,22,0.45)',
    color: active ? `rgba(${color === '196,154,60' ? '232,197,106' : color},0.85)` : 'rgba(196,154,60,0.30)',
    transition: 'all 0.2s',
  })

  return (
    <div data-tutorial="settings-root" style={{
      position: 'absolute',
      inset: 0,
      zIndex: 50,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
      background: 'rgba(3,13,6,0.92)',
      backdropFilter: 'blur(24px)',
      animation: 'fadeUp 0.3s cubic-bezier(.16,1,.3,1) forwards',
    }}>

      {/* Modal card */}
      <div style={{
        width: '100%',
        maxWidth: '360px',
        maxHeight: '88vh',
        overflowY: 'auto',
        borderRadius: '12px',
        padding: '24px 22px',
        background: 'rgba(2,9,4,0.96)',
        border: '1px solid rgba(196,154,60,0.14)',
        boxShadow: '0 0 60px rgba(196,154,60,0.06)',
        scrollbarWidth: 'thin',
        scrollbarColor: 'rgba(196,154,60,0.1) transparent',
        position: 'relative',
      }}>

        {/* Left accent line */}
        <div style={{
          position: 'absolute',
          left: 0, top: '18%', bottom: '18%',
          width: '2px', borderRadius: '2px',
          background: 'linear-gradient(180deg, transparent, rgba(232,197,106,0.3), transparent)',
        }} />

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '22px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '28px', height: '28px', borderRadius: '6px',
              background: 'radial-gradient(circle at 38% 36%, rgba(232,197,106,0.5), rgba(196,154,60,0.14))',
              border: '1px solid rgba(232,197,106,0.28)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '12px',
              boxShadow: '0 0 14px rgba(196,154,60,0.2)',
            }}>⚙</div>
            <span style={{
              fontFamily: "'Press Start 2P', monospace",
              fontSize: '9px',
              color: 'rgba(245,228,168,0.9)',
              letterSpacing: '0.06em',
              textShadow: '0 0 20px rgba(196,154,60,0.3)',
            }}>{t('settings.title')}</span>
          </div>

          <button
            onClick={onClose}
            style={{
              fontFamily: "'Press Start 2P', monospace",
              fontSize: '8px',
              color: 'rgba(196,154,60,0.28)',
              background: 'none', border: 'none',
              cursor: 'pointer', transition: 'color 0.2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'rgba(232,197,106,0.6)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(196,154,60,0.28)')}
          >✕</button>
        </div>

        {/* ── Profile block ───────────────────────────────────────────────────── */}
        <div style={{
          padding: '12px 14px', borderRadius: '10px', marginBottom: '18px',
          background: 'rgba(4,14,8,0.6)',
          border: '1px solid rgba(196,154,60,0.1)',
        }}>
          <div style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: '5px', letterSpacing: '0.18em',
            color: 'rgba(196,154,60,0.28)', marginBottom: '8px',
            lineHeight: 2, textTransform: 'uppercase',
          }}>{t('settings.profileLabel')}</div>
          <div style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: '6px', color: 'rgba(245,228,168,0.7)', lineHeight: 2,
          }}>{profile.name}</div>
        </div>

        <div style={{
          padding: '14px 14px', borderRadius: '10px', marginBottom: '18px',
          background: 'rgba(4,14,8,0.6)',
          border: '1px solid rgba(196,154,60,0.1)',
        }}>
          <div style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: '5px', letterSpacing: '0.18em',
            color: 'rgba(196,154,60,0.28)', marginBottom: '12px',
            lineHeight: 2, textTransform: 'uppercase',
          }}>{t('settings.ageGroup')}</div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
            {ageGroups.map(group => (
              <button
                key={group.code}
                onClick={() => changeAgeGroup(group.code)}
                style={chip(ageGroup === group.code, '40,180,120')}
                onMouseEnter={e => {
                  if (ageGroup !== group.code)
                    (e.currentTarget as HTMLElement).style.borderColor = 'rgba(40,180,120,0.22)'
                }}
                onMouseLeave={e => {
                  if (ageGroup !== group.code)
                    (e.currentTarget as HTMLElement).style.borderColor = 'rgba(40,180,120,0.12)'
                }}
              >
                {group.label}
              </button>
            ))}
          </div>
          <div style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: '5px', color: 'rgba(196,154,60,0.24)',
            marginTop: '10px', lineHeight: 2.2,
          }}>
            {t('settings.ageGroupHint')}
          </div>
        </div>

        {/* ── Limba ───────────────────────────────────────────────────────────── */}
        <div style={{
          padding: '14px 14px', borderRadius: '10px', marginBottom: '18px',
          background: 'rgba(4,14,8,0.6)',
          border: '1px solid rgba(196,154,60,0.1)',
        }}>
          <div style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: '5px', letterSpacing: '0.18em',
            color: 'rgba(196,154,60,0.28)', marginBottom: '12px',
            lineHeight: 2, textTransform: 'uppercase',
          }}>{t('settings.botLanguage')}</div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
            {LANGUAGES.map(l => (
              <button
                key={l.code}
                onClick={() => changeLang(l.code)}
                style={chip(lang === l.code)}
                onMouseEnter={e => {
                  if (lang !== l.code)
                    (e.currentTarget as HTMLElement).style.borderColor = 'rgba(196,154,60,0.22)'
                }}
                onMouseLeave={e => {
                  if (lang !== l.code)
                    (e.currentTarget as HTMLElement).style.borderColor = 'rgba(196,154,60,0.12)'
                }}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Mod ─────────────────────────────────────────────────────────────── */}
        <div style={{
          padding: '14px 14px', borderRadius: '10px', marginBottom: '18px',
          background: 'rgba(4,14,8,0.6)',
          border: '1px solid rgba(196,154,60,0.1)',
        }}>
          <div style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: '5px', letterSpacing: '0.18em',
            color: 'rgba(196,154,60,0.28)', marginBottom: '12px',
            lineHeight: 2, textTransform: 'uppercase',
          }}>{t('settings.modeLabel')}</div>

          <div style={{ display: 'flex', gap: '7px' }}>
            {modes.map(m => (
              <button
                key={m.code}
                onClick={() => changeMode(m.code)}
                style={chip(mode === m.code)}
                onMouseEnter={e => {
                  if (mode !== m.code)
                    (e.currentTarget as HTMLElement).style.borderColor = 'rgba(196,154,60,0.22)'
                }}
                onMouseLeave={e => {
                  if (mode !== m.code)
                    (e.currentTarget as HTMLElement).style.borderColor = 'rgba(196,154,60,0.12)'
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
          <div style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: '5px', color: 'rgba(196,154,60,0.24)',
            marginTop: '10px', lineHeight: 2.2,
          }}>
            {mode === 'adhd'
              ? t('settings.mode.adhdHint')
              : t('settings.mode.standardHint')}
          </div>
        </div>

        {/* ── Orb flotant ──────────────────────────────────────────────────────── */}
        {!isWebRuntime ? (
          <div style={{
            padding: '14px 14px', borderRadius: '10px', marginBottom: '18px',
            background: 'rgba(4,14,8,0.6)',
            border: '1px solid rgba(196,154,60,0.1)',
          }}>
            <div style={{
              fontFamily: "'Press Start 2P', monospace",
              fontSize: '5px', letterSpacing: '0.18em',
              color: 'rgba(196,154,60,0.28)', marginBottom: '12px',
              lineHeight: 2, textTransform: 'uppercase',
            }}>{t('settings.floatingOrb')}</div>

            <div style={{ display: 'flex', gap: '7px', marginBottom: orbOn ? 10 : 0 }}>
              <button onClick={() => toggleOrb(true)} style={chip(orbOn, '40,180,80')}>{t('settings.on')}</button>
              <button onClick={() => toggleOrb(false)} style={chip(!orbOn, '220,80,80')}>{t('settings.off')}</button>
            </div>

            {orbOn && (
              <div>
                <div style={{
                  fontFamily: "'Press Start 2P', monospace",
                  fontSize: '5px', color: 'rgba(196,154,60,0.2)',
                  marginBottom: 8, lineHeight: 2,
                }}>{t('settings.orbSize')}</div>
                <div style={{ display: 'flex', gap: '7px' }}>
                  {(['small', 'medium', 'large'] as const).map(s => (
                    <button key={s} onClick={() => changeOrbSize(s)} style={chip(orbSz === s)}>
                      {s === 'small' ? t('settings.orbSize.small') : s === 'medium' ? t('settings.orbSize.medium') : t('settings.orbSize.large')}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div style={{
              fontFamily: "'Press Start 2P', monospace",
              fontSize: '5px', color: 'rgba(196,154,60,0.18)',
              marginTop: 10, lineHeight: 2.2,
            }}>
              {orbOn ? t('settings.orbEnabledHint') : t('settings.orbDisabledHint')}
            </div>
          </div>
        ) : (
          <div style={{
            padding: '14px 14px', borderRadius: '10px', marginBottom: '18px',
            background: 'rgba(4,14,8,0.6)',
            border: '1px solid rgba(96,180,255,0.14)',
          }}>
            <div style={{
              fontFamily: "'Press Start 2P', monospace",
              fontSize: '5px', letterSpacing: '0.18em',
              color: 'rgba(96,180,255,0.42)', marginBottom: '12px',
              lineHeight: 2, textTransform: 'uppercase',
            }}>{t('settings.browserMode')}</div>
            <div style={{
              fontFamily: "'Press Start 2P', monospace",
              fontSize: '5px', color: 'rgba(196,154,60,0.26)', lineHeight: 2.2,
            }}>
              {t('settings.browserModeHint')}
            </div>
          </div>
        )}

        {/* ── Teme / fonturi / custom PNG ──────────────────────────────────── */}
        <ThemePicker />

        <div style={{
          padding: '14px 14px', borderRadius: '10px', marginBottom: '18px',
          background: 'rgba(4,14,8,0.6)',
          border: '1px solid rgba(40,180,120,0.12)',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            marginBottom: 12,
          }}>
            <div>
              <div style={{
                fontFamily: "'Press Start 2P', monospace",
                fontSize: '5px', letterSpacing: '0.18em',
                color: 'rgba(40,180,120,0.34)', marginBottom: '6px',
                lineHeight: 2, textTransform: 'uppercase',
              }}>{t('settings.plans')}</div>
              <div style={{
                fontFamily: "'Press Start 2P', monospace",
                fontSize: '5px', color: 'rgba(196,154,60,0.28)', lineHeight: 2.2,
              }}>
                {t('settings.plansHint')}
              </div>
            </div>
            <div style={{
              fontFamily: "'Press Start 2P', monospace",
              fontSize: '5px', color: 'rgba(46,184,122,0.62)', lineHeight: 2,
              padding: '5px 10px', borderRadius: 6,
              background: 'rgba(40,180,120,0.08)', border: '1px solid rgba(40,180,120,0.14)',
            }}>
              {tierMode === 'dev-unlimited' ? t('settings.devStatus.dev') : tierMode === 'premium' ? t('settings.devStatus.premium') : t('settings.devStatus.free')}
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px', marginBottom: 12 }}>
            {tiers.map((tier) => (
              <button
                key={tier.code}
                onClick={() => changeTierMode(tier.code)}
                style={chip(tierMode === tier.code, tier.code === 'premium' ? '46,184,122' : '196,154,60')}
              >
                {tier.label}
              </button>
            ))}
          </div>

          <div style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: '5px', color: 'rgba(196,154,60,0.24)', lineHeight: 2.2, marginBottom: 12,
          }}>
            {tierMode === 'dev-unlimited'
              ? t('settings.devHint')
              : tiers.find((tier) => tier.code === tierMode)?.note}
          </div>

          <div style={{
            padding: '12px 12px', borderRadius: 8, marginBottom: 12,
            background: 'rgba(10,16,12,0.72)', border: '1px solid rgba(96,180,255,0.14)',
          }}>
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '4.8px', color: 'rgba(96,180,255,0.46)', lineHeight: 2, marginBottom: 8 }}>
              {t('settings.devTitle')}
            </div>
            <button
              onClick={toggleDevFullAccess}
              style={chip(tierMode === 'dev-unlimited', '96,180,255')}
            >
              {t('settings.devButton')}
            </button>
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '4.4px', color: 'rgba(196,154,60,0.28)', lineHeight: 2.2, marginTop: 10 }}>
              {t('settings.devHint')}
            </div>
          </div>

          {tierSnapshot && (
            <div style={{ display: 'grid', gap: 10 }}>
              <div style={{
                padding: '12px 12px', borderRadius: 8,
                background: 'rgba(10,16,12,0.72)', border: '1px solid rgba(46,184,122,0.12)',
              }}>
                <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '4.8px', color: 'rgba(46,184,122,0.42)', lineHeight: 2, marginBottom: 8 }}>
                  {t('settings.activeWindow')}
                </div>
                <div style={{ display: 'grid', gap: 8 }}>
                  {[
                    [t('settings.coursesPer2h'), tierSnapshot.usage.coursesCreatedLast2Hours, tierSnapshot.capabilities.coursesPer2Hours],
                    [t('settings.coursesPerMonth'), tierSnapshot.usage.coursesCreatedThisMonth, tierSnapshot.capabilities.coursesPerMonth],
                    [t('settings.chatPerDay'), tierSnapshot.usage.chatMessagesToday, tierSnapshot.capabilities.chatMessagesPerDay],
                    [t('settings.lessonsPer2h'), tierSnapshot.usage.lessonsStartedLast2Hours, tierSnapshot.capabilities.lessonsPer2Hours],
                    [t('settings.lessonsPerMonth'), tierSnapshot.usage.lessonsStartedThisMonth, tierSnapshot.capabilities.lessonsPerMonth],
                    [t('settings.flashcards'), tierSnapshot.usage.flashcardsTotal, tierSnapshot.capabilities.flashcardsTotal],
                  ].map(([label, used, limit]) => (
                    <div key={String(label)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                      <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '4.6px', color: 'rgba(196,154,60,0.34)', lineHeight: 2 }}>
                        {label}
                      </div>
                      <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '4.8px', color: 'rgba(245,228,168,0.82)', lineHeight: 2 }}>
                        {String(used)} / {quotaLabel(limit as number | null)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gap: 8 }}>
                {(['free', 'premium'] as const).map((planCode) => {
                  const plan = tierSnapshot.plans[planCode]
                  const telemetry = tierSnapshot.telemetry.byTier[planCode]
                  const isActive = tierMode === planCode

                  return (
                    <div key={planCode} style={{
                      padding: '12px 12px', borderRadius: 8,
                      background: isActive ? 'rgba(46,184,122,0.08)' : 'rgba(2,9,4,0.58)',
                      border: `1px solid ${isActive ? 'rgba(46,184,122,0.16)' : 'rgba(196,154,60,0.1)'}`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
                        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '4.8px', color: isActive ? 'rgba(46,184,122,0.72)' : 'rgba(245,228,168,0.76)', lineHeight: 2 }}>
                          {plan.label}
                        </div>
                        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '4.4px', color: 'rgba(196,154,60,0.32)', lineHeight: 2 }}>
                          {isActive ? t('settings.active') : t('settings.planLabel')}
                        </div>
                      </div>
                      <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '4.4px', color: 'rgba(245,228,168,0.54)', lineHeight: 2.2, marginBottom: 10 }}>
                        {planCode === 'premium' ? t('settings.tier.premiumNote') : t('settings.tier.freeNote')}
                      </div>
                      <div style={{ display: 'grid', gap: 6 }}>
                        {[
                          [t('settings.coursesPer2h'), plan.capabilities.coursesPer2Hours],
                          [t('settings.coursesPerMonth'), plan.capabilities.coursesPerMonth],
                          [t('settings.chatPerDay'), plan.capabilities.chatMessagesPerDay],
                          [t('settings.lessonsPer2h'), plan.capabilities.lessonsPer2Hours],
                          [t('settings.lessonsPerMonth'), plan.capabilities.lessonsPerMonth],
                          [t('settings.flashcards'), plan.capabilities.flashcardsTotal],
                        ].map(([label, limit]) => (
                          <div key={String(label)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '4.4px', color: 'rgba(196,154,60,0.32)', lineHeight: 2 }}>
                              {label}
                            </div>
                            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '4.6px', color: 'rgba(245,228,168,0.74)', lineHeight: 2 }}>
                              {quotaLabel(limit as number | null)}
                            </div>
                          </div>
                        ))}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '4.4px', color: 'rgba(196,154,60,0.32)', lineHeight: 2 }}>
                            {t('settings.pdfExport')}
                          </div>
                          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '4.6px', color: plan.capabilities.exportCoursePdf ? 'rgba(46,184,122,0.74)' : 'rgba(220,100,100,0.66)', lineHeight: 2 }}>
                            {plan.capabilities.exportCoursePdf ? t('settings.yes') : t('settings.no')}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 4 }}>
                          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '4.4px', color: 'rgba(196,154,60,0.32)', lineHeight: 2 }}>
                            {t('settings.telemetry')}
                          </div>
                          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '4.6px', color: 'rgba(245,228,168,0.74)', lineHeight: 2 }}>
                            {metricLabel(telemetry.total, locale)} · {t('settings.averageShort')} {metricLabel(telemetry.averagePerRequest, locale)}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div style={{
                padding: '12px 12px', borderRadius: 8,
                background: 'rgba(2,9,4,0.58)', border: '1px solid rgba(196,154,60,0.1)',
              }}>
                <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '4.8px', color: 'rgba(196,154,60,0.34)', lineHeight: 2, marginBottom: 8 }}>
                  {t('settings.tokenSources')}
                </div>
                <div style={{ display: 'grid', gap: 6 }}>
                  {tierSnapshot.telemetry.bySource.slice(0, 5).map((item) => (
                    <div key={item.source} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                      <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '4.4px', color: 'rgba(245,228,168,0.6)', lineHeight: 2 }}>
                        {item.source}
                      </div>
                      <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '4.4px', color: 'rgba(196,154,60,0.42)', lineHeight: 2 }}>
                        {metricLabel(item.total, locale)} · {item.requests} {t('settings.requestsShort')}
                      </div>
                    </div>
                  ))}
                  {tierSnapshot.telemetry.bySource.length === 0 && (
                    <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '4.4px', color: 'rgba(196,154,60,0.28)', lineHeight: 2.2 }}>
                      {t('settings.noTraffic')}
                    </div>
                  )}
                </div>
              </div>

              <div style={{
                padding: '10px 12px', borderRadius: 8,
                background: 'rgba(40,180,120,0.05)', border: '1px solid rgba(40,180,120,0.1)',
              }}>
                <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '4.8px', color: 'rgba(40,180,120,0.38)', lineHeight: 2, marginBottom: 8 }}>
                  {t('settings.psychFrame')}
                </div>
                <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '4.6px', color: 'rgba(245,228,168,0.58)', lineHeight: 2.2 }}>
                  {tierSnapshot.notes.courseCreation}
                </div>
                <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '4.6px', color: 'rgba(245,228,168,0.52)', lineHeight: 2.2, marginTop: 8 }}>
                  {tierSnapshot.notes.chatBudget}
                </div>
                <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '4.6px', color: 'rgba(245,228,168,0.48)', lineHeight: 2.2, marginTop: 8 }}>
                  {tierSnapshot.notes.lessons}
                </div>
              </div>

              {feedbackAnalytics && (
                <div style={{
                  padding: '12px 12px', borderRadius: 8,
                  background: 'rgba(18,30,20,0.6)', border: '1px solid rgba(96,180,255,0.12)',
                }}>
                  <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '4.8px', color: 'rgba(96,180,255,0.44)', lineHeight: 2, marginBottom: 8 }}>
                    Course Feedback Signal
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginBottom: 12 }}>
                    {[
                      ['Completed', metricLabel(feedbackAnalytics.total_completed_courses, locale)],
                      ['Saved feedback', metricLabel(feedbackAnalytics.total_feedback_records, locale)],
                      ['Missing feedback', metricLabel(feedbackAnalytics.missing_feedback_count, locale)],
                      ['Ready to advance', metricLabel(feedbackAnalytics.ready_to_advance_count, locale)],
                      ['Needs attention', metricLabel(feedbackAnalytics.needs_attention_count, locale)],
                      ['Overall avg', `${ratingLabel(feedbackAnalytics.average_overall_rating, locale)}/10`],
                      ['Clarity avg', `${ratingLabel(feedbackAnalytics.average_clarity_rating, locale)}/10`],
                      ['Retention avg', `${ratingLabel(feedbackAnalytics.average_retention_rating, locale)}/10`],
                      ['Difficulty avg', `${ratingLabel(feedbackAnalytics.average_difficulty_rating, locale)}/10`],
                      ['Continue avg', `${ratingLabel(feedbackAnalytics.average_continue_interest_rating, locale)}/10`],
                    ].map(([label, value]) => (
                      <div key={label} style={{ padding: '10px 10px', borderRadius: 8, background: 'rgba(4,12,8,0.58)', border: '1px solid rgba(96,180,255,0.08)' }}>
                        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '4.2px', color: 'rgba(96,180,255,0.34)', lineHeight: 2, marginBottom: 4 }}>
                          {label}
                        </div>
                        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '4.8px', color: 'rgba(235,242,248,0.82)', lineHeight: 2 }}>
                          {value}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{
                    padding: '10px 10px', borderRadius: 8, marginBottom: 10,
                    background: 'rgba(96,180,255,0.04)', border: '1px solid rgba(96,180,255,0.08)',
                  }}>
                    <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '4.4px', color: 'rgba(96,180,255,0.34)', lineHeight: 2, marginBottom: 6 }}>
                      Recommendation directions
                    </div>
                    <div style={{ display: 'grid', gap: 6 }}>
                      {Object.entries(feedbackAnalytics.direction_counts).map(([direction, count]) => (
                        <div key={direction} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '4.4px', color: 'rgba(235,242,248,0.68)', lineHeight: 2 }}>
                            {direction.toUpperCase()}
                          </div>
                          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '4.4px', color: 'rgba(96,180,255,0.54)', lineHeight: 2 }}>
                            {metricLabel(count, locale)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{
                    padding: '10px 10px', borderRadius: 8,
                    background: 'rgba(4,12,8,0.58)', border: '1px solid rgba(96,180,255,0.08)',
                  }}>
                    <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '4.4px', color: 'rgba(96,180,255,0.34)', lineHeight: 2, marginBottom: 6 }}>
                      Recent completed courses
                    </div>
                    <div style={{ display: 'grid', gap: 8 }}>
                      {feedbackAnalytics.items.slice(0, 5).map((item) => (
                        <div key={item.id} style={{ padding: '8px 8px', borderRadius: 8, background: 'rgba(96,180,255,0.035)', border: '1px solid rgba(96,180,255,0.06)' }}>
                          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '4.3px', color: 'rgba(245,228,168,0.74)', lineHeight: 2, marginBottom: 2 }}>
                            {item.course_title}
                          </div>
                          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '4px', color: 'rgba(96,180,255,0.4)', lineHeight: 2, marginBottom: 4 }}>
                            {item.course_topic} · {(item.recommendation?.direction || 'none').toUpperCase()}
                          </div>
                          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '4.2px', color: 'rgba(235,242,248,0.62)', lineHeight: 2 }}>
                            O {ratingLabel(item.overall_rating, locale)} · C {ratingLabel(item.clarity_rating, locale)} · R {ratingLabel(item.retention_rating, locale)} · D {ratingLabel(item.difficulty_rating, locale)}
                          </div>
                        </div>
                      ))}
                      {feedbackAnalytics.items.length === 0 && (
                        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '4.2px', color: 'rgba(96,180,255,0.26)', lineHeight: 2.2 }}>
                          No saved course feedback yet.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Clear chat ───────────────────────────────────────────────────────── */}
        <button
          onClick={clearChat}
          style={{
            width: '100%',
            padding: '12px',
            borderRadius: '10px',
            fontFamily: "'Press Start 2P', monospace",
            fontSize: '6px',
            letterSpacing: '0.08em',
            lineHeight: 2,
            cursor: 'pointer',
            transition: 'all 0.28s ease',
            border: `1px solid ${cleared ? 'rgba(46,184,122,0.28)' : 'rgba(220,80,80,0.2)'}`,
            background: cleared ? 'rgba(46,184,122,0.07)' : 'rgba(220,80,80,0.06)',
            color: cleared ? 'rgba(46,184,122,0.8)' : 'rgba(220,80,80,0.65)',
            marginBottom: '16px',
          }}
          onMouseEnter={e => {
            if (!cleared) {
              e.currentTarget.style.borderColor = 'rgba(220,80,80,0.36)'
              e.currentTarget.style.boxShadow = '0 0 18px rgba(220,80,80,0.1)'
            }
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = cleared ? 'rgba(46,184,122,0.28)' : 'rgba(220,80,80,0.2)'
            e.currentTarget.style.boxShadow = 'none'
          }}
        >
          {cleared ? `${t('settings.clearConfirm')} ✓` : t('settings.clearChat')}
        </button>

        <div style={{
          padding: '14px 14px', borderRadius: '10px', marginBottom: '16px',
          background: 'rgba(36,8,8,0.5)',
          border: '1px solid rgba(220,80,80,0.16)',
        }}>
          <div style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: '5px', letterSpacing: '0.18em',
            color: 'rgba(220,80,80,0.56)', marginBottom: '10px',
            lineHeight: 2, textTransform: 'uppercase',
          }}>{t('settings.dangerZone')}</div>

          <div style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: '4.8px', color: 'rgba(245,228,168,0.5)', lineHeight: 2.2,
            marginBottom: '12px',
          }}>
            {t('settings.dangerZoneHint')}
          </div>

          <button
            onClick={resetProfileFromZero}
            disabled={resetting}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '10px',
              fontFamily: "'Press Start 2P', monospace",
              fontSize: '5.5px',
              letterSpacing: '0.08em',
              lineHeight: 2,
              cursor: resetting ? 'wait' : 'pointer',
              transition: 'all 0.28s ease',
              border: '1px solid rgba(220,80,80,0.24)',
              background: resetting ? 'rgba(220,80,80,0.12)' : 'rgba(220,80,80,0.08)',
              color: 'rgba(255,190,190,0.78)',
              opacity: resetting ? 0.72 : 1,
            }}
            onMouseEnter={e => {
              if (!resetting) {
                e.currentTarget.style.borderColor = 'rgba(220,80,80,0.4)'
                e.currentTarget.style.boxShadow = '0 0 18px rgba(220,80,80,0.12)'
              }
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'rgba(220,80,80,0.24)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            {resetting ? t('settings.resetting') : t('settings.resetButton')}
          </button>
        </div>

        {/* ── Version ─────────────────────────────────────────────────────────── */}
        <div style={{
          textAlign: 'center',
          fontFamily: "'Press Start 2P', monospace",
          fontSize: '5px',
          color: 'rgba(196,154,60,0.18)',
          letterSpacing: '0.1em',
          lineHeight: 2,
        }}>
          Wispucci AI beta v0.1.0 · {t('settings.versionPrivate')}
        </div>

      </div>
    </div>
  )
}