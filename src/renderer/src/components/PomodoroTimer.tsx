import { useState, useEffect, useRef } from 'react'

interface Props {
  onClose: () => void
  speak?: (text: string) => void
}

const PRESETS = [
  { label: '15 min', work: 15, break: 3 },
  { label: '25 min', work: 25, break: 5 },
  { label: '45 min', work: 45, break: 10 }
]

export default function PomodoroTimer({ onClose, speak }: Props) {
  const [preset, setPreset] = useState(1) // 25 min default
  const [secondsLeft, setSecondsLeft] = useState(PRESETS[1].work * 60)
  const [isRunning, setIsRunning] = useState(false)
  const [isBreak, setIsBreak] = useState(false)
  const [sessions, setSessions] = useState(0)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const currentPreset = PRESETS[preset]
  const totalSeconds = isBreak ? currentPreset.break * 60 : currentPreset.work * 60
  const progress = ((totalSeconds - secondsLeft) / totalSeconds) * 100

  useEffect(() => {
    if (isRunning && secondsLeft > 0) {
      intervalRef.current = setInterval(() => {
        setSecondsLeft(s => s - 1)
      }, 1000)
    }

    if (secondsLeft === 0 && isRunning) {
      setIsRunning(false)
      if (!isBreak) {
        // Work session done
        setSessions(s => s + 1)
        window.aura.motivation.addXP(10)
        speak?.('Good work. Take a break.')
        // Auto-start break
        setIsBreak(true)
        setSecondsLeft(currentPreset.break * 60)
        setTimeout(() => setIsRunning(true), 2000)
      } else {
        // Break done
        speak?.('Break is over. Let\'s keep going!')
        setIsBreak(false)
        setSecondsLeft(currentPreset.work * 60)
      }
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [isRunning, secondsLeft, isBreak, currentPreset, speak])

  const toggleRunning = () => {
    if (!isRunning && secondsLeft === totalSeconds) {
      speak?.(isBreak ? 'Break started.' : 'Focus mode activated. Back to work.')
    }
    setIsRunning(!isRunning)
  }

  const reset = () => {
    setIsRunning(false)
    setIsBreak(false)
    setSecondsLeft(currentPreset.work * 60)
  }

  const selectPreset = (i: number) => {
    if (isRunning) return
    setPreset(i)
    setIsBreak(false)
    setSecondsLeft(PRESETS[i].work * 60)
  }

  const minutes = Math.floor(secondsLeft / 60)
  const seconds = secondsLeft % 60

  const ringColor = isBreak ? '#10b981' : '#d97706'
  const circumference = 2 * Math.PI * 70

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center p-6 animate-fade-in"
      style={{ background: 'rgba(8,6,6,0.95)', backdropFilter: 'blur(20px)' }}>

      {/* Close button */}
      <button onClick={onClose}
        className="absolute top-4 right-4 text-aura-muted hover:text-aura-text text-sm transition-colors">
        ✕
      </button>

      {/* Preset selector */}
      <div className="flex gap-2 mb-8">
        {PRESETS.map((p, i) => (
          <button key={i} onClick={() => selectPreset(i)}
            className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${!isRunning ? 'hover:scale-105' : ''}`}
            style={{
              background: i === preset ? `${ringColor}15` : 'rgba(26,23,20,0.6)',
              border: `1px solid ${i === preset ? `${ringColor}30` : 'rgba(42,37,32,0.3)'}`,
              color: i === preset ? ringColor : '#8a7e72',
              opacity: isRunning && i !== preset ? 0.3 : 1
            }}>
            {p.label}
          </button>
        ))}
      </div>

      {/* Circular timer */}
      <div className="relative mb-8">
        <svg width="180" height="180" viewBox="0 0 180 180" className="transform -rotate-90">
          {/* Background ring */}
          <circle cx="90" cy="90" r="70" fill="none"
            stroke="rgba(42,37,32,0.3)" strokeWidth="4" />
          {/* Progress ring */}
          <circle cx="90" cy="90" r="70" fill="none"
            stroke={ringColor} strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - progress / 100)}
            style={{
              transition: 'stroke-dashoffset 1s linear',
              filter: `drop-shadow(0 0 8px ${ringColor}40)`
            }} />
        </svg>

        {/* Time display */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-light text-aura-text font-mono" style={{ letterSpacing: 2 }}>
            {minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}
          </span>
          <span className="text-[10px] text-aura-muted mt-1 uppercase tracking-wider">
            {isBreak ? 'Break' : 'Focus'}
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={reset}
          className="w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-110"
          style={{ background: 'rgba(42,37,32,0.3)', border: '1px solid rgba(42,37,32,0.4)' }}>
          <span className="text-xs text-aura-muted">↺</span>
        </button>

        <button onClick={toggleRunning}
          className="w-16 h-16 rounded-full flex items-center justify-center transition-all hover:scale-110"
          style={{
            background: `linear-gradient(135deg, ${ringColor}, ${isBreak ? '#059669' : '#b45309'})`,
            boxShadow: `0 0 25px ${ringColor}30`
          }}>
          <span className="text-lg text-white ml-0.5">
            {isRunning ? '⏸' : '▶'}
          </span>
        </button>

        <button onClick={onClose}
          className="w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-110"
          style={{ background: 'rgba(42,37,32,0.3)', border: '1px solid rgba(42,37,32,0.4)' }}>
          <span className="text-xs text-aura-muted">✕</span>
        </button>
      </div>

      {/* Session counter */}
      <div className="flex items-center gap-2">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="w-2 h-2 rounded-full transition-all" style={{
            background: i < sessions % 4 ? ringColor : 'rgba(42,37,32,0.4)',
            boxShadow: i < sessions % 4 ? `0 0 6px ${ringColor}40` : 'none'
          }} />
        ))}
        <span className="text-[10px] text-aura-muted ml-1">{sessions} sessions</span>
      </div>

      {/* Body-doubling message */}
      {isRunning && !isBreak && (
        <p className="text-[10px] text-aura-muted mt-6 animate-fade-in text-center">
          🤝 AURA is here with you. Focus. I am waiting.
        </p>
      )}
    </div>
  )
}
