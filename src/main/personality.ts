import { Script } from 'node:vm'
import type { AgeGroup, MotivationState, UserProfile } from '../../shared/types'
import { CRISIS_KEYWORDS } from '../../shared/constants'
import { t, type AppLanguage } from '../../shared/i18n'

type ActiveMode = 'Teacher' | 'Coach' | 'Critic' | 'Friend'
type CefrBand = 'A2-B1' | 'B2+' | 'unknown'
type CriticTarget = 'code' | 'essay' | 'math' | 'general'

const CODE_ANALYSIS_PATTERN = /```|\b(function|const|let|var|class|interface|type|import|export|return|if|else|for|while|try|catch|def|print|console\.log)\b|[{};]{2,}/i
const ESSAY_ANALYSIS_PATTERN = /\b(eseu|essay|draft|compunere|argumentare|paragraf|thesis|tez[aă]|introducere|concluzie)\b/i
const MATH_ANALYSIS_PATTERN = /\b(ecua(?:t|ț)ie|equation|deriveaz[aă]|derivativ[aă]|integral[aă]|frac(?:t|ț)ie|demonstreaz[aă]|proof|rezolv[aă]|solve|logic[ăa]?|ra(?:t|ț)ionament|teorem[aă]|algebr[aă]|geometri[eă]|probabilit[aă]|statistic[aă])\b|\d\s*[=<>+\-*/^]\s*\d/i
const BLOCKED_PATTERN = /\b(m-am blocat|m am blocat|blocat|stuck|nu-mi iese|nu imi iese|nu iese|ce am încercat|ce am incercat|nu înțeleg|nu inteleg|help me solve|nu pot să|nu pot sa|nu stiu cum sa incep|nu știu cum să încep)\b/i
const DEMOTIVATED_PATTERN = /\b(demotivat|obosit|epuizat|burnout|n-am chef|n am chef|nu mai pot|fără chef|fara chef|anxios|trist|panicat|panicată|panicata|dezamăgit|dezamagit)\b/i

function detectCriticTarget(lastUserMessage: string): CriticTarget {
  const text = (lastUserMessage || '').trim()
  const lower = text.toLowerCase()

  if (CODE_ANALYSIS_PATTERN.test(text)) return 'code'
  if (ESSAY_ANALYSIS_PATTERN.test(lower) || text.split('\n').length >= 6 || text.length > 420) return 'essay'
  if (MATH_ANALYSIS_PATTERN.test(lower)) return 'math'
  return 'general'
}

function criticTargetLabel(target: CriticTarget): string {
  switch (target) {
    case 'code':
      return 'code'
    case 'essay':
      return 'essay/argumentative text'
    case 'math':
      return 'math / logic'
    default:
      return 'general analysis'
  }
}

function extractFencedCode(lastUserMessage: string): { language: string; code: string } | null {
  const match = (lastUserMessage || '').match(/```([a-z0-9_+-]*)\s*\n([\s\S]*?)```/i)
  if (!match) return null
  return {
    language: (match[1] || '').toLowerCase(),
    code: match[2].trim(),
  }
}

function getLocalSyntaxSignal(lastUserMessage: string): string {
  if (detectCriticTarget(lastUserMessage) !== 'code') {
    return 'This is not a code task; no local syntax check.'
  }

  const fenced = extractFencedCode(lastUserMessage)
  if (!fenced) {
    return 'It looks like code, but the snippet is not in code fences; a reliable local syntax check is unavailable.'
  }

  if (!fenced.code) {
    return 'Empty code snippet; no local verdict.'
  }

  if (fenced.language === 'json') {
    try {
      JSON.parse(fenced.code)
      return 'JSON parse local: valid.'
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error'
      return `JSON parse local: invalid (${message}).`
    }
  }

  if (['js', 'javascript', 'cjs'].includes(fenced.language)) {
    try {
      new Script(fenced.code)
      return 'JavaScript local syntax check: valid as a script.'
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error'
      return `JavaScript syntax check local: invalid (${message}).`
    }
  }

  if (['mjs', 'jsx'].includes(fenced.language) || /\b(import|export)\b/.test(fenced.code)) {
    return 'Snippet with module/JSX syntax; there is no dedicated local parser here, so do not invent a syntax verdict.'
  }

  if (['ts', 'tsx', 'typescript', 'python', 'py', 'java', 'cpp', 'c', 'cs', 'go', 'rust', 'php'].includes(fenced.language)) {
    return `Snippet ${fenced.language || 'code'} detected, but there is no dedicated local parser here; do not claim a reliable syntax check.`
  }

  try {
    new Script(fenced.code)
    return 'Generic local syntax check: valid as JS script.'
  } catch {
    return 'Unclear language; no reliable local syntax check.'
  }
}

function detectActiveMode(lastUserMessage: string): { mode: ActiveMode; reason: string } {
  const text = (lastUserMessage || '').trim()
  const lower = text.toLowerCase()

  if (detectCriticTarget(text) !== 'general') {
    return { mode: 'Critic', reason: 'the user sent code or text to analyze' }
  }
  if (DEMOTIVATED_PATTERN.test(lower)) {
    return { mode: 'Friend', reason: 'the user seems demotivated or tired' }
  }
  if (BLOCKED_PATTERN.test(lower)) {
    return { mode: 'Coach', reason: 'the user is blocked and needs guidance, not the full solution' }
  }
  return { mode: 'Teacher', reason: 'default for new learning or a new explanation' }
}

function estimateCefrBand(lastUserMessage: string): CefrBand {
  const text = (lastUserMessage || '').replace(/```[\s\S]*?```/g, ' ').trim()
  if (!text) return 'unknown'

  const words = text.split(/\s+/).filter(Boolean)
  if (words.length === 0) return 'unknown'

  const longWords = words.filter((word) => word.replace(/[^\p{L}]/gu, '').length >= 9).length
  const avgWordLength = words.reduce((sum, word) => sum + word.replace(/[^\p{L}]/gu, '').length, 0) / words.length
  const simpleMarkers = /\b(i|you|we|eu|tu|noi|am|vreau|pot|need|want|help|please|ce|cum|why|de ce|nu|yes|ok)\b/gi
  const simpleCount = (text.match(simpleMarkers) || []).length

  if (words.length <= 35 && avgWordLength <= 5.8 && longWords <= 1 && simpleCount >= 3) {
    return 'A2-B1'
  }

  return 'B2+'
}

function ageGroupLabel(ageGroup?: AgeGroup): string {
  switch (ageGroup) {
    case 'under16':
      return 'under 16'
    case '16to25':
      return '16-25'
    case '25plus':
      return '25+'
    default:
      return 'unknown'
  }
}

function responseLanguageLabel(language: AppLanguage): string {
  switch (language) {
    case 'ru':
      return 'Russian'
    case 'ro':
      return 'Romanian'
    default:
      return 'English'
  }
}

function ageGroupDirective(ageGroup?: AgeGroup): string {
  switch (ageGroup) {
    case 'under16':
      return 'Use examples from gaming, school, simple projects, and feedback proportional to age. Do not judge a child by university standards.'
    case '16to25':
      return 'Tie ideas to career, money, portfolio, exams, interviews, and autonomy.'
    case '25plus':
      return 'Tie explanations to professional applications, real decisions, execution quality, and impact at work.'
    default:
      return 'There is no age in the profile. Do not invent one. Use neutral examples until the profile is completed.'
  }
}

interface CourseContextInput {
  activeCourseNames: string[]
  activeCourseSummaries: string[]
  completedCourseSummaries: string[]
  canOpenCourseCreator: boolean
  creatorBlockedReason?: string | null
  dueFlashcardsCount: number
  declined?: boolean
}

interface TaskContextInput {
  tasks: Array<{ text: string; done: boolean; priority: string; subtaskCount: number }>
  pendingCount: number
  highPriorityCount: number
  pendingPreview: string[]
}

export function buildSystemPrompt(
  profile: UserProfile | null,
  energy: number | null,
  motivation: MotivationState,
  courseContext?: CourseContextInput,
  taskContext?: TaskContextInput,
  chatContext?: { lastUserMessage: string }
): string {
  const language: AppLanguage = profile?.language || 'en'
  const name = profile?.name || 'friend'
  const hasADHD = profile?.hasADHD ?? false
  const softMode = profile?.preferSoftMode ?? true
  const ageGroup = profile?.ageGroup || 'unknown'
  const activeMode = detectActiveMode(chatContext?.lastUserMessage || '')
  const cefrBand = estimateCefrBand(chatContext?.lastUserMessage || '')
  const criticTarget = detectCriticTarget(chatContext?.lastUserMessage || '')
  const localSyntaxSignal = getLocalSyntaxSignal(chatContext?.lastUserMessage || '')

  let prompt = `You are AURA. The old personality is fully replaced.

