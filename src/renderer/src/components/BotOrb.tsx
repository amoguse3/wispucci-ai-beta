import { useState, useEffect } from 'react'

// ─── Types ──────────────────────────────────────────────────────────────────
type BotMood = 'neutral' | 'happy' | 'thinking' | 'sad' | 'excited' | 'calm'
  | 'sleeping' | 'waking' | 'dancing' | 'laughing' | 'curious'
  | 'proud' | 'worried' | 'loving' | 'focused' | 'playful'
  | 'grateful' | 'energized' | 'nostalgic' | 'inspired'

export type { BotMood }

const MOOD_CONFIG: Record<BotMood, { orb: string; glow: string; anim: string; speed: string; particles?: string }> = {
  neutral:   { orb: '#8b3a3a', glow: 'rgba(139,58,58,0.3)',   anim: 'orbBreathe',   speed: '4s' },
  happy:     { orb: '#d97706', glow: 'rgba(217,119,6,0.35)',  anim: 'orbBounce',    speed: '1.5s' },
  thinking:  { orb: '#7c5cbf', glow: 'rgba(124,92,191,0.3)',  anim: 'orbSpin',      speed: '3s' },
  sad:       { orb: '#4a6fa5', glow: 'rgba(74,111,165,0.3)',  anim: 'orbDroop',     speed: '5s' },
  excited:   { orb: '#e04080', glow: 'rgba(224,64,128,0.35)', anim: 'orbVibrate',   speed: '0.3s', particles: '✨' },
  calm:      { orb: '#10b981', glow: 'rgba(16,185,129,0.3)',  anim: 'orbFloat',     speed: '6s' },
  sleeping:  { orb: '#3a3a6b', glow: 'rgba(58,58,107,0.2)',   anim: 'orbSleep',     speed: '6s', particles: '💤' },
  waking:    { orb: '#c97a30', glow: 'rgba(201,122,48,0.35)', anim: 'orbWake',      speed: '2s' },
  dancing:   { orb: '#c040a0', glow: 'rgba(192,64,160,0.35)', anim: 'orbDance',     speed: '3s', particles: '♪' },
  laughing:  { orb: '#e0a020', glow: 'rgba(224,160,32,0.35)', anim: 'orbLaugh',     speed: '0.5s' },
  curious:   { orb: '#20a0b0', glow: 'rgba(32,160,176,0.3)',  anim: 'orbTilt',      speed: '3s' },
  proud:     { orb: '#d4a020', glow: 'rgba(212,160,32,0.35)', anim: 'orbGrow',      speed: '2s', particles: '⭐' },
  worried:   { orb: '#a06040', glow: 'rgba(160,96,64,0.3)',   anim: 'orbShiver',    speed: '2s' },
  loving:    { orb: '#d04060', glow: 'rgba(208,64,96,0.35)',  anim: 'orbHeartbeat', speed: '1.2s', particles: '♡' },
  focused:   { orb: '#5060c0', glow: 'rgba(80,96,192,0.3)',   anim: 'orbLaser',     speed: '2s' },
  playful:   { orb: '#c060c0', glow: 'rgba(192,96,192,0.3)',  anim: 'orbWobble',    speed: '1.5s', particles: '🎮' },
  grateful:  { orb: '#60a050', glow: 'rgba(96,160,80,0.3)',   anim: 'orbGlow',      speed: '3s', particles: '🌿' },
  energized: { orb: '#e04030', glow: 'rgba(224,64,48,0.35)',  anim: 'orbElectric',  speed: '0.4s', particles: '⚡' },
  nostalgic: { orb: '#a08060', glow: 'rgba(160,128,96,0.25)', anim: 'orbFade',      speed: '5s' },
  inspired:  { orb: '#b050d0', glow: 'rgba(176,80,208,0.35)', anim: 'orbRise',      speed: '2.5s', particles: '💡' },
}

export { MOOD_CONFIG }

