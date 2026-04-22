import { useState, useEffect, useRef, useCallback } from 'react'
import type { ChatTokenEvent } from '../../../../shared/types'

interface Props {
  onEnd: () => void
  voiceHook: {
    speak: (text: string) => void
    stopSpeaking: () => void
    isSpeaking: boolean
    startListening: (onResult: (text: string) => void, continuous?: boolean) => void
    stopListening: () => void
    isListening: boolean
    transcript: string
    hasSpeechRecognition: boolean
  }
}

export default function VoiceCall({ onEnd, voiceHook }: Props) {
  const [status, setStatus] = useState<'idle' | 'recording' | 'thinking' | 'speaking'>('idle')
  const [lastUserText, setLastUserText] = useState('')
  const [lastBotText, setLastBotText] = useState('')
  const [duration, setDuration] = useState(0)
  const unsubRef = useRef<(() => void) | null>(null)
  const streamRef = useRef('')

  // Timer
  useEffect(() => {
    const timer = setInterval(() => setDuration(d => d + 1), 1000)
    return () => clearInterval(timer)
  }, [])

  // Subscribe to tokens
  useEffect(() => {
    unsubRef.current = window.aura.chat.onToken((data: ChatTokenEvent) => {
      streamRef.current += data.token
      if (data.done) {
        const fullText = streamRef.current
        streamRef.current = ''
        setLastBotText(fullText)
        setStatus('speaking')
        voiceHook.speak(fullText)
      }
    })
    return () => { unsubRef.current?.() }
  }, [voiceHook])

  // Watch speaking state — when TTS finishes, go back to idle
  useEffect(() => {
    if (status === 'speaking' && !voiceHook.isSpeaking) {
      setStatus('idle')
    }
  }, [voiceHook.isSpeaking, status])

  const toggleRecording = useCallback(() => {
    if (status === 'recording') {
      voiceHook.stopListening()
    } else if (status === 'idle') {
      voiceHook.stopSpeaking()
      setStatus('recording')
      voiceHook.startListening((text) => {
        if (text.trim()) {
          setLastUserText(text)
          setStatus('thinking')
          streamRef.current = ''
          window.aura.chat.send(text)
        } else {
          setStatus('idle')
        }
      })
    }
  }, [status, voiceHook])

  useEffect(() => {
    if (status === 'recording' && !voiceHook.isListening) {
      // Recognition ended naturally — onResult callback handles text
    }
  }, [voiceHook.isListening, status])

  const endCall = () => {
    voiceHook.stopListening()
    voiceHook.stopSpeaking()
    onEnd()
  }

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
  }

  // ── colours per status ──────────────────────────────────────────────────────
  const statusColor = {
    idle:      { r: '196,154,60',  hex: '#c49a3c' },
    recording: { r: '220,80,80',   hex: '#dc5050' },
    thinking:  { r: '196,154,60',  hex: '#c49a3c' },
    speaking:  { r: '46,184,122',  hex: '#2eb87a' },
  }[status]

  const statusLabel = {
    idle:      'PRESS MIC TO SPEAK',
    recording: '● REC — PRESS AGAIN TO SEND',
    thinking:  '· · · THINKING',
    speaking:  '◆ SPEAKING',
  }[status]

  const isBusy = status === 'thinking' || status === 'speaking'

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 32px',
        background: 'rgba(3,13,6,0.97)',
        backdropFilter: 'blur(24px)',
        overflow: 'hidden',
      }}
    >

      {/* ── Aurora ambient glow ─────────────────────────────────────────────── */}
      <div style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute',
          width: 500,
          height: 500,
          top: '38%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          borderRadius: '50%',
          background: `radial-gradient(circle, rgba(${statusColor.r},0.09) 0%, transparent 65%)`,
          filter: 'blur(60px)',
          transition: 'background 1.2s ease',
        }} />
        {/* Scanlines */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.05) 2px,rgba(0,0,0,0.05) 4px)',
          opacity: 0.4,
        }} />
      </div>

      {/* ── Top: timer + status badge ───────────────────────────────────────── */}
      <div style={{
        position: 'relative',
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '10px',
        marginBottom: '48px',
      }}>
        {/* Timer */}
        <div style={{
          fontFamily: "'Press Start 2P', monospace",
          fontSize: '11px',
          color: 'rgba(196,154,60,0.36)',
          letterSpacing: '0.18em',
        }}>
          {formatTime(duration)}
        </div>

        {/* Status badge */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '7px',
          padding: '6px 14px',
          borderRadius: '5px',
          background: `rgba(${statusColor.r},0.06)`,
          border: `1px solid rgba(${statusColor.r},0.18)`,
          fontFamily: "'Press Start 2P', monospace",
          fontSize: '5px',
          color: `rgba(${statusColor.r},0.72)`,
          letterSpacing: '0.12em',
          lineHeight: 2,
          transition: 'all 0.4s ease',
        }}>
          {statusLabel}
        </div>
      </div>

      {/* ── Central orb ─────────────────────────────────────────────────────── */}
      <div style={{
        position: 'relative',
        zIndex: 10,
        marginBottom: '48px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {/* Pulse rings */}
        {(status === 'recording' || status === 'speaking') && (
          <>
            <div style={{
              position: 'absolute',
              width: 180,
              height: 180,
              borderRadius: '12px',
              border: `1px solid rgba(${statusColor.r},0.2)`,
              animation: 'nodeRing 2s ease-in-out infinite',
            }} />
            <div style={{
              position: 'absolute',
              width: 220,
              height: 220,
              borderRadius: '14px',
              border: `1px solid rgba(${statusColor.r},0.1)`,
              animation: 'nodeRing 2s ease-in-out infinite',
              animationDelay: '0.6s',
            }} />
          </>
        )}

        {/* Thinking dot pulse */}
        {status === 'thinking' && (
          <div style={{
            position: 'absolute',
            width: 160,
            height: 160,
            borderRadius: '11px',
            border: `1px solid rgba(196,154,60,0.16)`,
            animation: 'auraPulse 1.4s ease-in-out infinite',
          }} />
        )}

        {/* Orb body */}
        <div style={{
          width: 120,
          height: 120,
          borderRadius: '14px',
          background: `radial-gradient(circle at 38% 36%, rgba(${statusColor.r},0.55), rgba(${statusColor.r},0.14))`,
          border: `1px solid rgba(${statusColor.r},0.32)`,
          boxShadow: `0 0 40px rgba(${statusColor.r},0.2), 0 0 80px rgba(${statusColor.r},0.08)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.7s cubic-bezier(.16,1,.3,1)',
          animation: status === 'speaking'
            ? 'auraPulse 1.4s ease-in-out infinite'
            : status === 'recording'
              ? 'auraPulse 2s ease-in-out infinite'
              : 'auraPulse 4s ease-in-out infinite',
        }}>
          <span style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: '28px',
            color: `rgba(${statusColor.r},0.9)`,
            textShadow: `0 0 24px rgba(${statusColor.r},0.5)`,
            lineHeight: 1,
          }}>
            {status === 'recording' ? '●' : status === 'thinking' ? '·' : 'A'}
          </span>
        </div>
      </div>

      {/* ── Transcript / last exchange ───────────────────────────────────────── */}
      <div style={{
        position: 'relative',
        zIndex: 10,
        width: '100%',
        maxWidth: '360px',
        marginBottom: '40px',
        minHeight: '60px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}>
        {/* Live transcript */}
        {voiceHook.transcript && status === 'recording' && (
          <div style={{
            padding: '10px 14px',
            borderRadius: '8px',
            background: 'rgba(220,80,80,0.05)',
            border: '1px solid rgba(220,80,80,0.14)',
            animation: 'fadeUp 0.3s ease forwards',
          }}>
            <div style={{
              fontFamily: "'Press Start 2P', monospace",
              fontSize: '5px',
              color: 'rgba(220,80,80,0.4)',
              marginBottom: '6px',
              letterSpacing: '0.12em',
              lineHeight: 2,
            }}>TU:</div>
            <div style={{
              fontFamily: "'Press Start 2P', monospace",
              fontSize: '6px',
              color: 'rgba(245,228,168,0.7)',
              lineHeight: 2.2,
            }}>
              "{voiceHook.transcript}"
            </div>
          </div>
        )}

        {/* Last exchange */}
        {lastUserText && status !== 'recording' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{
              padding: '10px 14px',
              borderRadius: '8px',
              background: 'rgba(196,154,60,0.04)',
              border: '1px solid rgba(196,154,60,0.1)',
            }}>
              <div style={{
                fontFamily: "'Press Start 2P', monospace",
                fontSize: '5px',
                color: 'rgba(196,154,60,0.28)',
                marginBottom: '5px',
                letterSpacing: '0.12em',
                lineHeight: 2,
              }}>TU:</div>
              <div style={{
                fontFamily: "'Press Start 2P', monospace",
                fontSize: '6px',
                color: 'rgba(245,228,168,0.6)',
                lineHeight: 2.2,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}>"{lastUserText}"</div>
            </div>

            {lastBotText && (
              <div style={{
                padding: '10px 14px',
                borderRadius: '8px',
                background: 'rgba(46,184,122,0.04)',
                border: '1px solid rgba(46,184,122,0.12)',
              }}>
                <div style={{
                  fontFamily: "'Press Start 2P', monospace",
                  fontSize: '5px',
                  color: 'rgba(46,184,122,0.32)',
                  marginBottom: '5px',
                  letterSpacing: '0.12em',
                  lineHeight: 2,
                }}>AURA:</div>
                <div style={{
                  fontFamily: "'Press Start 2P', monospace",
                  fontSize: '6px',
                  color: 'rgba(245,228,168,0.6)',
                  lineHeight: 2.2,
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}>"{lastBotText}"</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Controls ─────────────────────────────────────────────────────────── */}
      <div style={{
        position: 'relative',
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
      }}>
        {/* Mic button */}
        <button
          onClick={toggleRecording}
          disabled={isBusy}
          style={{
            width: '60px',
            height: '60px',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: `1px solid rgba(${status === 'recording' ? '220,80,80' : '196,154,60'},${isBusy ? '0.08' : '0.28'})`,
            background: status === 'recording'
              ? 'rgba(220,80,80,0.14)'
              : isBusy
                ? 'rgba(196,154,60,0.03)'
                : 'linear-gradient(135deg, rgba(196,154,60,0.12), rgba(13,61,46,0.18))',
            boxShadow: status === 'recording'
              ? '0 0 24px rgba(220,80,80,0.2)'
              : isBusy ? 'none' : '0 0 20px rgba(196,154,60,0.12)',
            cursor: isBusy ? 'not-allowed' : 'pointer',
            opacity: isBusy ? 0.4 : 1,
            transition: 'all 0.28s ease',
            animation: status === 'recording' ? 'auraPulse 1.5s ease-in-out infinite' : 'none',
          }}
          onMouseEnter={e => {
            if (!isBusy) e.currentTarget.style.transform = 'translateY(-2px)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'translateY(0)'
          }}
        >
          <span style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: status === 'recording' ? '18px' : '16px',
            filter: status === 'recording'
              ? 'drop-shadow(0 0 8px rgba(220,80,80,0.6))'
              : isBusy ? 'none' : 'drop-shadow(0 0 6px rgba(196,154,60,0.4))',
          }}>
            {status === 'recording' ? '⏹' : '🎤'}
          </span>
        </button>

        {/* End call button */}
        <button
          onClick={endCall}
          style={{
            width: '54px',
            height: '54px',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid rgba(220,80,80,0.28)',
            background: 'rgba(220,80,80,0.1)',
            boxShadow: '0 0 20px rgba(220,80,80,0.12)',
            cursor: 'pointer',
            transition: 'all 0.28s ease',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = 'rgba(220,80,80,0.45)'
            e.currentTarget.style.boxShadow = '0 0 32px rgba(220,80,80,0.22)'
            e.currentTarget.style.transform = 'translateY(-2px)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = 'rgba(220,80,80,0.28)'
            e.currentTarget.style.boxShadow = '0 0 20px rgba(220,80,80,0.12)'
            e.currentTarget.style.transform = 'translateY(0)'
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="rgba(220,80,80,0.8)" strokeWidth="2.5" strokeLinecap="round">
            <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>
        </button>
      </div>

      {/* Hint text */}
      <div style={{
        position: 'relative',
        zIndex: 10,
        marginTop: '16px',
        fontFamily: "'Press Start 2P', monospace",
        fontSize: '5px',
        color: 'rgba(196,154,60,0.22)',
        letterSpacing: '0.1em',
        lineHeight: 2,
      }}>
        {status === 'recording' ? '⏹ WHEN YOU\'RE DONE' : '🎙 SPEAK  ·  ✕ CLOSE'}
      </div>

    </div>
  )
}