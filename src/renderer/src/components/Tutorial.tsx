import { useEffect, useMemo, useState } from 'react'
import { useLanguage } from '../contexts/LanguageContext'

interface Props {
  showMenu: boolean
  showCourses: boolean
  showTasks: boolean
  showFocus: boolean
  showSettings: boolean
  courseView: 'list' | 'create' | 'view'
  courseGenerated: boolean
  onEnsureCourseCreator: () => void
  onEnsureCourseList: () => void
  onCloseCourses: () => void
  onEnsureMenuOpen: () => void
  onCloseMenu: () => void
  onCloseTasks: () => void
  onCloseFocus: () => void
  onCloseSettings: () => void
  onComplete: () => void
}

type Step = 0 | 1 | 2

type DomState = {
  topicReady: boolean
  stage: 'idle' | 'ready' | 'questions' | 'readyToGenerate' | 'processing' | 'created'
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

function sameRect(a: DOMRect | null, b: DOMRect | null) {
  if (a === b) return true
  if (!a || !b) return false
  return a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height
}

function resolveSelector(step: Step, domState: DomState): string | null {
  if (step === 1) {
    if (domState.stage === 'questions') {
      return '[data-tutorial="course-intake-panel"]'
    }

    if (domState.stage === 'readyToGenerate') {
      return '[data-tutorial="course-generate-button"]'
    }

    return domState.topicReady ? '[data-tutorial="course-intake-continue-button"]' : '[data-tutorial="course-topic-input"]'
  }

  if (step === 2) {
    return '[data-tutorial="orb-button"]'
  }

  return null
}

export default function Tutorial({
  showMenu,
  showCourses,
  showTasks,
  showFocus,
  showSettings,
  courseView,
  courseGenerated,
  onEnsureCourseCreator,
  onEnsureCourseList: _onEnsureCourseList,
  onCloseCourses,
  onEnsureMenuOpen,
  onCloseMenu: _onCloseMenu,
  onCloseTasks,
  onCloseFocus,
  onCloseSettings,
  onComplete,
}: Props) {
  const { t } = useLanguage()
  const [step, setStep] = useState<Step>(0)
  const [domState, setDomState] = useState<DomState>({ topicReady: false, stage: 'idle' })
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
  const [viewport, setViewport] = useState(() => ({
    width: typeof window === 'undefined' ? 1280 : window.innerWidth,
    height: typeof window === 'undefined' ? 720 : window.innerHeight,
  }))

  useEffect(() => {
    const handleResize = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight })
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    const update = () => {
      const topicInput = document.querySelector('[data-tutorial="course-topic-input"]') as HTMLInputElement | null
      const intakeButton = document.querySelector('[data-tutorial="course-intake-continue-button"]') as HTMLButtonElement | null
      const intakePanel = document.querySelector('[data-tutorial="course-intake-panel"]') as HTMLElement | null
      const generateButton = document.querySelector('[data-tutorial="course-generate-button"]') as HTMLButtonElement | null
      const creatorPanel = document.querySelector('[data-tutorial="course-creator-panel"]') as HTMLElement | null
      const createdButton = document.querySelector('[data-tutorial="course-created-cta"]') as HTMLButtonElement | null

      const nextDomState: DomState = {
        topicReady: Boolean(topicInput?.value.trim()),
        stage: createdButton
          ? 'created'
          : generateButton
            ? 'readyToGenerate'
          : intakePanel
            ? 'questions'
          : creatorPanel && !topicInput && !intakeButton && !generateButton
            ? 'processing'
            : intakeButton && !intakeButton.disabled
              ? 'ready'
              : 'idle',
      }

      setDomState((previous) => (
        previous.topicReady === nextDomState.topicReady && previous.stage === nextDomState.stage
          ? previous
          : nextDomState
      ))

      const selector = resolveSelector(step, nextDomState)
      const element = selector ? document.querySelector(selector) as HTMLElement | null : null
      const nextRect = element && element.getClientRects().length > 0 ? element.getBoundingClientRect() : null
      setTargetRect((previous) => (sameRect(previous, nextRect) ? previous : nextRect))
    }

    update()
    const intervalId = window.setInterval(update, 120)
    return () => window.clearInterval(intervalId)
  }, [step, showCourses, showMenu, courseView])

  useEffect(() => {
    if (showTasks) onCloseTasks()
    if (showFocus) onCloseFocus()
    if (showSettings) onCloseSettings()

    if (step === 1 && (!showCourses || courseView !== 'create')) {
      onEnsureCourseCreator()
    }

    if (step === 2 && showCourses) {
      onCloseCourses()
    }
  }, [
    step,
    showCourses,
    showFocus,
    showSettings,
    showTasks,
    courseView,
    onCloseCourses,
    onCloseFocus,
    onCloseSettings,
    onCloseTasks,
    onEnsureCourseCreator,
  ])

  useEffect(() => {
    if (step === 1 && (domState.stage === 'processing' || domState.stage === 'created' || courseGenerated)) {
      setStep(2)
      return
    }

    if (step === 2 && showMenu) {
      onComplete()
    }
  }, [step, domState.stage, showMenu, courseGenerated, onComplete])

  const baseScale = clamp(Math.min(viewport.width / 1280, viewport.height / 760), 0.8, 1)
  const cardScale = clamp(baseScale * 0.7, 0.58, 0.76)

  const current = useMemo(() => {
    if (step === 0) {
      return {
        accent: '#d89a3a',
        kicker: t('tutorial.kicker'),
        title: t('tutorial.introTitle'),
        description: t('tutorial.introDescription'),
        detail: t('tutorial.introDetail'),
        status: t('tutorial.introStatus'),
        actionLabel: t('tutorial.introAction'),
        action: () => {
          onEnsureCourseCreator()
          setStep(1)
        },
        helper: t('tutorial.introHelper'),
        helperActionLabel: '',
        helperAction: undefined,
      }
    }

    if (step === 1) {
      return {
        accent: domState.topicReady || domState.stage === 'processing' || domState.stage === 'questions' || domState.stage === 'readyToGenerate' ? '#46b87a' : '#d89a3a',
        kicker: t('tutorial.step1'),
        title: domState.stage === 'questions'
          ? t('tutorial.step1TitleQuestions')
          : domState.stage === 'readyToGenerate'
            ? t('tutorial.step1TitlePlant')
            : domState.topicReady
              ? t('tutorial.step1TitleContinue')
              : t('tutorial.step1TitleType'),
        description: domState.stage === 'questions'
          ? t('tutorial.step1DescriptionQuestions')
          : domState.stage === 'readyToGenerate'
            ? t('tutorial.step1DescriptionPlant')
          : domState.topicReady
            ? t('tutorial.step1DescriptionContinue')
          : t('tutorial.step1DescriptionType'),
        detail: domState.stage === 'questions' ? t('tutorial.step1DetailQuestions') : t('tutorial.step1Detail'),
        status: domState.stage === 'processing'
          ? t('tutorial.step1StatusMoving')
          : domState.stage === 'questions'
            ? t('tutorial.step1StatusQuestions')
          : domState.stage === 'readyToGenerate'
            ? t('tutorial.step1StatusPlant')
            : domState.topicReady
              ? t('tutorial.step1StatusContinue')
            : t('tutorial.step1StatusTopic'),
        actionLabel: '',
        action: undefined,
        helper: !showCourses || courseView !== 'create' ? t('tutorial.step1HelperOpen') : t('tutorial.step1HelperFollow'),
        helperActionLabel: !showCourses || courseView !== 'create' ? t('tutorial.step1ActionOpen') : '',
        helperAction: !showCourses || courseView !== 'create' ? onEnsureCourseCreator : undefined,
      }
    }

    return {
      accent: '#5bb0ff',
      kicker: t('tutorial.step2'),
      title: t('tutorial.step2Title'),
      description: t('tutorial.step2Description'),
      detail: t('tutorial.step2Detail'),
      status: showMenu ? t('tutorial.step2StatusOpen') : t('tutorial.step2StatusWait'),
      actionLabel: '',
      action: undefined,
      helper: !showMenu ? t('tutorial.step2HelperFallback') : t('tutorial.step2HelperDone'),
      helperActionLabel: !showMenu ? t('tutorial.step2ActionOpen') : '',
      helperAction: !showMenu ? onEnsureMenuOpen : undefined,
    }
  }, [step, domState.topicReady, domState.stage, showCourses, courseView, showMenu, onEnsureCourseCreator, onEnsureMenuOpen, t])

  const cardWidth = step === 0
    ? Math.min(380 * cardScale, viewport.width - 36)
    : Math.min(320 * cardScale, viewport.width - 48)

  const cardStyle = useMemo(() => {
    if (step === 0) {
      return {
        width: cardWidth,
        left: (viewport.width - cardWidth) / 2,
        top: clamp(viewport.height * 0.156, 24, 102),
      }
    }

    return {
      width: cardWidth,
      left: viewport.width >= 900
        ? clamp(viewport.width * 0.055, 22, 56)
        : (viewport.width - cardWidth) / 2,
      top: clamp(viewport.height * 0.12, 16, 62),
    }
  }, [cardWidth, step, viewport.height, viewport.width])

  const spotlightStyle = useMemo(() => {
    if (!targetRect || step === 0) return null

    return {
      left: Math.max(8, targetRect.left - 10),
      top: Math.max(8, targetRect.top - 10),
      width: targetRect.width + 20,
      height: targetRect.height + 20,
    }
  }, [step, targetRect])

  const progressIndex = step === 2 ? 2 : 1

  return (
    <div className="fixed inset-0 z-[70]" style={{ pointerEvents: 'none' }}>
      <style>{`
        @keyframes tutorialPulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 0 1px rgba(255,236,184,0.24), 0 0 24px rgba(217,154,58,0.18), 0 0 0 9999px rgba(7,5,5,0.74); }
          50% { transform: scale(1.015); box-shadow: 0 0 0 1px rgba(255,236,184,0.36), 0 0 34px rgba(217,154,58,0.28), 0 0 0 9999px rgba(7,5,5,0.8); }
        }
        @keyframes tutorialCardIn {
          from { opacity: 0; transform: translateY(10px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes tutorialGlow {
          0%,100% { opacity: 0.45; }
          50% { opacity: 0.85; }
        }
      `}</style>

      {spotlightStyle ? (
        <div
          style={{
            position: 'fixed',
            borderRadius: 18,
            border: `1px solid ${current.accent}66`,
            background: 'transparent',
            animation: 'tutorialPulse 1.7s ease-in-out infinite',
            ...spotlightStyle,
          }}
        />
      ) : (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(7,5,5,0.76)',
          backdropFilter: 'blur(5px)',
        }} />
      )}

      <div
        key={step}
        style={{
          position: 'fixed',
          pointerEvents: 'auto',
          borderRadius: 24 * cardScale,
          padding: `${16 * cardScale}px ${16 * cardScale}px ${14 * cardScale}px`,
          background: 'linear-gradient(180deg, rgba(18,12,10,0.98), rgba(10,7,6,0.98))',
          border: `1px solid ${current.accent}33`,
          boxShadow: `0 ${24 * cardScale}px ${70 * cardScale}px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.03)`,
          animation: 'tutorialCardIn 0.28s cubic-bezier(.16,1,.3,1)',
          ...cardStyle,
        }}
      >
        <div style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 24 * cardScale,
          background: `radial-gradient(circle at top right, ${current.accent}18, transparent 46%)`,
          pointerEvents: 'none',
        }} />

        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 * cardScale, marginBottom: 10 * cardScale }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 * cardScale }}>
              <div style={{
                width: 10 * cardScale,
                height: 10 * cardScale,
                borderRadius: 999,
                background: current.accent,
                boxShadow: `0 0 ${16 * cardScale}px ${current.accent}88`,
                animation: 'tutorialGlow 1.8s ease-in-out infinite',
              }} />
              <div style={{
                fontSize: 9 * cardScale,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: 'rgba(230,205,178,0.64)',
              }}>
                {current.kicker}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 5 * cardScale }}>
              {[1, 2].map((index) => (
                <div
                  key={index}
                  style={{
                    width: (index === progressIndex ? 18 : 7) * cardScale,
                    height: 7 * cardScale,
                    borderRadius: 999,
                    background: index <= progressIndex ? current.accent : 'rgba(255,255,255,0.08)',
                    opacity: index <= progressIndex ? 1 : 0.5,
                    transition: 'all 0.22s ease',
                  }}
                />
              ))}
            </div>
          </div>

          <div style={{
            fontSize: 24 * cardScale,
            lineHeight: 1.12,
            color: 'rgba(255,243,224,0.94)',
            marginBottom: 9 * cardScale,
            fontFamily: 'Georgia, serif',
          }}>
            {current.title}
          </div>

          <div style={{ fontSize: 12 * cardScale, lineHeight: 1.55, color: 'rgba(233,219,199,0.82)', marginBottom: 9 * cardScale }}>
            {current.description}
          </div>

          <div style={{
            fontSize: 10 * cardScale,
            lineHeight: 1.55,
            color: 'rgba(194,171,145,0.62)',
            marginBottom: 12 * cardScale,
          }}>
            {current.detail}
          </div>

          <div style={{
            padding: `${9 * cardScale}px ${11 * cardScale}px`,
            borderRadius: 14 * cardScale,
            marginBottom: 12 * cardScale,
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            fontSize: 10 * cardScale,
            lineHeight: 1.5,
            color: 'rgba(244,229,205,0.72)',
          }}>
            {current.status}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 * cardScale }}>
            {current.helperAction && current.helperActionLabel ? (
              <button
                onClick={current.helperAction}
                style={{
                  pointerEvents: 'auto',
                  padding: `${9 * cardScale}px ${12 * cardScale}px`,
                  borderRadius: 999,
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(255,255,255,0.03)',
                  color: 'rgba(233,219,199,0.8)',
                  fontSize: 11 * cardScale,
                }}
              >
                {current.helperActionLabel}
              </button>
            ) : (
              <div style={{ fontSize: 10 * cardScale, color: 'rgba(194,171,145,0.52)' }}>
                {current.helper}
              </div>
            )}

            {current.action && current.actionLabel ? (
              <button
                onClick={current.action}
                style={{
                  pointerEvents: 'auto',
                  padding: `${9 * cardScale}px ${15 * cardScale}px`,
                  borderRadius: 999,
                  border: `1px solid ${current.accent}55`,
                  background: `linear-gradient(135deg, ${current.accent}, ${current.accent}cc)`,
                  color: '#fff8ed',
                  fontSize: 11 * cardScale,
                  fontWeight: 600,
                  boxShadow: `0 ${12 * cardScale}px ${26 * cardScale}px ${current.accent}33`,
                }}
              >
                {current.actionLabel}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
