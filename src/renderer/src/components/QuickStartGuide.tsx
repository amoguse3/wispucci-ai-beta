import { useEffect, useMemo, useState } from 'react'
import type { QuickStartIntent, UserProfile } from '../../../../shared/types'

const PX = "'Press Start 2P', monospace"

interface Props {
  profile: UserProfile
  onChoose: (intent: QuickStartIntent) => void
  onClose: () => void
}

interface QuickStartStats {
  pendingTasks: number
  activeCourses: number
}

const CARD_ORDER: QuickStartIntent[] = ['organize', 'learn', 'focus']

export default function QuickStartGuide({ profile, onChoose, onClose }: Props) {
  const [stats, setStats] = useState<QuickStartStats>({ pendingTasks: 0, activeCourses: 0 })

  useEffect(() => {
    let cancelled = false

    Promise.all([
      window.aura.tasks.list(),
      window.aura.educator.getCourses(),
    ]).then(([tasks, courses]) => {
      if (cancelled) return

      setStats({
        pendingTasks: tasks.filter((task) => !task.done && !task.parent_id).length,
        activeCourses: courses.filter((course) => course.status === 'active' || course.status === 'generating').length,
      })
    }).catch(() => null)

    return () => {
      cancelled = true
    }
  }, [])

  const recommendedIntent = useMemo<QuickStartIntent>(() => {
    if (stats.pendingTasks > 0) return 'organize'
    if (profile.hasADHD) return 'focus'
    if (stats.activeCourses > 0) return 'learn'
    return 'organize'
  }, [profile.hasADHD, stats.activeCourses, stats.pendingTasks])

  const cards: Array<{
    intent: QuickStartIntent
    eyebrow: string
    title: string
    body: string
    action: string
    accent: string
    note: string
  }> = [
    {
      intent: 'organize',
      eyebrow: 'Make today visible',
      title: 'Get organized first',
      body: 'Turn loose thoughts into one concrete plan. Start with one clear task, not a giant mental pile.',
      action: 'Open tasks',
      accent: 'rgba(232,197,106,0.84)',
      note: stats.pendingTasks > 0
        ? `${stats.pendingTasks} task${stats.pendingTasks === 1 ? '' : 's'} already waiting from onboarding.`
        : 'Best if your head feels noisy or scattered.',
    },
    {
      intent: 'learn',
      eyebrow: 'Build a skill path',
      title: 'Start one course',
      body: 'Pick one topic and follow one path. The goal is momentum, not collecting five half-started ideas.',
      action: 'Create course',
      accent: 'rgba(46,184,122,0.88)',
      note: stats.activeCourses > 0
        ? `${stats.activeCourses} active or growing course${stats.activeCourses === 1 ? '' : 's'} already exist. You can still start a fresh one.`
        : 'Best if you came here to learn something useful, fast.',
    },
    {
      intent: 'focus',
      eyebrow: 'Protect one block',
      title: 'Enter focus mode',
      body: 'Use one guided sprint to create traction. This is the lowest-friction way to win your first session.',
      action: 'Start focus',
      accent: 'rgba(96,180,255,0.88)',
      note: profile.hasADHD
        ? 'Recommended because your profile says gentler structure helps.'
        : 'Best if you already know what matters and just need to begin.',
    },
  ]

  return (
    <div style={{ padding: '28px 24px 30px', fontFamily: PX }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <div style={{ marginBottom: 22 }}>
          <div style={{
            fontSize: '5px',
            color: 'rgba(196,154,60,0.34)',
            letterSpacing: '0.18em',
            lineHeight: 2,
            marginBottom: 10,
            textTransform: 'uppercase',
          }}>
            First session
          </div>
          <div style={{
            fontSize: '15px',
            color: 'rgba(245,228,168,0.88)',
            lineHeight: 1.9,
            marginBottom: 10,
          }}>
            Pick your first win, {profile.name || 'friend'}.
          </div>
          <div style={{
            fontSize: '8px',
            color: 'rgba(196,154,60,0.44)',
            lineHeight: 2.1,
            maxWidth: 620,
          }}>
            Do not explore everything yet. Choose one clear path, get one small success, and let the rest of the app wait.
          </div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: 12,
        }}>
          {cards.sort((left, right) => CARD_ORDER.indexOf(left.intent) - CARD_ORDER.indexOf(right.intent)).map((card) => {
            const isRecommended = card.intent === recommendedIntent
            return (
              <button
                key={card.intent}
                onClick={() => onChoose(card.intent)}
                style={{
                  textAlign: 'left',
                  padding: '16px 16px 14px',
                  borderRadius: 14,
                  cursor: 'pointer',
                  background: isRecommended
                    ? 'linear-gradient(135deg, rgba(20,28,22,0.96), rgba(12,18,14,0.92))'
                    : 'rgba(12,10,10,0.92)',
                  border: `1px solid ${isRecommended ? card.accent.replace('0.84', '0.34').replace('0.88', '0.34') : 'rgba(196,154,60,0.12)'}`,
                  boxShadow: isRecommended ? `0 0 28px ${card.accent.replace('0.84', '0.12').replace('0.88', '0.12')}` : 'none',
                  transition: 'transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
                }}
                onMouseEnter={(event) => {
                  event.currentTarget.style.transform = 'translateY(-2px)'
                  event.currentTarget.style.borderColor = card.accent.replace('0.84', '0.36').replace('0.88', '0.36')
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.transform = 'translateY(0)'
                  event.currentTarget.style.borderColor = isRecommended
                    ? card.accent.replace('0.84', '0.34').replace('0.88', '0.34')
                    : 'rgba(196,154,60,0.12)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
                  <div style={{ fontSize: '5px', color: card.accent, letterSpacing: '0.16em', lineHeight: 2, textTransform: 'uppercase' }}>
                    {card.eyebrow}
                  </div>
                  {isRecommended && (
                    <div style={{
                      fontSize: '4.6px',
                      color: 'rgba(245,228,168,0.84)',
                      lineHeight: 2,
                      padding: '3px 6px',
                      borderRadius: 999,
                      background: 'rgba(245,228,168,0.08)',
                      border: '1px solid rgba(245,228,168,0.14)',
                    }}>
                      RECOMMENDED
                    </div>
                  )}
                </div>
                <div style={{ fontSize: '10px', color: 'rgba(245,228,168,0.9)', lineHeight: 1.9, marginBottom: 10 }}>
                  {card.title}
                </div>
                <div style={{ fontSize: '6px', color: 'rgba(230,200,190,0.7)', lineHeight: 2.1, marginBottom: 14 }}>
                  {card.body}
                </div>
                <div style={{ fontSize: '5px', color: 'rgba(196,154,60,0.34)', lineHeight: 2.1, marginBottom: 14 }}>
                  {card.note}
                </div>
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: '5.4px',
                  color: card.accent,
                  lineHeight: 2,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                }}>
                  {card.action}
                  <span style={{ color: 'rgba(245,228,168,0.5)' }}>→</span>
                </div>
              </button>
            )
          })}
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginTop: 18,
          paddingTop: 14,
          borderTop: '1px solid rgba(196,154,60,0.1)',
        }}>
          <div style={{ fontSize: '5px', color: 'rgba(196,154,60,0.26)', lineHeight: 2.1 }}>
            You will get a small activation bonus the first time you choose a path.
          </div>
          <button
            onClick={onClose}
            style={{
              fontFamily: PX,
              fontSize: '5px',
              color: 'rgba(196,154,60,0.42)',
              background: 'none',
              border: '1px solid rgba(196,154,60,0.12)',
              borderRadius: 8,
              padding: '8px 10px',
              cursor: 'pointer',
              lineHeight: 2,
            }}
          >
            Explore first
          </button>
        </div>
      </div>
    </div>
  )
}