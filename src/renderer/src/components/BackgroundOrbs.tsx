import { useState, useEffect, useRef } from 'react'

// ─── Day/Night Cycle (5 min = 300s) ──────────────────────────────────────────
function useDayNight() {
  const [time, setTime] = useState(0)
  useEffect(() => {
    const CYCLE = 300
    const start = Date.now()
    const tick = () => {
      const elapsed = ((Date.now() - start) / 1000) % CYCLE
      setTime(elapsed / CYCLE)
    }
    const id = setInterval(tick, 200)
    tick()
    return () => clearInterval(id)
  }, [])
  return time
}

// ─── Mouse Parallax Hook ─────────────────────────────────────────────────────
function useParallax() {
  const [pos, setPos] = useState({ x: 0, y: 0 })
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 2
      const y = (e.clientY / window.innerHeight - 0.5) * 2
      setPos({ x, y })
    }
    window.addEventListener('mousemove', handler)
    return () => window.removeEventListener('mousemove', handler)
  }, [])
  return pos
}

// ─── Flying Asteroids with impact chance ─────────────────────────────────────
type FlyingRock = {
  id: number; startX: number; startY: number; endX: number; endY: number;
  size: 'small' | 'medium'; angle: number; duration: number;
  hit: null | 'earth' | 'moon'; phase: 'start' | 'flying' | 'impact'
}

