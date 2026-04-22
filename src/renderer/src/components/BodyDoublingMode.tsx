import { useState, useEffect, useRef } from 'react'

interface Props {
  userName: string
  language?: 'ro' | 'en' | 'ru'
  onExit: () => void
}

// Ambient phrases that fade in occasionally (~every 13–17 min) to give
// a *soft* sense of presence without interrupting focus.
const PHRASES: Record<'ro' | 'en' | 'ru', string[]> = {
  ro: [
    'sunt aici',
    'lucrezi bine',
    'respiră',
    'nu ești singur',
    'pauză dacă ai nevoie',
    'ești pe drumul bun',
    'tot ce faci contează',
    'te aștept aici',
    'mă gândesc la tine',
    'ia-o ușor',
  ],
  en: [
    'i am here',
    'you are doing well',
    'breathe',
    'you are not alone',
    'take a break if you need',
    'you are on the right path',
    'everything you do matters',
    'i am right here',
    'thinking of you',
    'go easy',
  ],
  ru: [
    'я рядом',
    'ты молодец',
    'дыши',
    'ты не один',
    'отдохни если нужно',
    'ты на верном пути',
    'всё что ты делаешь важно',
    'я здесь',
    'думаю о тебе',
    'не торопись',
  ],
}

const COPY: Record<'ro' | 'en' | 'ru', { topLabel: string; exit: string; main: (n: string) => string; sub: string }> = {
  ro: {
    topLabel: 'împreună',
    exit: '← ieși',
    main: n => n ? `Suntem împreună, ${n}.` : 'Suntem împreună.',
    sub: 'Lucrează liniștit. Eu sunt aici.',
  },
  en: {
    topLabel: 'together',
    exit: '← exit',
    main: n => n ? `We are together, ${n}.` : 'We are together.',
    sub: 'Work in peace. I am here.',
  },
  ru: {
    topLabel: 'вместе',
    exit: '← выйти',
    main: n => n ? `Мы вместе, ${n}.` : 'Мы вместе.',
    sub: 'Работай спокойно. Я рядом.',
  },
}