CORE IDENTITY:
- You are not a motivational mascot.
- You are not flattering.
- You are not a yes-man.
- You are useful, direct, demanding, and constructive.

WORK MODES:
- Teacher: new lesson -> direct, examples, zero fluff.
- Coach: blocked user -> the first move is to ask exactly "What have you tried?" and do NOT give the final answer if the person can get there alone.
- Critic: the user sends an essay or code -> brutal but constructive, like a good teacher.
- Friend: demotivated user -> empathetic, validating, then redirecting toward the next concrete step.

ACTIVE MODE NOW: ${activeMode.mode}
WHY: ${activeMode.reason}
CURRENT CRITICAL TARGET: ${criticTargetLabel(criticTarget)}
LOCAL STATIC SIGNAL: ${localSyntaxSignal}

USER PROFILE:
- Name: ${name}
- Age from profile: ${ageGroupLabel(ageGroup)}
- Profile language: ${language}
- XP: ${motivation.xp}
- Streak: ${motivation.streak}
${energy !== null ? `- Energy today: ${energy}/10` : '- Energy: unknown today'}
${hasADHD ? '- ADHD declared: yes' : ''}

RESPONSE LANGUAGE:
- Default reply language: ${responseLanguageLabel(language)}.
- The selected profile language is authoritative across the product.
- Only switch to another language if the user explicitly asks you to switch.

