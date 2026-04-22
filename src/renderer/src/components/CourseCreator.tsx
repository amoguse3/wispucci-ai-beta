import { useState, useEffect, useRef } from 'react'
import type { CourseFamiliarity, CourseIntakeQuestion, CourseIntakeSession } from '../../../../shared/types'
import { useLanguage } from '../contexts/LanguageContext'

interface Props {
  onBack: () => void
  onCourseCreated: () => void
  onCourseGenerated?: () => void
  initialTopic?: string
}

function extractIntakeExamples(placeholder?: string): string[] {
  return String(placeholder || '')
    .replace(/^(example|exemplu|например)\s*:\s*/i, '')
    .split(',')
    .map((item) => item.replace(/\.\.\.$/, '').trim())
    .filter((item) => item.length >= 4)
    .slice(0, 4)
}

export default function CourseCreator({ onBack, onCourseCreated, onCourseGenerated, initialTopic }: Props) {
  const { t } = useLanguage()
  const [topic, setTopic] = useState('')
  const [familiarity, setFamiliarity] = useState<CourseFamiliarity>('unsure')
  const [intakeSession, setIntakeSession] = useState<CourseIntakeSession | null>(null)
  const [intakeQuestionHistory, setIntakeQuestionHistory] = useState<CourseIntakeQuestion[]>([])
  const [intakeAnswers, setIntakeAnswers] = useState<Record<string, string>>({})
  const [loadingQuestions, setLoadingQuestions] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [streamText, setStreamText] = useState('')
  const [started, setStarted] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const [progress, setProgress] = useState(0)
  const unsubRef = useRef<(() => void) | null>(null)
  const logRef = useRef<HTMLDivElement>(null)
  const generateButtonRef = useRef<HTMLButtonElement>(null)
  const intakePanelRef = useRef<HTMLDivElement>(null)
  const activeJobIdRef = useRef<number | null>(null)
  const intakeReady = intakeSession?.status === 'ready'
  const currentIntakeComplete = !!intakeSession && intakeSession.questions.every((question) => Boolean((intakeAnswers[question.id] || '').trim()))

  useEffect(() => {
    return () => { unsubRef.current?.() }
  }, [])

  useEffect(() => {
    if (!initialTopic) return
    setTopic(initialTopic)
  }, [initialTopic])

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [streamText])

  useEffect(() => {
    if (!topic.trim() || generating || loadingQuestions || started || blocked || intakeSession) return

    const timeoutId = window.setTimeout(() => {
      generateButtonRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    }, 420)

    return () => window.clearTimeout(timeoutId)
  }, [topic, generating, loadingQuestions, started, blocked, intakeSession])

  useEffect(() => {
    if (!intakeSession || intakeReady || generating || started || blocked) return

    const timeoutId = window.setTimeout(() => {
      intakePanelRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    }, 120)

    return () => window.clearTimeout(timeoutId)
  }, [intakeSession, intakeReady, generating, started, blocked])

  const mergeQuestionHistory = (questions: CourseIntakeQuestion[]) => {
    setIntakeQuestionHistory((prev) => {
      const seen = new Set(prev.map((question) => question.id))
      const next = [...prev]
      for (const question of questions) {
        if (seen.has(question.id)) continue
        seen.add(question.id)
        next.push(question)
      }
      return next
    })
  }

  const buildIntakeAnswerPayload = () => intakeQuestionHistory.map((question) => ({
    questionId: question.id,
    question: question.question,
    answer: intakeAnswers[question.id] || '',
  }))

  const applyIntakeExample = (questionId: string, example: string) => {
    setIntakeAnswers((prev) => {
      const current = (prev[questionId] || '').trim()
      if (!current) {
        return { ...prev, [questionId]: example }
      }
      if (current.toLowerCase().includes(example.toLowerCase())) {
        return prev
      }
      const separator = /[.!?]$/.test(current) ? ' ' : '; '
      return { ...prev, [questionId]: `${current}${separator}${example}` }
    })
  }

  const beginIntake = async () => {
    if (!topic.trim() || generating || loadingQuestions) return

    setBlocked(false)
    setLoadingQuestions(true)
    setStreamText('')

    try {
      const session = await window.aura.educator.startCourseIntake({ topic: topic.trim(), familiarity })
      setIntakeSession(session)
      setIntakeQuestionHistory(session.questions)
      setIntakeAnswers(Object.fromEntries(session.questions.map((question) => [question.id, ''])))
    } catch (error: any) {
      setBlocked(true)
      setStreamText(String(error?.message || t('creator.blocked')))
    } finally {
      setLoadingQuestions(false)
    }
  }

  const continueIntake = async () => {
    if (!topic.trim() || generating || loadingQuestions || !intakeSession || !currentIntakeComplete) return

    setBlocked(false)
    setLoadingQuestions(true)
    try {
      const session = await window.aura.educator.continueCourseIntake(intakeSession.id, {
        topic: topic.trim(),
        familiarity,
        intakeSessionId: intakeSession.id,
        intakeAnswers: buildIntakeAnswerPayload(),
      })
      setIntakeSession(session)
      mergeQuestionHistory(session.questions)
      setIntakeAnswers((prev) => {
        const next = { ...prev }
        for (const question of session.questions) {
          if (next[question.id] !== undefined) continue
          next[question.id] = ''
        }
        return next
      })
    } catch (error: any) {
      setBlocked(true)
      setStreamText(String(error?.message || t('creator.blocked')))
    } finally {
      setLoadingQuestions(false)
    }
  }

  const generate = async () => {
    if (!topic.trim() || generating || (intakeSession && !intakeReady)) return
    unsubRef.current?.()
    setGenerating(true)
    setStreamText('')
    setStarted(false)
    setBlocked(false)
    setProgress(0)
    activeJobIdRef.current = null

    unsubRef.current = window.aura.educator.onCourseGenToken((data) => {
      if (data.jobId && activeJobIdRef.current && data.jobId !== activeJobIdRef.current) return

      if (typeof data.progress === 'number') {
        setProgress((prev) => Math.max(prev, data.progress || 0))
      }

      if (data.token) {
        setStreamText(prev => prev + data.token)
      }

      if (data.done && data.status === 'failed') {
        setGenerating(false)
        setStarted(false)
        setBlocked(true)
        setProgress(0)
        if (data.error && !data.token) {
          setStreamText(data.error)
        }
      }
    })

    try {
      const result = await window.aura.educator.generateCourse({
        topic: topic.trim(),
        familiarity,
        intakeSessionId: intakeSession?.id,
        intakeAnswers: buildIntakeAnswerPayload(),
      })
      if (!result.accepted) {
        setGenerating(false)
        setBlocked(true)
        setStreamText(result.message || t('creator.blocked'))
        return
      }

      activeJobIdRef.current = result.jobId || null
      setGenerating(false)
      setStarted(true)
      setProgress(100)
      onCourseGenerated?.()
    } catch (error: any) {
      setGenerating(false)
      setBlocked(true)
      setStreamText(String(error?.message || t('creator.blocked')))
    }
  }

  const SUGGESTIONS = [
    t('creator.suggestion.python'),
    t('creator.suggestion.english'),
    t('creator.suggestion.investing'),
    t('creator.suggestion.uiux'),
    t('creator.suggestion.marketing'),
    t('creator.suggestion.ml'),
    t('creator.suggestion.adhd'),
    t('creator.suggestion.rust'),
    t('creator.suggestion.crypto'),
  ]

  const FAMILIARITIES: Array<{ code: CourseFamiliarity; label: string; note: string }> = [
    { code: 'new', label: t('creator.familiarity.new.label'), note: t('creator.familiarity.new.note') },
    { code: 'rusty', label: t('creator.familiarity.rusty.label'), note: t('creator.familiarity.rusty.note') },
    { code: 'comfortable', label: t('creator.familiarity.comfortable.label'), note: t('creator.familiarity.comfortable.note') },
    { code: 'strong', label: t('creator.familiarity.strong.label'), note: t('creator.familiarity.strong.note') },
    { code: 'unsure', label: t('creator.familiarity.unsure.label'), note: t('creator.familiarity.unsure.note') },
  ]

  return (
    <div className="flex-1 overflow-y-auto aura-creator-scroll">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');
        .aura-creator-px * { font-family: 'Press Start 2P', monospace !important; }
        .aura-creator-scroll { scrollbar-width: thin; scrollbar-color: rgba(196,154,60,0.1) transparent; }
        .aura-creator-scroll::-webkit-scrollbar { width: 4px; }
        .aura-creator-scroll::-webkit-scrollbar-thumb { background: rgba(196,154,60,0.1); border-radius: 4px; }

        .px-seed-core {
          width: 100%; height: 100%;
          border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%;
          background: radial-gradient(circle at 40% 38%, rgba(196,154,60,0.6) 0%, rgba(13,61,46,0.38) 50%, rgba(3,13,6,0.55) 100%);
          border: 1px solid rgba(196,154,60,0.28);
          box-shadow: 0 0 30px rgba(196,154,60,0.18);
          animation: pxSeedBreathe 4s ease-in-out infinite;
        }
        @keyframes pxSeedBreathe {
          0%,100% { transform: scale(1); box-shadow: 0 0 30px rgba(196,154,60,0.18); }
          50%      { transform: scale(1.06); box-shadow: 0 0 48px rgba(196,154,60,0.28); }
        }
        .px-gen-ring {
          position: absolute; inset: -10px; border-radius: 50%;
          border: 1px solid transparent; border-top-color: rgba(196,154,60,0.44);
          animation: pxSpinRing 2s linear infinite;
        }
        @keyframes pxSpinRing { to { transform: rotate(360deg); } }
        .px-growing-seed { animation: pxGrowSeed 7s ease-in-out forwards; }
        @keyframes pxGrowSeed {
          0%   { transform: scale(1); }
          60%  { transform: scale(1.1); }
          100% { transform: scale(1.16); filter: drop-shadow(0 0 22px rgba(46,184,122,0.35)); }
        }
        .px-growing-seed .px-seed-core { animation: pxSeedGrow 7s ease-in-out forwards; }
        @keyframes pxSeedGrow {
          0%   { background: radial-gradient(circle at 40% 38%, rgba(196,154,60,0.6) 0%, rgba(13,61,46,0.38) 50%, rgba(3,13,6,0.55) 100%); }
          100% { background: radial-gradient(circle at 40% 38%, rgba(46,184,122,0.55) 0%, rgba(13,61,46,0.44) 50%, rgba(3,13,6,0.55) 100%); }
        }
        .px-chip {
          padding: 6px 11px; border-radius: 5px;
          background: rgba(4,13,8,0.55); border: 1px solid rgba(196,154,60,0.11);
          font-size: 6px !important; color: rgba(196,154,60,0.3); cursor: pointer; transition: all 0.2s;
          line-height: 2;
        }
        .px-chip:hover, .px-chip.active {
          background: rgba(196,154,60,0.09); border-color: rgba(196,154,60,0.26); color: rgba(232,197,106,0.8);
        }
        .px-input-wrap {
          background: rgba(4,13,8,0.8);
          border: 1px solid rgba(196,154,60,0.14); border-radius: 10px;
          padding: 14px 16px; margin-bottom: 14px; transition: all 0.38s;
        }
        .px-input-wrap:focus-within {
          border-color: rgba(196,154,60,0.32);
          box-shadow: 0 0 32px rgba(196,154,60,0.09);
        }
        .px-input-wrap input::placeholder { color: rgba(196,154,60,0.22) !important; }
        .px-input-wrap textarea::placeholder { color: rgba(196,154,60,0.22) !important; }
        .px-gen-btn {
          width: 100%; padding: 16px; border-radius: 10px;
          background: linear-gradient(135deg, rgba(196,154,60,0.16), rgba(13,61,46,0.22));
          border: 1px solid rgba(196,154,60,0.26);
          color: rgba(232,197,106,0.92);
          font-size: 7px !important; cursor: pointer;
          transition: all 0.3s; box-shadow: 0 4px 22px rgba(0,0,0,0.24);
          line-height: 2;
        }
        .px-gen-btn:hover:not(:disabled) {
          border-color: rgba(232,197,106,0.42);
          box-shadow: 0 0 68px rgba(196,154,60,0.16), 0 8px 34px rgba(0,0,0,0.3);
          transform: translateY(-2px);
        }
        .px-gen-btn:disabled { opacity: 0.35; cursor: not-allowed; }
        .px-gen-log {
          background: rgba(3,9,5,0.75); border: 1px solid rgba(196,154,60,0.1);
          border-radius: 10px; padding: 16px;
          font-size: 7px !important; color: rgba(196,154,60,0.44); line-height: 2;
          white-space: pre-wrap; max-height: 200px; overflow-y: auto;
          text-align: left; margin-top: 18px;
        }
        .px-done-orb {
          width: 72px; height: 72px; margin: 0 auto 22px; border-radius: 10px;
          background: radial-gradient(circle at 40% 38%,rgba(46,184,122,0.48),rgba(13,61,46,0.34));
          border: 1px solid rgba(46,184,122,0.28);
          display: flex; align-items: center; justify-content: center; font-size: 30px;
          box-shadow: 0 0 32px rgba(46,184,122,0.24);
          animation: pxSeedBreathe 3s ease-in-out infinite;
        }
        .px-done-btn {
          padding: 14px 28px; border-radius: 8px;
          background: linear-gradient(135deg,rgba(196,154,60,0.14),rgba(13,61,46,0.22));
          border: 1px solid rgba(196,154,60,0.26);
          color: rgba(232,197,106,0.9);
          font-size: 7px !important; cursor: pointer; transition: all 0.3s; line-height: 2;
        }
        .px-done-btn:hover { border-color: rgba(232,197,106,0.4); transform: translateY(-2px); }
        .px-fadeUp { animation: pxFadeUp 0.5s cubic-bezier(.16,1,.3,1) forwards; }
        @keyframes pxFadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .px-back-btn { font-size: 6px !important; color: rgba(196,154,60,0.3); cursor: pointer; transition: color 0.2s; letter-spacing: 0.08em; line-height: 2; }
        .px-back-btn:hover { color: rgba(232,197,106,0.58); }
        .px-progress-ring-track { stroke: rgba(196,154,60,0.08); }
        .px-progress-ring-fill { stroke: rgba(196,154,60,0.4); transition: stroke-dashoffset 0.5s ease; }
      `}</style>

      <div data-tutorial="course-creator-panel" className="aura-creator-px" style={{ maxWidth: 500, margin: '0 auto', padding: '28px 18px' }}>
        <div className="px-back-btn mb-5" onClick={onBack}>{t('creator.back')}</div>

        {/* INPUT STAGE */}
        {!generating && !started && !blocked && !intakeSession && (
          <div className="px-fadeUp">
            {/* Seed visual */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 28 }}>
              <div style={{ width: 80, height: 80, margin: '0 auto 22px', position: 'relative' }}>
                <div className="px-seed-core" />
                <div style={{
                  position: 'absolute', top: -8, left: '50%', transform: 'translateX(-50%)',
                  width: 2, height: 10,
                  background: 'linear-gradient(180deg, rgba(46,184,122,0.54), transparent)',
                  borderRadius: 2,
                }} />
                <svg style={{ position: 'absolute', bottom: -10, left: '50%', transform: 'translateX(-50%)', width: 50, height: 12, opacity: 0.38 }}
                  viewBox="0 0 50 12" fill="none">
                  <path d="M25 0 Q15 8 5 10" stroke="rgba(196,154,60,0.44)" strokeWidth="1.2" strokeLinecap="round"/>
                  <path d="M25 0 Q35 8 45 10" stroke="rgba(196,154,60,0.44)" strokeWidth="1.2" strokeLinecap="round"/>
                  <path d="M25 0 Q20 6 12 12" stroke="rgba(196,154,60,0.27)" strokeWidth="0.8" strokeLinecap="round"/>
                  <path d="M25 0 Q30 6 38 12" stroke="rgba(196,154,60,0.27)" strokeWidth="0.8" strokeLinecap="round"/>
                </svg>
              </div>
            </div>

            <div style={{ fontSize: '11px', textAlign: 'center', marginBottom: 10, color: 'rgba(245,228,168,0.93)', lineHeight: 2, textShadow: '0 0 26px rgba(196,154,60,0.25)' }}>
              {t('creator.heroTitle')}
            </div>
            <div style={{ fontSize: '6px', color: 'rgba(196,154,60,0.3)', textAlign: 'center', marginBottom: 28, lineHeight: 2.2 }}>
              {t('creator.heroSubtitle')}
            </div>

            {/* Input */}
            <div className="px-input-wrap">
              <input
                data-tutorial="course-topic-input"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && generate()}
                placeholder={t('creator.placeholder')}
                autoFocus
                style={{
                  width: '100%', background: 'transparent', border: 'none', outline: 'none',
                  fontSize: '8px', color: 'rgba(245,228,168,0.9)', lineHeight: 2,
                  fontFamily: "'Press Start 2P', monospace",
                }}
              />
            </div>

            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: '5px', color: 'rgba(196,154,60,0.3)', marginBottom: 10, lineHeight: 2.2, textAlign: 'center' }}>
                {t('creator.familiarityPrompt')}
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                {FAMILIARITIES.map((item) => (
                  <button
                    key={item.code}
                    type="button"
                    onClick={() => setFamiliarity(item.code)}
                    className={`px-chip${familiarity === item.code ? ' active' : ''}`}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      textAlign: 'left',
                      padding: '10px 12px',
                    }}
                  >
                    <span>{item.label}</span>
                    <span style={{ color: familiarity === item.code ? 'rgba(245,228,168,0.72)' : 'rgba(196,154,60,0.24)' }}>{item.note}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Chips */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 24 }}>
              {SUGGESTIONS.map(s => (
                <button key={s} className={`px-chip${topic === s ? ' active' : ''}`} onClick={() => setTopic(s)}>
                  {s}
                </button>
              ))}
            </div>

            {/* Generate button */}
            <button ref={generateButtonRef} data-tutorial="course-intake-continue-button" onClick={beginIntake} disabled={!topic.trim() || loadingQuestions} className="px-gen-btn">
              🌱&nbsp; {loadingQuestions ? t('creator.preparingQuestions') : t('creator.continue')}
            </button>
          </div>
        )}

        {!generating && !started && !blocked && !!intakeSession && (
          <div className="px-fadeUp">
            <div className="px-back-btn mb-5" onClick={() => { setIntakeSession(null); setIntakeQuestionHistory([]); setIntakeAnswers({}) }}>
              {t('creator.editTopic')}
            </div>

            <div style={{ fontSize: '11px', textAlign: 'center', marginBottom: 10, color: 'rgba(245,228,168,0.93)', lineHeight: 2, textShadow: '0 0 26px rgba(196,154,60,0.25)' }}>
              {t('creator.intakeTitle')}
            </div>
            <div style={{ fontSize: '6px', color: 'rgba(196,154,60,0.3)', textAlign: 'center', marginBottom: 24, lineHeight: 2.2 }}>
              {t('creator.intakeSubtitle')}
            </div>

            {!!intakeSession.summary && (
              <div className="px-input-wrap" style={{ marginBottom: 18 }}>
                <div style={{ fontSize: '5px', color: 'rgba(196,154,60,0.34)', marginBottom: 10, lineHeight: 2 }}>
                  {intakeReady ? t('creator.intakeReadySummaryLabel') : t('creator.intakeProgressSummaryLabel')}
                </div>
                <div style={{ fontSize: '6px', color: 'rgba(245,228,168,0.86)', lineHeight: 2.1 }}>
                  {intakeSession.summary}
                </div>
              </div>
            )}

            {!intakeReady && (
              <div ref={intakePanelRef} data-tutorial="course-intake-panel" style={{ display: 'grid', gap: 12, marginBottom: 22 }}>
                {intakeSession.questions.map((question, index) => (
                  <div key={question.id} className="px-input-wrap" style={{ marginBottom: 0 }}>
                    <div style={{ fontSize: '6px', color: 'rgba(245,228,168,0.84)', marginBottom: 10, lineHeight: 2 }}>
                      {question.question}
                    </div>
                    <textarea
                      data-tutorial={index === 0 ? 'course-intake-answer-0' : undefined}
                      value={intakeAnswers[question.id] || ''}
                      onChange={(event) => setIntakeAnswers((prev) => ({ ...prev, [question.id]: event.target.value }))}
                      placeholder={question.placeholder || t('creator.placeholder')}
                      rows={3}
                      style={{
                        width: '100%',
                        background: 'transparent',
                        border: 'none',
                        outline: 'none',
                        resize: 'vertical',
                        fontSize: '7px',
                        color: 'rgba(245,228,168,0.9)',
                        lineHeight: 1.9,
                        fontFamily: "'Press Start 2P', monospace",
                      }}
                    />
                    {extractIntakeExamples(question.placeholder).length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 10 }}>
                        {extractIntakeExamples(question.placeholder).map((example) => (
                          <button
                            key={`${question.id}-${example}`}
                            type="button"
                            className={`px-chip${(intakeAnswers[question.id] || '').toLowerCase().includes(example.toLowerCase()) ? ' active' : ''}`}
                            onClick={() => applyIntakeExample(question.id, example)}
                          >
                            {example}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {intakeReady ? (
              <button data-tutorial="course-generate-button" onClick={generate} className="px-gen-btn">
                🌱&nbsp; {t('creator.generateCourse')}
              </button>
            ) : (
              <button
                data-tutorial="course-intake-continue-button"
                onClick={continueIntake}
                disabled={!currentIntakeComplete || loadingQuestions}
                className="px-gen-btn"
              >
                🌱&nbsp; {loadingQuestions ? t('creator.preparingQuestions') : t('creator.continue')}
              </button>
            )}
          </div>
        )}

        {/* GENERATING */}
        {generating && (
          <div className="px-fadeUp">
            <div style={{ textAlign: 'center', padding: '34px 18px' }}>
              {/* Progress ring */}
              <div style={{ position: 'relative', width: 80, height: 80, margin: '0 auto 20px' }}>
                <svg style={{ width: 80, height: 80, transform: 'rotate(-90deg)' }} viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="35" fill="none" stroke="rgba(196,154,60,0.08)" strokeWidth="2" />
                  <circle cx="40" cy="40" r="35" fill="none" stroke="rgba(196,154,60,0.4)" strokeWidth="2"
                    strokeDasharray={`${2 * Math.PI * 35}`}
                    strokeDashoffset={`${2 * Math.PI * 35 * (1 - progress / 100)}`}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 0.5s ease' }} />
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div className="px-growing-seed" style={{ width: 48, height: 48, position: 'relative' }}>
                    <div className="px-seed-core" />
                    <div className="px-gen-ring" />
                  </div>
                </div>
              </div>

              <div style={{ fontSize: '8px', color: 'rgba(196,154,60,0.6)', marginBottom: 8, lineHeight: 2 }}>
                {t('creator.planting')}
              </div>
              <div style={{ fontSize: '6px', color: 'rgba(196,154,60,0.3)', lineHeight: 2 }}>
                "{topic}"
              </div>
            </div>

            {/* Stream log */}
            <div ref={logRef} className="px-gen-log">
              {streamText}
              <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center', marginLeft: 4 }}>
                {[0, 0.2, 0.4].map((delay, i) => (
                  <span key={i} style={{
                    width: 4, height: 4, borderRadius: '50%',
                    background: 'rgba(196,154,60,0.4)',
                    animation: `pxDot 1.4s infinite ${delay}s`,
                    display: 'inline-block',
                  }} />
                ))}
              </span>
              <style>{`
                @keyframes pxDot {
                  0%,80%,100% { opacity: 0.2; transform: scale(0.8); }
                  40% { opacity: 0.8; transform: scale(1.2); }
                }
              `}</style>
            </div>
          </div>
        )}

        {/* DONE */}
        {started && (
          <div className="px-fadeUp" style={{ textAlign: 'center', padding: '52px 0' }}>
            <div className="px-done-orb">🌳</div>
            <div style={{ fontSize: '11px', color: 'rgba(245,228,168,0.94)', marginBottom: 14, lineHeight: 2, textShadow: '0 0 28px rgba(196,154,60,0.3)' }}>
              {t('creator.startedTitle')}
            </div>
            <div style={{ fontSize: '5px', color: 'rgba(196,154,60,0.22)', marginBottom: 30, lineHeight: 2.2, whiteSpace: 'pre-line' }}>
              {t('creator.startedSubtitle')}
            </div>
            <button data-tutorial="course-created-cta" onClick={onCourseCreated} className="px-done-btn">
              {t('creator.startedAction')} →
            </button>
          </div>
        )}

        {blocked && !generating && !started && (
          <div className="px-fadeUp" style={{ textAlign: 'center', padding: '28px 0 12px' }}>
            <div style={{
              width: 72, height: 72, margin: '0 auto 18px', borderRadius: 10,
              background: 'radial-gradient(circle at 40% 38%,rgba(220,170,50,0.44),rgba(90,60,20,0.24))',
              border: '1px solid rgba(220,170,50,0.24)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30,
              boxShadow: '0 0 28px rgba(220,170,50,0.18)',
            }}>🧠</div>
            <div style={{ fontSize: '9px', color: 'rgba(245,228,168,0.9)', marginBottom: 10, lineHeight: 2 }}>
              {t('creator.blockedTitle')}
            </div>
            <div className="px-gen-log" style={{ marginTop: 0, marginBottom: 18 }}>
              {streamText}
            </div>
            <button onClick={onBack} className="px-done-btn">
              {t('common.back')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}