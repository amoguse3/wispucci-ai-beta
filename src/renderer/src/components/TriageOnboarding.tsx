import { useState, useEffect, useRef } from 'react'
import type { AgeGroup, UserProfile } from '../../../../shared/types'

interface Props {
  onComplete: (profile: UserProfile) => void
}

type Bubble = { role: 'bot' | 'user'; text: string; id: number }
type Phase = 'ask-thoughts' | 'ask-name' | 'ask-adhd' | 'ask-age' | 'finalize'

const AGE_OPTIONS: Array<{ value: AgeGroup; label: string; bubble: string }> = [
  { value: 'under16', label: 'I\'m under 16', bubble: 'Under 16' },
  { value: '16to25', label: 'I\'m 16 to 25', bubble: '16-25' },
  { value: '25plus', label: 'I\'m over 25', bubble: '25+' },
  { value: 'unknown', label: 'Prefer not to say', bubble: 'Prefer not to say' },
]

// ─── simple heuristics (no API needed) ────────────────────────────────────────
function detectLanguage(text: string): 'ro' | 'en' | 'ru' {
  if (/[\u0400-\u04FF]/.test(text)) return 'ru'
  if (/[ăâîșțĂÂÎȘȚ]/.test(text)) return 'ro'
  // plain ASCII with English stopwords → en
  if (/\b(the|and|for|need|todo|work|today|tomorrow)\b/i.test(text)) return 'en'
  return 'en'
}

function extractTasks(text: string): string[] {
  const chunks = text
    .split(/[,.;\n]|\s+și\s+|\s+apoi\s+|\s+and\s+|\s+then\s+|\s+и\s+/i)
    .map(s => s.trim())
    .filter(s => s.length >= 4 && s.length <= 120)
    .slice(0, 3)
  return chunks.map(c => c.charAt(0).toUpperCase() + c.slice(1))
}

// Stop-words that commonly appear before a name — strip them out so that
// "mă numesc Vlad", "my name is Alex", "меня зовут Катя" all yield the name.
const NAME_FILLERS = new Set([
  // Romanian
  'ma', 'mă', 'mi', 'sunt', 'numesc', 'cheama', 'cheamă', 'zic', 'zice', 'pe', 'mine', 'eu', 'sa', 'să',
  // English
  'my', 'i', 'am', 'name', 'is', 'im', "i'm", 'call', 'me',
  // Russian
  'я', 'меня', 'зовут', 'имя', 'моё', 'мое',
])

