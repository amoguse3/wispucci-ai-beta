import { useState, useEffect, useRef, useCallback, type CSSProperties } from 'react'
import Chat from './components/Chat'
import Sidebar from './components/Sidebar'
import OnboardingDesktop from './components/OnboardingDesktop'
import BodyDoublingMode from './components/BodyDoublingMode'
import MemoryPanel from './components/MemoryPanel'
import AIError from './components/AIError'
import EnergyPrompt from './components/EnergyPrompt'
import ThemedBackground from './components/ThemedBackground'
import { useTheme } from './contexts/ThemeContext'
import { useLanguage } from './contexts/LanguageContext'
import CourseList from './components/CourseList'
import CourseCreator from './components/CourseCreator'
import CourseView from './components/CourseView'
import FlashcardDeck from './components/FlashcardDeck'
import VoiceCall from './components/VoiceCall'
import PomodoroTimer from './components/PomodoroTimer'
import BrainGames from './components/BrainGames'
import DopamineMenu from './components/DopamineMenu'
import FocusMode from './components/FocusMode'
import DailySummary from './components/DailySummary'
import CareerMirror from './components/CareerMirror'
import Settings from './components/Settings'
import Tutorial from './components/Tutorial'
import QuickStartGuide from './components/QuickStartGuide'
import BotOrb from './components/BotOrb'
import type { BotMood } from './components/BotOrb'
import { MOOD_CONFIG } from './components/BotOrb'
import FloatingMenu from './components/FloatingMenu'
import type { MenuAction } from './components/FloatingMenu'
import Achievements from './components/Achievements'
import { BADGES } from '../../../shared/constants'
import TaskPanel from './components/TaskPanel'
import TopIndicator from './components/TopIndicator'
import TeacherMode from './components/TeacherMode'
import { playBoot, playBlip, playWhoosh, playDing, playClick, playMoodTone, playAchievement } from './lib/sounds'
import type { ChatAction } from './lib/chat-actions'
import { getChatActionLabel, parseChatAssistantResponse } from './lib/chat-actions'
import { useVoice } from './hooks/useVoice'
import type { UserProfile, AIStatus, ChatTokenEvent, Flashcard, MotivationState, QuickStartIntent } from '../../../shared/types'
import { t as translateString, type AppLanguage } from '../../../shared/i18n'

// ─── Typewriter Text ──────────────────────────────────────────────────────────
function TypewriterText({ text }: { text: string }) {
  const [displayed, setDisplayed] = useState('')
  const [idx, setIdx] = useState(0)

  useEffect(() => { setDisplayed(''); setIdx(0) }, [text])

  useEffect(() => {
    if (idx >= text.length) return
    const t = setTimeout(() => { setDisplayed(text.slice(0, idx + 1)); setIdx(idx + 1) }, 25 + Math.random() * 20)
    return () => clearTimeout(t)
  }, [idx, text])

  return (
    <p className="aura-theme-font text-sm leading-relaxed text-left max-w-md transition-colors duration-1000" style={{
      color: 'var(--aura-text, rgba(255,250,235,0.9))',
      textShadow: '0 0 12px rgba(255,245,220,0.4), 0 0 30px rgba(255,240,200,0.15)',
    }}>
      {displayed}
      {idx < text.length && <span className="inline-block w-[2px] h-3.5 ml-0.5 align-middle" style={{ background: 'rgba(255,250,235,0.9)', animation: 'blink 0.8s infinite' }} />}
    </p>
  )
}

// ─── Panel Overlay (wraps existing components) ──────────────────────────────
// Замени функцию PanelOverlay в App.tsx на эту:

function PanelOverlay({ children, onClose, wide }: { children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center" style={{
      padding: 'clamp(10px, 2vw, 20px)',
      background: 'rgba(5,3,3,0.7)',
      backdropFilter: 'blur(8px)',
    }}
      onClick={onClose}>
      <div className="relative overflow-hidden" onClick={e => e.stopPropagation()}
        style={{
          width: wide ? 'min(calc(960px * var(--aura-ui-scale, 1)), 96vw)' : 'min(calc(700px * var(--aura-ui-scale, 1)), 96vw)',
          maxWidth: '96vw',
          height: wide ? 'min(calc(640px * var(--aura-ui-scale, 1)), 92vh)' : 'min(calc(520px * var(--aura-ui-scale, 1)), 92vh)',
          maxHeight: '92vh',
          borderRadius: 'calc(16px * var(--aura-ui-scale, 1))',
          background: 'rgba(15,10,10,0.95)',
          border: '1px solid rgba(139,58,58,0.15)',
          boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
          animation: 'panelIn 0.35s cubic-bezier(.16,1,.3,1) forwards'
        }}>
        <div className="flex items-center justify-end px-4 py-2" style={{ borderBottom: '1px solid rgba(139,58,58,0.1)' }}>
          <button data-tutorial="panel-close" onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-xs transition-all hover:bg-white/5"
            style={{ color: 'rgba(200,160,140,0.3)' }}>✕</button>
        </div>
        <div className="overflow-y-auto" style={{ height: 'calc(100% - 44px)' }}>
          {children}
        </div>
      </div>
    </div>
  )
}

const BASE_VIEWPORT = {
  width: 1280,
  height: 760,
}

