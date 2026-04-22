import { useEffect, useMemo, useState } from 'react'
import type { MotivationState } from '../../../../shared/types'
import { LESSON_MILESTONE_SIZE } from '../../../../shared/constants'
import { useLanguage } from '../contexts/LanguageContext'

interface Props {
  onClose: () => void
}

const PX = "'Press Start 2P', monospace"

const COURSE_MILESTONES = [1, 3, 5, 10]
const WORD_MILESTONES = [200, 1000, 5000, 15000]
const TIME_MILESTONES = [30, 120, 600, 1800]

function getNextLessonMilestone(value: number): number {
  return Math.max(LESSON_MILESTONE_SIZE, Math.ceil(Math.max(1, value) / LESSON_MILESTONE_SIZE) * LESSON_MILESTONE_SIZE)
}

function getLessonProgress(value: number): number {
  const next = getNextLessonMilestone(value)
  const prev = Math.max(0, next - LESSON_MILESTONE_SIZE)
  return Math.max(0, Math.min(100, ((value - prev) / LESSON_MILESTONE_SIZE) * 100))
}

function getNextMilestone(value: number, milestones: number[]): number | null {
  return milestones.find(m => value < m) ?? null
}

function getProgress(value: number, milestones: number[]): number {
  const next = getNextMilestone(value, milestones)
  if (!next) return 100
  const prev = [...milestones].reverse().find(m => m <= value) ?? 0
  const span = Math.max(1, next - prev)
  return Math.max(0, Math.min(100, ((value - prev) / span) * 100))
}

function defaultMotivation(): MotivationState {
  return {
    xp: 0,
    level: 1,
    streak: 0,
    lastActive: '',
    badges: [],
    weeklyXP: [],
    graceDayUsed: false,
    wordsTyped: 0,
    minutesSpent: 0,
    coursesCompleted: 0,
    completedLessons: 0,
    bonusXpEarned: 0,
    achievementLevels: { lessons: 1, courses: 1, words: 1, time: 1 },
    lastLessonReward: null,
  }
}