function cleanName(raw: string): string {
  const words = raw.trim().split(/\s+/).filter(Boolean)
  for (const w of words) {
    const letters = w.replace(/[^a-zA-ZăâîșțĂÂÎȘȚа-яА-ЯёЁ]/g, '')
    if (!letters) continue
    if (NAME_FILLERS.has(letters.toLowerCase())) continue
    if (letters.length < 2) continue
    return letters.charAt(0).toUpperCase() + letters.slice(1).toLowerCase()
  }
  return 'Friend'
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function TriageOnboarding({ onComplete }: Props) {
  const [bubbles, setBubbles] = useState<Bubble[]>([])
  const [phase, setPhase] = useState<Phase>('ask-thoughts')
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const [extractedTasks, setExtractedTasks] = useState<string[]>([])
  const [extractedName, setExtractedName] = useState('')
  const [hasADHD, setHasADHD] = useState<boolean | null>(null)
  const [ageGroup, setAgeGroup] = useState<AgeGroup>('unknown')
  const [language, setLanguage] = useState<'ro' | 'en' | 'ru'>('en')
  const scrollRef = useRef<HTMLDivElement>(null)
  const idRef = useRef(0)
  const mountedRef = useRef(false)

  const pushBubble = (role: 'bot' | 'user', text: string) => {
    setBubbles(b => [...b, { role, text, id: ++idRef.current }])
  }

  const botSay = (text: string, delay = 500) => {
    setTyping(true)
    window.setTimeout(() => {
      pushBubble('bot', text)
      setTyping(false)
    }, delay)
  }

  // First bot message on mount
  useEffect(() => {
    if (mountedRef.current) return
    mountedRef.current = true
    botSay('Hey 👋 I\'m Wispucci.\n\nBefore anything — what\'s buzzing in your head right now? You can type anything: tasks, worries, mixed ideas. I\'ll turn them into something concrete.', 700)
  }, [])

  // Auto-scroll
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [bubbles, typing])

  const handleSubmit = () => {
    const text = input.trim()
    if (!text || typing) return
    setInput('')
    pushBubble('user', text)

    if (phase === 'ask-thoughts') {
      const tasks = extractTasks(text)
      setExtractedTasks(tasks)
      setLanguage(detectLanguage(text))
      setPhase('ask-name')
      if (tasks.length > 0) {
        botSay(`Noted ${tasks.length} ${tasks.length === 1 ? 'thing' : 'things'}.\n\nWhat should I call you?`, 850)
      } else {
        botSay('OK, noted.\n\nWhat should I call you?', 750)
      }
    } else if (phase === 'ask-name') {
      const name = cleanName(text)
      setExtractedName(name)
      setPhase('ask-adhd')
      botSay(`Great, ${name}. Quick question — do you get easily distracted or have ADHD? I'm asking so I know whether to be gentler with you.`, 900)
    }
  }

  const answerADHD = (yes: boolean) => {
    if (typing) return
    setHasADHD(yes)
    pushBubble('user', yes ? 'Yes, be gentler' : 'No, normal mode is fine')
    setPhase('ask-age')
    botSay('One more and we\'re done: what age group are you in? I adjust my examples and tone based on this.', 900)
  }

  const answerAgeGroup = (value: AgeGroup) => {
    if (typing) return
    setAgeGroup(value)
    pushBubble('user', AGE_OPTIONS.find(option => option.value === value)?.bubble || 'Prefer not to say')
    setPhase('finalize')
    const tasksLine = extractedTasks.length > 0
      ? `\n\nI've added to your list:\n${extractedTasks.map(t => '  • ' + t).join('\n')}`
      : ''
    botSay(`Perfect. Now I know what tone and examples to use.${tasksLine}\n\nLet's get started.`, 900)
  }

  const finish = async () => {
    // Save tasks to DB (best-effort; onboarding continues even if backend is slow/fails)
    try {
      await Promise.all(
        extractedTasks.map(t => window.aura.tasks.add(t, 'mid', null).catch(() => null))
      )
    } catch {
      // ignore
    }
    const profile: UserProfile = {
      name: extractedName || 'Friend',
      hasADHD: hasADHD ?? false,
      preferSoftMode: hasADHD ?? true,
      selectedModel: '',
      language,
      onboardingDone: true,
      onboardingQuickStartDone: false,
      dopamineRewards: ['Favorite music 🎵', '5 min break ☕', 'Funny meme 😂'],
      ageGroup,
    }
    onComplete(profile)
  }

  return (
    <div className="relative z-20 h-full flex flex-col items-center p-6 pt-10">
      {/* Header */}
      <div className="w-full max-w-md flex items-center justify-center gap-3 mb-5 shrink-0">
        <div className="w-3 h-3 rounded-full" style={{
          background: 'radial-gradient(circle, #d97706 0%, #92400e 60%, transparent 100%)',
          boxShadow: '0 0 10px rgba(217,119,6,0.4)',
          animation: 'triageHeartbeat 3s ease-in-out infinite',
        }} />
        <span className="text-[9px] tracking-[0.25em] uppercase" style={{
          color: 'rgba(200,160,140,0.32)',
          fontFamily: "'Press Start 2P', monospace",
        }}>wispucci · session 1</span>
      </div>

      {/* Message list */}
      <div
        ref={scrollRef}
        className="w-full max-w-md flex-1 overflow-y-auto space-y-3 pr-1 min-h-0"
        style={{ scrollBehavior: 'smooth' }}
      >
        {bubbles.map(b => (
          <div
            key={b.id}
            className={`flex items-start ${b.role === 'user' ? 'justify-end' : 'justify-start'}`}
            style={{ animation: 'triageBubble 0.45s cubic-bezier(.16,1,.3,1)' }}
          >
            {b.role === 'bot' && (
              <div className="w-7 h-7 rounded-full shrink-0 mr-2 mt-1" style={{
                background: 'radial-gradient(circle at 40% 35%, rgba(255,250,235,0.9), rgba(255,240,200,0.5) 50%, rgba(255,230,180,0.15) 100%)',
                boxShadow: '0 0 12px rgba(255,245,220,0.3)',
              }} />
            )}
            <div
              className="px-4 py-2.5 rounded-2xl text-sm whitespace-pre-line leading-relaxed"
              style={{
                maxWidth: '78%',
                background: b.role === 'user'
                  ? 'linear-gradient(135deg, rgba(217,119,6,0.22), rgba(217,119,6,0.1))'
                  : 'rgba(26,23,20,0.82)',
                border: `1px solid ${b.role === 'user' ? 'rgba(217,119,6,0.3)' : 'rgba(139,58,58,0.15)'}`,
                color: b.role === 'user' ? '#fef3c7' : 'rgba(230,200,190,0.9)',
              }}
            >
              {b.text}
            </div>
          </div>
        ))}

        {typing && (
          <div className="flex justify-start items-center gap-2" style={{ animation: 'triageBubble 0.35s' }}>
            <div className="w-7 h-7 rounded-full" style={{
              background: 'radial-gradient(circle at 40% 35%, rgba(255,250,235,0.9), rgba(255,240,200,0.5) 50%, rgba(255,230,180,0.15) 100%)',
              boxShadow: '0 0 12px rgba(255,245,220,0.3)',
            }} />
            <div className="px-3.5 py-2.5 rounded-2xl flex gap-1.5" style={{
              background: 'rgba(26,23,20,0.82)',
              border: '1px solid rgba(139,58,58,0.15)',
            }}>
              {[0, 1, 2].map(i => (
                <div key={i} className="w-1.5 h-1.5 rounded-full" style={{
                  background: 'rgba(255,245,220,0.5)',
                  animation: `triageDot 1.2s ease-in-out ${i * 0.15}s infinite`,
                }} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Input / actions */}
      <div className="w-full max-w-md mt-4 shrink-0">
        {phase === 'ask-adhd' && !typing ? (
          <div className="flex flex-col gap-2" style={{ animation: 'triageBubble 0.45s' }}>
            <button
              onClick={() => answerADHD(true)}
              className="py-3 px-4 rounded-xl text-sm text-left transition-all hover:scale-[1.01]"
              style={{
                background: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(139,92,246,0.08))',
                border: '1px solid rgba(139,92,246,0.25)',
                color: '#c4b5fd',
              }}
            >
              Da, be gentler with me
            </button>
            <button
              onClick={() => answerADHD(false)}
              className="py-3 px-4 rounded-xl text-sm text-left transition-all hover:scale-[1.01]"
              style={{
                background: 'rgba(26,23,20,0.6)',
                border: '1px solid rgba(42,37,32,0.5)',
                color: '#a89a88',
              }}
            >
              No, normal mode is fine
            </button>
          </div>
        ) : phase === 'ask-age' && !typing ? (
          <div className="flex flex-col gap-2" style={{ animation: 'triageBubble 0.45s' }}>
            {AGE_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => answerAgeGroup(option.value)}
                className="py-3 px-4 rounded-xl text-sm text-left transition-all hover:scale-[1.01]"
                style={{
                  background: option.value === 'unknown'
                    ? 'rgba(26,23,20,0.6)'
                    : 'linear-gradient(135deg, rgba(217,119,6,0.14), rgba(217,119,6,0.08))',
                  border: `1px solid ${option.value === 'unknown' ? 'rgba(42,37,32,0.5)' : 'rgba(217,119,6,0.22)'}`,
                  color: option.value === 'unknown' ? '#a89a88' : '#f5d7a4',
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        ) : phase === 'finalize' && !typing ? (
          <button
            onClick={finish}
            className="w-full py-3 rounded-xl text-sm font-medium transition-all hover:scale-[1.02]"
            style={{
              background: 'linear-gradient(135deg, #d97706, #b45309)',
              color: '#fff',
              boxShadow: '0 0 20px rgba(217,119,6,0.22)',
              animation: 'triageBubble 0.5s',
            }}
          >
            Let's get started →
          </button>
        ) : (phase === 'ask-thoughts' || phase === 'ask-name') ? (
          <div
            className="flex items-center gap-2 rounded-2xl px-4 py-3 transition-all"
            style={{
              background: 'rgba(10,6,6,0.82)',
              backdropFilter: 'blur(20px)',
              border: `1px solid ${input ? 'rgba(217,119,6,0.35)' : 'rgba(139,58,58,0.15)'}`,
              boxShadow: input ? '0 0 20px rgba(217,119,6,0.1)' : 'none',
            }}
          >
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() } }}
              autoFocus
              disabled={typing}
              placeholder={phase === 'ask-thoughts' ? 'Type whatever comes to mind...' : 'Your name...'}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-white/15"
              style={{ color: 'rgba(230,200,190,0.9)' }}
            />
            <button
              onClick={handleSubmit}
              disabled={!input.trim() || typing}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-all shrink-0"
              style={{
                background: input.trim() ? 'rgba(217,119,6,0.3)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${input.trim() ? 'rgba(217,119,6,0.4)' : 'rgba(255,255,255,0.04)'}`,
                opacity: input.trim() && !typing ? 1 : 0.3,
                color: 'rgba(230,200,190,0.8)',
              }}
            >↑</button>
          </div>
        ) : null}
      </div>

      <style>{`
        @keyframes triageBubble {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes triageDot {
          0%,60%,100% { opacity: 0.3; transform: scale(0.8); }
          30%         { opacity: 1;   transform: scale(1.15); }
        }
        @keyframes triageHeartbeat {
          0%,100% { transform: scale(1);    opacity: 0.8; }
          50%     { transform: scale(1.15); opacity: 1;   }
        }
      `}</style>
    </div>
  )
}