// ─── Floating Particles ──────────────────────────────────────────────────────
function Particles({ symbol, color, count = 5 }: { symbol: string; color: string; count?: number }) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="absolute text-sm" style={{
          left: `${15 + Math.random() * 70}%`,
          top: `${5 + Math.random() * 70}%`,
          animation: `particleFloat ${3 + Math.random() * 4}s ease-in-out ${Math.random() * 2}s infinite`,
          opacity: 0.3 + Math.random() * 0.3,
          filter: `drop-shadow(0 0 4px ${color}60)`,
        }}>{symbol}</div>
      ))}
    </div>
  )
}

// ─── Music visualizer bars ──────────────────────────────────────────────────
function MusicBars({ color }: { color: string }) {
  return (
    <div className="absolute flex items-end gap-[3px] z-20" style={{ bottom: -35 }}>
      {Array.from({ length: 9 }).map((_, i) => (
        <div key={i} className="w-[3px] rounded-full" style={{
          background: `${color}60`,
          animation: `musicBar ${1.2 + i * 0.15}s ease-in-out ${i * 0.12}s infinite alternate`,
          height: 4,
          boxShadow: `0 0 6px ${color}25`,
        }} />
      ))}
    </div>
  )
}

// ─── SVG Face ────────────────────────────────────────────────────────────────
function BotFace({ mood, speaking, color }: { mood: BotMood; speaking: boolean; color: string }) {
  const eyeConfigs: Record<string, { left: string; right: string; extra?: string }> = {
    neutral:  { left: 'M32,38 a4,4 0 1,1 8,0 a4,4 0 1,1 -8,0', right: 'M60,38 a4,4 0 1,1 8,0 a4,4 0 1,1 -8,0' },
    happy:    { left: 'M32,38 Q36,33 40,38', right: 'M60,38 Q64,33 68,38' },
    thinking: { left: 'M32,38 a4,4 0 1,1 8,0 a4,4 0 1,1 -8,0', right: 'M60,38 a4,4 0 1,1 8,0 a4,4 0 1,1 -8,0', extra: 'M72,30 L78,24' },
    sad:      { left: 'M33,40 Q36,36 40,40', right: 'M60,40 Q64,36 68,40' },
    excited:  { left: 'M32,38 a4,4 0 1,1 8,0 a4,4 0 1,1 -8,0', right: 'M60,38 a4,4 0 1,1 8,0 a4,4 0 1,1 -8,0' },
    calm:     { left: 'M32,38 Q36,36 40,38', right: 'M60,38 Q64,36 68,38' },
    sleeping: { left: 'M32,40 L40,40', right: 'M60,40 L68,40' },
    waking:   { left: 'M33,39 a3,2 0 1,1 6,0 a3,2 0 1,1 -6,0', right: 'M61,39 a3,2 0 1,1 6,0 a3,2 0 1,1 -6,0' },
    dancing:  { left: 'M32,38 Q36,33 40,38', right: 'M60,38 Q64,33 68,38' },
    laughing: { left: 'M32,38 Q36,33 40,38', right: 'M60,38 Q64,33 68,38' },
    curious:  { left: 'M32,38 a4,5 0 1,1 8,0 a4,5 0 1,1 -8,0', right: 'M60,38 a5,5 0 1,1 10,0 a5,5 0 1,1 -10,0' },
    proud:    { left: 'M32,38 Q36,33 40,38', right: 'M60,38 Q64,33 68,38' },
    worried:  { left: 'M33,40 Q36,36 40,40', right: 'M60,40 Q64,36 68,40', extra: 'M30,32 L38,35 M62,35 L70,32' },
    loving:   { left: 'M31,38 L36,42 L41,38 L36,34 Z', right: 'M59,38 L64,42 L69,38 L64,34 Z' },
    focused:  { left: 'M34,38 a2,2 0 1,1 4,0 a2,2 0 1,1 -4,0', right: 'M62,38 a2,2 0 1,1 4,0 a2,2 0 1,1 -4,0' },
    playful:  { left: 'M32,38 a4,4 0 1,1 8,0 a4,4 0 1,1 -8,0', right: 'M60,38 Q64,35 68,38' },
    grateful: { left: 'M32,38 Q36,33 40,38', right: 'M60,38 Q64,33 68,38' },
    energized:{ left: 'M32,38 a4,4 0 1,1 8,0 a4,4 0 1,1 -8,0', right: 'M60,38 a4,4 0 1,1 8,0 a4,4 0 1,1 -8,0' },
    nostalgic:{ left: 'M33,39 a3,3 0 1,1 6,0 a3,3 0 1,1 -6,0', right: 'M61,39 a3,3 0 1,1 6,0 a3,3 0 1,1 -6,0' },
    inspired: { left: 'M32,38 a4,4 0 1,1 8,0 a4,4 0 1,1 -8,0', right: 'M60,38 a4,4 0 1,1 8,0 a4,4 0 1,1 -8,0' },
  }

  const mouthConfigs: Record<string, string> = {
    neutral:  'M40,56 Q50,62 60,56',
    happy:    'M38,54 Q50,68 62,54',
    thinking: 'M42,58 Q50,56 58,58',
    sad:      'M40,62 Q50,54 60,62',
    excited:  'M36,52 Q50,70 64,52',
    calm:     'M42,56 Q50,60 58,56',
    sleeping: 'M42,58 Q50,62 58,58',
    waking:   'M42,56 Q50,62 58,56',
    dancing:  'M36,52 Q50,68 64,52',
    laughing: 'M34,50 Q50,72 66,50',
    curious:  'M44,58 a6,6 0 1,0 12,0',
    proud:    'M38,54 Q50,66 62,54',
    worried:  'M42,60 Q50,56 58,60',
    loving:   'M40,54 Q50,66 60,54',
    focused:  'M44,58 L56,58',
    playful:  'M38,54 Q50,66 62,54',
    grateful: 'M38,54 Q50,68 62,54',
    energized:'M36,50 Q50,72 64,50',
    nostalgic:'M42,58 Q50,62 58,58',
    inspired: 'M38,52 Q50,68 62,52',
  }

  const eyes = eyeConfigs[mood] || eyeConfigs.neutral
  const mouth = mouthConfigs[mood] || mouthConfigs.neutral
  const isSleeping = mood === 'sleeping'
  const isLaughing = mood === 'laughing'
  const isLoving = mood === 'loving'

  return (
    <svg width="130" height="130" viewBox="0 0 100 100" className="absolute z-20" style={{
      filter: `drop-shadow(0 0 8px ${color}40)`,
      animation: speaking ? 'faceSpeak 0.6s ease-in-out infinite' : undefined,
      imageRendering: 'pixelated',
    }} shapeRendering="crispEdges">
      <g>
        <path d={eyes.left} fill={isLoving ? '#ff4080' : 'none'} stroke={isSleeping ? `${color}60` : `${color}cc`}
          strokeWidth={isLoving ? 0 : 4} strokeLinecap="square"
          style={{ transition: 'all 0.8s ease', animation: speaking ? undefined : (mood === 'curious' ? 'eyeLook 4s ease-in-out infinite' : undefined) }} />
        <path d={eyes.right} fill={isLoving ? '#ff4080' : 'none'} stroke={isSleeping ? `${color}60` : `${color}cc`}
          strokeWidth={isLoving ? 0 : 4} strokeLinecap="square"
          style={{ transition: 'all 0.8s ease' }} />
      </g>
      {eyes.extra && <path d={eyes.extra} fill="none" stroke={`${color}80`} strokeWidth="3" strokeLinecap="square" style={{ transition: 'all 0.5s ease' }} />}
      {(mood === 'happy' || mood === 'loving' || mood === 'proud' || mood === 'grateful') && (
        <>
          <circle cx="28" cy="46" r="5" fill={`${color}15`} />
          <circle cx="72" cy="46" r="5" fill={`${color}15`} />
        </>
      )}
      <path d={mouth} fill={isLaughing || mood === 'excited' || mood === 'energized' ? `${color}30` : 'none'}
        stroke={isSleeping ? `${color}40` : `${color}aa`}
        strokeWidth={3.5} strokeLinecap="square"
        style={{
          transition: 'all 0.8s ease',
          animation: speaking ? 'mouthTalk 0.4s ease-in-out infinite' : undefined,
        }} />
      {mood === 'thinking' && (
        <>
          <rect x="74" y="22" width="4" height="4" fill={`${color}50`} style={{ animation: 'thinkDot 1.5s ease-in-out infinite' }} />
          <rect x="80" y="16" width="5" height="5" fill={`${color}40`} style={{ animation: 'thinkDot 1.5s ease-in-out 0.3s infinite' }} />
          <rect x="84" y="8" width="6" height="6" fill={`${color}30`} style={{ animation: 'thinkDot 1.5s ease-in-out 0.6s infinite' }} />
        </>
      )}
      {isSleeping && (
        <text x="70" y="22" fill={`${color}60`} fontSize="14" fontWeight="bold"
          style={{ animation: 'zzz 3s ease-in-out infinite' }}>z</text>
      )}
    </svg>
  )
}