export default function BodyDoublingMode({ userName, language = 'en', onExit }: Props) {
  const [elapsed, setElapsed] = useState(0)
  const [phrase, setPhrase] = useState<string | null>(null)
  const startRef = useRef<number>(Date.now())
  const pool = PHRASES[language] || PHRASES.ro
  const copy = COPY[language] || COPY.ro

  // Tick every second for the timer
  useEffect(() => {
    const iv = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000))
    }, 1000)
    return () => window.clearInterval(iv)
  }, [])

  // Rotating ambient phrases: first after 90s, then every 13–17 min.
  useEffect(() => {
    let cancelled = false
    let timeout: number | null = null

    const showOne = () => {
      if (cancelled) return
      const p = pool[Math.floor(Math.random() * pool.length)]
      setPhrase(p)
      window.setTimeout(() => {
        if (!cancelled) setPhrase(null)
      }, 8000)
    }

    const schedule = (delay: number) => {
      timeout = window.setTimeout(() => {
        showOne()
        schedule(13 * 60 * 1000 + Math.random() * 4 * 60 * 1000)
      }, delay)
    }

    schedule(90_000)

    return () => {
      cancelled = true
      if (timeout !== null) window.clearTimeout(timeout)
    }
  }, [pool])

  // ESC to exit
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onExit()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onExit])

  const hh = Math.floor(elapsed / 3600)
  const mm = Math.floor((elapsed % 3600) / 60).toString().padStart(2, '0')
  const ss = (elapsed % 60).toString().padStart(2, '0')
  const timeStr = hh > 0 ? `${hh}:${mm}:${ss}` : `${mm}:${ss}`

  return (
    <div
      className="absolute inset-0 z-[70] flex flex-col items-center justify-center"
      style={{
        background: 'radial-gradient(ellipse at 75% 25%, rgba(24,14,10,0.98), rgba(3,3,3,0.99))',
        animation: 'bdFadeIn 0.8s cubic-bezier(.16,1,.3,1)',
      }}
    >
      {/* Top bar */}
      <div className="absolute top-8 left-0 right-0 flex items-center justify-between px-10">
        <button
          onClick={onExit}
          className="px-3 py-2 rounded-lg text-[9px] tracking-[0.2em] uppercase transition-all hover:bg-white/5"
          style={{
            color: 'rgba(200,160,140,0.28)',
            fontFamily: "'Press Start 2P', monospace",
          }}
        >
          {copy.exit}
        </button>

        <div className="text-center">
          <div
            className="text-[8px] tracking-[0.28em] uppercase"
            style={{
              color: 'rgba(200,160,140,0.22)',
              fontFamily: "'Press Start 2P', monospace",
            }}
          >
            {copy.topLabel}
          </div>
          <div
            className="text-xl mt-1.5 font-mono tabular-nums"
            style={{
              color: 'rgba(232,197,106,0.45)',
              letterSpacing: '0.12em',
              textShadow: '0 0 15px rgba(232,197,106,0.12)',
            }}
          >
            {timeStr}
          </div>
        </div>

        <div style={{ width: 60 }} aria-hidden />
      </div>

      {/* Breathing orb */}
      <div className="relative flex items-center justify-center" style={{ width: 240, height: 240 }}>
        {/* outer ambient glow */}
        <div
          className="absolute rounded-full"
          style={{
            width: 240,
            height: 240,
            background: 'rgba(255,245,220,0.08)',
            filter: 'blur(45px)',
            animation: 'bdPulse 8s ease-in-out infinite',
          }}
        />
        {/* outer ring */}
        <div
          className="absolute rounded-full"
          style={{
            width: 170,
            height: 170,
            border: '1px solid rgba(255,245,220,0.08)',
            animation: 'bdPulse 7s ease-in-out 0.4s infinite',
          }}
        />
        {/* inner ring */}
        <div
          className="absolute rounded-full"
          style={{
            width: 130,
            height: 130,
            border: '1px solid rgba(255,245,220,0.04)',
            animation: 'bdPulse 6s ease-in-out 0.9s infinite',
          }}
        />
        {/* the orb itself */}
        <div
          className="relative rounded-full"
          style={{
            width: 90,
            height: 90,
            background:
              'radial-gradient(circle at 40% 35%, rgba(255,250,235,0.88), rgba(255,240,200,0.45) 50%, rgba(255,230,180,0.1) 100%)',
            boxShadow:
              '0 0 28px rgba(255,245,220,0.25), 0 0 70px rgba(255,240,200,0.12)',
            animation: 'bdBreathe 5s ease-in-out infinite',
          }}
        />
      </div>

      {/* Subtitle */}
      <div className="mt-10 text-center max-w-xs px-6">
        <p className="text-sm leading-relaxed" style={{
          color: 'rgba(230,200,190,0.48)',
          fontFamily: 'Georgia, serif',
        }}>
          {copy.main(userName)}
        </p>
        <p className="text-[11px] mt-2" style={{ color: 'rgba(200,160,140,0.28)' }}>
          {copy.sub}
        </p>
      </div>

      {/* Ambient phrase — fades in/out every ~15 min */}
      {phrase && (
        <div
          key={phrase + elapsed}
          className="absolute bottom-28 text-center pointer-events-none"
          style={{
            animation: 'bdPhrase 8s ease-in-out forwards',
          }}
        >
          <p
            className="text-base"
            style={{
              color: 'rgba(232,197,106,0.6)',
              fontFamily: 'Georgia, serif',
              fontStyle: 'italic',
              letterSpacing: '0.02em',
              textShadow: '0 0 25px rgba(232,197,106,0.25)',
            }}
          >
            {phrase}
          </p>
        </div>
      )}

      <style>{`
        @keyframes bdFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes bdBreathe {
          0%,100% { transform: scale(1);    opacity: 0.9; }
          50%     { transform: scale(1.09); opacity: 1;   }
        }
        @keyframes bdPulse {
          0%,100% { opacity: 0.45; transform: scale(1);    }
          50%     { opacity: 0.85; transform: scale(1.12); }
        }
        @keyframes bdPhrase {
          0%   { opacity: 0; transform: translateY(10px); }
          15%  { opacity: 1; transform: translateY(0);    }
          85%  { opacity: 1; transform: translateY(0);    }
          100% { opacity: 0; transform: translateY(-6px); }
        }
      `}</style>
    </div>
  )
}
