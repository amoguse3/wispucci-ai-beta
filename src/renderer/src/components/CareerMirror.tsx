import { useState, useEffect, useRef } from 'react'
import type { ChatTokenEvent, MotivationState } from '../../../../shared/types'

interface Props {
  onClose: () => void
}

export default function CareerMirror({ onClose }: Props) {
  const [loading, setLoading] = useState(true)
  const [projection, setProjection] = useState('')
  const [motivation, setMotivation] = useState<MotivationState | null>(null)
  const [courses, setCourses] = useState<any[]>([])
  const unsubRef = useRef<(() => void) | null>(null)
  const streamRef = useRef('')

  useEffect(() => {
    loadAndGenerate()
    return () => { unsubRef.current?.() }
  }, [])

  const loadAndGenerate = async () => {
    const [mot, courseList] = await Promise.all([
      window.aura.motivation.getState(),
      window.aura.educator.getCourses()
    ])
    setMotivation(mot)
    setCourses(courseList)

    const courseInfo = courseList.map((c: any) =>
      `"${c.title}" (${c.completed_modules}/${c.total_modules} module)`
    ).join(', ')

    const prompt = `You are an AI career coach. Based on the user's data, create a "Career Mirror" — a motivational projection at 30, 90 and 365 days if they continue at this pace. Be realistic but optimistic.

Data:
- Current streak: ${mot.streak} consecutive days
- Total XP: ${mot.xp} (level ${mot.level}/8)
- Courses: ${courseList.length > 0 ? courseInfo : 'No courses yet'}
- Badges: ${mot.badges.length} unlocked

Format the response:
📅 30 DAYS: [what they'll be capable of]
📅 90 DAYS: [visible progress]
📅 365 DAYS: [complete transformation]
💡 TIP: [a concrete tip for today]

Write 2-3 sentences per section. Be concrete, not vague.`

    unsubRef.current = window.aura.chat.onToken((data: ChatTokenEvent) => {
      streamRef.current += data.token
      setProjection(streamRef.current)
      if (data.done) setLoading(false)
    })

    await window.aura.chat.send(prompt)
  }

  // Progress visualization
  const streakDays = motivation?.streak || 0
  const maxStreak = 365
  const streakPercent = Math.min((streakDays / maxStreak) * 100, 100)

  // Milestones
  const milestones = [
    { day: 7, label: '1 week', icon: '🌱', reached: streakDays >= 7 },
    { day: 30, label: '1 month', icon: '🌿', reached: streakDays >= 30 },
    { day: 90, label: '3 months', icon: '🌳', reached: streakDays >= 90 },
    { day: 180, label: '6 months', icon: '🏔️', reached: streakDays >= 180 },
    { day: 365, label: '1 year', icon: '⭐', reached: streakDays >= 365 }
  ]

  return (
    <div className="absolute inset-0 z-50 flex flex-col overflow-y-auto p-6"
      style={{ background: 'rgba(8,6,6,0.95)', backdropFilter: 'blur(20px)' }}>

      <div className="w-full max-w-sm mx-auto animate-fade-in-up">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-sm font-semibold text-aura-text" style={{ fontFamily: 'Georgia, serif' }}>
              Career Mirror
            </h2>
            <p className="text-[10px] text-aura-muted">Where you'll be if you don't stop</p>
          </div>
          <button onClick={onClose} className="text-aura-muted hover:text-aura-text text-sm">✕</button>
        </div>

        {/* Journey timeline */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-aura-muted">Day 0</span>
            <span className="text-[10px] font-medium text-aura-orange">Day {streakDays}</span>
            <span className="text-[10px] text-aura-muted">Day 365</span>
          </div>

          {/* Progress bar */}
          <div className="h-2 rounded-full overflow-hidden relative" style={{ background: 'rgba(42,37,32,0.3)' }}>
            <div className="h-full rounded-full transition-all duration-1000" style={{
              width: `${streakPercent}%`,
              background: 'linear-gradient(90deg, #d97706, #f59e0b, #10b981)',
              boxShadow: '0 0 10px rgba(217,119,6,0.4)'
            }} />
          </div>

          {/* Milestones */}
          <div className="flex justify-between mt-2">
            {milestones.map(m => (
              <div key={m.day} className="flex flex-col items-center" style={{
                opacity: m.reached ? 1 : 0.35
              }}>
                <span className="text-sm">{m.icon}</span>
                <span className="text-[8px] text-aura-muted">{m.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Stats snapshot */}
        <div className="grid grid-cols-3 gap-2 mb-5">
          <div className="text-center p-2 rounded-xl" style={{
            background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.15)'
          }}>
            <p className="text-lg font-bold text-aura-orange">{motivation?.xp || 0}</p>
            <p className="text-[8px] text-aura-muted">XP Total</p>
          </div>
          <div className="text-center p-2 rounded-xl" style={{
            background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.15)'
          }}>
            <p className="text-lg font-bold text-violet-400">{courses.length}</p>
            <p className="text-[8px] text-aura-muted">Courses</p>
          </div>
          <div className="text-center p-2 rounded-xl" style={{
            background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)'
          }}>
            <p className="text-lg font-bold text-emerald-400">{motivation?.badges.length || 0}</p>
            <p className="text-[8px] text-aura-muted">Badges</p>
          </div>
        </div>

        {/* AI Projection */}
        <div className="p-4 rounded-xl mb-5" style={{
          background: 'linear-gradient(135deg, rgba(217,119,6,0.06), rgba(139,92,246,0.06))',
          border: '1px solid rgba(217,119,6,0.12)'
        }}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{
              background: 'radial-gradient(circle, #d97706, #92400e)'
            }}>
              <span className="text-[9px] font-bold text-white">A</span>
            </div>
            <span className="text-xs font-medium text-aura-text">Wispucci AI Projection</span>
          </div>

          {loading && !projection ? (
            <div className="flex items-center gap-2 py-4">
              <div className="w-8 h-8 rounded-full animate-breathe" style={{
                background: 'radial-gradient(circle, #d97706, transparent)'
              }} />
              <span className="text-xs text-aura-muted">Analyzing your progress...</span>
            </div>
          ) : (
            <div className="text-xs text-aura-text leading-relaxed whitespace-pre-wrap">
              {projection}
            </div>
          )}
        </div>

        {/* Motivational closer */}
        <div className="text-center p-3 rounded-xl mb-4" style={{
          background: 'rgba(16,185,129,0.05)',
          border: '1px solid rgba(16,185,129,0.1)'
        }}>
          <p className="text-[10px] text-emerald-300">
            {streakDays === 0
              ? 'Every champion started from day 1.'
              : streakDays < 7
                ? 'You started. Now don\'t stop.'
                : streakDays < 30
                  ? 'Consistency is the mother of mastery.'
                  : 'You\'re already in the top 1%. Keep going.'}
          </p>
        </div>

        <button onClick={onClose}
          className="w-full py-2.5 rounded-xl text-xs font-medium transition-all hover:scale-[1.02]"
          style={{
            background: 'rgba(42,37,32,0.3)',
            border: '1px solid rgba(42,37,32,0.5)',
            color: '#8a7e72'
          }}>
                    Close
        </button>
      </div>
    </div>
  )
}
