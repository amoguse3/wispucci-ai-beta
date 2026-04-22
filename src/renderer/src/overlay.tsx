import { createRoot } from 'react-dom/client'
import { useState, useEffect, useRef, useCallback } from 'react'

declare global {
  interface Window {
    overlayAPI: {
      getReminder: () => Promise<{ text: string } | null>
      openMain: () => void
      sendToChat: (msg: string) => void
      getOrbSize: () => Promise<string>
      onSizeChange: (cb: (size: string) => void) => void
      setClickThrough: (ignore: boolean) => void
      dragMove: (dx: number, dy: number) => void
    }
  }
}

const SIZES: Record<string, number> = { small: 48, medium: 64, large: 80 }

function OverlayApp() {
  const [orbPx, setOrbPx] = useState(64)
  const [showChat, setShowChat] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const [reminder, setReminder] = useState<string | null>(null)
  const [idle, setIdle] = useState(false)
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dragging = useRef(false)
  const dragStart = useRef({ x: 0, y: 0 })
  const didDrag = useRef(false)

  useEffect(() => {
    window.overlayAPI.getOrbSize().then(s => setOrbPx(SIZES[s] || 64))
    window.overlayAPI.onSizeChange(s => setOrbPx(SIZES[s] || 64))
  }, [])

  const resetIdle = useCallback(() => {
    setIdle(false)
    if (idleTimer.current) clearTimeout(idleTimer.current)
    idleTimer.current = setTimeout(() => setIdle(true), 5000)
  }, [])

  useEffect(() => {
    resetIdle()
    return () => { if (idleTimer.current) clearTimeout(idleTimer.current) }
  }, [resetIdle])

  // Reminders every ~45s
  useEffect(() => {
    const fetchReminder = async () => {
      if (showChat) return
      const r = await window.overlayAPI.getReminder()
      if (r?.text) {
        setReminder(r.text)
        resetIdle()
        setTimeout(() => setReminder(null), 6000)
      }
    }
    const interval = setInterval(fetchReminder, 45000)
    const first = setTimeout(fetchReminder, 8000)
    return () => { clearInterval(interval); clearTimeout(first) }
  }, [showChat, resetIdle])

  // Custom drag via mousemove
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return
      const dx = e.screenX - dragStart.current.x
      const dy = e.screenY - dragStart.current.y
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
        didDrag.current = true
        window.overlayAPI.dragMove(dx, dy)
        dragStart.current = { x: e.screenX, y: e.screenY }
      }
    }
    const onMouseUp = () => {
      dragging.current = false
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  const handleOrbMouseDown = (e: React.MouseEvent) => {
    dragging.current = true
    didDrag.current = false
    dragStart.current = { x: e.screenX, y: e.screenY }
    resetIdle()
  }

  const handleOrbMouseUp = () => {
    dragging.current = false
    // If didn't drag — it's a click → toggle chat
    if (!didDrag.current) {
      setShowChat(prev => !prev)
      setReminder(null)
    }
  }

  // Tell main process: stop ignoring mouse when cursor enters visible elements
  const onEnterVisible = () => window.overlayAPI.setClickThrough(false)
  const onLeaveVisible = () => {
    if (!showChat) window.overlayAPI.setClickThrough(true)
  }

  const handleSend = () => {
    const msg = chatInput.trim()
    setChatInput('')
    setShowChat(false)
    window.overlayAPI.setClickThrough(true)
    if (msg) {
      window.overlayAPI.sendToChat(msg)
    } else {
      window.overlayAPI.openMain()
    }
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-end',
        paddingBottom: 12,
        opacity: idle && !showChat && !reminder ? 0.5 : 1,
        transition: 'opacity 0.8s ease',
        userSelect: 'none',
      }}
    >
      {/* Reminder bubble */}
      {reminder && !showChat && (
        <div
          onMouseEnter={onEnterVisible}
          onMouseLeave={onLeaveVisible}
          style={{
            maxWidth: 200,
            padding: '8px 12px',
            marginBottom: 8,
            borderRadius: 10,
            background: 'rgba(30,20,10,0.92)',
            border: '1px solid rgba(180,130,60,0.3)',
            fontFamily: "'Press Start 2P', monospace",
            fontSize: 5,
            color: 'rgba(220,200,160,0.85)',
            lineHeight: 2.2,
            textAlign: 'center',
            animation: 'fadeIn 0.3s ease',
          }}
        >
          {reminder}
        </div>
      )}

      {/* Orb + Panel */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {/* The Orb — mousedown+move = drag, click (no drag) = toggle chat */}
        <div
          onMouseEnter={onEnterVisible}
          onMouseLeave={onLeaveVisible}
          onMouseDown={handleOrbMouseDown}
          onMouseUp={handleOrbMouseUp}
          style={{
            width: orbPx,
            height: orbPx,
            borderRadius: '50%',
            background: 'radial-gradient(circle at 38% 32%, rgba(180,130,80,0.9), rgba(100,60,25,0.75) 50%, rgba(30,15,5,0.5) 80%)',
            boxShadow: showChat
              ? '0 0 25px rgba(180,130,60,0.5), 0 0 50px rgba(140,90,40,0.2)'
              : '0 0 20px rgba(140,90,40,0.35), 0 0 40px rgba(100,60,20,0.15)',
            cursor: dragging.current ? 'grabbing' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: dragging.current ? 'none' : 'orbFloat 4s ease-in-out infinite',
            flexShrink: 0,
            transition: 'box-shadow 0.3s ease',
          }}
        >
          <svg
            width="60%"
            height="60%"
            viewBox="0 0 100 100"
            style={{ imageRendering: 'pixelated', pointerEvents: 'none' }}
            shapeRendering="crispEdges"
          >
            <rect x="28" y="32" width="12" height="12" rx="2" fill="rgba(212,184,150,0.7)" />
            <rect x="60" y="32" width="12" height="12" rx="2" fill="rgba(212,184,150,0.7)" />
            <path d="M35,62 Q50,75 65,62" fill="none" stroke="rgba(212,184,150,0.5)" strokeWidth="3.5" />
          </svg>
        </div>

        {/* Chat input — centered below orb */}
        {showChat && (
          <div
            onMouseEnter={onEnterVisible}
            onMouseLeave={() => {}} // keep interactive while chat open
            style={{
              marginTop: 10,
              width: 220,
              borderRadius: 12,
              overflow: 'hidden',
              background: 'rgba(8,6,6,0.95)',
              border: '1px solid rgba(180,130,60,0.2)',
              boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
              animation: 'slideUp 0.2s ease',
              backdropFilter: 'blur(12px)',
            }}
          >
            <div style={{ padding: 8, display: 'flex', gap: 6 }}>
              <input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleSend()
                  if (e.key === 'Escape') {
                    setShowChat(false)
                    setChatInput('')
                    window.overlayAPI.setClickThrough(true)
                  }
                }}
                placeholder="Type something..."
                autoFocus
                style={{
                  flex: 1,
                  padding: '6px 10px',
                  borderRadius: 8,
                  fontFamily: "'Press Start 2P', monospace",
                  fontSize: 6,
                  color: 'rgba(220,200,160,0.8)',
                  background: 'rgba(20,15,10,0.8)',
                  border: '1px solid rgba(180,130,60,0.15)',
                  outline: 'none',
                }}
              />
              <button
                onClick={handleSend}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: 'rgba(180,130,60,0.12)',
                  border: '1px solid rgba(180,130,60,0.2)',
                  color: 'rgba(180,130,60,0.6)',
                  cursor: 'pointer',
                  fontSize: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                →
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes orbFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
      `}</style>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<OverlayApp />)
