import { getDB, getState, setState } from './db'
import type { TierLimitSnapshot, TierMode, UserProfile } from '../../shared/types'
import { getTokenStats } from './telemetry'
import {
  buildTierLimitSnapshot as buildTierLimitSnapshotState,
  evaluateAIBudget as evaluateAIBudgetState,
  evaluateChatBudget as evaluateChatBudgetState,
  evaluateCourseCreation as evaluateCourseCreationState,
  evaluateLessonStart as evaluateLessonStartState,
  normalizeTierMode as normalizeTierModeState,
  normalizeTierUsageState as normalizeTierUsageStateState,
  recordAIUsage as recordAIUsageState,
  recordChatMessage as recordChatMessageState,
  recordCourseCreation as recordCourseCreationState,
  recordLessonStart as recordLessonStartState,
} from './services/tier-limit-service'

const TWO_HOURS_MS = 2 * 60 * 60 * 1000
const ONE_DAY_MS = 24 * 60 * 60 * 1000
const USAGE_HISTORY_WINDOW_MS = 400 * ONE_DAY_MS
const TIER_USAGE_KEY = 'tierUsage'

interface TierConfig {
  label: string
  coursesPer2Hours: number | null
  coursesPerMonth: number | null
  chatMessagesPerDay: number | null
  lessonsPer2Hours: number | null
  lessonsPerMonth: number | null
  flashcardsTotal: number | null
  exportCoursePdf: boolean
}

interface TokenUsageEvent {
  timestamp: string
  tokens: number
  source?: string
}

interface LessonUsageEvent {
  timestamp: string
  lessonId: number
}

interface TierUsageState {
  courseGenerationTimestamps: string[]
  chatMessageTimestamps: string[]
  aiTokenEvents: TokenUsageEvent[]
  lessonUsageEvents: LessonUsageEvent[]
}

interface ChatContextMessage {
  content: string
}

interface BaseDecision {
  allowed: boolean
  message?: string
}

interface AIBudgetDecision extends BaseDecision {
  estimatedTokens?: number
}

interface LessonStartDecision extends BaseDecision {
  consumesSlot: boolean
}

const TIER_CONFIGS: Record<TierMode, TierConfig> = {
  free: {
    label: 'Free',
    coursesPer2Hours: 2,
    coursesPerMonth: 3,
    chatMessagesPerDay: 20,
    lessonsPer2Hours: 5,
    lessonsPerMonth: 30,
    flashcardsTotal: 20,
    exportCoursePdf: false,
  },
  premium: {
    label: 'Premium',
    coursesPer2Hours: 6,
    coursesPerMonth: 30,
    chatMessagesPerDay: null,
    lessonsPer2Hours: 15,
    lessonsPerMonth: 250,
    flashcardsTotal: null,
    exportCoursePdf: true,
  },
  'dev-unlimited': {
    label: 'Dev Unlimited',
    coursesPer2Hours: null,
    coursesPerMonth: null,
    chatMessagesPerDay: null,
    lessonsPer2Hours: null,
    lessonsPerMonth: null,
    flashcardsTotal: null,
    exportCoursePdf: true,
  },
}

function localMonthKey(input: number | string | Date = Date.now()): string {
  const date = new Date(input)
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 7)
}

