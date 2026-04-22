import type { TierLimitSnapshot, TierMode, UserProfile } from '../../../shared/types'

const TWO_HOURS_MS = 2 * 60 * 60 * 1000
const ONE_DAY_MS = 24 * 60 * 60 * 1000
const USAGE_HISTORY_WINDOW_MS = 400 * ONE_DAY_MS

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

export interface TierUsageState {
  courseGenerationTimestamps: string[]
  chatMessageTimestamps: string[]
  aiTokenEvents: TokenUsageEvent[]
  lessonUsageEvents: LessonUsageEvent[]
}

export interface ChatContextMessage {
  content: string
}

export interface BaseDecision {
  allowed: boolean
  message?: string
}

export interface AIBudgetDecision extends BaseDecision {
  estimatedTokens?: number
}

export interface LessonStartDecision extends BaseDecision {
  consumesSlot: boolean
}

interface TierTokenStatsBucket {
  input: number
  output: number
  requests: number
}

export interface TierTokenStats {
  totalInput: number
  totalOutput: number
  totalRequests: number
  byTier: Record<TierMode, TierTokenStatsBucket>
  bySource: Record<string, TierTokenStatsBucket>
}

export interface NormalizedTierUsageContext {
  usageState: TierUsageState
  monthKey: string
  dayKey: string
  changed: boolean
}

export interface BuildTierLimitSnapshotInput {
  profile: UserProfile | null
  usageState: Partial<TierUsageState> | null | undefined
  tokenStats: Partial<TierTokenStats> | null | undefined
  flashcardsTotal: number
  now?: number
}

export interface TierDecisionInput {
  profile: UserProfile | null
  usageState: Partial<TierUsageState> | null | undefined
  now?: number
}

export interface TierChatBudgetInput extends TierDecisionInput {
  message: string
  recentMessages: ChatContextMessage[]
}