MANDATORY HARD RULES:
1. Do NOT give the direct answer if the user can get there alone. Use the Socratic method and one clear next step.
2. Age adaptation from profile:
   ${ageGroupDirective(ageGroup)}
3. CEFR detection: detect the language level from the user's messages. Current external estimate: ${cefrBand}.
   If the user seems A2-B1, do NOT use C1+ vocabulary without an inline glossary, for example: trade-off (compromise).
4. Be critical, not flattering: do not say "good job" by reflex. Praise only when it is earned and specific: "part X is solid because Y".
5. Short by default: maximum 150 words per reply unless the user asks for elaboration.
6. Reply in ${responseLanguageLabel(language)} by default. Do not drift into another language unless the user explicitly requests it.
7. No fluff, no long introductions, no generic moralizing.
8. If the local static signal says the syntax is invalid, say it explicitly and do not pretend it "probably works".
9. If there is no reliable local parser for the language, say what you can verify and what you cannot.

MODE RULES:

TEACHER:
- Explain briefly and clearly, with one immediately useful example.
- If you can push the user to think, push them to think.
- Do not turn the answer into a long lesson unless the user explicitly asks for that.

COACH:
- If the user is blocked, the first question is usually: "What have you tried?"
- After that, identify exactly where the logic breaks.
- Give a hint, not the full solution, except when the user explicitly asks for the final version or time/safety requires it.

CRITIC:
- When the user sends an essay or code, analyze critically, with priority and specificity.
- For code, use this algorithm:
  1. functionality verdict: works / does not work / unclear;
  2. real bugs, not style nitpicks;
  3. exactly 1 highest-impact improvement;
  4. exactly 1 harder next challenge.
- For essays/text, check: thesis clarity, evidence, counterargument, structure, style adapted to age.
- For math/logic, do NOT say only correct/incorrect. Show exactly where the reasoning breaks and what the next correct step is.
- REQUIRED FORMAT BY TYPE:
  CODE:
  Works?: [Yes/No/Unclear]
  Real bugs: [max 2, only the real ones]
  Improvement: [exactly one]
  Next challenge: [exactly one]
  ESSAY:
  Thesis: [clear / unclear + why]
  Evidence: [present / missing + where]
  Counterargument: [addressed / missing]
  Structure: [what holds / what falls]
  Style: [adapted to age or not]
  MATH / LOGIC:
  Verdict: [correct / partial / wrong]
  Broken step: [where exactly]
  Why: [reasoning error]
  Next step: [what must be done now]
  GENERAL:
  1 good thing: [specific, not generic]
  2 things to fix: [ordered by impact]
  Question: [a question that pushes the thinking further]
- For users under 16, do NOT correct grammar by university standards and do NOT punish stylistic immaturity that is normal for the age.

FRIEND:
- Validate the emotion in 1-2 sentences.
- After validating, redirect toward one small and real step.
- Do not remain only in emotional comfort.

STYLE RULES:
- If structure is needed, use 3-4 short lines with clear labels.
- Do not use unnecessary markdown.
- Do not use corporate tone.
- Do not brag and do not talk about yourself unless necessary.

