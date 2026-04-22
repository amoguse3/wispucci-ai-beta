import { useState, useEffect } from 'react'
import type { Course } from '../../../../shared/types'
import { useLanguage } from '../contexts/LanguageContext'

interface Props {
  onSelectCourse: (courseId: number) => void
  onCreateCourse: () => void
  onOpenTeacher?: (courseId: number) => void
}

export default function CourseList({ onSelectCourse, onCreateCourse, onOpenTeacher }: Props) {
  const { t } = useLanguage()
  const [courses, setCourses] = useState<Course[]>([])
  const [canCreate, setCanCreate] = useState(true)
  const [cooldownMin, setCooldownMin] = useState(0)

  const syncCreateWindow = (nextCourses: Course[]) => {
    if (nextCourses.length === 0) {
      setCanCreate(true)
      setCooldownMin(0)
      return
    }

    const sorted = [...nextCourses].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    const lastCreated = new Date(sorted[0].created_at).getTime()
    const diff = Date.now() - lastCreated
    const twoHours = 2 * 60 * 60 * 1000
    if (diff < twoHours) {
      setCanCreate(false)
      setCooldownMin(Math.ceil((twoHours - diff) / 60000))
      return
    }

    setCanCreate(true)
    setCooldownMin(0)
  }

  const loadCourses = async () => {
    const nextCourses = await window.aura.educator.getCourses()
    setCourses(nextCourses)
    syncCreateWindow(nextCourses)
  }

  useEffect(() => {
    loadCourses()
    const unsubscribe = window.aura.educator.onCourseGenToken((event) => {
      if (event.courseId || event.done) {
        loadCourses().catch(() => null)
      }
    })
    return unsubscribe
  }, [])

  useEffect(() => {
    if (canCreate || cooldownMin <= 0) return
    const t = setInterval(() => {
      setCooldownMin(prev => {
        if (prev <= 1) { setCanCreate(true); return 0 }
        return prev - 1
      })
    }, 60000)
    return () => clearInterval(t)
  }, [canCreate, cooldownMin])

  const formatCooldown = (min: number) => {
    if (min >= 60) return `${Math.floor(min / 60)}${t('common.hoursShort')} ${min % 60}${t('common.minutesShort')}`
    return `${min}${t('common.minutesShort')}`
  }

  const activeCourses = courses.filter(c => c.status !== 'completed')
  const doneCourses = courses.filter(c => c.status === 'completed')

  return (
    <div className="flex-1 overflow-y-auto aura-scrollbar">
      <style>{`
        .aura-px * { font-family: 'Press Start 2P', 'Courier New', Courier, monospace !important; }
        .aura-scrollbar { scrollbar-width: thin; scrollbar-color: rgba(196,154,60,0.1) transparent; }
        .aura-scrollbar::-webkit-scrollbar { width: 4px; }
        .aura-scrollbar::-webkit-scrollbar-thumb { background: rgba(196,154,60,0.1); border-radius: 4px; }

        .px-course-item {
          padding: 16px 18px; border-radius: 10px; margin-bottom: 8px;
          cursor: pointer; border: 1px solid transparent;
          transition: all 0.22s ease; position: relative; overflow: hidden;
          animation: pxSlideIn 0.5s cubic-bezier(.16,1,.3,1) both;
        }
        .px-course-item.active {
          background: rgba(196,154,60,0.055);
          border-color: rgba(196,154,60,0.22);
          box-shadow: 0 0 28px rgba(196,154,60,0.07);
        }
        .px-course-item.active::before {
          content: '';
          position: absolute; left: 0; top: 18%; bottom: 18%; width: 2px; border-radius: 2px;
          background: linear-gradient(180deg, transparent, rgba(232,197,106,0.68), transparent);
        }
        .px-course-item:not(.active):hover { background: rgba(26,51,38,0.38); border-color: rgba(196,154,60,0.1); }
        .px-create-btn {
          transition: all 0.28s ease; position: relative; overflow: hidden;
        }
        .px-create-btn::before {
          content: ''; position: absolute; inset: 0;
          background: radial-gradient(ellipse at center, rgba(232,197,106,0.1), transparent 70%);
          opacity: 0; transition: opacity 0.3s;
        }
        .px-create-btn:hover::before { opacity: 1; }
        .px-create-btn:hover:not(:disabled) {
          border-color: rgba(232,197,106,0.4) !important;
          box-shadow: 0 0 28px rgba(196,154,60,0.16);
          transform: translateY(-1px);
        }
        .px-due-banner { animation: pxGlowViolet 5s ease-in-out infinite; }
        @keyframes pxGlowViolet {
          0%,100% { box-shadow: none; }
          50%      { box-shadow: 0 0 18px rgba(120,100,200,0.1); }
        }
        @keyframes pxSlideIn {
          from { opacity: 0; transform: translateX(-8px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        .px-progress-fill {
          height: 100%; border-radius: 2px;
          background: linear-gradient(90deg, rgba(196,154,60,0.55), rgba(232,197,106,0.4));
          box-shadow: 0 0 7px rgba(196,154,60,0.32);
          transition: width 1s cubic-bezier(.16,1,.3,1);
        }
        .px-progress-fill.done {
          background: linear-gradient(90deg, rgba(26,107,80,0.6), rgba(46,184,122,0.45));
          box-shadow: 0 0 8px rgba(46,184,122,0.24);
        }
        .px-pixel-divider {
          height: 1px;
          background: repeating-linear-gradient(90deg,rgba(196,154,60,0.15) 0,rgba(196,154,60,0.15) 4px,transparent 4px,transparent 8px);
          margin: 8px 4px;
        }
        .px-empty-orb { animation: pxBreathe 4s ease-in-out infinite; }
        @keyframes pxBreathe {
          0%,100% { transform: scale(1); opacity: 0.6; }
          50%      { transform: scale(1.05); opacity: 1; }
        }
      `}</style>

      <div className="aura-px" style={{ maxWidth: 600, margin: '0 auto', padding: '28px 24px' }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <div style={{ fontSize: "16px", color: 'rgba(245,228,168,0.85)', letterSpacing: '0.06em', lineHeight: 2 }}>
              {t('courseList.title')}
            </div>
            <div style={{ fontSize: "10px", color: 'rgba(196,154,60,0.4)', marginTop: 6, lineHeight: 2 }}>
              {t('courseList.count', { count: courses.length })}
            </div>
          </div>
        </div>

        {/* Create button */}
        <button
          data-tutorial="course-list-create-button"
          onClick={onCreateCourse}
          disabled={!canCreate}
          className="px-create-btn w-full mb-2 py-3 rounded-lg text-center"
          style={{
            background: canCreate
              ? 'linear-gradient(135deg, rgba(196,154,60,0.1), rgba(13,61,46,0.18))'
              : 'rgba(8,18,12,0.55)',
            border: `1px solid ${canCreate ? 'rgba(196,154,60,0.26)' : 'rgba(196,154,60,0.08)'}`,
            color: canCreate ? 'rgba(232,197,106,0.84)' : 'rgba(196,154,60,0.28)',
            fontSize: "12px",
            letterSpacing: '0.05em',
            lineHeight: 2,
            cursor: canCreate ? 'pointer' : 'not-allowed',
          }}>
          {canCreate ? `✦  ${t('courseList.create')}` : `⏳ ${formatCooldown(cooldownMin)}`}
        </button>

        {!canCreate && (
          <div style={{ fontSize: "10px", color: 'rgba(196,154,60,0.22)', textAlign: 'center', marginBottom: 8, lineHeight: 2 }}>
            {t('courseList.cooldownHint')}
          </div>
        )}

        {/* Cooldown bar */}
        {!canCreate && (
          <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded-lg"
            style={{ background: 'rgba(8,18,12,0.55)', border: '1px solid rgba(196,154,60,0.08)' }}>
            <span style={{ fontSize: 11 }}>🌱</span>
            <span style={{ fontSize: "10px", color: 'rgba(196,154,60,0.3)', lineHeight: 2 }}>{t('courseList.nextAvailable')}</span>
            <span style={{ fontSize: "12px", color: 'rgba(196,154,60,0.48)', marginLeft: 'auto', lineHeight: 2 }}>
              {formatCooldown(cooldownMin)}
            </span>
          </div>
        )}

        {/* Active courses */}
        {activeCourses.length > 0 && (
          <>
            <div style={{ fontSize: "10px", letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(196,154,60,0.35)', padding: '14px 6px 8px', lineHeight: 2 }}>
              {t('courseList.growing')}
            </div>
            {activeCourses.map((course, i) => {
              const isGenerating = course.status === 'generating'
              const isFailed = course.status === 'failed'
              const isPending = isGenerating || isFailed
              const progress = isGenerating
                ? Math.max(6, Number(course.generation_progress || 0))
                : isFailed
                  ? 0
                  : course.total_modules > 0
                ? Math.round((course.completed_modules / course.total_modules) * 100)
                : 0

              return (
                <div key={course.id} data-tutorial={i === 0 ? 'course-list-first' : undefined} className="px-course-item" style={{ animationDelay: `${i * 60}ms` }}
                  onClick={() => onSelectCourse(course.id)}>
                  <div style={{ fontSize: "12px", color: 'rgba(245,228,168,0.8)', marginBottom: 12, lineHeight: 1.9 }}>
                    {course.title}
                  </div>
                  {isPending && (
                    <div style={{
                      fontSize: '10px',
                      color: isFailed ? 'rgba(220,120,120,0.6)' : 'rgba(196,154,60,0.35)',
                      marginBottom: 10,
                      lineHeight: 1.8,
                    }}>
                      {isFailed
                        ? (course.generation_error || t('courseList.failedHint'))
                        : (course.generation_summary || t('courseList.generatingHint'))}
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'rgba(196,154,60,0.1)', overflow: 'hidden' }}>
                      <div className={`px-progress-fill${isFailed ? ' done' : ''}`} style={{ width: `${progress}%`, opacity: isFailed ? 0.45 : 1 }} />
                    </div>
                    <span style={{ fontSize: "10px", color: 'rgba(196,154,60,0.35)', whiteSpace: 'nowrap', lineHeight: 1 }}>
                      {isGenerating ? `${progress}%` : isFailed ? t('courseList.failedStatus') : `${course.completed_modules}/${course.total_modules}`}
                    </span>
                  </div>
                  {onOpenTeacher && !isPending && (
                    <button onClick={e => { e.stopPropagation(); onOpenTeacher(course.id) }}
                      className="px-create-btn mt-2 w-full py-2 rounded-md text-center"
                      style={{
                        background: 'rgba(40,180,120,0.05)',
                        border: '1px solid rgba(40,180,120,0.15)',
                        color: 'rgba(40,180,120,0.6)',
                        fontSize: '10px', lineHeight: 2, cursor: 'pointer',
                      }}>
                      📖 {t('courseList.teacher')}
                    </button>
                  )}
                </div>
              )
            })}
          </>
        )}

        {/* Completed courses */}
        {doneCourses.length > 0 && (
          <>
            <div className="px-pixel-divider" />
            <div style={{ fontSize: "10px", letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(196,154,60,0.35)', padding: '14px 6px 8px', lineHeight: 2 }}>
              {t('courseList.bloomed')} ✓
            </div>
            {doneCourses.map((course, i) => (
              <div key={course.id} className="px-course-item" style={{ animationDelay: `${(activeCourses.length + i) * 60}ms` }}
                onClick={() => onSelectCourse(course.id)}>
                <div style={{ fontSize: "12px", color: 'rgba(245,228,168,0.8)', marginBottom: 12, lineHeight: 1.9 }}>
                  {course.title}
                </div>
                <div className="flex items-center gap-3">
                  <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'rgba(196,154,60,0.1)', overflow: 'hidden' }}>
                    <div className="px-progress-fill done" style={{ width: '100%' }} />
                  </div>
                  <span style={{ fontSize: "10px", color: 'rgba(46,184,122,0.5)', whiteSpace: 'nowrap', lineHeight: 1 }}>
                    {course.total_modules}/{course.total_modules}
                  </span>
                </div>
                {onOpenTeacher && (
                  <button onClick={e => { e.stopPropagation(); onOpenTeacher(course.id) }}
                    className="px-create-btn mt-2 w-full py-2 rounded-md text-center"
                    style={{
                      background: 'rgba(40,180,120,0.05)',
                      border: '1px solid rgba(40,180,120,0.15)',
                      color: 'rgba(40,180,120,0.6)',
                      fontSize: '10px', lineHeight: 2, cursor: 'pointer',
                    }}>
                    📖 {t('courseList.teacher')}
                  </button>
                )}
              </div>
            ))}
          </>
        )}

        {/* Empty state */}
        {courses.length === 0 && (
          <div className="text-center py-12">
            <div className="px-empty-orb w-16 h-16 mx-auto mb-4 rounded-lg flex items-center justify-center"
              style={{ background: 'radial-gradient(circle, rgba(196,154,60,0.1) 0%, transparent 70%)' }}>
              <span style={{ fontSize: 28, opacity: 0.3 }}>📚</span>
            </div>
            <div style={{ fontSize: "12px", color: 'rgba(245,228,168,0.4)', marginBottom: 8, lineHeight: 2 }}>
              {t('courseList.emptyTitle')}
            </div>
            <div style={{ fontSize: "10px", color: 'rgba(196,154,60,0.22)', marginBottom: 22, lineHeight: 2.2 }}>
              {t('courseList.emptySubtitle')}
            </div>
            <button onClick={onCreateCourse}
              className="px-create-btn px-6 py-3 rounded-lg"
              style={{
                background: 'linear-gradient(135deg, rgba(196,154,60,0.1), rgba(13,61,46,0.18))',
                border: '1px solid rgba(196,154,60,0.26)',
                color: 'rgba(232,197,106,0.84)',
                fontSize: "12px",
                lineHeight: 2,
                cursor: 'pointer',
              }}>
              {t('courseList.emptyAction')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}