// ─── Main Bot Orb Component ──────────────────────────────────────────────────
interface BotOrbProps {
  mood: BotMood
  speaking: boolean
  onClick?: () => void
  /** User-uploaded orb PNG (data URL). When set, replaces the gradient body. */
  customImage?: string | null
}

export default function BotOrb({ mood, speaking, onClick, customImage }: BotOrbProps) {
  const cfg = MOOD_CONFIG[mood]
  const isSleeping = mood === 'sleeping'
  const isDancing = mood === 'dancing'
  const activeAnim = speaking ? 'orbSpeak' : cfg.anim
  const color = '#f0e0c0' // pixel theme color

  return (
    <div className="shrink-0 cursor-pointer transition-transform hover:scale-[1.02] active:scale-[0.98] relative z-10"
      onClick={onClick}
      style={{ opacity: 'var(--aura-orb-opacity, 1)' }}>
      <div className="relative flex items-center justify-center" style={{ width: 286, height: 286 }}>
        {cfg.particles && (
          <Particles symbol={cfg.particles} color={cfg.orb}
            count={mood === 'excited' || mood === 'energized' ? 10 : mood === 'dancing' ? 12 : 6} />
        )}

        {/* Outer ambient glow */}
        <div className="absolute rounded-full transition-all duration-[2500ms]" style={{
          width: 260, height: 260,
          background: 'rgba(255,245,220,0.15)',
          filter: 'blur(50px)',
          animation: `orbPulse ${isSleeping ? '8' : '4'}s ease-in-out infinite`,
          opacity: isSleeping ? 0.3 : isDancing ? 0.8 : 0.6,
        }} />

        {/* Ring 1 */}
        <div className="absolute rounded-full transition-all duration-[2000ms]" style={{
          width: 182, height: 182,
          border: '1px solid rgba(255,245,220,0.15)',
          animation: isDancing ? 'ringDance 2s ease-in-out infinite' : 'ringPulse 3s ease-in-out infinite',
        }} />
        {/* Ring 2 */}
        <div className="absolute rounded-full transition-all duration-[2000ms]" style={{
          width: 228, height: 228,
          border: '1px solid rgba(255,245,220,0.08)',
          animation: isDancing ? 'ringDance 2.5s ease-in-out 0.3s infinite' : 'ringPulse 4s ease-in-out 0.5s infinite',
        }} />

        {isDancing && <MusicBars color={cfg.orb} />}

        {/* Saturn ring */}
        <div className="absolute z-20 pointer-events-none" style={{
          width: 200, height: 200,
          animation: 'saturnRing 12s ease-in-out infinite',
        }}>
          <svg width="200" height="200" viewBox="0 0 200 200" fill="none" style={{ overflow: 'visible' }}>
            <ellipse cx="100" cy="100" rx="95" ry="18"
              stroke="rgba(255,245,220,0.25)" strokeWidth="2.5" fill="none"
              style={{ transition: 'stroke 1.5s ease' }} />
            <ellipse cx="100" cy="100" rx="88" ry="14"
              stroke="rgba(255,245,220,0.12)" strokeWidth="1.5" fill="none"
              style={{ transition: 'stroke 1.5s ease' }} />
          </svg>
        </div>

        {/* Star dust particles around planet */}
        <div className="absolute z-5 pointer-events-none" style={{ width: 200, height: 200 }}>
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={`dust-${i}`} className="absolute" style={{
              width: 2, height: 2, borderRadius: '50%',
              background: 'rgba(255,245,220,0.3)',
              left: `${30 + Math.cos(i * 0.52) * 45}%`,
              top: `${30 + Math.sin(i * 0.52) * 45}%`,
              animation: `dustOrbit ${6 + i * 0.8}s linear infinite`,
              opacity: 0.2 + (i % 3) * 0.1,
              boxShadow: '0 0 3px rgba(255,245,220,0.15)',
            }} />
          ))}
        </div>

        {/* Main orb body */}
        <div className="relative rounded-full flex items-center justify-center z-10 transition-all duration-[1500ms]" style={{
          width: isSleeping ? 117 : 130, height: isSleeping ? 117 : 130,
          background: customImage
            ? `center/cover no-repeat url(${customImage})`
            : 'radial-gradient(circle at 40% 35%, rgba(255,250,235,0.9), rgba(255,240,200,0.5) 50%, rgba(255,230,180,0.15) 100%)',
          boxShadow: `
            0 0 calc(30px * var(--aura-orb-glow, 1)) rgba(255,245,220,0.4),
            0 0 calc(60px * var(--aura-orb-glow, 1)) rgba(255,240,200,0.2),
            0 0 calc(100px * var(--aura-orb-glow, 1)) rgba(255,230,180,0.1)
          `,
          animation: `${activeAnim} ${speaking ? '0.8s' : cfg.speed} ease-in-out infinite`,
          borderRadius: '50%',
          overflow: 'hidden',
        }}>
          {/* Pixel texture overlay — craters & surface (hidden when custom PNG is used) */}
          {!customImage && <div className="absolute inset-0 z-5 pointer-events-none" style={{ imageRendering: 'pixelated' }}>
            {[
              { x: 20, y: 25, s: 8, o: 0.08 },
              { x: 65, y: 40, s: 6, o: 0.06 },
              { x: 35, y: 70, s: 10, o: 0.07 },
              { x: 75, y: 20, s: 5, o: 0.05 },
              { x: 50, y: 55, s: 7, o: 0.04 },
              { x: 15, y: 55, s: 4, o: 0.06 },
              { x: 80, y: 65, s: 6, o: 0.05 },
            ].map((c, ci) => (
              <div key={ci} className="absolute rounded-full" style={{
                left: `${c.x}%`, top: `${c.y}%`, width: c.s, height: c.s,
                background: `rgba(200,180,140,${c.o})`,
                boxShadow: `inset 1px 1px 0 rgba(255,255,255,${c.o * 0.5}), inset -1px -1px 0 rgba(0,0,0,${c.o * 0.8})`,
              }} />
            ))}
            {/* Pixel grid overlay */}
            <div className="absolute inset-0 rounded-full" style={{
              backgroundImage: `
                linear-gradient(0deg, rgba(0,0,0,0.06) 1px, transparent 1px),
                linear-gradient(90deg, rgba(0,0,0,0.06) 1px, transparent 1px)
              `,
              backgroundSize: '5px 5px',
              mixBlendMode: 'multiply',
            }} />
            <div className="absolute inset-0 rounded-full" style={{
              backgroundImage: `
                linear-gradient(0deg, rgba(255,255,255,0.03) 2px, transparent 2px),
                linear-gradient(90deg, rgba(255,255,255,0.03) 2px, transparent 2px)
              `,
              backgroundSize: '5px 5px',
              backgroundPosition: '2px 2px',
            }} />
          </div>}
          {/* Face */}
          <BotFace mood={mood} speaking={speaking} color={color} />
        </div>
      </div>
    </div>
  )
}