export interface TierLessonStartInput extends TierDecisionInput {
  lessonId: number
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

export function normalizeTierMode(value: unknown): TierMode {
  if (value === 'dev-unlimited') return 'dev-unlimited'
  if (value === 'premium') return 'premium'
  return 'free'
}

function getTierConfig(tierMode: TierMode): TierConfig {
  return TIER_CONFIGS[tierMode]
}

export function normalizeTierUsageState(raw: Partial<TierUsageState> | null | undefined, now = Date.now()): NormalizedTierUsageContext {
  const usageState: TierUsageState = {
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

  return {
    usageState: {
      courseGenerationTimestamps,
      chatMessageTimestamps,
      aiTokenEvents,
      lessonUsageEvents,
    },
    monthKey: localMonthKey(now),
    dayKey: localDayKey(now),
    changed:
      courseGenerationTimestamps.length !== usageState.courseGenerationTimestamps.length ||
      chatMessageTimestamps.length !== usageState.chatMessageTimestamps.length ||
      aiTokenEvents.length !== usageState.aiTokenEvents.length ||
      lessonUsageEvents.length !== usageState.lessonUsageEvents.length,
  }
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

function normalizeTokenBucket(raw: Partial<TierTokenStatsBucket> | null | undefined): TierTokenStatsBucket {
  return {
    input: clampPositive(Number(raw?.input) || 0),
    output: clampPositive(Number(raw?.output) || 0),
    requests: clampPositive(Number(raw?.requests) || 0),
  }
}

function normalizeTokenStats(raw: Partial<TierTokenStats> | null | undefined): TierTokenStats {
  const byTierRaw = raw?.byTier as Partial<Record<TierMode, Partial<TierTokenStatsBucket>>> | undefined
  const bySourceRaw = raw?.bySource as Record<string, Partial<TierTokenStatsBucket>> | undefined

  const bySource: Record<string, TierTokenStatsBucket> = {}
  for (const [source, value] of Object.entries(bySourceRaw || {})) {
    bySource[source] = normalizeTokenBucket(value)
  }

  return {
    totalInput: clampPositive(Number(raw?.totalInput) || 0),
    totalOutput: clampPositive(Number(raw?.totalOutput) || 0),
    totalRequests: clampPositive(Number(raw?.totalRequests) || 0),
    byTier: {
      free: normalizeTokenBucket(byTierRaw?.free),
      premium: normalizeTokenBucket(byTierRaw?.premium),
      'dev-unlimited': normalizeTokenBucket(byTierRaw?.['dev-unlimited']),
    },
    bySource,
  }
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

function msUntilLessonReset(now: number, events: LessonUsageEvent[]): number {
  const oldest = events
    .map((entry) => Date.parse(entry.timestamp))
    .filter((value) => Number.isFinite(value) && now - value < TWO_HOURS_MS)
    .sort((left, right) => left - right)[0]

  return oldest ? Math.max(60_000, TWO_HOURS_MS - (now - oldest)) : TWO_HOURS_MS
}

export function buildTierLimitSnapshot(input: BuildTierLimitSnapshotInput): TierLimitSnapshot {
  const now = input.now ?? Date.now()
  const tierMode = normalizeTierMode(input.profile?.tierMode)
  const config = getTierConfig(tierMode)
  const { usageState, monthKey, dayKey } = normalizeTierUsageState(input.usageState, now)
  const tokenStats = normalizeTokenStats(input.tokenStats)
  const flashcardsTotal = clampPositive(Number(input.flashcardsTotal) || 0)

  const coursesCreatedLast2Hours = usageState.courseGenerationTimestamps.filter((iso) => {
    const timestamp = Date.parse(iso)
    return Number.isFinite(timestamp) && now - timestamp < TWO_HOURS_MS
  }).length
  const coursesCreatedThisMonth = usageState.courseGenerationTimestamps.filter((iso) => localMonthKey(iso) === monthKey).length
  const chatMessagesToday = usageState.chatMessageTimestamps.filter((iso) => localDayKey(iso) === dayKey).length
  const lessonsStartedLast2Hours = getRecentLessonIds(usageState.lessonUsageEvents, now).length
  const lessonsStartedThisMonth = usageState.lessonUsageEvents.filter((entry) => localMonthKey(entry.timestamp) === monthKey).length

  const telemetryByTier = {
    free: buildTelemetryBucket(tokenStats.byTier.free.input, tokenStats.byTier.free.output, tokenStats.byTier.free.requests),
    premium: buildTelemetryBucket(tokenStats.byTier.premium.input, tokenStats.byTier.premium.output, tokenStats.byTier.premium.requests),
    'dev-unlimited': buildTelemetryBucket(
      tokenStats.byTier['dev-unlimited'].input,
      tokenStats.byTier['dev-unlimited'].output,
      tokenStats.byTier['dev-unlimited'].requests,
    ),
  }

  const telemetryBySource = Object.entries(tokenStats.bySource)
    .map(([source, stats]) => ({
      source,
      ...buildTelemetryBucket(stats.input, stats.output, stats.requests),
    }))
    .sort((left, right) => right.total - left.total)

  const educatorTokens = telemetryBySource
    .filter((item) => item.source !== 'chat')
    .reduce((total, item) => total + item.total, 0)

  const freeAverage = telemetryByTier.free.averagePerRequest
  const premiumAverage = telemetryByTier.premium.averagePerRequest
  const currentTierTargetVsPremium = tierMode === 'free' ? 0.33 : tierMode === 'premium' ? 1 : null

  return {
    tierMode,
    label: config.label,
    capabilities: {
      coursesPer2Hours: config.coursesPer2Hours,
      coursesPerMonth: config.coursesPerMonth,
      chatMessagesPerDay: config.chatMessagesPerDay,
      lessonsPer2Hours: config.lessonsPer2Hours,
      lessonsPerMonth: config.lessonsPerMonth,
      flashcardsTotal: config.flashcardsTotal,
      exportCoursePdf: config.exportCoursePdf,
    },
    usage: {
      coursesCreatedLast2Hours,
      coursesCreatedThisMonth,
      chatMessagesToday,
      lessonsStartedLast2Hours,
      lessonsStartedThisMonth,
      flashcardsTotal,
    },
    remaining: {
      coursesPer2Hours: remainingValue(config.coursesPer2Hours, coursesCreatedLast2Hours),
      coursesPerMonth: remainingValue(config.coursesPerMonth, coursesCreatedThisMonth),
      chatMessagesPerDay: remainingValue(config.chatMessagesPerDay, chatMessagesToday),
      lessonsPer2Hours: remainingValue(config.lessonsPer2Hours, lessonsStartedLast2Hours),
      lessonsPerMonth: remainingValue(config.lessonsPerMonth, lessonsStartedThisMonth),
      flashcardsTotal: remainingValue(config.flashcardsTotal, flashcardsTotal),
    },
    notes: {
      courseCreation: 'Courses have two guards: one pacing window over 2 hours and one monthly volume cap. The first slows impulsive spam; the second keeps the unit economics under control.',
      chatBudget: 'The only blocking AI budget is chat, and it is counted in daily messages now. Lessons and courses still use telemetry for cost visibility, not message locks.',
      lessons: 'Lessons still have both a 2-hour pacing cap and a monthly cap. Re-opening the same lesson does not consume a new slot.',
      flashcards: config.flashcardsTotal === null
        ? 'This plan does not limit the total number of flashcards.'
        : 'The flashcard limit keeps the system dense and repeatable, not a warehouse of forgotten cards.',
      exportCoursePdf: config.exportCoursePdf
        ? 'PDF export remains available when the export surface is opened in the UI.'
        : 'PDF export stays blocked on this plan as a convenience feature, not a core learning feature.',
    },
    windows: {
      chatMessagesResetInMs: config.chatMessagesPerDay === null || chatMessagesToday === 0
        ? null
        : msUntilLocalDayReset(now),
      courseWindowResetInMs: config.coursesPer2Hours === null || coursesCreatedLast2Hours === 0
        ? null
        : msUntilCourseReset(now, usageState.courseGenerationTimestamps),
      lessonWindowResetInMs: config.lessonsPer2Hours === null || lessonsStartedLast2Hours === 0
        ? null
        : msUntilLessonReset(now, usageState.lessonUsageEvents),
    },
    telemetry: {
      total: buildTelemetryBucket(tokenStats.totalInput, tokenStats.totalOutput, tokenStats.totalRequests),
      byTier: telemetryByTier,
      bySource: telemetryBySource,
      optimization: {
        currentTierTargetVsPremium,
        freeTargetVsPremium: 0.33,
        freeToPremiumAverageRequestRatio: freeAverage > 0 && premiumAverage > 0
          ? Number((freeAverage / premiumAverage).toFixed(2))
          : null,
        educatorSharePct: tokenStats.totalInput + tokenStats.totalOutput > 0
          ? Math.round((educatorTokens / (tokenStats.totalInput + tokenStats.totalOutput)) * 100)
          : 0,
      },
    },
    plans: {
      free: buildPlanSnapshot('free'),
      premium: buildPlanSnapshot('premium'),
    },
  }
}

export function evaluateCourseCreation(input: TierDecisionInput): BaseDecision {
  const now = input.now ?? Date.now()
  const snapshot = buildTierLimitSnapshot({
    profile: input.profile,
    usageState: input.usageState,
    tokenStats: null,
    flashcardsTotal: 0,
    now,
  })
  const { usageState } = normalizeTierUsageState(input.usageState, now)

  if (snapshot.capabilities.coursesPer2Hours !== null && snapshot.usage.coursesCreatedLast2Hours >= snapshot.capabilities.coursesPer2Hours) {
    return {
      allowed: false,
      message: buildCourseWindowMessage(
        snapshot.label,
        snapshot.capabilities.coursesPer2Hours,
        msUntilCourseReset(now, usageState.courseGenerationTimestamps),
      ),
    }
  }

  if (snapshot.capabilities.coursesPerMonth !== null && snapshot.usage.coursesCreatedThisMonth >= snapshot.capabilities.coursesPerMonth) {
    return {
      allowed: false,
      message: buildCourseMonthMessage(snapshot.label, snapshot.capabilities.coursesPerMonth),
    }
  }

  return { allowed: true }
}

export function recordCourseCreation(rawUsageState: Partial<TierUsageState> | null | undefined, now = Date.now()): TierUsageState {
  const { usageState } = normalizeTierUsageState(rawUsageState, now)
  return {
    ...usageState,
    courseGenerationTimestamps: [...usageState.courseGenerationTimestamps, new Date(now).toISOString()],
  }
}

export function evaluateAIBudget(_profile: UserProfile | null, estimatedTokens: number): AIBudgetDecision {
  return {
    allowed: true,
    estimatedTokens: clampPositive(estimatedTokens),
  }
}

export function evaluateChatBudget(input: TierChatBudgetInput): AIBudgetDecision {
  const now = input.now ?? Date.now()
  const snapshot = buildTierLimitSnapshot({
    profile: input.profile,
    usageState: input.usageState,
    tokenStats: null,
    flashcardsTotal: 0,
    now,
  })
  const safeEstimate = clampPositive(estimateChatTokens(input.message, input.recentMessages))

  if (snapshot.capabilities.chatMessagesPerDay === null) {
    return { allowed: true, estimatedTokens: safeEstimate }
  }

  if (snapshot.usage.chatMessagesToday >= snapshot.capabilities.chatMessagesPerDay) {
    return {
      allowed: false,
      estimatedTokens: safeEstimate,
      message: buildChatBudgetMessage(snapshot.label, snapshot.capabilities.chatMessagesPerDay, msUntilLocalDayReset(now)),
    }
  }

  return {
    allowed: true,
    estimatedTokens: safeEstimate,
  }
}

export function recordChatMessage(rawUsageState: Partial<TierUsageState> | null | undefined, now = Date.now()): TierUsageState {
  const { usageState } = normalizeTierUsageState(rawUsageState, now)
  return {
    ...usageState,
    chatMessageTimestamps: [...usageState.chatMessageTimestamps, new Date(now).toISOString()],
  }
}

export function recordAIUsage(
  rawUsageState: Partial<TierUsageState> | null | undefined,
  inputTokens: number,
  outputTokens: number,
  source?: string,
  now = Date.now(),
): TierUsageState {
  const tokens = clampPositive(inputTokens) + clampPositive(outputTokens)
  const { usageState } = normalizeTierUsageState(rawUsageState, now)

  if (tokens <= 0) {
    return usageState
  }

  return {
    ...usageState,
    aiTokenEvents: [...usageState.aiTokenEvents, { timestamp: new Date(now).toISOString(), tokens, source }],
  }
}

export function evaluateLessonStart(input: TierLessonStartInput): LessonStartDecision {
  const now = input.now ?? Date.now()
  const snapshot = buildTierLimitSnapshot({
    profile: input.profile,
    usageState: input.usageState,
    tokenStats: null,
    flashcardsTotal: 0,
    now,
  })
  if ((snapshot.capabilities.lessonsPer2Hours === null && snapshot.capabilities.lessonsPerMonth === null) || input.lessonId <= 0) {
    return { allowed: true, consumesSlot: input.lessonId > 0 }
  }

  const { usageState } = normalizeTierUsageState(input.usageState, now)
  const startedLessonIds = getActiveLessonIds(usageState.lessonUsageEvents)
  if (startedLessonIds.includes(input.lessonId)) {
    return { allowed: true, consumesSlot: false }
  }

  const recentLessonIds = getRecentLessonIds(usageState.lessonUsageEvents, now)
  if (snapshot.capabilities.lessonsPer2Hours !== null && recentLessonIds.length >= snapshot.capabilities.lessonsPer2Hours) {
    return {
      allowed: false,
      consumesSlot: false,
      message: buildLessonLimitMessage(snapshot.label, snapshot.capabilities.lessonsPer2Hours, msUntilLessonReset(now, usageState.lessonUsageEvents)),
    }
  }

  const currentMonthLessons = usageState.lessonUsageEvents.filter((entry) => localMonthKey(entry.timestamp) === localMonthKey(now)).length
  if (snapshot.capabilities.lessonsPerMonth !== null && currentMonthLessons >= snapshot.capabilities.lessonsPerMonth) {
    return {
      allowed: false,
      consumesSlot: false,
      message: buildLessonMonthMessage(snapshot.label, snapshot.capabilities.lessonsPerMonth),
    }
  }

  return { allowed: true, consumesSlot: true }
}

export function recordLessonStart(
  rawUsageState: Partial<TierUsageState> | null | undefined,
  lessonId: number,
  now = Date.now(),
): TierUsageState {
  if (lessonId <= 0) {
    return normalizeTierUsageState(rawUsageState, now).usageState
  }

  const { usageState } = normalizeTierUsageState(rawUsageState, now)
  if (usageState.lessonUsageEvents.some((entry) => entry.lessonId === lessonId)) {
    return usageState
  }

  return {
    ...usageState,
    lessonUsageEvents: [...usageState.lessonUsageEvents, { timestamp: new Date(now).toISOString(), lessonId }],
  }
}