function clampValue(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function getUiScale(width: number, height: number) {
  return clampValue(Math.min(width / BASE_VIEWPORT.width, height / BASE_VIEWPORT.height), 0.74, 1)
}

function clampOrbPosition(position: { x: number; y: number }, width: number, height: number) {
  const insetX = clampValue(width * 0.13, 124, 168)
  const insetTop = clampValue(height * 0.18, 124, 172)
  const insetBottom = clampValue(height * 0.24, 180, 230)
  const maxX = Math.max(insetX, width - insetX)
  const maxY = Math.max(insetTop, height - insetBottom)

  return {
    x: clampValue(position.x, insetX, maxX),
    y: clampValue(position.y, insetTop, maxY),
  }
}

// ─── Chat Overlay ──────────────────────────────────────────────────────────────
function ChatOverlay({ profile, aiStatus, voice, onClose, onOpenTasks, onOpenCourses, onOpenCourseCreator, onOpenCourse, onOpenFlashcards, onOpenTeacher }: {
  profile: UserProfile; aiStatus: AIStatus | null
  voice: ReturnType<typeof useVoice>; onClose: () => void
  onOpenTasks: () => void
  onOpenCourses: () => void
  onOpenCourseCreator: () => void
  onOpenCourse: (courseId: number) => void
  onOpenFlashcards: () => void
  onOpenTeacher: (courseId: number) => void
}) {
  return (
    <PanelOverlay onClose={onClose}>
      <Chat profile={profile} aiStatus={aiStatus} voiceHook={voice}
        onStartVoiceCall={() => {}} onStartPomodoro={() => {}}
        onOpenTasks={onOpenTasks}
        onOpenCourses={onOpenCourses}
        onOpenCourseCreator={onOpenCourseCreator}
        onOpenCourse={onOpenCourse}
        onOpenFlashcards={onOpenFlashcards}
        onOpenTeacher={onOpenTeacher}
      />
    </PanelOverlay>
  )
}

export default function App() {
  const theme = useTheme()
  const { t, lang } = useLanguage()
  const isWebRuntime = typeof window !== 'undefined' && window.__AURA_RUNTIME__ === 'web'
  const [viewport, setViewport] = useState(() => ({
    width: typeof window === 'undefined' ? BASE_VIEWPORT.width : window.innerWidth,
    height: typeof window === 'undefined' ? BASE_VIEWPORT.height : window.innerHeight,
  }))
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [aiStatus, setAiStatus] = useState<AIStatus | null>(null)
  const [showEnergy, setShowEnergy] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [todayEnergy, setTodayEnergy] = useState<number | null>(null)
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null)
  const [showVoiceCall, setShowVoiceCall] = useState(false)
  const [showPomodoro, setShowPomodoro] = useState(false)
  const [showDopamine, setShowDopamine] = useState(false)
  const [showFocus, setShowFocus] = useState(false)
  const [showSummary, setShowSummary] = useState(false)
  const [showMirror, setShowMirror] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showTutorial, setShowTutorial] = useState(false)
  const [showQuickStart, setShowQuickStart] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [showGames, setShowGames] = useState(false)
  const [showCourses, setShowCourses] = useState(false)
  const [showTasks, setShowTasks] = useState(false)
  const [showTeacher, setShowTeacher] = useState(false)
  const [showAchievements, setShowAchievements] = useState(false)
  const [showBodyDoubling, setShowBodyDoubling] = useState(false)
  const [showMemory, setShowMemory] = useState(false)
  const [tutorialCourseGenerated, setTutorialCourseGenerated] = useState(false)
  const [teacherCourseId, setTeacherCourseId] = useState<number | undefined>(undefined)
  const [courseView, setCourseView] = useState<'list' | 'create' | 'view'>('list')
  const [courseEntryMode, setCourseEntryMode] = useState<'tree' | 'currentLesson'>('tree')
  const [courseCreatorSeed, setCourseCreatorSeed] = useState('')
  const [motivation, setMotivation] = useState<MotivationState | null>(null)
  const [showFlashcards, setShowFlashcards] = useState(false)
  const [flashcardCards, setFlashcardCards] = useState<Flashcard[]>([])
  const [pendingEnergyAfterQuickStart, setPendingEnergyAfterQuickStart] = useState(false)
  const voice = useVoice()

  // Bot state
  const [mood, setMood] = useState<BotMood>('neutral')
  const [speaking, setSpeaking] = useState(false)
  const [botText, setBotText] = useState('')
  const [showMenu, setShowMenu] = useState(false)
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [streamText, setStreamText] = useState('')
  const [botActions, setBotActions] = useState<ChatAction[]>([])
  const [achievement, setAchievement] = useState<{ icon: string; title: string; text: string } | null>(null)
  const prevXpRef = useRef(0)
  const prevBadgesRef = useRef<string[]>([])
  const unsubRef = useRef<(() => void) | null>(null)

  // ─── Draggable orb state ──────────────────────────────────────────────
  const [orbPos, setOrbPos] = useState<{ x: number; y: number } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const dragRef = useRef({
    active: false, moved: false,
    startClientX: 0, startClientY: 0,
    startOrbX: 0, startOrbY: 0,
  })
  const orbPosRef = useRef<{ x: number; y: number } | null>(null)
  orbPosRef.current = orbPos
  const uiScale = getUiScale(viewport.width, viewport.height)

  const showUnlockedBadgeToast = (badgeId: string) => {
    const badge = BADGES.find(b => b.id === badgeId)
    if (!badge) return
    playAchievement()
    setAchievement({
      icon: badge.icon,
      title: t('app.badgeUnlocked'),
      text: t(badge.nameKey),
    })
    setTimeout(() => setAchievement(null), 4200)
  }

  useEffect(() => {
    async function init() {
      const [p, status, energy, mot] = await Promise.all([
        window.aura.profile.get(),
        window.aura.ai.status(),
        window.aura.energy.getToday(),
        window.aura.motivation.getState()
      ])
      setProfile(p)
      setAiStatus(status)
      setTodayEnergy(energy)
      setMotivation(mot)
      prevXpRef.current = mot?.xp ?? 0
      prevBadgesRef.current = mot?.badges || []
      const profileLang = (p?.language || lang) as AppLanguage
      const tr = (key: string, params?: Record<string, string | number>) => translateString(key, profileLang, params)
      let welcomeBackMsg: string | null = null
      if (p?.onboardingDone) {
        const updated = await window.aura.motivation.updateStreak()
        setMotivation(updated)
        if (updated?.welcomeBack === 'freeze_used') {
          welcomeBackMsg = tr('app.welcomeBackFreeze', { name: p.name })
          setMood('grateful')
        } else if (updated?.welcomeBack === 'streak_reset') {
          welcomeBackMsg = tr('app.welcomeBackReset', { name: p.name })
          setMood('loving')
        }
      }
      if (p?.onboardingDone) {
        if (welcomeBackMsg) {
          setBotText(welcomeBackMsg)
          setSpeaking(true)
          playBoot()
          setTimeout(() => setSpeaking(false), 4500)
          // clear the flag so next session goes back to the normal greeting
          window.aura.motivation.acknowledgeWelcomeBack().then(setMotivation).catch(() => {})
        } else {
          // Time-based greeting (normal path)
          const hour = new Date().getHours()
          const timeGreetKey = hour < 6
            ? 'app.greeting.night'
            : hour < 12
              ? 'app.greeting.morning'
              : hour < 18
                ? 'app.greeting.afternoon'
                : 'app.greeting.evening'
          setBotText(tr('app.greeting.intro', { greeting: tr(timeGreetKey), name: p.name }))
          setSpeaking(true)
          playBoot()
          setTimeout(() => setSpeaking(false), 3000)
        }
      }
      const shouldShowFirstSessionTutorial = Boolean(
        p?.onboardingDone && p.onboardingQuickStartDone !== true && (mot?.xp ?? 0) === 0,
      )

      if (p?.onboardingDone && energy === null) {
        if (shouldShowFirstSessionTutorial) {
          setPendingEnergyAfterQuickStart(true)
        } else {
          setShowEnergy(true)
        }
      }

      if (shouldShowFirstSessionTutorial) {
        setShowTutorial(true)
      }
      setLoading(false)
    }
    init()
  }, [])

  useEffect(() => {
    if (!pendingEnergyAfterQuickStart) return

    const hasBlockingOverlay = showQuickStart || showTutorial || showTasks || showCourses || showFocus || showTeacher || showChat || showFlashcards || showMemory || showAchievements || showBodyDoubling || showSettings || showVoiceCall || showPomodoro || showDopamine || showSummary || showMirror || showGames
    if (hasBlockingOverlay || showEnergy || todayEnergy !== null) return

    setShowEnergy(true)
    setPendingEnergyAfterQuickStart(false)
  }, [pendingEnergyAfterQuickStart, showQuickStart, showTutorial, showTasks, showCourses, showFocus, showTeacher, showChat, showFlashcards, showMemory, showAchievements, showBodyDoubling, showSettings, showVoiceCall, showPomodoro, showDopamine, showSummary, showMirror, showGames, showEnergy, todayEnergy])

  useEffect(() => {
    const iv = setInterval(async () => {
      try {
        const mot = await window.aura.motivation.getState()
        const prev = prevBadgesRef.current
        const newBadges = (mot.badges || []).filter(b => !prev.includes(b))
        if (newBadges.length > 0) {
          showUnlockedBadgeToast(newBadges[newBadges.length - 1])
        }
        prevBadgesRef.current = mot.badges || []
        setMotivation(mot)
      } catch {
        // ignore polling errors
      }
    }, 8000)
    return () => clearInterval(iv)
  }, [])

  useEffect(() => {
    if (!profile?.onboardingDone) return
    const timer = setInterval(() => {
      window.aura.motivation.addMinutes(1).then(setMotivation).catch(() => {})
    }, 60000)
    return () => clearInterval(timer)
  }, [profile?.onboardingDone])

  // ─── Orb position: load from storage + clamp on resize ────────────────
  useEffect(() => {
    try {
      const saved = localStorage.getItem('aura_orb_pos')
      if (saved) {
        const p = JSON.parse(saved)
        if (typeof p?.x === 'number' && typeof p?.y === 'number') {
          setOrbPos(clampOrbPosition({ x: p.x, y: p.y }, window.innerWidth, window.innerHeight))
        }
      }
    } catch { /* ignore */ }

    const onResize = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight })
      setOrbPos(prev => {
        if (!prev) return prev
        return clampOrbPosition(prev, window.innerWidth, window.innerHeight)
      })
    }
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const startOrbDrag = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return
    const host = e.currentTarget as HTMLElement
    const rect = host.getBoundingClientRect()
    const currentX = rect.left + rect.width / 2
    const currentY = rect.top + rect.height / 2
    dragRef.current = {
      active: true, moved: false,
      startClientX: e.clientX, startClientY: e.clientY,
      startOrbX: currentX, startOrbY: currentY,
    }

    const onMove = (ev: PointerEvent) => {
      const d = dragRef.current
      if (!d.active) return
      const dx = ev.clientX - d.startClientX
      const dy = ev.clientY - d.startClientY
      if (!d.moved && Math.hypot(dx, dy) > 5) {
        d.moved = true
        setIsDragging(true)
        document.body.style.cursor = 'grabbing'
      }
      if (d.moved) {
        setOrbPos(clampOrbPosition({ x: d.startOrbX + dx, y: d.startOrbY + dy }, window.innerWidth, window.innerHeight))
      }
    }

    const onUp = () => {
      const d = dragRef.current
      if (d.moved) {
        const pos = orbPosRef.current
        if (pos) {
          try { localStorage.setItem('aura_orb_pos', JSON.stringify(pos)) } catch { /* ignore */ }
        }
      }
      d.active = false
      setIsDragging(false)
      document.body.style.cursor = ''
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [])

  const handleOrbClick = useCallback(() => {
    // Suppress menu-toggle if the last pointer interaction was a drag
    if (dragRef.current.moved) {
      dragRef.current.moved = false
      return
    }
    setShowMenu(prev => !prev)
  }, [])

  // Double-click the orb to reset to center
  const handleOrbDoubleClick = useCallback(() => {
    setOrbPos(null)
    try { localStorage.removeItem('aura_orb_pos') } catch { /* ignore */ }
  }, [])

  // Subscribe to AI tokens for inline bot text
  useEffect(() => {
    unsubRef.current = window.aura.chat.onToken((data: ChatTokenEvent) => {
      if (data.done) {
        setIsTyping(false)
        setStreamText(prev => {
          const final = prev + data.token
          const parsed = parseChatAssistantResponse(final)
          const visibleText = parsed.visibleText || final
          setBotText(visibleText)
          setBotActions(parsed.actions)
          setSpeaking(true)
          setTimeout(() => setSpeaking(false), 3000)

          // Detect mood from response
          const s = visibleText.toLowerCase()
          let newMood: BotMood = 'happy'
          if (/haha|lol|amuzant|funny/.test(s)) newMood = 'laughing'
          else if (/trist|rău|greu|sad|bad|hard/.test(s)) newMood = 'sad'
          else if (/super|minunat|genial|bravo|great|awesome|amazing/.test(s)) newMood = 'excited'
          else if (/gândesc|analize|think|analy/.test(s)) newMood = 'thinking'
          else if (/calm|liniștit|relaxa|peaceful|relax/.test(s)) newMood = 'calm'
          setMood(newMood)
          playMoodTone(newMood)

          // Check for level-up
          window.aura.motivation.getState().then(mot => {
            if (mot && mot.xp > prevXpRef.current) {
              const prevLevel = motivation?.level ?? 1
              const prevBadges = prevBadgesRef.current
              const newBadges = (mot.badges || []).filter(b => !prevBadges.includes(b))
              if (mot.level > prevLevel) {
                playAchievement()
                setAchievement({
                  icon: '⬆',
                  title: t('app.levelUpTitle'),
                  text: t('app.levelReached', { level: mot.level }),
                })
                setTimeout(() => setAchievement(null), 4000)
              } else if (newBadges.length > 0) {
                showUnlockedBadgeToast(newBadges[newBadges.length - 1])
              }
              prevXpRef.current = mot.xp
              prevBadgesRef.current = mot.badges || []
              setMotivation(mot)
            }
          })

          return ''
        })
      } else {
        setStreamText(prev => {
          const updated = prev + data.token
          setBotText(updated)
          return updated
        })
      }
    })
    return () => { unsubRef.current?.() }
  }, [])

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isTyping) return
    setInput('')
    setIsTyping(true)
    setStreamText('')
    setBotActions([])
    setMood('thinking')
    setBotText(t('chat.thinking'))
    setSpeaking(false)
    playBlip()
    await window.aura.chat.send(text.trim())
  }, [isTyping, t])

  // Listen for messages from the floating orb overlay
  useEffect(() => {
    const unsub = window.aura.overlay.onMessage((msg: string) => {
      if (msg) sendMessage(msg)
    })
    return unsub
  }, [sendMessage])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const handleMenuSelect = (action: MenuAction) => {
    setShowMenu(false)
    playClick()
    playWhoosh()
    switch (action) {
      case 'chat': setShowChat(true); break
      case 'tasks': setShowTasks(true); break
      case 'games': setShowGames(true); break
      case 'courses': setShowCourses(true); break
      case 'focus': setShowFocus(true); break
      case 'teacher': setTeacherCourseId(undefined); setShowTeacher(true); break
      case 'achievements': setShowAchievements(true); break
      case 'companion': setShowBodyDoubling(true); break
      case 'memory': setShowMemory(true); break
      case 'settings': setShowSettings(true); break
    }
  }

  const openTasksFromBot = useCallback(() => {
    setShowChat(false)
    setShowTasks(true)
    setBotActions([])
  }, [])

  const openCoursesListFromBot = useCallback(() => {
    setShowChat(false)
    setSelectedCourseId(null)
    setCourseEntryMode('tree')
    setCourseCreatorSeed('')
    setCourseView('list')
    setShowCourses(true)
    setBotActions([])
  }, [])

  const openCourseCreatorFromBot = useCallback(() => {
    setShowChat(false)
    setSelectedCourseId(null)
    setCourseEntryMode('tree')
    setCourseCreatorSeed('')
    setCourseView('create')
    setShowCourses(true)
    setBotActions([])
  }, [])

  const openCourseFromBot = useCallback((courseId: number) => {
    setShowChat(false)
    setSelectedCourseId(courseId)
    setCourseEntryMode('currentLesson')
    setCourseView('view')
    setShowCourses(true)
    setBotActions([])
  }, [])

  const openFlashcardsFromBot = useCallback(async () => {
    setShowChat(false)
    try {
      const cards = await window.aura.educator.getDueFlashcards()
      if (!cards.length) {
        setBotText(t('app.flashcards.noneDue'))
        setBotActions([])
        return
      }
      setFlashcardCards(cards)
      setShowFlashcards(true)
      setBotActions([])
    } catch {
      setBotText(t('app.flashcards.openError'))
      setBotActions([])
    }
  }, [t])

  const openTeacherFromBot = useCallback((courseId: number) => {
    setShowChat(false)
    setTeacherCourseId(courseId)
    setShowTeacher(true)
    setShowCourses(false)
    setBotActions([])
  }, [])

  const handleQuickStartChoice = useCallback(async (intent: QuickStartIntent) => {
    if (!profile) return

    const nextProfile: UserProfile = {
      ...profile,
      onboardingIntent: intent,
      onboardingQuickStartDone: true,
    }

    setProfile(nextProfile)
    setShowQuickStart(false)
    setMood('excited')
    setSpeaking(true)
    setTimeout(() => setSpeaking(false), 2600)

    try {
      await window.aura.profile.save(nextProfile)
    } catch {
      // Keep the quick-start flow moving even if persistence fails once.
    }

    try {
      const updatedMotivation = await window.aura.motivation.addXP(25)
      prevXpRef.current = updatedMotivation.xp
      prevBadgesRef.current = updatedMotivation.badges || []
      setMotivation(updatedMotivation)
    } catch {
      // Bonus XP is helpful but should not block the first action.
    }

    playAchievement()
    setAchievement({
      icon: '✦',
      title: t('app.quickStart.title'),
      text: '+25 XP',
    })
    setTimeout(() => setAchievement(null), 4000)

    if (intent === 'organize') {
      setBotText(t('app.quickStart.organize'))
      setShowTasks(true)
      return
    }

    if (intent === 'learn') {
      setBotText(t('app.quickStart.learn'))
      setSelectedCourseId(null)
      setCourseEntryMode('tree')
      setCourseCreatorSeed('')
      setCourseView('create')
      setShowCourses(true)
      return
    }

    setBotText(t('app.quickStart.focus'))
    setShowFocus(true)
  }, [profile, t])

  const completeGuidedTutorial = useCallback(async () => {
    if (!profile) return

    const nextProfile: UserProfile = {
      ...profile,
      onboardingIntent: 'learn',
      onboardingQuickStartDone: true,
    }

    setProfile(nextProfile)
    setShowTutorial(false)
    setTutorialCourseGenerated(false)
    setPendingEnergyAfterQuickStart(false)
    setMood('proud')
    setBotText(t('app.tutorialComplete'))
    setSpeaking(true)
    setTimeout(() => setSpeaking(false), 3200)

    try {
      await window.aura.profile.save(nextProfile)
    } catch {
      // Keep the first-session flow moving even if persistence fails once.
    }

    try {
      const updatedMotivation = await window.aura.motivation.addXP(25)
      prevXpRef.current = updatedMotivation.xp
      prevBadgesRef.current = updatedMotivation.badges || []
      setMotivation(updatedMotivation)
    } catch {
      // XP bonus is helpful but should not block tutorial completion.
    }

    playAchievement()
    setAchievement({
      icon: '🌱',
      title: t('app.firstCourse.title'),
      text: '+25 XP',
    })
    setTimeout(() => setAchievement(null), 4200)

    if (todayEnergy === null) {
      setShowEnergy(true)
    }
  }, [profile, t, todayEnergy])

  const runBotAction = useCallback((action: ChatAction) => {
    switch (action.kind) {
      case 'OPEN_TASKS':
        openTasksFromBot()
        break
      case 'OPEN_COURSES':
        openCoursesListFromBot()
        break
      case 'OPEN_COURSE_CREATOR':
        openCourseCreatorFromBot()
        break
      case 'OPEN_COURSE':
        if (action.courseId) openCourseFromBot(action.courseId)
        break
      case 'OPEN_FLASHCARDS':
        void openFlashcardsFromBot()
        break
      case 'OPEN_TEACHER':
        if (action.courseId) openTeacherFromBot(action.courseId)
        break
    }
  }, [openCourseCreatorFromBot, openCourseFromBot, openCoursesListFromBot, openFlashcardsFromBot, openTasksFromBot, openTeacherFromBot])

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center" style={{ background: '#080606' }}>
        <ThemedBackground />
        <div className="relative z-10 flex flex-col items-center gap-4 animate-fade-in">
          <div className="w-16 h-16 rounded-full animate-breathe" style={{
            background: 'radial-gradient(circle, #d97706 0%, #92400e 70%, transparent 100%)',
            boxShadow: '0 0 40px rgba(217,119,6,0.4), 0 0 80px rgba(217,119,6,0.1)'
          }} />
          <span className="text-aura-muted text-sm tracking-widest uppercase">wispucci ai beta</span>
        </div>
      </div>
    )
  }

  if (!profile?.onboardingDone) {
    return (
      <div className="h-full" style={{ background: '#080606' }}>
        <ThemedBackground />
        <OnboardingDesktop onComplete={async (p) => {
          await window.aura.profile.save(p)
          setProfile(p)
          setTutorialCourseGenerated(false)
          setShowTutorial(true)
        }} />
      </div>
    )
  }

  // AI status no longer blocks the UI — user can set key in Settings

  const moodCfg = MOOD_CONFIG[mood]
  const shellStyle = {
    background: '#080606',
    fontFamily: theme.fontFamily,
    '--aura-ui-scale': String(uiScale),
  } as CSSProperties

  return (
    <div className="h-full flex flex-col" style={shellStyle}>
      <ThemedBackground />

      {/* Titlebar */}
      <div className="titlebar-drag h-8 flex items-center justify-between px-4 shrink-0 relative z-50"
        style={{ background: 'rgba(10,6,6,0.85)', borderBottom: '1px solid rgba(139,58,58,0.06)' }}>
        <div className="flex items-center gap-3 titlebar-nodrag">
          <div className="w-2 h-2 rounded-full" style={{
            background: aiStatus?.running ? '#10b981' : '#ef4444',
            boxShadow: aiStatus?.running ? '0 0 6px #10b981' : '0 0 6px #ef4444'
          }} />
          <span className="text-[10px] tracking-[0.2em] uppercase font-medium" style={{ color: 'rgba(200,160,140,0.25)' }}>wispucci ai beta</span>
          <span className="text-[8px]" style={{ color: 'rgba(200,160,140,0.12)' }}>· beta</span>
          {isWebRuntime && (
            <span className="text-[8px] px-2 py-1 rounded-full" style={{
              color: 'rgba(96,180,255,0.78)',
              background: 'rgba(96,180,255,0.08)',
              border: '1px solid rgba(96,180,255,0.16)',
            }}>
              {t('app.localWeb')}
            </span>
          )}
        </div>
        {!isWebRuntime && (
          <div className="flex items-center gap-0.5 titlebar-nodrag">
            <button onClick={() => window.aura.window.minimize()}
              className="w-7 h-5 rounded flex items-center justify-center text-[10px]" style={{ color: 'rgba(200,160,140,0.15)' }}>—</button>
            <button onClick={() => window.aura.window.close()}
              className="w-7 h-5 rounded flex items-center justify-center text-[10px] hover:text-red-400" style={{ color: 'rgba(200,160,140,0.15)' }}>✕</button>
          </div>
        )}
      </div>

      {/* Top center rotating task/course indicator */}
      <TopIndicator
        onClickTask={() => setShowTasks(true)}
        onClickCourse={(courseId) => {
          setSelectedCourseId(courseId)
          setCourseEntryMode('tree')
          setCourseView('view')
          setShowCourses(true)
        }}
      />

      {/* CENTER — Bot Orb (draggable) + Typewriter Text (follows orb) */}
      {(() => {
        const ORB_HALF = 143    // half of orb container 286
        const TEXT_W = 380
        const GAP = 24
        const usingCustomPos = orbPos !== null
        // If there's no room to the right, flip text to the left of the orb.
        const textOnRight = usingCustomPos
          ? (orbPos!.x + ORB_HALF + GAP + TEXT_W) < (window.innerWidth - 16)
          : true
        const transitionCss = isDragging
          ? 'none'
          : 'left 0.35s cubic-bezier(.16,1,.3,1), top 0.35s cubic-bezier(.16,1,.3,1)'

        return (
          <div className="relative z-20 flex-1 min-h-0 transition-all duration-700"
            style={{ opacity: showMenu ? 0.3 : 1, filter: showMenu ? 'blur(2px)' : 'none' }}>
            {/* Orb (draggable) */}
            <div
              onPointerDown={startOrbDrag}
              onDoubleClick={handleOrbDoubleClick}
              data-tutorial="orb-button"
              title="Drag the orb anywhere · double-click to re-center"
              style={{
                position: 'absolute',
                left: usingCustomPos ? orbPos!.x : '50%',
                top:  usingCustomPos ? orbPos!.y : '50%',
                transform: 'translate(-50%,-50%)',
                cursor: isDragging ? 'grabbing' : 'grab',
                userSelect: 'none',
                touchAction: 'none',
                transition: transitionCss,
              }}
            >
              <BotOrb mood={mood} speaking={speaking} onClick={handleOrbClick} customImage={theme.orbImage} />
            </div>

            {/* Typewriter text — follows orb, flips side automatically */}
            <div
              className="overflow-hidden"
              style={{
                position: 'absolute',
                width: TEXT_W,
                maxWidth: '40vw',
                pointerEvents: 'none',
                left: usingCustomPos
                  ? (textOnRight
                      ? orbPos!.x + ORB_HALF + GAP
                      : orbPos!.x - ORB_HALF - GAP - TEXT_W)
                  : `calc(50% + ${ORB_HALF + GAP}px)`,
                top: usingCustomPos ? orbPos!.y : '50%',
                transform: 'translateY(-50%)',
                transition: transitionCss,
                opacity: showMenu ? 0 : 1,
              }}
            >
              <TypewriterText text={botText} />
            </div>
          </div>
        )
      })()}

      {/* Bottom input — full width */}
      <div className="relative z-30 shrink-0 px-4 py-3">
        {botActions.length > 0 && !isTyping && (
          <div className="mb-3 flex flex-wrap items-center gap-2 px-1">
            {botActions.map((action, index) => (
              <button
                key={`${action.kind}:${action.courseId || index}`}
                onClick={() => runBotAction(action)}
                className="rounded-xl px-4 py-2 text-[10px] transition-all duration-300"
                style={{
                  fontFamily: theme.fontFamily,
                  background: 'rgba(196,154,60,0.08)',
                  border: '1px solid rgba(196,154,60,0.18)',
                  color: 'rgba(245,228,168,0.8)',
                  boxShadow: '0 0 18px rgba(196,154,60,0.08)',
                }}
              >
                {getChatActionLabel(action, t)}
              </button>
            ))}
          </div>
        )}
        <div className="w-full flex items-center gap-2 rounded-2xl px-5 py-3 transition-all duration-500 aura-input-wrap" style={{
          }} data-tutorial="chat-input">
          <div className="contents" style={{
          background: 'rgba(10,6,6,0.8)', backdropFilter: 'blur(20px)',
          border: `1px solid ${input ? `${moodCfg.orb}50` : 'rgba(139,58,58,0.08)'}`,
          boxShadow: input
            ? `0 0 20px ${moodCfg.orb}15, 0 0 40px ${moodCfg.orb}08, inset 0 0 20px ${moodCfg.orb}05`
            : '0 0 8px rgba(255,245,220,0.04)',
        }}>
          <input value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('app.inputPlaceholder')}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-white/10"
            style={{ color: 'rgba(230,200,190,0.8)' }} />
          <button onClick={() => sendMessage(input)} disabled={!input.trim() || isTyping}
            className="w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300"
            style={{
              background: input.trim() ? `${moodCfg.orb}25` : 'rgba(255,255,255,0.02)',
              border: `1px solid ${input.trim() ? `${moodCfg.orb}35` : 'rgba(255,255,255,0.04)'}`,
              opacity: input.trim() ? 1 : 0.3,
            }}>
            <span style={{ color: 'rgba(230,200,190,0.6)' }}>↑</span>
          </button>
          </div>
        </div>
      </div>

      {/* Radial floating menu */}
      <FloatingMenu open={showMenu} onClose={() => setShowMenu(false)} onSelect={handleMenuSelect} />

      {/* Chat overlay */}
      {showChat && (
        <ChatOverlay
          profile={profile}
          aiStatus={aiStatus}
          voice={voice}
          onClose={() => setShowChat(false)}
          onOpenTasks={openTasksFromBot}
          onOpenCourses={openCoursesListFromBot}
          onOpenCourseCreator={openCourseCreatorFromBot}
          onOpenCourse={openCourseFromBot}
          onOpenFlashcards={() => { void openFlashcardsFromBot() }}
          onOpenTeacher={openTeacherFromBot}
        />
      )}

      {/* Tasks overlay */}
      {showTasks && (
        <PanelOverlay onClose={() => setShowTasks(false)}>
          <TaskPanel />
        </PanelOverlay>
      )}

      {/* Games overlay */}
      {showGames && (
        <PanelOverlay onClose={() => setShowGames(false)}>
          <BrainGames />
        </PanelOverlay>
      )}

      {/* Courses overlay */}
      {showCourses && (
        <PanelOverlay onClose={() => { setShowCourses(false); setCourseView('list'); setCourseEntryMode('tree'); setSelectedCourseId(null); setCourseCreatorSeed('') }}>
          {courseView === 'view' && selectedCourseId ? (
            <CourseView
              courseId={selectedCourseId}
              entryMode={courseEntryMode}
              onBack={() => { setSelectedCourseId(null); setCourseEntryMode('tree'); setCourseView('list'); setCourseCreatorSeed('') }}
              onStartSuggestedCourse={(topic) => {
                setSelectedCourseId(null)
                setCourseEntryMode('tree')
                setCourseCreatorSeed(topic)
                setCourseView('create')
              }}
            />
          ) : courseView === 'create' ? (
            <CourseCreator
              initialTopic={courseCreatorSeed}
              onBack={() => { setCourseCreatorSeed(''); setCourseView('list') }}
              onCourseCreated={() => { setCourseCreatorSeed(''); setCourseView('list') }}
              onCourseGenerated={() => setTutorialCourseGenerated(true)}
            />
          ) : (
            <CourseList
              onSelectCourse={(id) => { setSelectedCourseId(id); setCourseEntryMode('tree'); setCourseView('view') }}
              onCreateCourse={() => { setCourseCreatorSeed(''); setCourseView('create') }}
              onOpenTeacher={(id) => { setTeacherCourseId(id); setShowTeacher(true); setShowCourses(false) }}
            />
          )}
        </PanelOverlay>
      )}

      {showFlashcards && (
        <PanelOverlay onClose={() => { setShowFlashcards(false); setFlashcardCards([]) }}>
          <FlashcardDeck moduleId={0} cards={flashcardCards} onBack={() => { setShowFlashcards(false); setFlashcardCards([]) }} />
        </PanelOverlay>
      )}

      {/* Teacher mode */}
      {showTeacher && (
        <TeacherMode onClose={() => { setShowTeacher(false); setTeacherCourseId(undefined) }} initialCourseId={teacherCourseId} />
      )}

      {/* Achievements overlay */}
      {showAchievements && (
        <Achievements onClose={() => setShowAchievements(false)} />
      )}

      {/* Memory panel overlay */}
      {showMemory && (
        <PanelOverlay onClose={() => setShowMemory(false)}>
          <MemoryPanel />
        </PanelOverlay>
      )}

      {/* Voice call overlay */}
      {showVoiceCall && (
        <VoiceCall voiceHook={voice} onEnd={() => setShowVoiceCall(false)} />
      )}

      {/* Pomodoro overlay */}
      {showPomodoro && (
        <PomodoroTimer onClose={() => setShowPomodoro(false)} speak={voice.speak} />
      )}

      {/* Dopamine Menu */}
      {showDopamine && profile && (
        <DopamineMenu profile={profile} onClose={() => setShowDopamine(false)} onRewardPicked={() => {}} />
      )}

      {/* Focus Mode */}
      {showFocus && (
        <FocusMode onClose={() => setShowFocus(false)} speak={voice.speak} />
      )}

      {/* Daily Summary */}
      {showSummary && (
        <DailySummary onClose={() => setShowSummary(false)} />
      )}

      {/* Career Mirror */}
      {showMirror && (
        <CareerMirror onClose={() => setShowMirror(false)} />
      )}

      {/* Settings */}
      {showSettings && profile && (
        <Settings profile={profile} isWebRuntime={isWebRuntime} onClose={() => setShowSettings(false)} />
      )}

      {/* Tutorial overlay */}
      {showTutorial && (
        <Tutorial
          showMenu={showMenu}
          showCourses={showCourses}
          showTasks={showTasks}
          showFocus={showFocus}
          showSettings={showSettings}
          courseView={courseView}
          courseGenerated={tutorialCourseGenerated}
          onEnsureCourseCreator={() => {
            setShowMenu(false)
            setShowTasks(false)
            setShowFocus(false)
            setShowSettings(false)
            setSelectedCourseId(null)
            setCourseEntryMode('tree')
            setCourseCreatorSeed('')
            setCourseView('create')
            setShowCourses(true)
          }}
          onEnsureCourseList={() => {
            setShowMenu(false)
            setShowTasks(false)
            setShowFocus(false)
            setShowSettings(false)
            setSelectedCourseId(null)
            setCourseEntryMode('tree')
            setCourseView('list')
            setShowCourses(true)
          }}
          onCloseCourses={() => {
            setShowCourses(false)
            setCourseView('list')
            setCourseEntryMode('tree')
            setSelectedCourseId(null)
          }}
          onEnsureMenuOpen={() => {
            setShowCourses(false)
            setShowTasks(false)
            setShowFocus(false)
            setShowSettings(false)
            setShowMenu(true)
          }}
          onCloseMenu={() => setShowMenu(false)}
          onCloseTasks={() => setShowTasks(false)}
          onCloseFocus={() => setShowFocus(false)}
          onCloseSettings={() => setShowSettings(false)}
          onComplete={() => { void completeGuidedTutorial() }}
        />
      )}

      {/* Energy prompt overlay */}
      {showEnergy && (
        <EnergyPrompt
          name={profile.name}
          onSubmit={async (level) => {
            await window.aura.energy.log(level)
            setTodayEnergy(level)
            setShowEnergy(false)
          }}
          onSkip={() => setShowEnergy(false)}
        />
      )}

      {sidebarOpen && <Sidebar onClose={() => setSidebarOpen(false)} profile={profile} />}

      {/* Silent Body-Doubling — ambient presence mode */}
      {showBodyDoubling && (
        <BodyDoublingMode
          userName={profile.name}
          language={profile.language}
          onExit={() => setShowBodyDoubling(false)}
        />
      )}

      {/* Achievement toast */}
      {achievement && (
        <div className="absolute bottom-4 right-4 z-[60] flex items-center gap-2 px-3 py-2 rounded-lg"
          style={{
            fontFamily: "'Press Start 2P', monospace",
            background: 'rgba(10,6,6,0.9)',
            border: '1px solid rgba(245,158,11,0.25)',
            boxShadow: '0 0 20px rgba(245,158,11,0.1), 0 8px 24px rgba(0,0,0,0.4)',
            animation: 'achieveMinecraft 4.2s cubic-bezier(.16,1,.3,1) forwards',
            minWidth: 240,
          }}>
          <span style={{ fontSize: 14 }}>{achievement.icon}</span>
          <div className="flex flex-col gap-0.5">
            <span style={{ fontSize: 6, color: 'rgba(200,160,140,0.7)', letterSpacing: '0.08em' }}>{achievement.title}</span>
            <span style={{ fontSize: 7, color: 'rgba(251,191,36,0.85)', letterSpacing: '0.08em' }}>{achievement.text}</span>
          </div>
        </div>
      )}

      {/* XP progress bar (subtle, below titlebar) */}
      {motivation && (
        <div className="absolute top-8 left-0 right-0 z-30 h-[2px]" style={{ background: 'rgba(139,58,58,0.06)' }}>
          <div className="h-full transition-all duration-1000 ease-out" style={{
            width: `${Math.min(100, ((motivation.xp % 100) / 100) * 100)}%`,
            background: 'linear-gradient(90deg, rgba(217,119,6,0.3), rgba(245,158,11,0.5))',
            boxShadow: '0 0 8px rgba(245,158,11,0.2)',
          }} />
        </div>
      )}

      {/* All CSS animations */}
      <style>{`
        /* Orb body animations */
        @keyframes orbBreathe { 0%,100%{transform:scale(1)} 50%{transform:scale(1.06)} }
        @keyframes orbSpeak { 0%,100%{transform:scale(1)} 25%{transform:scale(1.1)} 75%{transform:scale(0.96)} }
        @keyframes orbBounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        @keyframes orbSpin { 0%{transform:rotate(0deg) scale(1)} 50%{transform:rotate(180deg) scale(1.04)} 100%{transform:rotate(360deg) scale(1)} }
        @keyframes orbDroop { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(4px) scale(0.97)} }
        @keyframes orbVibrate { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-3px)} 75%{transform:translateX(3px)} }
        @keyframes orbFloat { 0%,100%{transform:translateY(0)} 33%{transform:translateY(-6px)} 66%{transform:translateY(3px)} }
        @keyframes orbSleep { 0%,100%{transform:scale(0.95);opacity:0.7} 50%{transform:scale(1);opacity:0.85} }
        @keyframes orbWake { 0%{transform:scale(0.9);opacity:0.5} 50%{transform:scale(1.1);opacity:1} 100%{transform:scale(1);opacity:1} }
        @keyframes orbDance {
          0%{transform:translateY(0) rotate(0deg) scale(1)}
          15%{transform:translateY(-6px) rotate(-4deg) scale(1.03)}
          30%{transform:translateY(0) rotate(0deg) scale(0.98)}
          45%{transform:translateY(-8px) rotate(5deg) scale(1.04)}
          60%{transform:translateY(0) rotate(0deg) scale(1)}
          75%{transform:translateY(-5px) rotate(-3deg) scale(1.02)}
          90%{transform:translateY(1px) rotate(0deg) scale(0.99)}
          100%{transform:translateY(0) rotate(0deg) scale(1)}
        }
        @keyframes orbLaugh { 0%,100%{transform:scale(1) rotate(0)} 25%{transform:scale(1.06) rotate(-2deg)} 75%{transform:scale(1.06) rotate(2deg)} }
        @keyframes orbTilt { 0%,100%{transform:rotate(0deg)} 50%{transform:rotate(10deg)} }
        @keyframes orbGrow { 0%,100%{transform:scale(1)} 50%{transform:scale(1.12)} }
        @keyframes orbShiver { 0%,100%{transform:translateX(0)} 10%{transform:translateX(-1.5px)} 20%{transform:translateX(1.5px)} 30%{transform:translateX(-1px)} 40%{transform:translateX(1px)} 50%{transform:translateX(0)} }
        @keyframes orbHeartbeat { 0%,100%{transform:scale(1)} 15%{transform:scale(1.12)} 30%{transform:scale(1)} 45%{transform:scale(1.08)} }
        @keyframes orbLaser { 0%,100%{transform:scale(1)} 50%{transform:scale(1.03)} }
        @keyframes orbWobble { 0%,100%{transform:rotate(0deg)} 25%{transform:rotate(-8deg)} 75%{transform:rotate(8deg)} }
        @keyframes orbGlow { 0%,100%{filter:brightness(1)} 50%{filter:brightness(1.25)} }
        @keyframes orbElectric { 0%,100%{transform:translateX(0) scale(1)} 10%{transform:translateX(-3px) scale(1.02)} 20%{transform:translateX(3px) scale(0.98)} 30%{transform:translateX(-1px)} 40%{transform:translateX(0) scale(1)} }
        @keyframes orbFade { 0%,100%{opacity:0.6;transform:scale(1)} 50%{transform:scale(1.02);opacity:1} }
        @keyframes orbRise { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(-10px) scale(1.06)} }

        /* Face animations */
        @keyframes faceSpeak { 0%,100%{transform:scale(1)} 50%{transform:scale(1.03)} }
        @keyframes mouthTalk { 0%,100%{d:path("M40,56 Q50,62 60,56")} 50%{d:path("M40,56 Q50,68 60,56")} }
        @keyframes eyeLook { 0%,100%{transform:translateX(0)} 30%{transform:translateX(2px)} 70%{transform:translateX(-2px)} }
        @keyframes thinkDot { 0%,100%{opacity:0.3;transform:scale(0.8)} 50%{opacity:0.8;transform:scale(1.2)} }

        /* Environment */
        @keyframes orbPulse { 0%,100%{opacity:0.5;transform:scale(1)} 50%{opacity:0.8;transform:scale(1.15)} }
        @keyframes ringPulse { 0%,100%{opacity:0.3;transform:scale(1)} 50%{opacity:0;transform:scale(1.3)} }
        @keyframes ringDance { 0%,100%{transform:scale(1) rotate(0)} 50%{transform:scale(1.08) rotate(5deg)} }
        @keyframes musicBar { 0%{height:4px;opacity:0.4} 100%{height:16px;opacity:0.7} }
        @keyframes particleFloat {
          0%,100%{transform:translateY(0) scale(1);opacity:0.2}
          50%{transform:translateY(-18px) scale(1.15);opacity:0.5}
        }
        @keyframes zzz { 0%,100%{transform:translateY(0) scale(1);opacity:0.4} 50%{transform:translateY(-10px) scale(1.2);opacity:0.7} }
        @keyframes dustOrbit { 0%{transform:rotate(0deg) translateX(70px) rotate(0deg)} 100%{transform:rotate(360deg) translateX(70px) rotate(-360deg)} }
        @keyframes saturnRing {
          0%   { transform: rotateX(70deg) rotateZ(0deg) rotateY(0deg); }
          20%  { transform: rotateX(45deg) rotateZ(15deg) rotateY(10deg); }
          40%  { transform: rotateX(75deg) rotateZ(-10deg) rotateY(-15deg); }
          60%  { transform: rotateX(35deg) rotateZ(20deg) rotateY(5deg); }
          80%  { transform: rotateX(65deg) rotateZ(-15deg) rotateY(-10deg); }
          100% { transform: rotateX(70deg) rotateZ(0deg) rotateY(0deg); }
        }

        /* UI animations */
        @keyframes blink { 0%,50%{opacity:1} 51%,100%{opacity:0} }
        @keyframes menuPop { from{opacity:0;transform:scale(0.5)} to{opacity:1;transform:scale(1)} }
        @keyframes panelIn { from{opacity:0;transform:scale(0.95) translateY(10px)} to{opacity:1;transform:scale(1) translateY(0)} }

        /* Top indicator animations */
        @keyframes indicatorSlideIn { from{opacity:0;transform:translateX(-50%) translateY(-8px)} to{opacity:1;transform:translateX(-50%) translateY(0)} }
        @keyframes indicatorPulse { 0%,100%{opacity:0.5} 50%{opacity:1} }

        /* Achievement toast (Minecraft-style bottom-right) */
        @keyframes achieveMinecraft {
          0%   { opacity: 0; transform: translateX(120%); }
          12%  { opacity: 1; transform: translateX(0); }
          78%  { opacity: 1; transform: translateX(0); }
          100% { opacity: 0; transform: translateX(120%); }
        }

        /* Input focus glow */
        .aura-input-wrap { transition: border-color 0.5s ease, box-shadow 0.8s ease; }
        .aura-input-wrap:focus-within {
          border-color: rgba(255,200,160,0.3) !important;
          box-shadow: 0 0 25px rgba(255,200,160,0.15), 0 0 50px rgba(255,200,160,0.08), 0 0 80px rgba(255,200,160,0.04), inset 0 0 20px rgba(255,200,160,0.05) !important;
          animation: inputPulse 3s ease-in-out infinite !important;
        }
        @keyframes inputPulse {
          0%,100% { box-shadow: 0 0 25px rgba(255,200,160,0.15), 0 0 50px rgba(255,200,160,0.08), inset 0 0 20px rgba(255,200,160,0.05); }
          50% { box-shadow: 0 0 35px rgba(255,200,160,0.2), 0 0 60px rgba(255,200,160,0.1), inset 0 0 25px rgba(255,200,160,0.07); }
        }

        /* Apel button pulse */
        .apel-btn { animation: apelPulse 3s ease-in-out infinite; }
        @keyframes apelPulse {
          0%,100% { box-shadow: 0 0 8px rgba(255,245,220,0.06), 0 0 3px rgba(255,245,220,0.03); }
          50% { box-shadow: 0 0 16px rgba(255,245,220,0.12), 0 0 6px rgba(255,245,220,0.08), 0 0 30px rgba(255,245,220,0.04); }
        }
      `}</style>
    </div>
  )
}
