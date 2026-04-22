import { useState, useEffect, useRef, useCallback } from 'react'
import type { Task, Course, MotivationState, TierLimitSnapshot } from '../../../../shared/types'
import { LESSON_MILESTONE_SIZE } from '../../../../shared/constants'

const PX = "'Press Start 2P', monospace"

interface Props {
  onClickTask: () => void
  onClickCourse: (courseId: number) => void
}

interface CourseProgress {
  id: number
  title: string
  status: Course['status']
  generationProgress?: number | null
  generationSummary?: string | null
  completedModules: number
  totalModules: number
}

export default function TopIndicator({ onClickTask, onClickCourse }: Props) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [courseProgress, setCourseProgress] = useState<CourseProgress | null>(null)
  const [motivation, setMotivation] = useState<MotivationState | null>(null)
  const [limits, setLimits] = useState<TierLimitSnapshot | null>(null)
  const [showTask, setShowTask] = useState(true)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const formatCompactTokens = (value: number | null | undefined) => {
    const safeValue = Number(value || 0)
    if (safeValue >= 1000) return `${(safeValue / 1000).toFixed(safeValue >= 10000 ? 0 : 1)}k`
    return String(safeValue)
  }

  const formatResetWindow = (value: number | null | undefined) => {
    const safeValue = Number(value || 0)
    if (!safeValue || safeValue <= 0) return ''
    const totalMinutes = Math.max(1, Math.ceil(safeValue / 60000))
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`
    if (hours > 0) return `${hours}h`
    return `${minutes}m`
  }

  const loadData = useCallback(async () => {
    const [t, courses, mot, limitSnapshot] = await Promise.all([
      window.aura.tasks.list(),
      window.aura.educator.getCourses(),
      window.aura.motivation.getState(),
      window.aura.limits.getState(),
    ])
    setTasks(t)
    setMotivation(mot)
    setLimits(limitSnapshot)

    const trackedCourse = courses.find((c: Course) => c.status === 'generating')
      || courses.find((c: Course) => c.status === 'active')
    if (trackedCourse) {
      setCourseProgress({
        id: trackedCourse.id,
        title: trackedCourse.title,
        status: trackedCourse.status,
        generationProgress: trackedCourse.generation_progress,
        generationSummary: trackedCourse.generation_summary,
        completedModules: trackedCourse.completed_modules,
        totalModules: trackedCourse.total_modules,
      })
    } else {
      setCourseProgress(null)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  useEffect(() => {
    const unsubscribe = window.aura.educator.onCourseGenToken((event) => {
      if (event.courseId || event.done) {
        loadData().catch(() => null)
      }
    })
    return unsubscribe
  }, [loadData])

  // Reload periodically  
  useEffect(() => {
    const iv = setInterval(loadData, 15000)
    return () => clearInterval(iv)
  }, [loadData])

  // Alternate between task and course every 10s
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setShowTask(prev => !prev)
    }, 10000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  const pendingTasks = tasks.filter(t => !t.done && !t.parent_id)
  const currentTask = pendingTasks[0] // highest priority pending
  const subtaskCount = currentTask ? tasks.filter(t => t.parent_id === currentTask.id).length : 0
  const subtaskDone = currentTask ? tasks.filter(t => t.parent_id === currentTask.id && t.done).length : 0

  const hasTask = !!currentTask
  const hasCourse = !!courseProgress
  const completedLessons = motivation?.completedLessons || 0
  const milestoneReached = completedLessons > 0 && completedLessons % LESSON_MILESTONE_SIZE === 0
  const nextMilestoneAt = milestoneReached
    ? completedLessons + LESSON_MILESTONE_SIZE
    : Math.max(LESSON_MILESTONE_SIZE, Math.ceil(Math.max(1, completedLessons) / LESSON_MILESTONE_SIZE) * LESSON_MILESTONE_SIZE)
  const lessonsUntilNextMilestone = Math.max(0, nextMilestoneAt - completedLessons)
  const milestoneText = motivation
    ? (motivation.lastLessonReward?.milestoneReached
        ? 'Small milestone reached'
        : motivation.lastLessonReward?.lessonsUntilNextMilestone
          ? `${motivation.lastLessonReward.lessonsUntilNextMilestone} lessons until the next milestone`
          : milestoneReached
            ? 'Small milestone reached'
            : `${lessonsUntilNextMilestone} lessons until the next milestone`)
    : '3 lessons until the next milestone'

  // If only one exists, show that one
  const displayTask = hasTask && (!hasCourse || showTask)
  const chatLimit = limits?.capabilities.chatMessagesPerDay ?? null
  const chatRemaining = limits?.remaining.chatMessagesPerDay ?? null
  const chatUsed = limits?.usage.chatMessagesToday ?? 0
  const showChatBudgetNotice = chatLimit !== null && chatRemaining !== null && (chatRemaining <= 0 || chatRemaining <= Math.round(chatLimit * 0.2))
  const chatResetLabel = formatResetWindow(limits?.windows.chatMessagesResetInMs)

  // Nothing to show
  if (!hasTask && !hasCourse && !showChatBudgetNotice) return null

  return (
    <div className="absolute top-9 left-1/2 -translate-x-1/2 z-40" style={{ fontFamily: PX, display: 'grid', gap: 8, justifyItems: 'center' }}>
      {showChatBudgetNotice && (
        <div style={{
          padding: '6px 10px',
          borderRadius: 999,
          background: chatRemaining === 0 ? 'rgba(139,58,58,0.2)' : 'rgba(196,154,60,0.12)',
          border: `1px solid ${chatRemaining === 0 ? 'rgba(220,100,100,0.24)' : 'rgba(196,154,60,0.18)'}`,
          boxShadow: '0 4px 20px rgba(0,0,0,0.22)',
          maxWidth: 360,
        }}>
          <span style={{
            fontSize: 5.5,
            color: chatRemaining === 0 ? 'rgba(255,190,190,0.88)' : 'rgba(245,228,168,0.82)',
            lineHeight: 1.8,
            letterSpacing: '0.06em',
          }}>
            {chatRemaining === 0
              ? `CHAT LIMIT REACHED${chatResetLabel ? ` · ${chatResetLabel}` : ''}`
              : `CHAT ${chatUsed}/${chatLimit} TODAY`}
          </span>
        </div>
      )}

      {(hasTask || hasCourse) && (
        <button
          onClick={() => displayTask ? onClickTask() : courseProgress && onClickCourse(courseProgress.id)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all group"
          style={{
            background: 'rgba(10,6,6,0.7)',
            backdropFilter: 'blur(12px)',
            border: `1px solid ${displayTask ? 'rgba(245,158,11,0.15)' : 'rgba(46,184,122,0.15)'}`,
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            animation: 'indicatorSlideIn 0.4s cubic-bezier(.16,1,.3,1)',
            maxWidth: 320,
          }}
        >
          {displayTask ? (
            <div className="w-3 h-3 rounded-sm shrink-0" style={{
              border: '1.5px solid rgba(245,158,11,0.6)',
              animation: 'indicatorPulse 2s ease-in-out infinite',
            }} />
          ) : (
            <div className="w-3 h-3 shrink-0" style={{
              background: 'rgba(46,184,122,0.5)',
              borderRadius: 2,
              animation: 'indicatorPulse 2s ease-in-out infinite',
            }} />
          )}

          <span className="truncate" style={{
            fontSize: 6,
            color: displayTask ? 'rgba(251,191,36,0.7)' : 'rgba(46,184,122,0.7)',
            maxWidth: 200,
            transition: 'color 0.3s',
          }}>
            {displayTask ? (
              <>
                {currentTask!.text}
                {subtaskCount > 0 && (
                  <span style={{ color: 'rgba(200,160,140,0.3)', marginLeft: 6 }}>
                    {subtaskDone}/{subtaskCount}
                  </span>
                )}
              </>
            ) : (
              <>
                {courseProgress!.title}
                <span style={{ color: 'rgba(200,160,140,0.3)', marginLeft: 6 }}>
                  {courseProgress!.status === 'generating'
                    ? `${Math.max(4, Number(courseProgress!.generationProgress || 0))}% · ${courseProgress!.generationSummary || 'growing in background'}`
                    : milestoneText}
                </span>
              </>
            )}
          </span>

          <span className="opacity-0 group-hover:opacity-100 transition-opacity" style={{
            fontSize: 7, color: 'rgba(200,160,140,0.3)',
          }}>
            →
          </span>
        </button>
      )}
    </div>
  )
}

// CSS for the indicator is injected in App.tsx styles
