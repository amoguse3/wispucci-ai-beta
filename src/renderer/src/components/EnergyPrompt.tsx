import { useState } from 'react'
import { useLanguage } from '../contexts/LanguageContext'

interface Props {
  name: string
  onSubmit: (level: number) => void
  onSkip: () => void
}

const ENERGY_COLORS: Record<number, string> = {
  1: '#ef4444', 2: '#ef4444', 3: '#f97316', 4: '#f97316', 5: '#eab308',
  6: '#eab308', 7: '#22c55e', 8: '#22c55e', 9: '#10b981', 10: '#10b981',
}

export default function EnergyPrompt({ name, onSubmit, onSkip }: Props) {
  const { t } = useLanguage()
  const [level, setLevel] = useState(5)
  const color = ENERGY_COLORS[level]
  const labelText = t(`energy.${level}`)

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-6 animate-fade-in"
      style={{ background: 'rgba(8,6,6,0.9)', backdropFilter: 'blur(20px)' }}>
      <div className="w-full max-w-sm text-center animate-fade-in-up">
        {/* Glow orb that changes color */}
        <div className="mx-auto mb-6 w-16 h-16 rounded-full animate-breathe" style={{
          background: `radial-gradient(circle, ${color}44 0%, transparent 70%)`,
          boxShadow: `0 0 40px ${color}33`,
          transition: 'all 0.5s ease'
        }} />

        <h2 className="text-lg font-semibold text-aura-text mb-1" style={{ fontFamily: 'Georgia, serif' }}>
          {t('energy.greeting', { name })}
        </h2>
        <p className="text-sm text-aura-muted mb-6">
          {t('energy.question')}
        </p>

        {/* Energy slider */}
        <div className="mb-4">
          <div className="flex justify-between items-end mb-3 px-1">
            {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
              <button key={n}
                onClick={() => setLevel(n)}
                className="flex flex-col items-center gap-1 transition-all"
                style={{ transform: n === level ? 'scale(1.2)' : 'scale(1)' }}>
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium transition-all"
                  style={{
                    background: n <= level
                      ? `linear-gradient(135deg, ${color}33, ${color}15)`
                      : 'rgba(42,37,32,0.2)',
                    border: `1px solid ${n <= level ? color + '44' : 'rgba(42,37,32,0.3)'}`,
                    color: n <= level ? color : '#8a7e72',
                    boxShadow: n === level ? `0 0 10px ${color}33` : 'none'
                  }}>
                  {n}
                </div>
              </button>
            ))}
          </div>
          <p className="text-sm font-medium transition-all" style={{ color }}>
            {labelText}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <button onClick={() => onSubmit(level)}
            className="w-full py-3 rounded-xl text-sm font-medium transition-all hover:scale-[1.02]"
            style={{
              background: `linear-gradient(135deg, ${color}33, ${color}15)`,
              border: `1px solid ${color}33`,
              color,
              boxShadow: `0 0 15px ${color}15`
            }}>
            {t('energy.confirm', { level: String(level) })}
          </button>
          <button onClick={onSkip}
            className="text-xs text-aura-muted hover:text-aura-text transition-colors py-2">
            {t('energy.skip')}
          </button>
        </div>
      </div>
    </div>
  )
}
