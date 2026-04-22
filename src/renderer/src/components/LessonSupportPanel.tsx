import { useEffect, useRef, useState } from 'react'
import MessageBubble from './MessageBubble'
import type { Lesson, Message, TeacherCheckpoint, TeacherCheckpointFlashcard, ChatTokenEvent } from '../../../../shared/types'

const PX = "'Press Start 2P', monospace"
const READING = "'Palatino Linotype', 'Book Antiqua', Georgia, serif"
const UI = "'Trebuchet MS', 'Segoe UI', sans-serif"
const SUPPORT_TEXT_SCALE = 0.7

const sSize = (size: number) => Number((size * SUPPORT_TEXT_SCALE).toFixed(1))

type SupportTab = 'score' | 'clarify' | 'recall'

const UNDERSTANDING_OPTIONS = [
  { label: 'NOT YET', emoji: '😵', score: 3, tone: 'rgba(255,180,140,0.22)' },
  { label: 'ALMOST', emoji: '🤔', score: 6, tone: 'rgba(232,197,106,0.18)' },
  { label: 'CLEAR', emoji: '💡', score: 9, tone: 'rgba(46,184,122,0.18)' },
] as const

interface Props {
  lesson: Lesson
  understandingScore: number | null
  onUnderstandingScoreChange: (score: number) => void
  initialFlashcards?: TeacherCheckpointFlashcard[]
  onCheckpointUpdate?: (checkpoint: TeacherCheckpoint) => void
  autoGenerateFlashcards?: boolean
  continueLabel?: string
  continueEnabled?: boolean
  continueDisabledLabel?: string
  onContinue?: () => void
}

function makeMessage(role: 'user' | 'assistant', content: string): Message {
  return {
    id: Date.now() + Math.floor(Math.random() * 1000),
    role,
    content,
    created_at: new Date().toISOString(),
  }
}