function localDayKey(input: number | string | Date = Date.now()): string {
  const date = new Date(input)
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

function clampPositive(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0
}

function formatRemaining(ms: number): string {
  const totalMinutes = Math.max(1, Math.ceil(ms / 60_000))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`
  if (hours > 0) return `${hours}h`
  return `${minutes}m`
}

function buildCourseWindowMessage(label: string, limit: number, msUntilReset: number): string {
  return [
    '🧠 ACTIVE CONSOLIDATION',
    '',
    `You already created ${limit} courses in the last 2 hours on the ${label} plan. Pause new generation for a bit and let the courses already in motion connect together.`,
    '',
    `Come back in ${formatRemaining(msUntilReset)} or continue one of the courses you already created.`,
  ].join('\n')
}

function buildCourseMonthMessage(label: string, limit: number): string {
  return [
    '📚 MONTHLY COURSE LIMIT',
    '',
    `You reached ${limit} generated courses this month on the ${label} plan.`,
    '',
    'Continue what you already have or wait until next month for new slots.',
  ].join('\n')
}

function buildChatBudgetMessage(label: string, limit: number, msUntilReset: number): string {
  return [
    '💬 DAILY CHAT LIMIT REACHED',
    '',
    `You already used ${limit} AI chat messages today on the ${label} plan. Lessons and courses are still available; only chat waits for reset.`,
    '',
    `Come back in ${formatRemaining(msUntilReset)} or stay with the material you already opened.`,
  ].join('\n')
}

function buildLessonMonthMessage(label: string, limit: number): string {
  return [
    '🧩 MONTHLY LESSON LIMIT',
    '',
    `You reached ${limit} generated lessons this month on the ${label} plan.`,
    '',
    'You can continue lessons that already exist and get fresh slots next month.',
  ].join('\n')
}

function buildLessonLimitMessage(label: string, limit: number, msUntilReset: number): string {
  return [
    '📚 CONSOLIDATION PAUSE',
    '',
    `You already opened ${limit} new lessons in the last 2 hours on the ${label} plan. Continue what you started and come back for a new lesson after reset.`,
    '',
    `The next new slot opens in ${formatRemaining(msUntilReset)}.`,
  ].join('\n')
}

export function buildTeacherLimitToken(message: string): string {
  return `[[AURA_LIMIT]]\n${message}`
}

export function isTeacherLimitToken(text: string): boolean {
  return String(text || '').startsWith('[[AURA_LIMIT]]')
}

export function stripTeacherLimitToken(text: string): string {
  return isTeacherLimitToken(text)
    ? String(text).replace('[[AURA_LIMIT]]', '').trim()
    : text
}

export function normalizeTierMode(value: unknown): TierMode {
  return normalizeTierModeState(value)
}

function getTierConfig(tierMode: TierMode): TierConfig {
  return TIER_CONFIGS[tierMode]
}

function getTierUsageState(): TierUsageState {
  const raw = getState(TIER_USAGE_KEY) as Partial<TierUsageState> | null
  return {
    courseGenerationTimestamps: Array.isArray(raw?.courseGenerationTimestamps)
      ? raw.courseGenerationTimestamps.filter((value): value is string => typeof value === 'string')
      : [],
    chatMessageTimestamps: Array.isArray(raw?.chatMessageTimestamps)
      ? raw.chatMessageTimestamps.filter((value): value is string => typeof value === 'string')
      : [],
    aiTokenEvents: Array.isArray(raw?.aiTokenEvents)
      ? raw.aiTokenEvents
          .filter((entry): entry is TokenUsageEvent => typeof entry?.timestamp === 'string' && Number.isFinite(Number(entry?.tokens)))
          .map((entry) => ({ timestamp: entry.timestamp, tokens: clampPositive(Number(entry.tokens)), source: entry.source }))
      : [],
    lessonUsageEvents: Array.isArray(raw?.lessonUsageEvents)
      ? raw.lessonUsageEvents
          .filter((entry): entry is LessonUsageEvent => typeof entry?.timestamp === 'string' && Number.isFinite(Number(entry?.lessonId)))
          .map((entry) => ({ timestamp: entry.timestamp, lessonId: clampPositive(Number(entry.lessonId)) }))
      : [],
  }
}

function setTierUsageState(nextState: TierUsageState): void {
  setState(TIER_USAGE_KEY, nextState)
}

function getNormalizedUsageContext(now = Date.now()) {
  const normalized = normalizeTierUsageStateState(getState(TIER_USAGE_KEY) as Partial<TierUsageState> | null, now)
  if (normalized.changed) {
    setTierUsageState(normalized.usageState)
  }
  return normalized
}

function normalizeUsageState(now = Date.now()) {
  const usageState = getTierUsageState()

  const courseGenerationTimestamps = usageState.courseGenerationTimestamps.filter((iso) => {
    const timestamp = Date.parse(iso)
    return Number.isFinite(timestamp) && now - timestamp < USAGE_HISTORY_WINDOW_MS
  })

  const chatMessageTimestamps = usageState.chatMessageTimestamps.filter((iso) => {
    const timestamp = Date.parse(iso)
    return Number.isFinite(timestamp) && now - timestamp < USAGE_HISTORY_WINDOW_MS
  })

  const aiTokenEvents = usageState.aiTokenEvents.filter((entry) => {
    const timestamp = Date.parse(entry.timestamp)
    return Number.isFinite(timestamp) && now - timestamp < TWO_HOURS_MS
  })

  const lessonUsageEvents = usageState.lessonUsageEvents.filter((entry) => {
    const timestamp = Date.parse(entry.timestamp)
    return Number.isFinite(timestamp) && now - timestamp < USAGE_HISTORY_WINDOW_MS
  })

  const changed =
    courseGenerationTimestamps.length !== usageState.courseGenerationTimestamps.length ||
    chatMessageTimestamps.length !== usageState.chatMessageTimestamps.length ||
    aiTokenEvents.length !== usageState.aiTokenEvents.length ||
    lessonUsageEvents.length !== usageState.lessonUsageEvents.length

  if (changed) {
    setTierUsageState({
      courseGenerationTimestamps,
      chatMessageTimestamps,
      aiTokenEvents,
      lessonUsageEvents,
    })
  }

  return {
    courseGenerationTimestamps,
    chatMessageTimestamps,
    aiTokenEvents,
    lessonUsageEvents,
    monthKey: localMonthKey(now),
    dayKey: localDayKey(now),
  }
}

function countTotalFlashcards(): number {
  const stmt = getDB().prepare('SELECT COUNT(*) as total FROM flashcards')
  const stepped = stmt.step()
  const row = stepped ? stmt.getAsObject() : { total: 0 }
  stmt.free()
  return clampPositive(Number(row.total || 0))
}

function estimateChatTokens(message: string, recentMessages: ChatContextMessage[]): number {
  const normalizedMessage = String(message || '').trim()
  const wordCount = normalizedMessage.split(/\s+/).filter(Boolean).length
  const simpleTurn = normalizedMessage.length <= 80 && wordCount <= 14 && !/[\n`{}\[\]]/.test(normalizedMessage)
  const historyChars = recentMessages
    .slice(simpleTurn ? -4 : -8)
    .reduce((total, item) => total + String(item.content || '').length, 0)

  const estimate = simpleTurn
    ? 110 + Math.ceil(normalizedMessage.length * 0.18) + Math.ceil(historyChars * 0.04) + 90
    : 180 + Math.ceil(normalizedMessage.length * 0.28) + Math.ceil(historyChars * 0.08) + (normalizedMessage.length > 360 ? 260 : 180)

  return Math.max(simpleTurn ? 140 : 220, estimate)
}

