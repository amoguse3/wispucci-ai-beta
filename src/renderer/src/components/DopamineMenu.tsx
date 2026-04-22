import { useState, useEffect } from 'react'
import type { UserProfile } from '../../../../shared/types'
import { useLanguage } from '../contexts/LanguageContext'

interface Props {
  profile: UserProfile
  onClose: () => void
  onRewardPicked: (reward: string) => void
}

function useRewards() {
  const { t } = useLanguage()
  return [
    { id: 'youtube', icon: '🎬', label: t('dopamine.youtube'), timeMin: 15 },
    { id: 'game', icon: '🎮', label: t('dopamine.game'), timeMin: 20 },
    { id: 'walk', icon: '🚶', label: t('dopamine.walk'), timeMin: 15 },
    { id: 'snack', icon: '🍫', label: t('dopamine.snack'), timeMin: 10 },
    { id: 'music', icon: '🎵', label: t('dopamine.music'), timeMin: 15 },
    { id: 'social', icon: '📱', label: t('dopamine.social'), timeMin: 10 },
    { id: 'nap', icon: '😴', label: t('dopamine.nap'), timeMin: 20 },
    { id: 'draw', icon: '🎨', label: t('dopamine.draw'), timeMin: 15 },
    { id: 'stretch', icon: '🧘', label: t('dopamine.stretch'), timeMin: 10 },
    { id: 'chat', icon: '💬', label: t('dopamine.chat'), timeMin: 15 },
    { id: 'coffee', icon: '☕', label: t('dopamine.coffee'), timeMin: 10 },
    { id: 'custom', icon: '✨', label: t('dopamine.custom'), timeMin: 0 }
  ]
}