export default function Achievements({ onClose }: Props) {
  const { t } = useLanguage()
  const [motivation, setMotivation] = useState<MotivationState>(defaultMotivation())

  useEffect(() => {
    let mounted = true
    const load = async () => {
      const mot = await window.aura.motivation.getState()
      if (mounted) setMotivation(mot)
    }
    load()
    const iv = setInterval(load, 5000)
    return () => {
      mounted = false
      clearInterval(iv)
    }
  }, [])

  const tracks = useMemo(() => {
    const nextLesson = getNextLessonMilestone(motivation.completedLessons)
    const nextCourse = getNextMilestone(motivation.coursesCompleted, COURSE_MILESTONES)
    const nextWords = getNextMilestone(motivation.wordsTyped, WORD_MILESTONES)
    const nextTime = getNextMilestone(motivation.minutesSpent, TIME_MILESTONES)

    return [
      {
        icon: '⚡',
        title: t('achievements.lessonsTrack'),
        level: motivation.achievementLevels.lessons,
        value: motivation.completedLessons,
        unit: t('achievements.lessonsUnit'),
        next: nextLesson,
        leftText: nextLesson - motivation.completedLessons === 0
          ? t('achievements.milestoneHit', { size: LESSON_MILESTONE_SIZE })
          : t('achievements.lessonsLeft', { count: nextLesson - motivation.completedLessons }),
        progress: getLessonProgress(motivation.completedLessons),
        color: 'rgba(232,197,106,0.72)',
        glow: 'rgba(232,197,106,0.18)',
      },
      {
        icon: '📚',
        title: t('achievements.coursesTrack'),
        level: motivation.achievementLevels.courses,
        value: motivation.coursesCompleted,
        unit: t('achievements.coursesUnit'),
        next: nextCourse,
        leftText: nextCourse ? t('achievements.coursesLeft', { count: nextCourse - motivation.coursesCompleted }) : t('achievements.allUnlocked'),
        progress: getProgress(motivation.coursesCompleted, COURSE_MILESTONES),
        color: 'rgba(46,184,122,0.7)',
        glow: 'rgba(46,184,122,0.18)',
      },
      {
        icon: '✍️',
        title: t('achievements.wordsTrack'),
        level: motivation.achievementLevels.words,
        value: motivation.wordsTyped,
        unit: t('achievements.wordsUnit'),
        next: nextWords,
        leftText: nextWords ? t('achievements.wordsLeft', { count: nextWords - motivation.wordsTyped }) : t('achievements.allUnlocked'),
        progress: getProgress(motivation.wordsTyped, WORD_MILESTONES),
        color: 'rgba(139,92,246,0.7)',
        glow: 'rgba(139,92,246,0.18)',
      },
      {
        icon: '⏱',
        title: t('achievements.timeTrack'),
        level: motivation.achievementLevels.time,
        value: motivation.minutesSpent,
        unit: t('achievements.timeUnit'),
        next: nextTime,
        leftText: nextTime ? t('achievements.timeLeft', { count: nextTime - motivation.minutesSpent }) : t('achievements.allUnlocked'),
        progress: getProgress(motivation.minutesSpent, TIME_MILESTONES),
        color: 'rgba(245,158,11,0.75)',
        glow: 'rgba(245,158,11,0.18)',
      },
    ]
  }, [motivation])

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-4" style={{
      background: 'rgba(3,13,6,0.9)',
      backdropFilter: 'blur(16px)',
    }}>
      <div className="w-full max-w-2xl max-h-[88vh] overflow-y-auto rounded-xl" style={{
        background: 'rgba(2,9,4,0.96)',
        border: '1px solid rgba(196,154,60,0.16)',
        boxShadow: '0 0 50px rgba(196,154,60,0.08)',
      }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(196,154,60,0.12)' }}>
          <div>
            <div style={{ fontFamily: PX, fontSize: 8, color: 'rgba(245,228,168,0.88)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{t('achievements.title')}</div>
            <div style={{ fontFamily: PX, fontSize: 5, color: 'rgba(196,154,60,0.38)', marginTop: 4 }}>
              {t('achievements.subtitle')}
            </div>
          </div>
          <button onClick={onClose} style={{
            fontFamily: PX,
            fontSize: 8,
            color: 'rgba(196,154,60,0.35)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
          }}>✕</button>
        </div>

        <div className="p-5 space-y-4">
          {tracks.map(track => (
            <div key={track.title} style={{
              background: 'rgba(4,14,8,0.6)',
              border: '1px solid rgba(196,154,60,0.1)',
              borderRadius: 12,
              padding: 14,
            }}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: 18 }}>{track.icon}</span>
                  <span style={{ fontFamily: PX, fontSize: 6, color: 'rgba(232,197,106,0.75)' }}>{track.title}</span>
                </div>
                <div style={{ fontFamily: PX, fontSize: 5, color: 'rgba(200,220,180,0.7)' }}>
                  {t('achievements.levelLabel')} {track.level}
                </div>
              </div>

              <div className="flex items-center justify-between mb-2">
                <span style={{ fontFamily: PX, fontSize: 5, color: 'rgba(196,154,60,0.5)' }}>
                  {track.value} {track.unit}
                </span>
                <span style={{ fontFamily: PX, fontSize: 5, color: 'rgba(196,154,60,0.5)' }}>
                  {Math.round(track.progress)}%
                </span>
              </div>

              <div style={{
                height: 6,
                borderRadius: 999,
                background: 'rgba(196,154,60,0.12)',
                overflow: 'hidden',
                marginBottom: 8,
              }}>
                <div style={{
                  width: `${track.progress}%`,
                  height: '100%',
                  borderRadius: 999,
                  background: track.color,
                  boxShadow: `0 0 14px ${track.glow}`,
                  transition: 'width 0.5s ease',
                }} />
              </div>

              <div style={{ fontFamily: PX, fontSize: 5, color: 'rgba(196,154,60,0.34)', lineHeight: 1.9 }}>
                {track.leftText}
              </div>
            </div>
          ))}

          <div style={{
            background: 'rgba(4,14,8,0.45)',
            border: '1px solid rgba(196,154,60,0.08)',
            borderRadius: 10,
            padding: 12,
            fontFamily: PX,
            fontSize: 5,
            color: 'rgba(196,154,60,0.32)',
            lineHeight: 2,
          }}>
            {t('achievements.totalBadges', { count: motivation.badges.length })} · {t('achievements.bonusXP', { xp: motivation.bonusXpEarned })}
          </div>
        </div>
      </div>
    </div>
  )
}
