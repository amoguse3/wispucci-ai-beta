// ─── AURA Sound System (Web Audio API synthesized sounds) ─────────────────────
// No audio files needed — all sounds are procedurally generated

let ctx: AudioContext | null = null
let enabled = true
let volume = 0.3

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext()
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

function gain(v: number): GainNode {
  const g = getCtx().createGain()
  g.gain.value = v * volume
  g.connect(getCtx().destination)
  return g
}

export function setSoundEnabled(v: boolean) { enabled = v }
export function setSoundVolume(v: number) { volume = Math.max(0, Math.min(1, v)) }
export function isSoundEnabled() { return enabled }

// Soft blip — message sent
export function playBlip() {
  if (!enabled) return
  const c = getCtx(), g = gain(0.15)
  const o = c.createOscillator()
  o.type = 'sine'
  o.frequency.setValueAtTime(880, c.currentTime)
  o.frequency.exponentialRampToValueAtTime(1320, c.currentTime + 0.06)
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.12)
  o.connect(g)
  o.start(c.currentTime)
  o.stop(c.currentTime + 0.12)
}

// Whoosh — panel open
export function playWhoosh() {
  if (!enabled) return
  const c = getCtx(), g = gain(0.08)
  const bufferSize = c.sampleRate * 0.15
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize)
  }
  const noise = c.createBufferSource()
  noise.buffer = buffer
  const filter = c.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.setValueAtTime(2000, c.currentTime)
  filter.frequency.exponentialRampToValueAtTime(400, c.currentTime + 0.15)
  filter.Q.value = 0.5
  noise.connect(filter)
  filter.connect(g)
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.18)
  noise.start(c.currentTime)
  noise.stop(c.currentTime + 0.18)
}

// Ding — XP earned / achievement
export function playDing() {
  if (!enabled) return
  const c = getCtx(), g = gain(0.12)
  const o1 = c.createOscillator(), o2 = c.createOscillator()
  o1.type = 'sine'; o2.type = 'sine'
  o1.frequency.value = 1047; o2.frequency.value = 1319
  o1.connect(g); o2.connect(g)
  g.gain.setValueAtTime(0.12 * volume, c.currentTime)
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.4)
  o1.start(c.currentTime); o2.start(c.currentTime + 0.08)
  o1.stop(c.currentTime + 0.4); o2.stop(c.currentTime + 0.4)
}

// Achievement unlock — retro 2-step chime distinct from XP ding
export function playAchievement() {
  if (!enabled) return
  const c = getCtx()
  const notes = [784, 988, 1175] // G5, B5, D6
  notes.forEach((freq, i) => {
    const g = gain(0.09)
    const o = c.createOscillator()
    o.type = 'triangle'
    o.frequency.value = freq
    o.connect(g)
    const t = c.currentTime + i * 0.08
    g.gain.setValueAtTime(0.09 * volume, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.28)
    o.start(t)
    o.stop(t + 0.28)
  })
}

// Click — button press
export function playClick() {
  if (!enabled) return
  const c = getCtx(), g = gain(0.06)
  const o = c.createOscillator()
  o.type = 'square'
  o.frequency.setValueAtTime(600, c.currentTime)
  o.frequency.exponentialRampToValueAtTime(200, c.currentTime + 0.04)
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.05)
  o.connect(g)
  o.start(c.currentTime)
  o.stop(c.currentTime + 0.05)
}

// Boot — app startup chime (3-note ascending)
export function playBoot() {
  if (!enabled) return
  const c = getCtx()
  const notes = [523, 659, 784] // C5, E5, G5
  notes.forEach((freq, i) => {
    const g = gain(0.1)
    const o = c.createOscillator()
    o.type = 'sine'
    o.frequency.value = freq
    o.connect(g)
    const t = c.currentTime + i * 0.12
    g.gain.setValueAtTime(0.1 * volume, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3)
    o.start(t)
    o.stop(t + 0.3)
  })
}

// Wake — morning BotOrb yawn sound (descending + ascending)
export function playWake() {
  if (!enabled) return
  const c = getCtx(), g = gain(0.08)
  const o = c.createOscillator()
  o.type = 'sine'
  o.frequency.setValueAtTime(400, c.currentTime)
  o.frequency.exponentialRampToValueAtTime(250, c.currentTime + 0.5)
  o.frequency.exponentialRampToValueAtTime(600, c.currentTime + 1.0)
  g.gain.setValueAtTime(0.08 * volume, c.currentTime)
  g.gain.setValueAtTime(0.08 * volume, c.currentTime + 0.8)
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 1.2)
  o.connect(g)
  o.start(c.currentTime)
  o.stop(c.currentTime + 1.2)
}

// Celebration — firework-like burst
export function playCelebration() {
  if (!enabled) return
  const c = getCtx()
  // Rising sweep
  const g1 = gain(0.08)
  const o1 = c.createOscillator()
  o1.type = 'sawtooth'
  o1.frequency.setValueAtTime(200, c.currentTime)
  o1.frequency.exponentialRampToValueAtTime(2000, c.currentTime + 0.3)
  g1.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.35)
  o1.connect(g1)
  o1.start(c.currentTime)
  o1.stop(c.currentTime + 0.35)
  // Sparkle burst
  const notes = [1047, 1175, 1319, 1397, 1568]
  notes.forEach((f, i) => {
    const g = gain(0.06)
    const o = c.createOscillator()
    o.type = 'sine'
    o.frequency.value = f
    o.connect(g)
    const t = c.currentTime + 0.3 + i * 0.06
    g.gain.setValueAtTime(0.06 * volume, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.25)
    o.start(t)
    o.stop(t + 0.25)
  })
}

// Mood tones — soft tone that matches BotOrb mood
export function playMoodTone(mood: string) {
  if (!enabled) return
  const c = getCtx(), g = gain(0.04)
  const o = c.createOscillator()
  o.type = 'sine'
  const moodFreqs: Record<string, number> = {
    happy: 523, sad: 262, excited: 659, calm: 392,
    thinking: 440, sleeping: 220, waking: 330,
    dancing: 587, laughing: 587, loving: 494,
    proud: 523, worried: 311, curious: 440,
    focused: 392, playful: 587, grateful: 494,
    energized: 659, nostalgic: 349, inspired: 587,
  }
  o.frequency.value = moodFreqs[mood] || 440
  o.connect(g)
  g.gain.setValueAtTime(0.04 * volume, c.currentTime)
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.6)
  o.start(c.currentTime)
  o.stop(c.currentTime + 0.6)
}