export default function DopamineMenu({ profile, onClose, onRewardPicked }: Props) {
  const { t } = useLanguage()
  const DEFAULT_REWARDS = useRewards()
  const [selected, setSelected] = useState<string | null>(null)
  const [customReward, setCustomReward] = useState('')
  const [countdown, setCountdown] = useState<number | null>(null)
  const [countdownActive, setCountdownActive] = useState(false)

  // Save user's custom rewards
  const savedRewards = profile.dopamineRewards || []
  const rewards = [...DEFAULT_REWARDS.filter(r => r.id !== 'custom'),
    ...savedRewards.map((r, i) => ({ id: `custom_${i}`, icon: '✨', label: r, timeMin: 15 })),
    DEFAULT_REWARDS.find(r => r.id === 'custom')!
  ]

  useEffect(() => {
    if (!countdownActive || countdown === null) return
    if (countdown <= 0) {
      setCountdownActive(false)
      // Time's up — gentle reminder
      return
    }
    const timer = setTimeout(() => setCountdown(c => (c ?? 1) - 1), 1000)
    return () => clearTimeout(timer)
  }, [countdown, countdownActive])

  const startReward = (reward: typeof DEFAULT_REWARDS[number]) => {
    setSelected(reward.id)
    if (reward.timeMin > 0) {
      setCountdown(reward.timeMin * 60)
      setCountdownActive(true)
    }
    onRewardPicked(reward.label)
  }

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  if (selected && countdown !== null && countdown > 0) {
    const reward = rewards.find(r => r.id === selected)
    return (
      <div className="absolute inset-0 z-50 flex flex-col items-center justify-center p-6"
        style={{ background: 'rgba(8,6,6,0.95)', backdropFilter: 'blur(20px)' }}>
        <div className="w-24 h-24 rounded-full flex items-center justify-center mb-6 animate-breathe" style={{
          background: 'radial-gradient(circle, #10b981, #059669)',
          boxShadow: '0 0 40px rgba(16,185,129,0.3)'
        }}>
          <span className="text-3xl">{reward?.icon}</span>
        </div>

        <h2 className="text-lg font-semibold text-aura-text mb-1">{t('dopamine.enjoy')}</h2>
        <p className="text-sm text-aura-muted mb-4">{reward?.label}</p>

        <p className="text-4xl font-mono font-bold text-emerald-400 mb-6" style={{
          textShadow: '0 0 20px rgba(16,185,129,0.3)'
        }}>
          {formatCountdown(countdown)}
        </p>

        <p className="text-[10px] text-aura-muted mb-6">{t('dopamine.deserved')}</p>

        <button onClick={onClose}
          className="px-6 py-2 rounded-full text-xs font-medium transition-all hover:scale-105"
          style={{ background: 'rgba(42,37,32,0.3)', border: '1px solid rgba(42,37,32,0.5)', color: '#8a7e72' }}>
          {t('dopamine.backToWork')}
        </button>
      </div>
    )
  }

  if (selected && (countdown === null || countdown <= 0)) {
    return (
      <div className="absolute inset-0 z-50 flex flex-col items-center justify-center p-6"
        style={{ background: 'rgba(8,6,6,0.95)', backdropFilter: 'blur(20px)' }}>
        <span className="text-5xl mb-4">🎉</span>
        <h2 className="text-lg font-semibold text-aura-text mb-2">{t('dopamine.congrats')}</h2>
        <p className="text-sm text-aura-muted mb-6">{t('dopamine.backToWork')}</p>
        <button onClick={onClose}
          className="px-8 py-2.5 rounded-full text-sm font-medium transition-all hover:scale-105"
          style={{ background: 'linear-gradient(135deg, #d97706, #b45309)', boxShadow: '0 0 20px rgba(217,119,6,0.3)', color: 'white' }}>
          {t('dopamine.backToWork')}
        </button>
      </div>
    )
  }

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(8,6,6,0.9)', backdropFilter: 'blur(20px)' }}>
      <div className="w-full max-w-sm max-h-[80vh] rounded-2xl p-5 overflow-y-auto animate-fade-in-up" style={{
        background: 'rgba(18,16,14,0.95)',
        border: '1px solid rgba(42,37,32,0.4)'
      }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-aura-text" style={{ fontFamily: 'Georgia, serif' }}>
              Dopamine Menu
            </h2>
            <p className="text-[10px] text-aura-muted mt-0.5">{t('dopamine.enjoy')}</p>
          </div>
          <button onClick={onClose} className="text-aura-muted hover:text-aura-text text-sm">✕</button>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
          {rewards.map(reward => (
            <button key={reward.id}
              onClick={() => {
                if (reward.id === 'custom' && !customReward.trim()) return
                startReward(reward.id === 'custom' ? { ...reward, label: customReward } : reward)
              }}
              className="p-3 rounded-xl text-left transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: 'rgba(26,23,20,0.6)',
                border: '1px solid rgba(42,37,32,0.3)'
              }}>
              <span className="text-lg">{reward.icon}</span>
              <p className="text-[11px] text-aura-text mt-1">{reward.label}</p>
              {reward.timeMin > 0 && (
                <p className="text-[9px] text-aura-muted mt-0.5">{reward.timeMin} min</p>
              )}
            </button>
          ))}
        </div>

        {/* Custom reward input */}
        <div className="flex gap-2">
          <input value={customReward}
            onChange={e => setCustomReward(e.target.value)}
            placeholder={t('dopamine.custom') + '...'}
            className="flex-1 bg-transparent text-xs text-aura-text placeholder:text-aura-muted px-3 py-2 rounded-lg outline-none"
            style={{ border: '1px solid rgba(42,37,32,0.5)' }} />
          <button onClick={() => {
            if (customReward.trim()) {
              startReward({ id: 'custom_new', icon: '✨', label: customReward, timeMin: 15 })
            }
          }}
            className="px-3 py-2 rounded-lg text-xs"
            style={{ background: 'rgba(217,119,6,0.15)', color: '#d97706', border: '1px solid rgba(217,119,6,0.2)' }}>
            Go
          </button>
        </div>
      </div>
    </div>
  )
}