function remainingValue(limit: number | null, used: number): number | null {
  return limit === null ? null : Math.max(0, limit - used)
}

function getActiveLessonIds(lessonUsageEvents: LessonUsageEvent[]): number[] {
  return Array.from(new Set(lessonUsageEvents.map((entry) => entry.lessonId).filter((id) => id > 0)))
}

function getRecentLessonIds(lessonUsageEvents: LessonUsageEvent[], now = Date.now()): number[] {
  return Array.from(new Set(
    lessonUsageEvents
      .filter((entry) => {
        const timestamp = Date.parse(entry.timestamp)
        return Number.isFinite(timestamp) && now - timestamp < TWO_HOURS_MS
      })
      .map((entry) => entry.lessonId)
      .filter((id) => id > 0),
  ))
}

function buildTelemetryBucket(input: number, output: number, requests: number) {
  const safeInput = clampPositive(input)
  const safeOutput = clampPositive(output)
  const safeRequests = clampPositive(requests)
  const total = safeInput + safeOutput
  return {
    input: safeInput,
    output: safeOutput,
    total,
    requests: safeRequests,
    averagePerRequest: safeRequests > 0 ? Math.round(total / safeRequests) : 0,
  }
}

function buildPlanSnapshot(tierMode: 'free' | 'premium') {
  const config = getTierConfig(tierMode)
  return {
    label: config.label,
    note: tierMode === 'free'
      ? 'Lean and cheaper: keeps the useful core without excess cost.'
      : 'Deeper and broader: more room for chat, lessons, practice, and recall.',
    capabilities: {
      coursesPer2Hours: config.coursesPer2Hours,
      coursesPerMonth: config.coursesPerMonth,
      chatMessagesPerDay: config.chatMessagesPerDay,
      lessonsPer2Hours: config.lessonsPer2Hours,
      lessonsPerMonth: config.lessonsPerMonth,
      flashcardsTotal: config.flashcardsTotal,
      exportCoursePdf: config.exportCoursePdf,
    },
  }
}