function FlyingAsteroids({ moonPos }: { moonPos: { x: number; y: number } }) {
  const [rocks, setRocks] = useState<FlyingRock[]>([])
  const idRef = useRef(0)
  const moonRef = useRef(moonPos)
  moonRef.current = moonPos

  useEffect(() => {
    const spawn = () => {
      const id = ++idRef.current
      const isSmall = Math.random() > 0.4
      const size = isSmall ? 'small' : 'medium'
      const edge = Math.random()
      const startX = edge < 0.5 ? -5 : 105
      const startY = 5 + Math.random() * 70

      const roll = Math.random()
      let hit: null | 'earth' | 'moon' = null
      let endX: number, endY: number

      if (roll < 0.125) {
        hit = 'earth'; endX = 88; endY = 55
      } else if (roll < 0.25) {
        hit = 'moon'; endX = moonRef.current.x; endY = moonRef.current.y
      } else {
        endX = startX < 50 ? 110 : -10
        endY = 10 + Math.random() * 80
      }

      const duration = 1.2 + Math.random() * 0.8
      const dx = endX - startX, dy = endY - startY
      const angle = Math.atan2(dy, dx) * (180 / Math.PI)

      const rock: FlyingRock = { id, startX, startY, endX, endY, size, angle, duration, hit, phase: 'start' }
      setRocks(prev => [...prev.slice(-3), rock])

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setRocks(prev => prev.map(r => r.id === id ? { ...r, phase: 'flying' } : r))
        })
      })

      setTimeout(() => {
        if (hit) {
          setRocks(prev => prev.map(r => r.id === id ? { ...r, phase: 'impact' } : r))
          setTimeout(() => setRocks(prev => prev.filter(r => r.id !== id)), 900)
        } else {
          setRocks(prev => prev.filter(r => r.id !== id))
        }
      }, duration * 1000 + 50)
    }

    spawn()
    const interval = setInterval(spawn, 10000 + Math.random() * 8000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 15 }}>
      {rocks.map(rock => {
        if (rock.phase === 'impact') {
          return (
            <div key={rock.id} className="absolute" style={{
              left: `${rock.endX}%`, top: `${rock.endY}%`,
              transform: 'translate(-50%, -50%)',
            }}>
              <div className="absolute rounded-full" style={{
                width: 50, height: 50, left: -25, top: -25,
                background: 'radial-gradient(circle, rgba(255,240,150,0.9) 0%, rgba(255,180,60,0.5) 35%, rgba(255,100,20,0.2) 60%, transparent 80%)',
                animation: 'impactFlash 0.8s ease-out forwards',
              }} />
              {Array.from({ length: 8 }).map((_, pi) => (
                <div key={pi} className="absolute" style={{
                  width: 2 + (pi % 2), height: 2 + (pi % 2),
                  background: pi < 3 ? '#f0c060' : pi < 5 ? '#c89050' : '#8a6830',
                  borderRadius: '30%',
                  left: 0, top: 0,
                  animation: `impactDebris 0.8s ease-out ${pi * 0.04}s forwards`,
                  ['--r' as string]: `${pi * 45}deg`,
                  transform: `rotate(${pi * 45}deg) translateX(4px)`,
                }} />
              ))}
              <div className="absolute rounded-full" style={{
                width: 12, height: 12, left: -6, top: -6,
                border: '2px solid rgba(255,220,100,0.6)',
                animation: 'impactRing 0.7s ease-out forwards',
              }} />
              <div className="absolute rounded-full" style={{
                width: 8, height: 8, left: -4, top: -4,
                border: '1px solid rgba(255,180,60,0.4)',
                animation: 'impactRing 0.7s ease-out 0.1s forwards',
              }} />
            </div>
          )
        }

        const isFlying = rock.phase === 'flying'
        const posX = isFlying ? rock.endX : rock.startX
        const posY = isFlying ? rock.endY : rock.startY
        const isSmall = rock.size === 'small'

        return (
          <div key={rock.id} className="absolute" style={{
            left: `${posX}%`, top: `${posY}%`,
            transform: 'translate(-50%, -50%)',
            transition: isFlying ? `left ${rock.duration}s linear, top ${rock.duration}s linear` : 'none',
          }}>
            <div style={{ transform: `rotate(${rock.angle}deg)`, position: 'relative' }}>
              <div className="absolute" style={{
                right: isSmall ? 6 : 12, top: '50%', transform: 'translateY(-50%)',
                width: isSmall ? 40 : 70, height: isSmall ? 10 : 16,
                background: `linear-gradient(to left, rgba(255,200,80,${isSmall ? 0.3 : 0.5}), rgba(255,120,30,0.15) 50%, transparent)`,
                filter: `blur(${isSmall ? 3 : 5}px)`,
                borderRadius: '40%',
              }} />
              <div className="absolute" style={{
                right: isSmall ? 4 : 8, top: '50%', transform: 'translateY(-50%)',
                width: isSmall ? 20 : 35, height: isSmall ? 4 : 7,
                background: 'linear-gradient(to left, rgba(255,250,200,0.7), rgba(255,180,60,0.3) 60%, transparent)',
                filter: `blur(${isSmall ? 1 : 2}px)`,
                borderRadius: '40%',
              }} />
              <div style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${isSmall ? 3 : 5}, ${isSmall ? 3 : 4}px)`,
                gap: 0, imageRendering: 'pixelated' as const,
                filter: `drop-shadow(0 0 ${isSmall ? 4 : 10}px rgba(255,140,40,0.5))`,
                position: 'relative', zIndex: 2,
              }}>
                {(isSmall
                  ? [0,1,0, 1,2,1, 0,1,0]
                  : [0,0,1,0,0, 0,1,2,1,0, 1,2,3,2,1, 0,1,2,1,0, 0,0,1,0,0]
                ).map((v, j) => (
                  <div key={j} style={{
                    width: isSmall ? 3 : 4, height: isSmall ? 3 : 4,
                    background: v === 0 ? 'transparent' : v === 1 ? '#5a4030' : v === 2 ? '#8a6840' : '#b09060',
                  }} />
                ))}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Pixel Space Background ──────────────────────────────────────────────────
export default function BackgroundOrbs() {
  const dayNight = useDayNight()
  const mouse = useParallax()

  const angle = dayNight * Math.PI * 2
  const sunX = 50 + Math.cos(angle - Math.PI / 2) * 38
  const sunY = 50 + Math.sin(angle - Math.PI / 2) * 35
  const moonX = 50 + Math.cos(angle + Math.PI / 2) * 38
  const moonY = 50 + Math.sin(angle + Math.PI / 2) * 35
  const sunUp = sunY < 55
  const brightness = sunUp ? Math.max(0, 1 - (sunY / 55)) : 0
  const nebHue = Math.round(dayNight * 360) % 360

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0, imageRendering: 'pixelated' }}>
      {/* Deep space base */}
      <div className="absolute inset-0" style={{
        background: `radial-gradient(ellipse at 50% 50%, hsl(${nebHue}, 30%, ${4 + brightness * 3}%) 0%, #020108 70%)`,
        transition: 'background 2s ease',
      }} />

      {/* Nebula layer 1: pink-purple (parallax far) */}
      <div className="absolute inset-0 transition-all duration-[4000ms]" style={{
        transform: `translate(${mouse.x * -4}px, ${mouse.y * -4}px)`,
        background: `
          radial-gradient(ellipse at 20% 25%, hsla(${nebHue + 300}, 50%, 18%, 0.12) 0%, transparent 45%),
          radial-gradient(ellipse at 75% 70%, hsla(${nebHue + 260}, 45%, 15%, 0.1) 0%, transparent 40%),
          radial-gradient(ellipse at 85% 20%, hsla(${nebHue + 200}, 40%, 12%, 0.08) 0%, transparent 35%)
        `,
      }} />
      {/* Nebula layer 2: blue-cyan */}
      <div className="absolute inset-0 transition-all duration-[4000ms]" style={{
        transform: `translate(${mouse.x * -6}px, ${mouse.y * -6}px)`,
        background: `
          radial-gradient(ellipse at 60% 30%, hsla(${nebHue + 180}, 50%, 15%, 0.1) 0%, transparent 50%),
          radial-gradient(ellipse at 30% 75%, hsla(${nebHue + 120}, 40%, 12%, 0.08) 0%, transparent 40%),
          radial-gradient(ellipse at 50% 50%, hsla(${nebHue + 60}, 35%, 10%, 0.06) 0%, transparent 55%)
        `,
      }} />

      {/* Stars layer 1: far */}
      <div className="absolute inset-0" style={{ transform: `translate(${mouse.x * -8}px, ${mouse.y * -8}px)` }}>
        {Array.from({ length: 40 }).map((_, i) => (
          <div key={`s1-${i}`} className="absolute" style={{
            width: 1, height: 1, background: '#ffffff',
            left: `${(i * 31 + 7) % 98}%`, top: `${(i * 23 + 13) % 96}%`,
            opacity: (0.15 + (i % 4) * 0.05) - brightness * 0.1,
            animation: `starTwinkle ${3 + (i % 5)}s ease-in-out ${(i % 8) * 0.5}s infinite`,
          }} />
        ))}
      </div>

      {/* Stars layer 2: mid */}
      <div className="absolute inset-0" style={{ transform: `translate(${mouse.x * -4}px, ${mouse.y * -4}px)` }}>
        {Array.from({ length: 30 }).map((_, i) => (
          <div key={`s2-${i}`} className="absolute" style={{
            width: 2, height: 2,
            background: i % 3 === 0 ? '#c8d8ff' : '#ffffff',
            left: `${(i * 43 + 17) % 97}%`, top: `${(i * 29 + 8) % 95}%`,
            opacity: (0.3 + (i % 5) * 0.08) - brightness * 0.2,
            animation: `starTwinkle ${2 + (i % 6)}s ease-in-out ${(i % 7) * 0.4}s infinite`,
          }} />
        ))}
      </div>

      {/* Stars layer 3: near bright */}
      <div className="absolute inset-0" style={{ transform: `translate(${mouse.x * -2}px, ${mouse.y * -2}px)` }}>
        {Array.from({ length: 15 }).map((_, i) => (
          <div key={`s3-${i}`} className="absolute" style={{
            width: 3, height: 3,
            background: i % 2 === 0 ? '#ffe8c0' : '#c8d8ff',
            left: `${(i * 59 + 11) % 96}%`, top: `${(i * 37 + 5) % 94}%`,
            opacity: (0.5 + (i % 3) * 0.1) - brightness * 0.3,
            animation: `starTwinkle ${2 + (i % 4)}s ease-in-out ${(i % 6) * 0.3}s infinite`,
            boxShadow: '0 0 3px rgba(255,255,255,0.2)',
          }} />
        ))}
      </div>

      {/* Distant faint planet silhouettes */}
      <div className="absolute" style={{
        right: '6%', top: '8%', width: 20, height: 20, borderRadius: '50%',
        background: 'radial-gradient(circle at 40% 40%, rgba(80,60,100,0.12), rgba(40,30,50,0.06))',
        boxShadow: '0 0 15px rgba(80,60,100,0.05)',
        animation: 'planetFloat 25s ease-in-out infinite',
        transform: `translate(${mouse.x * -3}px, ${mouse.y * -3}px)`,
      }} />
      <div className="absolute" style={{
        left: '4%', bottom: '15%', width: 14, height: 14, borderRadius: '50%',
        background: 'radial-gradient(circle at 45% 40%, rgba(60,80,120,0.1), rgba(30,40,60,0.05))',
        boxShadow: '0 0 10px rgba(60,80,120,0.04)',
        animation: 'planetFloat 30s ease-in-out 5s infinite',
        transform: `translate(${mouse.x * -5}px, ${mouse.y * -5}px)`,
      }} />

      {/* Sun — pixel+realistic hybrid */}
      <div className="absolute transition-all duration-500" style={{
        left: `${sunX}%`, top: `${sunY}%`,
        transform: `translate(-50%, -50%) translate(${mouse.x * -1}px, ${mouse.y * -1}px)`,
        opacity: sunY > 85 ? 0 : 1,
        animation: 'sunPulse 5s ease-in-out infinite',
      }}>
        <div className="absolute rounded-full" style={{
          width: 90, height: 90, left: -15, top: -15,
          background: 'radial-gradient(circle, rgba(255,220,60,0.25) 0%, rgba(255,180,30,0.08) 50%, transparent 70%)',
          filter: `blur(${8 + brightness * 6}px)`,
        }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 5px)', gap: 0, imageRendering: 'pixelated' as const,
          filter: `drop-shadow(0 0 ${15 + brightness * 20}px rgba(255,200,40,${0.5 + brightness * 0.4})) drop-shadow(0 0 ${30 + brightness * 30}px rgba(255,160,20,${0.2 + brightness * 0.2}))`,
        }}>
          {[
            0,0,0,0,1,1,1,1,0,0,0,0,
            0,0,0,1,2,3,3,2,1,0,0,0,
            0,0,1,2,3,4,4,3,2,1,0,0,
            0,1,2,3,4,5,5,4,3,2,1,0,
            1,2,3,4,5,5,5,5,4,3,2,1,
            1,3,4,5,5,5,5,5,5,4,3,1,
            1,3,4,5,5,5,5,5,5,4,3,1,
            1,2,3,4,5,5,5,5,4,3,2,1,
            0,1,2,3,4,5,5,4,3,2,1,0,
            0,0,1,2,3,4,4,3,2,1,0,0,
            0,0,0,1,2,3,3,2,1,0,0,0,
            0,0,0,0,1,1,1,1,0,0,0,0,
          ].map((v, i) => (
            <div key={i} style={{ width: 5, height: 5,
              background: v === 0 ? 'transparent' : v === 1 ? '#c07800' : v === 2 ? '#e0a020' : v === 3 ? '#f0c830' : v === 4 ? '#ffe050' : '#fffbe8',
            }} />
          ))}
        </div>
      </div>

      {/* Moon — pixel+realistic */}
      <div className="absolute transition-all duration-500" style={{
        left: `${moonX}%`, top: `${moonY}%`,
        transform: `translate(-50%, -50%) translate(${mouse.x * -1}px, ${mouse.y * -1}px)`,
        opacity: moonY > 85 ? 0 : 1,
      }}>
        <div className="absolute rounded-full" style={{
          width: 60, height: 60, left: -8, top: -8,
          background: 'radial-gradient(circle, rgba(220,215,190,0.12) 0%, transparent 60%)',
          filter: 'blur(6px)',
        }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(11, 4px)', gap: 0, imageRendering: 'pixelated' as const,
          filter: 'drop-shadow(0 0 10px rgba(220,215,190,0.3)) drop-shadow(0 0 20px rgba(200,195,170,0.12))',
        }}>
          {[
            0,0,0,0,2,3,3,2,0,0,0,
            0,0,0,2,3,4,4,3,2,0,0,
            0,0,2,3,4,4,3,1,3,2,0,
            0,2,3,4,4,3,1,2,4,3,0,
            2,3,4,4,3,2,2,3,4,3,2,
            3,4,4,3,1,2,3,4,4,2,3,
            3,4,4,3,2,3,4,4,3,2,3,
            2,3,4,4,3,1,3,3,2,2,0,
            0,2,3,4,4,3,2,1,2,0,0,
            0,0,2,3,3,4,3,2,0,0,0,
            0,0,0,0,2,3,3,2,0,0,0,
          ].map((v, i) => (
            <div key={i} style={{ width: 4, height: 4,
              background: v === 0 ? 'transparent' : v === 1 ? '#908870' : v === 2 ? '#b8b098' : v === 3 ? '#d8d0b8' : '#f0ead8',
            }} />
          ))}
        </div>
      </div>

      {/* Saturn — pixel+realistic, with ring */}
      <div className="absolute" style={{
        left: '78%', top: '22%', imageRendering: 'pixelated',
        animation: 'planetFloat 20s ease-in-out infinite',
        transform: `translate(${mouse.x * -2}px, ${mouse.y * -2}px)`,
      }}>
        <div className="absolute rounded-full" style={{
          width: 50, height: 50, left: -7, top: -7,
          background: 'radial-gradient(circle, rgba(200,160,100,0.1) 0%, transparent 60%)',
          filter: 'blur(5px)',
        }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(13, 3px)', gap: 0,
          filter: 'drop-shadow(0 0 8px rgba(200,160,100,0.25))',
        }}>
          {[
            0,0,0,0,0,2,3,2,0,0,0,0,0,
            0,0,0,2,3,4,5,4,3,2,0,0,0,
            0,0,2,3,4,5,5,5,4,3,2,0,0,
            0,2,3,4,5,4,3,4,5,4,3,2,0,
            1,1,3,4,3,2,2,2,3,4,3,1,1,
            1,1,1,3,4,3,3,3,4,3,1,1,1,
            0,2,3,4,5,4,3,4,5,4,3,2,0,
            0,0,2,3,4,5,5,5,4,3,2,0,0,
            0,0,0,2,3,4,5,4,3,2,0,0,0,
            0,0,0,0,0,2,3,2,0,0,0,0,0,
          ].map((v, i) => (
            <div key={i} style={{ width: 3, height: 3,
              background: v === 0 ? 'transparent' : v === 1 ? '#a0885080' : v === 2 ? '#8a6830' : v === 3 ? '#c8a060' : v === 4 ? '#d4b878' : '#e8d8a8',
            }} />
          ))}
        </div>
      </div>

      {/* Mars — pixel+realistic */}
      <div className="absolute" style={{
        left: '15%', top: '65%', imageRendering: 'pixelated',
        animation: 'planetFloat 15s ease-in-out 3s infinite',
        transform: `translate(${mouse.x * -3}px, ${mouse.y * -3}px)`,
      }}>
        <div className="absolute rounded-full" style={{
          width: 40, height: 40, left: -5, top: -5,
          background: 'radial-gradient(circle, rgba(180,60,40,0.1) 0%, transparent 60%)',
          filter: 'blur(4px)',
        }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(9, 3px)', gap: 0,
          filter: 'drop-shadow(0 0 6px rgba(180,70,40,0.25))',
        }}>
          {[
            0,0,0,2,5,5,2,0,0,
            0,0,2,3,4,4,3,2,0,
            0,2,3,4,3,2,4,3,0,
            2,3,4,3,2,3,4,3,2,
            2,3,3,2,3,4,3,2,2,
            2,3,4,3,2,3,3,2,2,
            0,2,3,4,3,2,3,1,0,
            0,0,2,3,3,3,2,0,0,
            0,0,0,1,2,2,0,0,0,
          ].map((v, i) => (
            <div key={i} style={{ width: 3, height: 3,
              background: v === 0 ? 'transparent' : v === 1 ? '#6a2818' : v === 2 ? '#a04030' : v === 3 ? '#c06048' : v === 4 ? '#d88060' : '#e8d0c0',
            }} />
          ))}
        </div>
      </div>

      {/* Earth — pixel+realistic */}
      <div className="absolute" style={{
        left: '88%', top: '55%', imageRendering: 'pixelated',
        animation: 'planetFloat 18s ease-in-out 6s infinite',
        transform: `translate(${mouse.x * -2}px, ${mouse.y * -2}px)`,
      }}>
        <div className="absolute rounded-full" style={{
          width: 40, height: 40, left: -5, top: -5,
          background: 'radial-gradient(circle, rgba(60,120,200,0.1) 0%, transparent 60%)',
          filter: 'blur(4px)',
        }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 3px)', gap: 0,
          filter: 'drop-shadow(0 0 6px rgba(60,140,220,0.25))',
        }}>
          {[
            0,0,0,1,2,2,1,0,0,0,
            0,0,1,2,3,4,2,1,0,0,
            0,1,2,3,4,3,5,2,1,0,
            1,2,3,4,5,3,2,3,2,1,
            1,2,5,3,2,2,3,4,2,1,
            1,2,3,2,3,4,5,3,2,1,
            0,1,2,3,4,3,2,2,1,0,
            0,0,1,2,2,5,3,1,0,0,
            0,0,0,1,2,2,1,0,0,0,
          ].map((v, i) => (
            <div key={i} style={{ width: 3, height: 3,
              background: v === 0 ? 'transparent' : v === 1 ? '#1a3870' : v === 2 ? '#2860a8' : v === 3 ? '#40a060' : v === 4 ? '#60c048' : '#e8e8f0',
            }} />
          ))}
        </div>
      </div>

      {/* Pixel Asteroids (slow drifting) */}
      {[
        { x: 25, y: 80, speed: 45, sz: 3, color: '#807060' },
        { x: 72, y: 42, speed: 55, sz: 4, color: '#706050' },
        { x: 50, y: 90, speed: 38, sz: 3, color: '#908070' },
      ].map((a, i) => (
        <div key={`ast-${i}`} className="absolute" style={{
          left: `${a.x}%`, top: `${a.y}%`,
          width: a.sz, height: a.sz, background: a.color, borderRadius: '30%',
          opacity: 0.5,
          animation: `asteroidDrift ${a.speed}s linear infinite`,
          boxShadow: `${a.sz}px 0 0 ${a.color}80, 0 ${a.sz}px 0 ${a.color}60, 0 0 4px ${a.color}40`,
          filter: `drop-shadow(0 0 3px ${a.color}30)`,
        }} />
      ))}

      {/* Asteroid debris — small & medium chunks */}
      {[
        { x: 10, y: 18, spd: 60, grid: [0,1,0, 1,2,1, 0,1,0], cols: 3, px: 2, rot: 15 },
        { x: 82, y: 72, spd: 50, grid: [1,1, 2,1], cols: 2, px: 2, rot: -20 },
        { x: 92, y: 38, spd: 55, grid: [1,2,0, 0,1,1], cols: 3, px: 2, rot: -10 },
        { x: 55, y: 25, spd: 40, grid: [0,1,1,0, 1,2,3,1, 1,3,2,1, 0,1,1,0], cols: 4, px: 3, rot: 12 },
        { x: 78, y: 60, spd: 52, grid: [0,1,0, 1,3,1, 2,3,2, 1,2,1, 0,1,0], cols: 3, px: 3, rot: 40 },
        { x: 38, y: 50, spd: 42, grid: [1,1,0, 2,3,1, 1,2,1], cols: 3, px: 3, rot: -50 },
      ].map((chunk, i) => (
        <div key={`debris-${i}`} className="absolute" style={{
          left: `${chunk.x}%`, top: `${chunk.y}%`,
          imageRendering: 'pixelated',
          animation: `debrisFloat ${chunk.spd}s ease-in-out infinite, debrisSpin ${chunk.spd * 1.5}s linear infinite`,
          opacity: chunk.px === 2 ? 0.35 : 0.5,
          filter: `drop-shadow(0 0 ${chunk.px}px rgba(160,140,120,0.2))`,
          transform: `rotate(${chunk.rot}deg) translate(${mouse.x * -(1 + i % 3)}px, ${mouse.y * -(1 + i % 3)}px)`,
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${chunk.cols}, ${chunk.px}px)`, gap: 0 }}>
            {chunk.grid.map((v, j) => (
              <div key={j} style={{ width: chunk.px, height: chunk.px,
                background: v === 0 ? 'transparent' : v === 1 ? '#5a4a38' : v === 2 ? '#7a6850' : '#a08868',
              }} />
            ))}
          </div>
        </div>
      ))}

      {/* Big Meteorites (fast, realistic, every ~15s) */}
      {[
        { x: -5, y: 5, delay: 0, dur: 15, angle: 25 },
        { x: 20, y: -5, delay: 5, dur: 15, angle: 32 },
        { x: -8, y: 30, delay: 10, dur: 15, angle: 20 },
      ].map((m, i) => (
        <div key={`bigmeteor-${i}`} className="absolute" style={{
          left: `${m.x}%`, top: `${m.y}%`,
          animation: `bigMeteor ${m.dur}s ease-in ${m.delay}s infinite`,
          opacity: 0,
        }}>
          <div style={{ transform: `rotate(${m.angle}deg)`, position: 'relative' }}>
            <div className="absolute" style={{
              left: -80, top: '50%', transform: 'translateY(-50%)',
              width: 200, height: 50,
              background: 'linear-gradient(to left, rgba(255,200,80,0.25), rgba(255,140,40,0.08) 40%, transparent)',
              filter: 'blur(18px)',
              borderRadius: '50%',
            }} />
            <div className="absolute" style={{
              left: -50, top: '50%', transform: 'translateY(-50%)',
              width: 140, height: 28,
              background: 'linear-gradient(to left, rgba(255,220,100,0.8), rgba(255,160,40,0.6) 20%, rgba(255,80,20,0.3) 50%, rgba(200,40,10,0.1) 75%, transparent)',
              filter: 'blur(5px)',
              borderRadius: '40%',
            }} />
            <div className="absolute" style={{
              left: -20, top: '50%', transform: 'translateY(-50%)',
              width: 60, height: 12,
              background: 'linear-gradient(to left, rgba(255,255,240,0.9), rgba(255,220,120,0.6) 40%, rgba(255,160,60,0.2) 80%, transparent)',
              filter: 'blur(3px)',
              borderRadius: '40%',
            }} />
            {Array.from({ length: 8 }).map((_, si) => (
              <div key={si} className="absolute rounded-full" style={{
                width: 3 - (si % 2), height: 3 - (si % 2),
                left: -10 - si * 12, top: `calc(50% + ${(si % 3 - 1) * 8}px)`,
                background: si < 3 ? 'rgba(255,240,180,0.8)' : si < 5 ? 'rgba(255,180,60,0.5)' : 'rgba(255,120,30,0.3)',
                filter: `blur(${si < 3 ? 1 : 2}px)`,
                animation: `sparkFlicker ${0.2 + si * 0.1}s ease-in-out infinite alternate`,
              }} />
            ))}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 5px)', gap: 0, imageRendering: 'pixelated' as const,
              filter: 'drop-shadow(0 0 15px rgba(255,140,40,0.7)) drop-shadow(0 0 30px rgba(255,80,20,0.4)) drop-shadow(0 0 50px rgba(255,60,10,0.2))',
              position: 'relative', zIndex: 2,
            }}>
              {[
                0,0,0,0,1,2,1,0,0,0,
                0,0,0,1,3,4,3,1,0,0,
                0,0,1,3,5,6,5,3,1,0,
                0,1,3,5,6,6,5,4,2,0,
                1,2,4,6,6,6,6,5,3,1,
                1,3,5,6,6,5,4,4,2,1,
                0,1,3,5,5,4,3,2,1,0,
                0,0,1,3,4,3,2,1,0,0,
                0,0,0,1,2,2,1,0,0,0,
                0,0,0,0,1,1,0,0,0,0,
              ].map((v, j) => (
                <div key={j} style={{ width: 5, height: 5,
                  background: v === 0 ? 'transparent' : v === 1 ? '#3a2015' : v === 2 ? '#5a3520' : v === 3 ? '#8a5530' : v === 4 ? '#b07840' : v === 5 ? '#d0a060' : '#f0d8a0',
                }} />
              ))}
            </div>
          </div>
        </div>
      ))}

      {/* Star dust haze */}
      <div className="absolute inset-0" style={{
        background: 'radial-gradient(circle at 50% 50%, rgba(255,245,220,0.02) 0%, transparent 40%)',
        animation: 'dustBreathe 8s ease-in-out infinite',
      }} />

      {/* Cosmic dust particles */}
      <div className="absolute inset-0" style={{ transform: `translate(${mouse.x * -3}px, ${mouse.y * -3}px)` }}>
        {Array.from({ length: 25 }).map((_, i) => (
          <div key={`cdust-${i}`} className="absolute rounded-full" style={{
            width: 1 + (i % 3), height: 1 + (i % 3),
            background: i % 4 === 0 ? 'rgba(200,180,255,0.3)' : i % 4 === 1 ? 'rgba(255,200,220,0.25)' : 'rgba(255,245,220,0.2)',
            left: `${(i * 41 + 5) % 95}%`, top: `${(i * 29 + 8) % 92}%`,
            animation: `cosmicDust ${15 + (i % 8) * 3}s ease-in-out ${(i % 6) * 2}s infinite`,
            boxShadow: i % 3 === 0 ? '0 0 4px rgba(200,180,255,0.15)' : 'none',
          }} />
        ))}
      </div>

      {/* Aurora Borealis (full spectrum) */}
      <div className="absolute inset-0 pointer-events-none" style={{
        animation: 'auroraPulse 10s ease-in-out infinite',
      }}>
        {/* Layer 1: vivid green */}
        <div className="absolute" style={{
          left: '0%', right: '0%', top: '0%', height: '75%',
          background: `
            radial-gradient(ellipse at 30% 35%, rgba(40,240,100,0.14) 0%, transparent 45%),
            radial-gradient(ellipse at 60% 50%, rgba(60,220,80,0.1) 0%, transparent 50%),
            radial-gradient(ellipse at 85% 30%, rgba(80,255,120,0.08) 0%, transparent 40%)
          `,
          filter: 'blur(35px)',
          animation: 'auroraShift 16s ease-in-out infinite',
        }} />
        {/* Layer 2: violet + magenta */}
        <div className="absolute" style={{
          left: '0%', right: '0%', top: '5%', height: '65%',
          background: `
            radial-gradient(ellipse at 70% 40%, rgba(160,60,220,0.16) 0%, transparent 50%),
            radial-gradient(ellipse at 25% 30%, rgba(200,50,180,0.12) 0%, transparent 45%),
            radial-gradient(ellipse at 50% 60%, rgba(140,40,200,0.08) 0%, transparent 50%)
          `,
          filter: 'blur(38px)',
          animation: 'auroraShift 20s ease-in-out 2s infinite reverse',
        }} />
        {/* Layer 3: electric blue + cyan */}
        <div className="absolute" style={{
          left: '5%', right: '5%', top: '8%', height: '55%',
          background: `
            radial-gradient(ellipse at 45% 35%, rgba(30,100,255,0.12) 0%, transparent 45%),
            radial-gradient(ellipse at 75% 55%, rgba(40,200,240,0.1) 0%, transparent 40%),
            radial-gradient(ellipse at 15% 50%, rgba(60,140,255,0.08) 0%, transparent 35%)
          `,
          filter: 'blur(40px)',
          animation: 'auroraShift 24s ease-in-out 5s infinite',
        }} />
        {/* Layer 4: hot pink + rose */}
        <div className="absolute" style={{
          left: '10%', right: '10%', top: '3%', height: '60%',
          background: `
            radial-gradient(ellipse at 55% 40%, rgba(255,60,140,0.12) 0%, transparent 40%),
            radial-gradient(ellipse at 20% 55%, rgba(255,100,180,0.08) 0%, transparent 45%),
            radial-gradient(ellipse at 80% 35%, rgba(240,80,160,0.06) 0%, transparent 35%)
          `,
          filter: 'blur(42px)',
          animation: 'auroraShift 18s ease-in-out 8s infinite reverse',
        }} />
        {/* Layer 5: deep red + crimson */}
        <div className="absolute" style={{
          left: '5%', right: '5%', top: '10%', height: '50%',
          background: `
            radial-gradient(ellipse at 40% 45%, rgba(220,30,60,0.08) 0%, transparent 40%),
            radial-gradient(ellipse at 70% 30%, rgba(200,40,80,0.06) 0%, transparent 35%),
            radial-gradient(ellipse at 20% 60%, rgba(180,20,50,0.05) 0%, transparent 30%)
          `,
          filter: 'blur(45px)',
          animation: 'auroraShift 22s ease-in-out 12s infinite',
        }} />
        {/* Layer 6: deep indigo */}
        <div className="absolute" style={{
          left: '0%', right: '0%', top: '12%', height: '65%',
          background: `
            radial-gradient(ellipse at 50% 45%, rgba(60,30,200,0.07) 0%, transparent 45%),
            radial-gradient(ellipse at 30% 55%, rgba(80,50,240,0.05) 0%, transparent 40%)
          `,
          filter: 'blur(40px)',
          animation: 'auroraShift 26s ease-in-out 15s infinite reverse',
        }} />
        {/* Layer 7: bright green-yellow transition */}
        <div className="absolute" style={{
          left: '10%', right: '10%', top: '0%', height: '45%',
          background: `
            radial-gradient(ellipse at 50% 30%, rgba(120,255,80,0.06) 0%, transparent 35%),
            radial-gradient(ellipse at 35% 45%, rgba(180,255,100,0.04) 0%, transparent 30%)
          `,
          filter: 'blur(50px)',
          animation: 'auroraShift 30s ease-in-out 3s infinite',
        }} />
      </div>

      {/* Flying asteroids with impact */}
      <FlyingAsteroids moonPos={{ x: moonX, y: moonY }} />
    </div>
  )
}
