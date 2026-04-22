import { useState, useEffect, useRef } from 'react'
import type { LessonQuizQuestion, Lesson } from '../../../../shared/types'
import { useLanguage } from '../contexts/LanguageContext'

interface Props {
  lesson: Lesson
  nextTeaser?: string | null
  onPass: () => void
  onReview: () => void
  onBack: () => void
}

type Phase = 'loading' | 'question' | 'correct' | 'wrong' | 'passed' | 'failed' | 'blocked'

const PX: React.CSSProperties = { fontFamily: "'Press Start 2P', monospace" }

export default function LessonQuiz({ lesson, nextTeaser, onPass, onReview, onBack }: Props) {
  const { t } = useLanguage()
  const [questions, setQuestions] = useState<LessonQuizQuestion[]>([])
  const [phase, setPhase] = useState<Phase>('loading')
  const [currentQ, setCurrentQ] = useState(0)
  const [answer, setAnswer] = useState('')
  const [wrongCount, setWrongCount] = useState(0)
  const [blockedMessage, setBlockedMessage] = useState('')
  const loadRef = useRef(false)

  useEffect(() => {
    if (loadRef.current) return
    loadRef.current = true
    generateQuiz()
  }, [lesson.id])

  const generateQuiz = async () => {
    setPhase('loading')
    try {
      const qs = await window.aura.educator.generateLessonQuiz(lesson.id)
      if (qs && qs.length > 0) {
        setQuestions(qs)
        setCurrentQ(0)
        setAnswer('')
        setWrongCount(0)
        setPhase('question')
      } else {
        onPass()
      }
    } catch (error: any) {
      setBlockedMessage(String(error?.message || t('lessonQuiz.blockedStart')))
      setPhase('blocked')
    } finally {
      loadRef.current = false
    }
  }

  const checkAnswer = () => {
    const q = questions[currentQ]
    if (!q) return

    const userAns = answer.trim().toLowerCase()
    const correctAns = q.correctAnswer.trim().toLowerCase()

    let isCorrect = false
    if (q.type === 'mcq') {
      isCorrect = userAns === correctAns
    } else {
      // For text questions, check keyword overlap
      const keywords = correctAns.split(/\s+/).filter(w => w.length > 2)
      const matched = keywords.filter(kw => userAns.includes(kw))
      isCorrect = matched.length >= Math.max(1, keywords.length * 0.5)
    }

    if (isCorrect) {
      setPhase('correct')
    } else {
      setWrongCount(w => w + 1)
      setPhase('wrong')
    }
  }

  const nextAfterCorrect = async () => {
    const nextIdx = currentQ + 1

    if (nextIdx >= questions.length) {
      // All questions answered correctly
      if (wrongCount > 0) {
        setPhase('failed')
      } else {
        setPhase('passed')
      }
      return
    }

    setCurrentQ(nextIdx)
    setAnswer('')
    setPhase('question')
  }

  const q = questions[currentQ]

  // ── Shared styles ────────────────────────────────
  const card = (color = '196,154,60'): React.CSSProperties => ({
    padding: '18px 20px', borderRadius: '10px',
    background: 'rgba(4,14,8,0.6)',
    border: `1px solid rgba(${color},0.14)`,
    position: 'relative', overflow: 'hidden',
  })

  const accentLine = (color: string): React.CSSProperties => ({
    position: 'absolute', left: 0, top: '18%', bottom: '18%',
    width: '2px', borderRadius: '2px',
    background: `linear-gradient(180deg, transparent, rgba(${color},0.5), transparent)`,
  })

  const btnStyle = (color: string, active = false): React.CSSProperties => ({
    ...PX, fontSize: '6px', lineHeight: 2, letterSpacing: '0.08em',
    padding: '12px 20px', borderRadius: '10px', cursor: 'pointer',
    background: active ? `rgba(${color},0.15)` : `rgba(${color},0.06)`,
    border: `1px solid rgba(${color},${active ? '0.4' : '0.2'})`,
    color: `rgba(${color},${active ? '0.95' : '0.7'})`,
    transition: 'all 0.25s ease',
    boxShadow: active ? `0 0 20px rgba(${color},0.15)` : 'none',
  })

  // ── Loading ────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ textAlign: 'center', animation: 'fadeUp 0.4s ease forwards' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '10px', margin: '0 auto 16px',
            background: 'radial-gradient(circle at 38% 36%, rgba(196,154,60,0.5), rgba(196,154,60,0.12))',
            border: '1px solid rgba(196,154,60,0.28)',
            boxShadow: '0 0 28px rgba(196,154,60,0.18)',
            animation: 'auraPulse 1.4s ease-in-out infinite',
          }} />
          <div style={{ ...PX, fontSize: '6px', color: 'rgba(196,154,60,0.42)', lineHeight: 2, letterSpacing: '0.1em' }}>
            {t('lessonQuiz.loading')}
          </div>
        </div>
      </div>
    )
  }

  // ── Passed — all correct, no mistakes ──────────────
  if (phase === 'passed') {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ textAlign: 'center', animation: 'fadeUp 0.5s cubic-bezier(.16,1,.3,1) forwards' }}>
          <div style={{
            width: '72px', height: '72px', borderRadius: '12px', margin: '0 auto 18px',
            background: 'radial-gradient(circle at 38% 36%, rgba(46,184,122,0.48), rgba(46,184,122,0.12))',
            border: '1px solid rgba(46,184,122,0.28)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '28px',
            boxShadow: '0 0 32px rgba(46,184,122,0.2)',
            animation: 'auraPulse 3s ease-in-out infinite',
          }}>
            🎓
          </div>
          <div style={{ ...PX, fontSize: '11px', color: 'rgba(46,184,122,0.9)', letterSpacing: '0.04em', lineHeight: 1.8, marginBottom: '10px' }}>
            {t('lessonQuiz.passedTitle')}
          </div>
          <div style={{ ...PX, fontSize: '5px', color: 'rgba(196,154,60,0.5)', lineHeight: 2.2, maxWidth: '360px', margin: '0 auto 10px' }}>
            {t('lessonQuiz.passedBody1')}
          </div>
          <div style={{ ...PX, fontSize: '5px', color: 'rgba(245,228,168,0.6)', lineHeight: 2.4, maxWidth: '360px', margin: '0 auto 20px' }}>
            {t('lessonQuiz.passedBody2')}
          </div>
          {nextTeaser && (
            <div style={{
              maxWidth: '360px',
              margin: '0 auto 18px',
              padding: '12px 14px',
              borderRadius: '12px',
              background: 'rgba(196,154,60,0.06)',
              border: '1px solid rgba(196,154,60,0.14)',
            }}>
              <div style={{ ...PX, fontSize: '4px', color: 'rgba(200,180,40,0.46)', lineHeight: 2, letterSpacing: '0.1em', marginBottom: '6px' }}>
                {t('lessonQuiz.afterPractice')}
              </div>
              <div style={{ ...PX, fontSize: '5px', color: 'rgba(245,228,168,0.74)', lineHeight: 2.2 }}>
                {nextTeaser}
              </div>
            </div>
          )}
          <button onClick={onPass} style={btnStyle('46,184,122', true)}>
            {t('lessonQuiz.enterPractice')} →
          </button>
        </div>
      </div>
    )
  }

  // ── Failed — had wrong answers, must re-read ───────
  if (phase === 'failed') {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ textAlign: 'center', animation: 'fadeUp 0.5s cubic-bezier(.16,1,.3,1) forwards', maxWidth: '400px' }}>
          <div style={{
            width: '72px', height: '72px', borderRadius: '12px', margin: '0 auto 18px',
            background: 'radial-gradient(circle at 38% 36%, rgba(220,170,50,0.48), rgba(220,170,50,0.12))',
            border: '1px solid rgba(220,170,50,0.28)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '28px',
            boxShadow: '0 0 32px rgba(220,170,50,0.2)',
          }}>
            📖
          </div>
          <div style={{ ...PX, fontSize: '9px', color: 'rgba(220,170,50,0.9)', letterSpacing: '0.04em', lineHeight: 1.8, marginBottom: '10px' }}>
            {t('lessonQuiz.failedTitle')}
          </div>
          <div style={{ ...PX, fontSize: '5px', color: 'rgba(196,154,60,0.4)', lineHeight: 2.4, maxWidth: '360px', margin: '0 auto 24px' }}>
            {t('lessonQuiz.failedBody', {
              count: wrongCount,
              label: wrongCount === 1 ? t('lessonQuiz.questionSingular') : t('lessonQuiz.questionPlural'),
            })}
          </div>
          <div style={{ ...PX, fontSize: '5px', color: 'rgba(245,228,168,0.48)', lineHeight: 2.2, maxWidth: '360px', margin: '0 auto 20px' }}>
            {t('lessonQuiz.failedBody2')}
          </div>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button onClick={onReview} style={btnStyle('232,197,106', true)}>
              ← {t('lessonQuiz.rereadLesson')}
            </button>
            <button onClick={onBack} style={btnStyle('196,154,60')}>
              {t('lessonQuiz.backToModule')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (phase === 'blocked') {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ textAlign: 'center', animation: 'fadeUp 0.5s cubic-bezier(.16,1,.3,1) forwards', maxWidth: '420px' }}>
          <div style={{
            width: '72px', height: '72px', borderRadius: '12px', margin: '0 auto 18px',
            background: 'radial-gradient(circle at 38% 36%, rgba(220,170,50,0.48), rgba(220,170,50,0.12))',
            border: '1px solid rgba(220,170,50,0.28)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '28px',
            boxShadow: '0 0 32px rgba(220,170,50,0.2)',
          }}>
            ⏳
          </div>
          <div style={{ ...PX, fontSize: '9px', color: 'rgba(220,170,50,0.9)', letterSpacing: '0.04em', lineHeight: 1.8, marginBottom: '10px' }}>
            {t('lessonQuiz.blockedTitle')}
          </div>
          <div style={{ ...PX, fontSize: '5px', color: 'rgba(245,228,168,0.62)', lineHeight: 2.4, maxWidth: '360px', margin: '0 auto 24px', whiteSpace: 'pre-wrap' }}>
            {blockedMessage}
          </div>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button onClick={onReview} style={btnStyle('232,197,106', true)}>
              ← {t('lessonQuiz.backToLesson')}
            </button>
            <button onClick={onBack} style={btnStyle('196,154,60')}>
              {t('lessonQuiz.backToModule')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Correct answer feedback ────────────────────────
  if (phase === 'correct' && q) {
    return (
      <div style={{ flex: 1, overflowY: 'auto', padding: '30px 42px 40px', scrollbarWidth: 'thin', scrollbarColor: 'rgba(196,154,60,0.1) transparent' }}>
        <div style={{ maxWidth: '480px', margin: '0 auto', animation: 'fadeUp 0.4s ease forwards' }}>
          {/* Progress */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
            {questions.map((_, i) => (
              <div key={i} style={{
                flex: 1, height: '4px', borderRadius: '2px',
                background: i <= currentQ ? 'rgba(46,184,122,0.5)' : 'rgba(196,154,60,0.1)',
                transition: 'background 0.3s',
              }} />
            ))}
          </div>

          <div style={{ ...card('46,184,122'), textAlign: 'center' }}>
            <div style={accentLine('46,184,122')} />
            <div style={{ fontSize: '28px', marginBottom: '12px' }}>✓</div>
            <div style={{ ...PX, fontSize: '8px', color: 'rgba(46,184,122,0.9)', lineHeight: 2, marginBottom: '8px' }}>
              {t('lessonQuiz.correct')}
            </div>
            <div style={{ ...PX, fontSize: '5px', color: 'rgba(196,154,60,0.35)', lineHeight: 2 }}>
              {currentQ + 1} / {questions.length}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '20px' }}>
            <button onClick={nextAfterCorrect} style={btnStyle('46,184,122', true)}>
              {currentQ + 1 >= questions.length ? `${t('lessonQuiz.seeResult')} →` : `${t('lessonQuiz.next')} →`}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Wrong answer — show hint & remind ──────────────
  if (phase === 'wrong' && q) {
    return (
      <div style={{ flex: 1, overflowY: 'auto', padding: '30px 42px 40px', scrollbarWidth: 'thin', scrollbarColor: 'rgba(196,154,60,0.1) transparent' }}>
        <div style={{ maxWidth: '480px', margin: '0 auto', animation: 'fadeUp 0.4s ease forwards' }}>
          {/* Progress */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
            {questions.map((_, i) => (
              <div key={i} style={{
                flex: 1, height: '4px', borderRadius: '2px',
                background: i < currentQ ? 'rgba(46,184,122,0.5)' : i === currentQ ? 'rgba(220,80,80,0.5)' : 'rgba(196,154,60,0.1)',
                transition: 'background 0.3s',
              }} />
            ))}
          </div>

          {/* Wrong answer card */}
          <div style={{ ...card('220,80,80'), marginBottom: '12px' }}>
            <div style={accentLine('220,80,80')} />
            <div style={{ fontSize: '20px', marginBottom: '10px', textAlign: 'center' }}>✗</div>
            <div style={{ ...PX, fontSize: '7px', color: 'rgba(220,80,80,0.85)', lineHeight: 2, marginBottom: '10px', textAlign: 'center' }}>
              {t('lessonQuiz.wrong')}
            </div>
            <div style={{ ...PX, fontSize: '5px', color: 'rgba(196,154,60,0.35)', lineHeight: 2, marginBottom: '6px' }}>
              {t('lessonQuiz.correctAnswer')}
            </div>
            <div style={{ ...PX, fontSize: '6px', color: 'rgba(46,184,122,0.8)', lineHeight: 2, marginBottom: '4px' }}>
              {q.correctAnswer}
            </div>
          </div>

          {/* Hint / Reminder card */}
          <div style={{ ...card('232,197,106'), marginBottom: '18px' }}>
            <div style={accentLine('232,197,106')} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <span style={{ fontSize: '16px' }}>💡</span>
              <span style={{ ...PX, fontSize: '5px', color: 'rgba(232,197,106,0.5)', letterSpacing: '0.12em', lineHeight: 2 }}>
                {t('lessonQuiz.reminder')}
              </span>
            </div>
            <div style={{ ...PX, fontSize: '6px', color: 'rgba(245,228,168,0.7)', lineHeight: 2.4 }}>
              {q.hint || t('lessonQuiz.hintFallback')}
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center' }}>
            <button onClick={onReview} style={{ ...btnStyle('232,197,106', true), width: '100%', maxWidth: '320px' }}>
              ← {t('lessonQuiz.rereadLesson')}
            </button>
            <button
              onClick={() => {
                setCurrentQ(prev => prev + 1 >= questions.length ? prev : prev + 1)
                setAnswer('')
                if (currentQ + 1 >= questions.length) {
                  setPhase('failed')
                } else {
                  setPhase('question')
                }
              }}
              style={{ ...btnStyle('196,154,60'), width: '100%', maxWidth: '320px' }}
            >
              {t('lessonQuiz.continueQuiz')} →
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Question view ──────────────────────────────────
  if (!q) return null

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '30px 42px 40px', scrollbarWidth: 'thin', scrollbarColor: 'rgba(196,154,60,0.1) transparent' }}>
      <div style={{ maxWidth: '480px', margin: '0 auto', animation: 'fadeUp 0.4s ease forwards' }}>

        {/* Back button */}
        <button onClick={onBack} style={{
          ...PX, fontSize: '6px', color: 'rgba(196,154,60,0.30)', cursor: 'pointer',
          marginBottom: '20px', display: 'inline-flex', alignItems: 'center', gap: '8px',
          transition: 'color 0.2s', letterSpacing: '0.08em', lineHeight: 2,
          background: 'none', border: 'none', padding: 0,
        }}>
          {t('lessonQuiz.back')}
        </button>

        {/* Quiz header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '5px 12px', borderRadius: '5px',
            background: 'rgba(196,154,60,0.06)',
            border: '1px solid rgba(196,154,60,0.14)',
            ...PX, fontSize: '5px', color: 'rgba(196,154,60,0.30)', lineHeight: 2, letterSpacing: '0.08em',
          }}>
            📝 {t('lessonQuiz.header', { num: lesson.order_num })}
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
          {questions.map((_, i) => (
            <div key={i} style={{
              flex: 1, height: '4px', borderRadius: '2px',
              background: i < currentQ ? 'rgba(46,184,122,0.5)' : i === currentQ
                ? 'rgba(232,197,106,0.5)' : 'rgba(196,154,60,0.1)',
              transition: 'background 0.3s',
            }} />
          ))}
          <span style={{ ...PX, fontSize: '5px', color: 'rgba(196,154,60,0.3)', lineHeight: 2 }}>
            {currentQ + 1}/{questions.length}
          </span>
        </div>

        {/* Question card */}
        <div style={{ ...card(), marginBottom: '16px' }}>
          <div style={accentLine('232,197,106')} />
          <div style={{ ...PX, fontSize: '7px', color: 'rgba(245,228,168,0.85)', lineHeight: 2.4 }}>
            {q.question}
          </div>
        </div>

        {/* MCQ options */}
        {q.type === 'mcq' && q.options && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
            {q.options.map((opt, oi) => {
              const isSelected = answer === opt
              return (
                <button
                  key={oi}
                  onClick={() => setAnswer(opt)}
                  style={{
                    ...PX, fontSize: '6px', lineHeight: 2, textAlign: 'left',
                    padding: '12px 16px', borderRadius: '10px',
                    background: isSelected ? 'rgba(232,197,106,0.08)' : 'rgba(4,14,8,0.4)',
                    border: `1px solid ${isSelected ? 'rgba(232,197,106,0.3)' : 'rgba(196,154,60,0.1)'}`,
                    color: isSelected ? 'rgba(245,228,168,0.9)' : 'rgba(220,190,140,0.5)',
                    cursor: 'pointer', transition: 'all 0.2s ease',
                    boxShadow: isSelected ? '0 0 16px rgba(232,197,106,0.1)' : 'none',
                  }}
                  onMouseEnter={e => {
                    if (!isSelected) {
                      e.currentTarget.style.borderColor = 'rgba(196,154,60,0.2)'
                      e.currentTarget.style.color = 'rgba(245,228,168,0.7)'
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isSelected) {
                      e.currentTarget.style.borderColor = 'rgba(196,154,60,0.1)'
                      e.currentTarget.style.color = 'rgba(220,190,140,0.5)'
                    }
                  }}
                >
                  {String.fromCharCode(65 + oi)}) {opt}
                </button>
              )
            })}
          </div>
        )}

        {/* Text input */}
        {q.type === 'text' && (
          <div style={{ marginBottom: '16px' }}>
            <input
              type="text"
              value={answer}
              onChange={e => setAnswer(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && answer.trim() && checkAnswer()}
              placeholder={t('lessonQuiz.answerPlaceholder')}
              style={{
                ...PX, fontSize: '6px', lineHeight: 2,
                width: '100%', padding: '12px 16px', borderRadius: '10px',
                background: 'rgba(4,14,8,0.6)',
                border: '1px solid rgba(196,154,60,0.14)',
                color: 'rgba(245,228,168,0.85)',
                outline: 'none', transition: 'border-color 0.2s',
              }}
              onFocus={e => e.currentTarget.style.borderColor = 'rgba(232,197,106,0.3)'}
              onBlur={e => e.currentTarget.style.borderColor = 'rgba(196,154,60,0.14)'}
            />
          </div>
        )}

        {/* Submit button */}
        <button
          onClick={checkAnswer}
          disabled={!answer.trim()}
          style={{
            ...btnStyle('46,184,122', !!answer.trim()),
            width: '100%',
            opacity: answer.trim() ? 1 : 0.4,
            cursor: answer.trim() ? 'pointer' : 'not-allowed',
          }}
        >
          {t('lessonQuiz.checkAnswer')} →
        </button>
      </div>
    </div>
  )
}