function msUntilLocalDayReset(now: number): number {
  const next = new Date(now)
  next.setHours(24, 0, 0, 0)
  return Math.max(60_000, next.getTime() - now)
}

function msUntilCourseReset(now: number, timestamps: string[]): number {
  const oldest = timestamps
    .map((iso) => Date.parse(iso))
    .filter((value) => Number.isFinite(value) && now - value < TWO_HOURS_MS)
    .sort((left, right) => left - right)[0]

  return oldest ? Math.max(60_000, TWO_HOURS_MS - (now - oldest)) : TWO_HOURS_MS
}

function msUntilTokenReset(now: number, events: TokenUsageEvent[]): number {
  const oldest = events
    .map((entry) => Date.parse(entry.timestamp))
    .filter((value) => Number.isFinite(value) && now - value < TWO_HOURS_MS)
    .sort((left, right) => left - right)[0]

  return oldest ? Math.max(60_000, TWO_HOURS_MS - (now - oldest)) : TWO_HOURS_MS
}

function msUntilLessonReset(now: number, events: LessonUsageEvent[]): number {
  const oldest = events
    .map((entry) => Date.parse(entry.timestamp))
    .filter((value) => Number.isFinite(value) && now - value < TWO_HOURS_MS)
    .sort((left, right) => left - right)[0]

  return oldest ? Math.max(60_000, TWO_HOURS_MS - (now - oldest)) : TWO_HOURS_MS
}

export function buildTierLimitSnapshot(profile: UserProfile | null): TierLimitSnapshot {
  const now = Date.now()
  return buildTierLimitSnapshotState({
    profile,
    usageState: getNormalizedUsageContext(now).usageState,
    tokenStats: getTokenStats(),
    flashcardsTotal: countTotalFlashcards(),
    now,
  })
}

export function evaluateCourseCreation(profile: UserProfile | null): BaseDecision {
  const now = Date.now()
  return evaluateCourseCreationState({
    profile,
    usageState: getNormalizedUsageContext(now).usageState,
    now,
  })
}

export function recordCourseCreation(): void {
  const now = Date.now()
  setTierUsageState(recordCourseCreationState(getNormalizedUsageContext(now).usageState, now))
}

export function evaluateAIBudget(profile: UserProfile | null, estimatedTokens: number): AIBudgetDecision {
  return evaluateAIBudgetState(profile, estimatedTokens)
}

export function evaluateChatBudget(profile: UserProfile | null, message: string, recentMessages: ChatContextMessage[]): AIBudgetDecision {
  const now = Date.now()
  return evaluateChatBudgetState({
    profile,
    usageState: getNormalizedUsageContext(now).usageState,
    message,
    recentMessages,
    now,
  })
}

export function recordChatMessage(): void {
  const now = Date.now()
  setTierUsageState(recordChatMessageState(getNormalizedUsageContext(now).usageState, now))
}

export function recordAIUsage(inputTokens: number, outputTokens: number, source?: string): void {
  const now = Date.now()
  setTierUsageState(recordAIUsageState(getNormalizedUsageContext(now).usageState, inputTokens, outputTokens, source, now))
}

export function evaluateLessonStart(profile: UserProfile | null, lessonId: number): LessonStartDecision {
  const now = Date.now()
  return evaluateLessonStartState({
    profile,
    usageState: getNormalizedUsageContext(now).usageState,
    lessonId,
    now,
  })
}

export function recordLessonStart(lessonId: number): void {
  const now = Date.now()
  setTierUsageState(recordLessonStartState(getNormalizedUsageContext(now).usageState, lessonId, now))
}