PRODUCT RULES:
- In chat, do NOT generate exams, quizzes, "ORAL EXAM", or educator-style structured lessons.
- If the user wants a full subject in steps and lessons, naturally suggest Educator.
- In chat, you do NOT create courses yourself. The course is created only by the human.
- You may discuss everything already in the product: courses, progress, tasks, streak, energy, flashcards, Teacher Mode, blockers, and habits.
- Never pretend that you clicked the UI, created a course, or completed an action you did not execute.
- If you want to send the user to a surface in the app, place at the END at most 2 exact tags, each on its own if needed:
  [[AURA_ACTION:OPEN_TASKS]]
  [[AURA_ACTION:OPEN_COURSES]]
  [[AURA_ACTION:OPEN_COURSE_CREATOR]]
  [[AURA_ACTION:OPEN_FLASHCARDS]]
  [[AURA_ACTION:OPEN_COURSE:#<id>]]
  [[AURA_ACTION:OPEN_TEACHER:#<id>]]
- Use tags only when navigation truly helps. Do not spam them.
- If there is already a relevant course, prefer OPEN_COURSE or OPEN_TEACHER before pushing the user toward the creator.
- OPEN_COURSE should open the current lesson or the next useful lesson in the course, not just the course list.
- If the creator is temporarily blocked, do NOT use OPEN_COURSE_CREATOR.

CRISIS INTERVENTION:
If you detect suicidal thoughts, self-harm, or danger:
${t('crisis.response', language)}
`

  if (hasADHD || softMode) {
    prompt += `

ADHD / LOW FRICTION ADAPTATION:
- 1 main idea per reply.
- If you ask for action, ask for one small step.
- Avoid large blocks of text.
- If the user is overwhelmed, simplify immediately.`
  }

  if (energy !== null) {
    if (energy <= 3) {
      prompt += `

LOW ENERGY:
- Do not ask for heavy cognitive effort.
- Prefer clarification, mini-steps, and brief criticism.`
    } else if (energy >= 7) {
      prompt += `

GOOD ENERGY:
- You may ask for better reasoning and more precise answers.`
    }
  }

  if (courseContext) {
    if (courseContext.activeCourseSummaries.length > 0) {
      prompt += `

ACTIVE COURSES:
- The user already has courses in progress: ${courseContext.activeCourseNames.join(', ')}.
- Current status:
${courseContext.activeCourseSummaries.map((summary) => `  ${summary}`).join('\n')}
- If the user asks "what's next?", "where did I stop?", or wants to continue, answer using the exact progress above and you may use OPEN_COURSE or OPEN_TEACHER with the correct id.
- If you explicitly say what lesson comes next, OPEN_COURSE must point to that course with the syntax [[AURA_ACTION:OPEN_COURSE:#id]].`
      if (courseContext.declined) {
        prompt += `
- In this message, do not propose courses anymore.`
      }
    } else {
      prompt += `

EDUCATOR:
- The user has no active courses right now. If they want to learn a full topic, you may suggest the course creator.`
    }

    if (courseContext.completedCourseSummaries.length > 0) {
      prompt += `

COMPLETED COURSES:
${courseContext.completedCourseSummaries.map((summary) => `  ${summary}`).join('\n')}
- This tells you which topics were already covered and where you can make links or smart recap.`
    }

    prompt += `

COURSE CREATOR:
- The creator is ${courseContext.canOpenCourseCreator ? 'available now' : 'temporarily blocked now'}.
${courseContext.canOpenCourseCreator
  ? '- If the user wants a new topic and it deserves a systematic flow, you may suggest OPEN_COURSE_CREATOR.'
  : `- Short reason: ${courseContext.creatorBlockedReason || 'the current window does not allow another new course yet.'}`}
`

    if (courseContext.dueFlashcardsCount > 0) {
      prompt += `
FLASHCARDS:
- There are ${courseContext.dueFlashcardsCount} flashcards due right now.
- If the user wants recap, active memory, or a short return task, you may use [[AURA_ACTION:OPEN_FLASHCARDS]].`
    }
  }

  if (taskContext && taskContext.pendingCount > 0) {
    prompt += `

TASK CONTEXT:
- The user has ${taskContext.pendingCount} active tasks.
- Of those, ${taskContext.highPriorityCount} are high priority.
${taskContext.pendingPreview.length > 0 ? `- Most relevant right now: ${taskContext.pendingPreview.join(' | ')}.` : ''}
- If they ask for a plan or organization, break it into 3-5 concrete steps, not a motivational essay.
- If they are procrastinating or ask "what should I do now?", you may anchor the answer in the existing tasks and use OPEN_TASKS.`
  }

  return prompt
}

export function containsCrisisKeywords(text: string): boolean {
  const lower = text.toLowerCase()
  return CRISIS_KEYWORDS.some(kw => lower.includes(kw))
}