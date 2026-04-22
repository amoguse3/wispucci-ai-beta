import { useState } from 'react'
import type { AgeGroup, UserProfile } from '../../../../shared/types'
import { t, LANGUAGE_OPTIONS, type AppLanguage, DEFAULT_LANGUAGE } from '../../../../shared/i18n'

interface Props {
  onComplete: (profile: UserProfile) => void
}

export default function OnboardingDesktop({ onComplete }: Props) {
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [hasADHD, setHasADHD] = useState<boolean | null>(null)
  const [ageGroup, setAgeGroup] = useState<AgeGroup>('16to25')
  const [language, setLanguage] = useState<AppLanguage>(DEFAULT_LANGUAGE)
  const [fade, setFade] = useState(true)

  const transition = (next: number) => {
    setFade(false)
    setTimeout(() => {
      setStep(next)
      setFade(true)
    }, 300)
  }

  const finish = () => {
    const profile: UserProfile = {
      name: name.trim(),
      hasADHD: hasADHD ?? false,
      preferSoftMode: hasADHD ?? true,
      selectedModel: '',
      language,
      onboardingDone: true,
      onboardingQuickStartDone: false,
      ageGroup,
      dopamineRewards: [
        t('onboarding.defaultReward1', language),
        t('onboarding.defaultReward2', language),
        t('onboarding.defaultReward3', language),
      ]
    }
    onComplete(profile)
  }

  return (
    <div className="relative z-20 h-full flex items-center justify-center p-6">
      <div className="w-full max-w-sm" style={{
        opacity: fade ? 1 : 0,
        transform: fade ? 'translateY(0)' : 'translateY(10px)',
        transition: 'all 0.3s ease-out'
      }}>
        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-8">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="h-1 rounded-full transition-all duration-500" style={{
              width: i === step ? 32 : 8,
              background: i <= step
                ? 'linear-gradient(90deg, #d97706, #f59e0b)'
                : 'rgba(42,37,32,0.4)',
              boxShadow: i === step ? '0 0 8px rgba(217,119,6,0.3)' : 'none'
            }} />
          ))}
        </div>

        {step === 0 && (
          <div className="text-center">
            {/* Brand orb */}
            <div className="mx-auto mb-6 w-20 h-20 rounded-full animate-breathe" style={{
              background: 'radial-gradient(circle, #d97706 0%, #92400e 60%, rgba(8,6,6,0.5) 100%)',
              boxShadow: '0 0 50px rgba(217,119,6,0.3), 0 0 100px rgba(217,119,6,0.1)'
            }} />
            <h1 className="text-xl font-semibold text-aura-text mb-2" style={{ fontFamily: 'Georgia, serif' }}>
              {t('onboarding.hello', language)}
            </h1>
            <p className="text-sm text-aura-muted mb-8 leading-relaxed">
              {t('onboarding.subtitle', language)}
            </p>
            <p className="text-[11px] text-aura-muted mb-8 leading-relaxed">
              First we set you up fast. Right after this, AURA will walk you through creating your first course step by step.
            </p>
            <div className="space-y-3">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && name.trim() && transition(1)}
                placeholder={t('onboarding.namePlaceholder', language)}
                autoFocus
                className="w-full px-4 py-3 rounded-xl bg-transparent text-sm text-center text-aura-text placeholder:text-aura-muted"
                style={{ border: '1px solid rgba(42,37,32,0.5)' }}
              />
              <button
                onClick={() => name.trim() && transition(1)}
                disabled={!name.trim()}
                className="w-full py-3 rounded-xl text-sm font-medium transition-all"
                style={{
                  background: name.trim()
                    ? 'linear-gradient(135deg, #d97706, #b45309)'
                    : 'rgba(42,37,32,0.3)',
                  color: name.trim() ? '#fff' : '#8a7e72',
                  boxShadow: name.trim() ? '0 0 20px rgba(217,119,6,0.2)' : 'none',
                  cursor: name.trim() ? 'pointer' : 'default'
                }}>
                {t('onboarding.continue', language)}
              </button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="text-center">
            <h2 className="text-lg font-semibold text-aura-text mb-2" style={{ fontFamily: 'Georgia, serif' }}>
              {t('onboarding.importantQuestion', language, { name })}
            </h2>
            <p className="text-sm text-aura-muted mb-6 leading-relaxed">
              {t('onboarding.adhdQuestion', language)}
              <br />
              <span className="text-[11px]">{t('onboarding.adhdHint', language)}</span>
            </p>
            <div className="flex flex-col gap-3">
              <button onClick={() => { setHasADHD(true); transition(2) }}
                className="py-3 px-6 rounded-xl text-sm transition-all hover:scale-[1.02]"
                style={{
                  background: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(139,92,246,0.08))',
                  border: '1px solid rgba(139,92,246,0.25)',
                  color: '#c4b5fd'
                }}>
                {t('onboarding.adhdYes', language)}
              </button>
              <button onClick={() => { setHasADHD(false); transition(2) }}
                className="py-3 px-6 rounded-xl text-sm transition-all hover:scale-[1.02]"
                style={{
                  background: 'rgba(26,23,20,0.6)',
                  border: '1px solid rgba(42,37,32,0.5)',
                  color: '#8a7e72'
                }}>
                {t('onboarding.adhdNo', language)}
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="text-center">
            <h2 className="text-lg font-semibold text-aura-text mb-2" style={{ fontFamily: 'Georgia, serif' }}>
              Choose your age group
            </h2>
            <p className="text-sm text-aura-muted mb-6 leading-relaxed">
              AURA uses this only to choose examples and tone.
            </p>
            <div className="flex flex-col gap-3">
              {[
                { code: 'under16', label: 'Under 16' },
                { code: '16to25', label: '16 to 25' },
                { code: '25plus', label: 'Over 25' },
                { code: 'unknown', label: 'Prefer not to say' },
              ].map((option) => {
                const active = ageGroup === option.code
                return (
                  <button key={option.code}
                    onClick={() => { setAgeGroup(option.code as AgeGroup); transition(3) }}
                    className="py-3 px-6 rounded-xl text-sm transition-all hover:scale-[1.02]"
                    style={{
                      background: active
                        ? 'linear-gradient(135deg, rgba(217,119,6,0.15), rgba(217,119,6,0.08))'
                        : 'rgba(26,23,20,0.6)',
                      border: `1px solid ${active ? 'rgba(217,119,6,0.25)' : 'rgba(42,37,32,0.5)'}`,
                      color: active ? '#f59e0b' : '#8a7e72'
                    }}>
                    {option.label}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="text-center">
            <h2 className="text-lg font-semibold text-aura-text mb-2" style={{ fontFamily: 'Georgia, serif' }}>
              {t('onboarding.languageTitle', language)}
            </h2>
            <p className="text-sm text-aura-muted mb-6">
              {t('onboarding.languageHint', language)}
            </p>
            <div className="flex flex-col gap-2 mb-6">
              {LANGUAGE_OPTIONS.map(({ code, label }) => (
                <button key={code}
                  onClick={() => setLanguage(code)}
                  className="py-3 px-6 rounded-xl text-sm transition-all hover:scale-[1.01]"
                  style={{
                    background: language === code
                      ? 'linear-gradient(135deg, rgba(217,119,6,0.15), rgba(217,119,6,0.08))'
                      : 'rgba(26,23,20,0.6)',
                    border: `1px solid ${language === code ? 'rgba(217,119,6,0.25)' : 'rgba(42,37,32,0.5)'}`,
                    color: language === code ? '#f59e0b' : '#8a7e72'
                  }}>
                  {label}
                </button>
              ))}
            </div>
            <button onClick={finish}
              className="w-full py-3 rounded-xl text-sm font-medium transition-all hover:scale-[1.02]"
              style={{
                background: 'linear-gradient(135deg, #d97706, #b45309)',
                color: '#fff',
                boxShadow: '0 0 20px rgba(217,119,6,0.2)'
              }}>
              Start and build my first course
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
