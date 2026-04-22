import { useState, useEffect, useRef } from 'react'

type Particle = {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  color: string
  size: number
  life: number
}

type Firework = {
  id: number
  x: number
  y: number
  targetY: number
  color: string
  phase: 'rising' | 'exploded'
  particles: Particle[]
}

const COLORS = ['#f0c030', '#e04080', '#40c0e0', '#60e060', '#c060f0', '#f08030']

export default function PixelFireworks({ active, onDone }: { active: boolean; onDone?: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const fireworksRef = useRef<Firework[]>([])
  const idRef = useRef(0)
  const spawnCountRef = useRef(0)

  useEffect(() => {
    if (!active) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = canvas.offsetWidth
    canvas.height = canvas.offsetHeight
    const W = canvas.width, H = canvas.height
    spawnCountRef.current = 0

    const spawn = () => {
      if (spawnCountRef.current >= 6) return
      spawnCountRef.current++
      const id = ++idRef.current
      const color = COLORS[Math.floor(Math.random() * COLORS.length)]
      fireworksRef.current.push({
        id, x: W * 0.15 + Math.random() * W * 0.7,
        y: H, targetY: H * 0.15 + Math.random() * H * 0.35,
        color, phase: 'rising', particles: [],
      })
    }

    const explode = (fw: Firework) => {
      fw.phase = 'exploded'
      const count = 20 + Math.floor(Math.random() * 15)
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.3
        const speed = 1.5 + Math.random() * 3
        fw.particles.push({
          id: i, x: fw.x, y: fw.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color: Math.random() > 0.3 ? fw.color : COLORS[Math.floor(Math.random() * COLORS.length)],
          size: 2 + Math.floor(Math.random() * 3),
          life: 1,
        })
      }
    }

    let lastSpawn = 0
    const loop = (time: number) => {
      ctx.clearRect(0, 0, W, H)

      if (time - lastSpawn > 400 && spawnCountRef.current < 6) {
        spawn()
        lastSpawn = time
      }

      fireworksRef.current = fireworksRef.current.filter(fw => {
        if (fw.phase === 'rising') {
          fw.y -= 4
          // Draw rising pixel trail
          ctx.fillStyle = fw.color
          ctx.fillRect(Math.floor(fw.x / 3) * 3, Math.floor(fw.y / 3) * 3, 3, 3)
          ctx.globalAlpha = 0.4
          ctx.fillRect(Math.floor(fw.x / 3) * 3, Math.floor(fw.y / 3) * 3 + 3, 3, 6)
          ctx.globalAlpha = 1
          if (fw.y <= fw.targetY) explode(fw)
          return true
        }

        let alive = false
        fw.particles.forEach(p => {
          p.x += p.vx
          p.y += p.vy
          p.vy += 0.06 // gravity
          p.life -= 0.015
          if (p.life <= 0) return
          alive = true
          ctx.globalAlpha = p.life
          ctx.fillStyle = p.color
          const px = Math.floor(p.x / 3) * 3
          const py = Math.floor(p.y / 3) * 3
          ctx.fillRect(px, py, p.size, p.size)
        })
        ctx.globalAlpha = 1
        return alive
      })

      if (fireworksRef.current.length > 0 || spawnCountRef.current < 6) {
        animRef.current = requestAnimationFrame(loop)
      } else {
        onDone?.()
      }
    }

    animRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(animRef.current)
  }, [active])

  if (!active) return null

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute', inset: 0, zIndex: 55,
        pointerEvents: 'none',
        imageRendering: 'pixelated',
      }}
    />
  )
}