export default function LessonSupportPanel({
  lesson,
  understandingScore,
  onUnderstandingScoreChange,
  initialFlashcards = [],
  onCheckpointUpdate,
  autoGenerateFlashcards = false,
  continueLabel,
  continueEnabled = true,
  continueDisabledLabel,
  onContinue,
}: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streamText, setStreamText] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [flashcards, setFlashcards] = useState<TeacherCheckpointFlashcard[]>(initialFlashcards)
  const [activeTab, setActiveTab] = useState<SupportTab>('score')
  const [recallStarted, setRecallStarted] = useState(false)
  const [recallFinished, setRecallFinished] = useState(false)
  const [activeCardIndex, setActiveCardIndex] = useState(0)
  const [cardFlipped, setCardFlipped] = useState(false)
  const streamRef = useRef('')
  const unsubRef = useRef<(() => void) | null>(null)
  const activeQuestionRef = useRef('')
  const hasGeneratedInitialRef = useRef(false)

  useEffect(() => {
    setMessages([])
    setInput('')
    setStreamText('')
    setIsTyping(false)
    setFlashcards(initialFlashcards)
    setActiveTab('score')
    setRecallStarted(false)
    setRecallFinished(false)
    setActiveCardIndex(0)
    setCardFlipped(false)
    streamRef.current = ''
    activeQuestionRef.current = ''
    hasGeneratedInitialRef.current = initialFlashcards.length > 0
  }, [lesson.id])

  useEffect(() => {
    if (initialFlashcards.length === 0) return
    setFlashcards(initialFlashcards)
    setActiveCardIndex(0)
    setCardFlipped(false)
    setRecallFinished(false)
    hasGeneratedInitialRef.current = true
  }, [initialFlashcards])

  useEffect(() => {
    const clarificationOpen = understandingScore !== null && understandingScore < 7
    const hasReply = messages.some(message => message.role === 'assistant')
    const recallReady = (understandingScore !== null && understandingScore >= 7) || hasReply

    if (understandingScore === null) {
      setActiveTab('score')
      return
    }
    if (activeTab === 'recall' && !recallReady) {
      setActiveTab('score')
      return
    }
    if (activeTab === 'clarify' && !clarificationOpen && !hasReply) {
      setActiveTab('score')
    }
  }, [activeTab, messages, understandingScore])

  useEffect(() => {
    unsubRef.current = window.aura.educator.onClarifyToken(async (data: ChatTokenEvent) => {
      if (data.done) {
        const finalText = `${streamRef.current}${data.token || ''}`.trim()
        streamRef.current = ''
        setStreamText('')
        setIsTyping(false)

        if (finalText) {
          setMessages(prev => [...prev, makeMessage('assistant', finalText)])
        }

        if (activeQuestionRef.current) {
          try {
            const nextCheckpoint = await window.aura.educator.generateTeacherCheckpoint(lesson.id, activeQuestionRef.current)
            setFlashcards(nextCheckpoint.flashcards)
            setActiveCardIndex(0)
            setCardFlipped(false)
            setRecallStarted(false)
            setRecallFinished(false)
            onCheckpointUpdate?.(nextCheckpoint)
            window.aura.educator.saveTeacherCheckpointFlashcards(lesson.id, nextCheckpoint.flashcards).catch(() => null)
          } catch {
            // keep current flashcards if focused regeneration fails
          }
        }
        return
      }

      streamRef.current += data.token
      setStreamText(streamRef.current)
    })

    return () => {
      unsubRef.current?.()
      unsubRef.current = null
    }
  }, [lesson.id, onCheckpointUpdate])

  useEffect(() => {
    if (!autoGenerateFlashcards || hasGeneratedInitialRef.current || flashcards.length > 0) return

    let cancelled = false
    window.aura.educator.generateTeacherCheckpoint(lesson.id)
      .then((checkpoint) => {
        if (cancelled) return
        setFlashcards(checkpoint.flashcards)
        onCheckpointUpdate?.(checkpoint)
        hasGeneratedInitialRef.current = true
        window.aura.educator.saveTeacherCheckpointFlashcards(lesson.id, checkpoint.flashcards).catch(() => null)
      })
      .catch(() => null)

    return () => {
      cancelled = true
    }
  }, [autoGenerateFlashcards, flashcards.length, lesson.id, onCheckpointUpdate])

  const understandingHint = understandingScore === null
    ? 'Choose quickly and honestly: stuck, almost or clear.'
    : understandingScore >= 7
      ? 'Clear. You can move forward or open a short recall.'
      : 'Not clear yet. Write exactly where you got stuck and we\'ll clarify just that point.'

  const clarificationNeeded = understandingScore !== null && understandingScore < 7
  const hasClarificationResponse = messages.some(message => message.role === 'assistant')
  const recallUnlocked = (understandingScore !== null && understandingScore >= 7) || hasClarificationResponse
  const canContinue = Boolean(onContinue && continueLabel && continueEnabled && understandingScore !== null && understandingScore >= 7)
  const activeCard = flashcards[activeCardIndex] || null

  const placeholder = clarificationNeeded
    ? 'Write specifically what you didn\'t understand from the lesson...'
    : 'Ask anything about the lesson: text, problem, idea, example...'

  const askLabel = clarificationNeeded
    ? 'EXPLAIN SIMPLER'
    : 'SEND QUESTION'

  const tabState: Array<{ id: SupportTab; label: string; enabled: boolean }> = [
    { id: 'score', label: 'SCORE', enabled: true },
    { id: 'clarify', label: 'CLARIFY', enabled: clarificationNeeded || hasClarificationResponse },
    { id: 'recall', label: 'RECALL', enabled: recallUnlocked },
  ]

  const askForHelp = async () => {
    const question = input.trim()
    if (!question || isTyping || !clarificationNeeded) return

    activeQuestionRef.current = question
    streamRef.current = ''
    setStreamText('')
    setIsTyping(true)
    setMessages(prev => [...prev, makeMessage('user', question)])
    setInput('')

    await window.aura.educator.clarifyLesson(lesson.id, question, understandingScore)
  }

  const startRecall = () => {
    setRecallStarted(true)
    setRecallFinished(false)
    setActiveCardIndex(0)
    setCardFlipped(false)
    setActiveTab('recall')
  }

  const advanceRecall = () => {
    if (activeCardIndex + 1 >= flashcards.length) {
      setRecallFinished(true)
      setCardFlipped(false)
      return
    }
    setActiveCardIndex(prev => prev + 1)
    setCardFlipped(false)
  }

  return (
    <div style={{
      width: 'min(100%, 390px)',
      margin: '20px auto 0',
      padding: '10px 10px 8px',
      borderRadius: 18,
      background: 'rgba(4,14,8,0.72)',
      border: '1px solid rgba(196,154,60,0.12)',
      boxShadow: '0 0 28px rgba(0,0,0,0.14)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
        {tabState.map((tab) => {
          const active = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => tab.enabled && setActiveTab(tab.id)}
              disabled={!tab.enabled}
              style={{
                padding: '0 0 8px',
                background: 'none',
                border: 'none',
                borderBottom: `2px solid ${active ? 'rgba(46,184,122,0.72)' : 'rgba(196,154,60,0.14)'}`,
                cursor: tab.enabled ? 'pointer' : 'not-allowed',
                opacity: active ? 1 : tab.enabled ? 0.58 : 0.26,
                color: active ? 'rgba(245,228,168,0.92)' : 'rgba(220,200,160,0.58)',
                fontFamily: PX,
                fontSize: sSize(4.4),
                letterSpacing: '0.08em',
                lineHeight: 1.8,
                transition: 'all .18s ease',
              }}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {activeTab === 'score' && (
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: PX, fontSize: sSize(4.8), color: 'rgba(200,180,40,0.56)', lineHeight: 1.8, letterSpacing: '0.08em', marginBottom: 8 }}>
            AFTER READING, HOW CLEAR IS IT?
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, marginBottom: 8 }}>
            {UNDERSTANDING_OPTIONS.map((option) => {
              const selected = understandingScore === option.score
              return (
                <button
                  key={option.label}
                  onClick={() => onUnderstandingScoreChange(option.score)}
                  style={{
                    padding: '10px 8px 9px',
                    borderRadius: 14,
                    border: `1px solid ${selected ? 'rgba(46,184,122,0.3)' : 'rgba(196,154,60,0.12)'}`,
                    background: selected ? option.tone : 'rgba(4,14,8,0.55)',
                    color: selected ? 'rgba(245,228,168,0.94)' : 'rgba(220,200,160,0.66)',
                    cursor: 'pointer',
                    transition: 'all .18s ease',
                  }}
                >
                  <div style={{ fontSize: 18, marginBottom: 6 }}>{option.emoji}</div>
                  <div style={{ fontFamily: PX, fontSize: sSize(4.6), lineHeight: 1.8, letterSpacing: '0.05em' }}>{option.label}</div>
                </button>
              )
            })}
          </div>
          <div style={{
            fontFamily: UI,
            fontSize: sSize(14),
            lineHeight: 1.55,
            color: clarificationNeeded ? 'rgba(255,180,140,0.82)' : 'rgba(220,210,180,0.72)',
            marginBottom: 10,
          }}>
            {understandingHint}
          </div>
          {clarificationNeeded && (
            <button
              onClick={() => setActiveTab('clarify')}
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: 12,
                cursor: 'pointer',
                background: 'rgba(220,170,50,0.08)',
                border: '1px solid rgba(220,170,50,0.18)',
                color: 'rgba(245,228,168,0.88)',
                fontFamily: PX,
                fontSize: sSize(4.6),
                lineHeight: 1.8,
                letterSpacing: '0.06em',
                marginBottom: 8,
              }}
            >
              OPEN CLARIFICATION ↓
            </button>
          )}
          {recallUnlocked && flashcards.length > 0 && (
            <button
              onClick={startRecall}
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: 12,
                cursor: 'pointer',
                background: 'rgba(40,180,120,0.08)',
                border: '1px solid rgba(40,180,120,0.18)',
                color: 'rgba(245,228,168,0.9)',
                fontFamily: PX,
                fontSize: sSize(4.6),
                lineHeight: 1.8,
                letterSpacing: '0.06em',
                marginBottom: canContinue ? 8 : 0,
              }}
            >
              READY FOR RECALL?
            </button>
          )}
          {canContinue && continueLabel && (
            <button
              onClick={() => onContinue?.()}
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: 12,
                cursor: 'pointer',
                background: 'linear-gradient(135deg, rgba(46,184,122,0.18), rgba(232,197,106,0.14))',
                border: '1px solid rgba(46,184,122,0.22)',
                color: 'rgba(245,228,168,0.92)',
                fontFamily: PX,
                fontSize: sSize(4.8),
                lineHeight: 1.8,
                letterSpacing: '0.06em',
              }}
            >
              {continueLabel}
            </button>
          )}
        </div>
      )}

      {activeTab === 'clarify' && (
        <div>
          <div style={{
            padding: '10px 10px 9px',
            borderRadius: 14,
            background: 'rgba(2,9,4,0.42)',
            border: '1px solid rgba(196,154,60,0.08)',
            marginBottom: 8,
          }}>
            <div style={{ fontFamily: PX, fontSize: sSize(4.5), color: 'rgba(200,180,40,0.56)', lineHeight: 1.8, marginBottom: 5, textAlign: 'center' }}>
              WHERE DID YOU GET STUCK?
            </div>
            <div style={{ fontFamily: READING, fontSize: sSize(15), color: 'rgba(235,225,205,0.76)', lineHeight: 1.5, textAlign: 'center' }}>
              Just say the unclear part. We won't redo the whole lesson, just the exact point that tripped you up.
            </div>
          </div>

          <div style={{
            minHeight: 86,
            maxHeight: 160,
            overflowY: 'auto',
            padding: '4px 0',
            borderRadius: 12,
            background: 'rgba(2,9,4,0.42)',
            border: '1px solid rgba(196,154,60,0.08)',
            marginBottom: 8,
          }}>
            {messages.length === 0 && !isTyping ? (
              <div style={{ padding: '10px 10px 9px', textAlign: 'center' }}>
                <div style={{ fontFamily: READING, fontSize: sSize(15), color: 'rgba(245,228,168,0.7)', lineHeight: 1.5, marginBottom: 4 }}>
                  Good example: "I don't get why this is used here".
                </div>
                <div style={{ fontFamily: UI, fontSize: sSize(12), color: 'rgba(196,154,60,0.42)', lineHeight: 1.45 }}>
                  The more specific the question, the better the explanation and flashcards will be.
                </div>
              </div>
            ) : (
              <>
                {messages.map((message) => (
                  <MessageBubble key={message.id} message={message} />
                ))}
                {isTyping && (
                  <MessageBubble
                    message={{ id: -999, role: 'assistant', content: '', created_at: new Date().toISOString() }}
                    isStreaming
                    streamText={streamText}
                  />
                )}
              </>
            )}
          </div>

          <div style={{ display: 'grid', gap: 8 }}>
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  askForHelp()
                }
              }}
              placeholder={placeholder}
              style={{
                minHeight: 58,
                resize: 'vertical',
                borderRadius: 12,
                border: '1px solid rgba(196,154,60,0.14)',
                background: 'rgba(3,9,5,0.82)',
                color: 'rgba(245,228,168,0.9)',
                padding: '10px 12px',
                outline: 'none',
                fontFamily: UI,
                fontSize: sSize(14),
                lineHeight: 1.45,
              }}
            />
            <button
              onClick={askForHelp}
              disabled={!input.trim() || isTyping || !clarificationNeeded}
              style={{
                width: '100%',
                padding: '11px 14px',
                borderRadius: 12,
                cursor: !input.trim() || isTyping || !clarificationNeeded ? 'not-allowed' : 'pointer',
                border: `1px solid ${!input.trim() || isTyping || !clarificationNeeded ? 'rgba(196,154,60,0.08)' : 'rgba(46,184,122,0.22)'}`,
                background: !input.trim() || isTyping || !clarificationNeeded
                  ? 'rgba(46,184,122,0.05)'
                  : 'linear-gradient(135deg, rgba(46,184,122,0.18), rgba(232,197,106,0.14))',
                color: !input.trim() || isTyping || !clarificationNeeded ? 'rgba(245,228,168,0.34)' : 'rgba(245,228,168,0.92)',
                fontFamily: PX,
                fontSize: sSize(4.6),
                lineHeight: 1.8,
                letterSpacing: '0.05em',
              }}
            >
              {isTyping ? 'EXPLAINING...' : askLabel}
            </button>
          </div>

          {hasClarificationResponse && (
            <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
              {flashcards.length > 0 && (
                <button
                  onClick={startRecall}
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    borderRadius: 12,
                    cursor: 'pointer',
                    background: 'rgba(40,180,120,0.08)',
                    border: '1px solid rgba(40,180,120,0.18)',
                    color: 'rgba(245,228,168,0.9)',
                    fontFamily: PX,
                    fontSize: sSize(4.6),
                    lineHeight: 1.8,
                    letterSpacing: '0.06em',
                  }}
                >
                  READY FOR RECALL?
                </button>
              )}
              <div style={{ fontFamily: UI, fontSize: sSize(12), lineHeight: 1.45, color: 'rgba(220,210,180,0.68)', textAlign: 'center' }}>
                You can return anytime to the <span style={{ fontFamily: PX, fontSize: sSize(5.1) }}>SCORE</span> or <span style={{ fontFamily: PX, fontSize: sSize(5.1) }}>RECALL</span> tabs above.
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'recall' && (
        <div>
          {!recallUnlocked ? (
            <div style={{
              padding: '12px 10px',
              borderRadius: 14,
              background: 'rgba(2,9,4,0.42)',
              border: '1px solid rgba(196,154,60,0.08)',
              textAlign: 'center',
            }}>
              <div style={{ fontFamily: PX, fontSize: sSize(4.4), color: 'rgba(200,180,40,0.54)', lineHeight: 1.8, marginBottom: 6 }}>
                RECALL LOCKED
              </div>
              <div style={{ fontFamily: UI, fontSize: sSize(13), color: 'rgba(220,210,180,0.7)', lineHeight: 1.45 }}>
                Choose <strong>CLEAR</strong> or ask for a clarification first to unlock the cards.
              </div>
            </div>
          ) : !recallStarted ? (
            <div style={{
              padding: '12px 10px',
              borderRadius: 14,
              background: 'rgba(2,9,4,0.42)',
              border: '1px solid rgba(196,154,60,0.08)',
              textAlign: 'center',
            }}>
              <div style={{ fontFamily: PX, fontSize: sSize(4.4), color: 'rgba(40,180,120,0.56)', lineHeight: 1.8, marginBottom: 6 }}>
                SHORT RECALL
              </div>
              <div style={{ fontFamily: READING, fontSize: sSize(15), color: 'rgba(245,228,168,0.76)', lineHeight: 1.5, marginBottom: 10 }}>
                Try to answer in your mind before flipping the card. This solidifies better than passive reading.
              </div>
              <button
                onClick={startRecall}
                style={{
                  width: '100%',
                  padding: '11px 14px',
                  borderRadius: 12,
                  cursor: 'pointer',
                  background: 'linear-gradient(135deg, rgba(46,184,122,0.18), rgba(232,197,106,0.14))',
                  border: '1px solid rgba(46,184,122,0.22)',
                  color: 'rgba(245,228,168,0.92)',
                  fontFamily: PX,
                  fontSize: sSize(4.6),
                  lineHeight: 1.8,
                  letterSpacing: '0.06em',
                }}
              >
                START RECALL
              </button>
            </div>
          ) : flashcards.length === 0 ? (
            <div style={{
              padding: '12px 10px',
              borderRadius: 14,
              background: 'rgba(2,9,4,0.42)',
              border: '1px solid rgba(196,154,60,0.08)',
              textAlign: 'center',
            }}>
              <div style={{ fontFamily: PX, fontSize: sSize(4.4), color: 'rgba(200,180,40,0.54)', lineHeight: 1.8, marginBottom: 6 }}>
                PREPARING CARDS
              </div>
              <div style={{ fontFamily: UI, fontSize: sSize(13), color: 'rgba(220,210,180,0.7)', lineHeight: 1.45 }}>
                Just a moment while the focused flashcards arrive.
              </div>
            </div>
          ) : recallFinished ? (
            <div style={{
              padding: '12px 10px',
              borderRadius: 14,
              background: 'rgba(2,9,4,0.42)',
              border: '1px solid rgba(40,180,120,0.12)',
              textAlign: 'center',
            }}>
              <div style={{ fontFamily: PX, fontSize: sSize(4.6), color: 'rgba(40,180,120,0.64)', lineHeight: 1.8, marginBottom: 6 }}>
                RECALL DONE
              </div>
              <div style={{ fontFamily: UI, fontSize: sSize(13), color: 'rgba(220,210,180,0.72)', lineHeight: 1.45, marginBottom: canContinue ? 10 : 0 }}>
                Good. If everything is clear now, set your score to <strong>CLEAR</strong> and move on.
              </div>
              {canContinue && continueLabel && (
                <button
                  onClick={() => onContinue?.()}
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    borderRadius: 12,
                    cursor: 'pointer',
                    background: 'linear-gradient(135deg, rgba(46,184,122,0.18), rgba(232,197,106,0.14))',
                    border: '1px solid rgba(46,184,122,0.22)',
                    color: 'rgba(245,228,168,0.92)',
                    fontFamily: PX,
                    fontSize: sSize(4.7),
                    lineHeight: 1.8,
                    letterSpacing: '0.06em',
                  }}
                >
                  {continueLabel}
                </button>
              )}
            </div>
          ) : activeCard ? (
            <div>
              <div style={{ fontFamily: PX, fontSize: sSize(4.2), color: 'rgba(200,180,40,0.48)', lineHeight: 1.8, textAlign: 'center', marginBottom: 8 }}>
                TRY TO REMEMBER FIRST, THEN FLIP THE CARD
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                {flashcards.map((_, index) => (
                  <div key={index} style={{
                    flex: 1,
                    height: 5,
                    borderRadius: 999,
                    background: index < activeCardIndex
                      ? 'rgba(46,184,122,0.5)'
                      : index === activeCardIndex
                        ? 'rgba(232,197,106,0.54)'
                        : 'rgba(196,154,60,0.12)',
                  }} />
                ))}
              </div>
              <button
                onClick={() => setCardFlipped(prev => !prev)}
                style={{
                  width: '100%',
                  minHeight: 148,
                  padding: '14px 14px 12px',
                  borderRadius: 18,
                  cursor: 'pointer',
                  background: cardFlipped
                    ? 'linear-gradient(145deg, rgba(40,180,120,0.14), rgba(196,154,60,0.1))'
                    : 'linear-gradient(145deg, rgba(196,154,60,0.14), rgba(40,180,120,0.08))',
                  border: `1px solid ${cardFlipped ? 'rgba(40,180,120,0.22)' : 'rgba(196,154,60,0.18)'}`,
                  color: 'rgba(245,228,168,0.92)',
                  textAlign: 'center',
                  marginBottom: 10,
                }}
              >
                <div style={{ fontFamily: PX, fontSize: sSize(4.4), color: 'rgba(200,180,40,0.42)', lineHeight: 1.8, marginBottom: 8 }}>
                  {cardFlipped ? `ANSWER · ${activeCardIndex + 1}/${flashcards.length}` : `QUESTION · ${activeCardIndex + 1}/${flashcards.length}`}
                </div>
                <div style={{ fontFamily: cardFlipped ? UI : READING, fontSize: cardFlipped ? sSize(14) : sSize(17), lineHeight: 1.45, maxWidth: 280, margin: '0 auto' }}>
                  {cardFlipped ? activeCard.back : activeCard.front}
                </div>
              </button>
              <div style={{ display: 'grid', gap: 10 }}>
                <button
                  onClick={() => setCardFlipped(prev => !prev)}
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    borderRadius: 12,
                    cursor: 'pointer',
                    background: 'rgba(196,154,60,0.08)',
                    border: '1px solid rgba(196,154,60,0.16)',
                    color: 'rgba(245,228,168,0.86)',
                    fontFamily: PX,
                    fontSize: sSize(4.5),
                    lineHeight: 1.8,
                    letterSpacing: '0.05em',
                  }}
                >
                  {cardFlipped ? 'HIDE ANSWER' : 'SHOW ANSWER'}
                </button>
                <button
                  onClick={advanceRecall}
                  disabled={!cardFlipped}
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    borderRadius: 12,
                    cursor: cardFlipped ? 'pointer' : 'not-allowed',
                    background: cardFlipped
                      ? 'linear-gradient(135deg, rgba(46,184,122,0.18), rgba(120,210,170,0.14))'
                      : 'rgba(46,184,122,0.05)',
                    border: `1px solid ${cardFlipped ? 'rgba(46,184,122,0.22)' : 'rgba(46,184,122,0.08)'}`,
                    color: cardFlipped ? 'rgba(245,228,168,0.92)' : 'rgba(245,228,168,0.36)',
                    fontFamily: PX,
                    fontSize: sSize(4.6),
                    lineHeight: 1.8,
                    letterSpacing: '0.06em',
                  }}
                >
                  {activeCardIndex + 1 >= flashcards.length ? 'CLOSE SET' : 'NEXT CARD'}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}