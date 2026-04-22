import { useState, useEffect, useRef } from 'react'
import type { ChatTokenEvent, MotivationState } from '../../../../shared/types'
import { useLanguage } from '../contexts/LanguageContext'

interface Props {
  onClose: () => void
}

export default function DailySummary({ onClose }: Props) {
  const { t, lang } = useLanguage()
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState('')
  const [motivation, setMotivation] = useState<MotivationState | null>(null)
  const [tasks, setTasks] = useState<{ done: number; total: number }>({ done: 0, total: 0 })
  const [gamePoints, setGamePoints] = useState(0)
  const unsubRef = useRef<(() => void) | null>(null)
  const streamRef = useRef('')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    const [mot, taskList, pts] = await Promise.all([
      window.aura.motivation.getState(),
      window.aura.tasks.list(),
      window.aura.games.getPoints()
    ])
    setMotivation(mot)
    setTasks({ done: taskList.filter(t => t.done).length, total: taskList.length })
    setGamePoints(pts.todayEarned)

    // Generate AI summary
    generateSummary(mot, taskList.filter(t => t.done).length, taskList.length, pts.todayEarned)
  }

  const generateSummary = async (
    mot: MotivationState,
    tasksDone: number,
    tasksTotal: number,
    todayPoints: number
  ) => {
    const promptLead = lang === 'ru'
      ? 'Сгенерируй короткое мотивирующее резюме дня пользователя на русском языке в 3-5 предложениях. Говори прямо, дружелюбно.'
      : lang === 'ro'
        ? 'Generează un rezumat motivațional scurt pentru ziua utilizatorului în limba română, în 3-5 propoziții. Vorbește direct și prietenos.'
        : 'Generate a short motivational summary for the user\'s day in English, in 3-5 sentences. Speak directly and warmly.'

    const promptTail = lang === 'ru'
      ? 'Будь кратким, эмпатичным и поддерживающим. Если сделано мало, не осуждай — поддержи. Если сделано много, отпразднуй.'
      : lang === 'ro'
        ? 'Fii scurt, empatic și încurajator. Dacă a făcut puțin, nu judeca — încurajează. Dacă a făcut mult, celebrează.'
        : 'Be brief, empathetic, and encouraging. If they did little, do not judge — encourage. If they did a lot, celebrate.'

    const prompt = `${promptLead}
- Total XP: ${mot.xp}, Level: ${mot.level}
- Streak: ${mot.streak} days
- Tasks: ${tasksDone}/${tasksTotal} completed
- Brain Games: ${todayPoints} points earned today
${promptTail}`

    unsubRef.current = window.aura.chat.onToken((data: ChatTokenEvent) => {
      streamRef.current += data.token
      setSummary(streamRef.current)
      if (data.done) {
        setLoading(false)
      }
    })

    await window.aura.chat.send(prompt)
  }

  useEffect(() => {
    return () => { unsubRef.current?.() }
  }, [])

  // Stats cards
  const stats = [
    { icon: '🔥', label: t('daily.streak'), value: `${motivation?.streak || 0} ${lang === 'ru' ? 'д.' : lang === 'ro' ? 'zile' : 'days'}`, color: '#ef4444' },
    { icon: '⚡', label: t('daily.xpToday'), value: `+${motivation?.xp || 0}`, color: '#d97706' },
    { icon: '✅', label: t('daily.tasks'), value: `${tasks.done}/${tasks.total}`, color: '#10b981' },
    { icon: '🧠', label: t('daily.games'), value: `${gamePoints} ${lang === 'ru' ? 'очк.' : lang === 'ro' ? 'pct' : 'pts'}`, color: '#8b5cf6' }
  ]
  const locale = lang === 'ru' ? 'ru-RU' : lang === 'ro' ? 'ro-RO' : 'en-US'

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center p-6"
      style={{ background: 'rgba(8,6,6,0.95)', backdropFilter: 'blur(20px)' }}>

      <div className="w-full max-w-sm animate-fade-in-up">
        {/* Header */}
        <div className="text-center mb-6">
          <span className="text-3xl">📊</span>
          <h2 className="text-lg font-semibold text-aura-text mt-2" style={{ fontFamily: 'Georgia, serif' }}>
            {t('daily.title')}
          </h2>
          <p className="text-[10px] text-aura-muted mt-1">
            {new Date().toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-4 gap-2 mb-5">
          {stats.map(s => (
            <div key={s.label} className="text-center p-2 rounded-xl" style={{
              background: `${s.color}08`,
              border: `1px solid ${s.color}15`
            }}>
              <span className="text-lg">{s.icon}</span>
              <p className="text-xs font-bold mt-1" style={{ color: s.color }}>{s.value}</p>
              <p className="text-[8px] text-aura-muted">{s.label}</p>
            </div>
          ))}
        </div>

        {/* AI Summary */}
        <div className="p-4 rounded-xl mb-5" style={{
          background: 'rgba(26,23,20,0.6)',
          border: '1px solid rgba(42,37,32,0.3)'
        }}>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{
              background: 'radial-gradient(circle, #d97706, #92400e)'
            }}>
              <span className="text-[8px] font-bold text-white">A</span>
            </div>
            <span className="text-[10px] text-aura-muted">{t('daily.aiSays')}</span>
          </div>

          {loading && !summary ? (
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-aura-orange animate-typing-dot" />
                <div className="w-1.5 h-1.5 rounded-full bg-aura-orange animate-typing-dot" style={{ animationDelay: '0.2s' }} />
                <div className="w-1.5 h-1.5 rounded-full bg-aura-orange animate-typing-dot" style={{ animationDelay: '0.4s' }} />
              </div>
            </div>
          ) : (
            <p className="text-xs text-aura-text leading-relaxed whitespace-pre-wrap">{summary}</p>
          )}
        </div>

        {/* Mood check */}
        <div className="text-center mb-4">
          <p className="text-[10px] text-aura-muted mb-2">{t('daily.feeling')}</p>
          <div className="flex justify-center gap-2">
            {['😊', '😌', '😤', '😴', '🔥'].map(emoji => (
              <button key={emoji} onClick={onClose}
                className="w-10 h-10 rounded-full flex items-center justify-center text-lg transition-all hover:scale-125 active:scale-90"
                style={{ background: 'rgba(42,37,32,0.2)', border: '1px solid rgba(42,37,32,0.3)' }}>
                {emoji}
              </button>
            ))}
          </div>
        </div>

        <button onClick={onClose}
          className="w-full py-2.5 rounded-xl text-xs font-medium transition-all hover:scale-[1.02]"
          style={{
            background: 'linear-gradient(135deg, rgba(217,119,6,0.15), rgba(139,92,246,0.1))',
            border: '1px solid rgba(217,119,6,0.2)',
            color: '#d97706'
          }}>
          {t('daily.close')}
        </button>
      </div>
    </div>
  )
}
