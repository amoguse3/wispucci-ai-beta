import type { LessonReward, MotivationState } from '../../../shared/types'
import { LEVELS, LESSON_MILESTONE_SIZE, LESSON_REWARD_BONUS_XP, LESSON_REWARD_NORMAL_XP, LESSON_REWARD_TOTAL_XP } from '../../../shared/constants'

export interface MotivationProgressDeps {
  getCoursesCompletedCount: () => number
  getCompletedLessonsCount: () => number
}

export interface MotivationLessonDeps extends MotivationProgressDeps {
  getLessonById: (lessonId: number) => { id: number; completed?: boolean } | null
  completeLesson: (lessonId: number) => void
}

export interface MotivationStreakDeps extends MotivationProgressDeps {
  getToday: () => string
}

export function defaultMotivation(): MotivationState {
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
    freezesAvailable: 1,
    lastFreezeGrantDate: '',
    welcomeBack: null,
    lastLessonReward: null,
  }
}

export function normalizeMotivation(raw: MotivationState | null): MotivationState {
  const base = defaultMotivation()
  const motivation = raw || base

  return {
    ...base,
    ...motivation,
    achievementLevels: {
      ...base.achievementLevels,
      ...(motivation.achievementLevels || {}),
    },
  }
}

export function countWords(text: string): number {
  const matches = (text || '').trim().match(/[\p{L}\p{N}']+/gu)
  return matches ? matches.length : 0
}

export function hydrateMotivationProgress(raw: MotivationState | null, deps: MotivationProgressDeps): MotivationState {
  const motivation = normalizeMotivation(raw)
  return applyAchievementProgress(motivation, deps)
}

export function recordWordsTyped(raw: MotivationState | null, text: string, deps: MotivationProgressDeps): MotivationState {
  const motivation = normalizeMotivation(raw)
  motivation.wordsTyped += countWords(text)
  return applyAchievementProgress(motivation, deps)
}

export function rewardChatReply(raw: MotivationState | null): MotivationState {
  const motivation = normalizeMotivation(raw)
  motivation.xp += 5
  syncLevelAndXpBadges(motivation)

  if (!motivation.badges.includes('first_session')) {
    motivation.badges.push('first_session')
  }

  return motivation
}

export function addXp(raw: MotivationState | null, amount: number, deps: MotivationProgressDeps): MotivationState {
  const motivation = normalizeMotivation(raw)
  motivation.xp += Number(amount) || 0
  syncLevelAndXpBadges(motivation)
  return applyAchievementProgress(motivation, deps)
}

export function awardLessonCompletion(
  raw: MotivationState | null,
  lessonId: number,
  deps: MotivationLessonDeps,
): { motivation: MotivationState; reward: LessonReward } {
  const motivation = normalizeMotivation(raw)
  const lesson = deps.getLessonById(lessonId)

  if (!lesson) {
    throw new Error('Lesson not found')
  }

  if (lesson.completed) {
    const cached = motivation.lastLessonReward
    if (cached?.lessonId === lessonId) {
      return { motivation, reward: cached }
    }

    applyAchievementProgress(motivation, deps)
    const reward = buildLessonReward(lessonId, motivation.completedLessons)
    motivation.lastLessonReward = reward
    return { motivation, reward }
  }

  deps.completeLesson(lessonId)

  motivation.xp += LESSON_REWARD_TOTAL_XP
  motivation.bonusXpEarned += LESSON_REWARD_BONUS_XP
  syncLevelAndXpBadges(motivation)
  applyAchievementProgress(motivation, deps)

  const reward = buildLessonReward(lessonId, motivation.completedLessons)
  motivation.lastLessonReward = reward

  return { motivation, reward }
}

export function updateStreak(raw: MotivationState | null, deps: MotivationStreakDeps): MotivationState {
  const motivation = normalizeMotivation(raw)
  const today = deps.getToday()
  const lastActive = motivation.lastActive

  maybeGrantFreeze(motivation, today)

  if (lastActive === today) {
    return motivation
  }

  const gap = daysBetween(lastActive, today)
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().split('T')[0]

  if (lastActive === yesterday || gap === 1) {
    motivation.streak += 1
    motivation.graceDayUsed = false
    motivation.welcomeBack = null
  } else if (gap === 2 && (motivation.freezesAvailable ?? 0) > 0 && motivation.streak > 0) {
    motivation.freezesAvailable = (motivation.freezesAvailable ?? 1) - 1
    motivation.welcomeBack = 'freeze_used'
  } else if (!motivation.graceDayUsed && motivation.streak > 0 && gap <= 2) {
    motivation.graceDayUsed = true
    motivation.welcomeBack = 'freeze_used'
  } else if (lastActive !== '' && gap > 1) {
    motivation.streak = 1
    motivation.graceDayUsed = false
    motivation.welcomeBack = 'streak_reset'
  } else {
    motivation.streak = 1
    motivation.graceDayUsed = false
    motivation.welcomeBack = null
  }

  motivation.lastActive = today

  if (motivation.streak >= 3 && !motivation.badges.includes('streak_3')) motivation.badges.push('streak_3')
  if (motivation.streak >= 7 && !motivation.badges.includes('streak_7')) motivation.badges.push('streak_7')
  if (motivation.streak >= 30 && !motivation.badges.includes('streak_30')) motivation.badges.push('streak_30')

  return applyAchievementProgress(motivation, deps)
}

export function acknowledgeWelcomeBack(raw: MotivationState | null): MotivationState {
  const motivation = normalizeMotivation(raw)
  motivation.welcomeBack = null
  return motivation
}

export function addMinutes(raw: MotivationState | null, minutes: number, deps: MotivationProgressDeps): MotivationState {
  const motivation = normalizeMotivation(raw)
  motivation.minutesSpent += Math.max(0, Math.floor(minutes || 0))
  return applyAchievementProgress(motivation, deps)
}

function getLevel(xp: number): number {
  for (let index = LEVELS.length - 1; index >= 0; index -= 1) {
    if (xp >= LEVELS[index].minXP) return index + 1
  }
  return 1
}

function syncLevelAndXpBadges(motivation: MotivationState): MotivationState {
  motivation.level = getLevel(motivation.xp)

  if (motivation.level >= 3 && !motivation.badges.includes('level_3')) motivation.badges.push('level_3')
  if (motivation.level >= 5 && !motivation.badges.includes('level_5')) motivation.badges.push('level_5')
  if (motivation.xp >= 500 && !motivation.badges.includes('xp_500')) motivation.badges.push('xp_500')
  if (motivation.xp >= 1000 && !motivation.badges.includes('xp_1000')) motivation.badges.push('xp_1000')

  return motivation
}

function getLessonLevel(completedLessons: number): number {
  return Math.floor(Math.max(0, completedLessons) / LESSON_MILESTONE_SIZE) + 1
}

function buildLessonReward(lessonId: number, completedLessons: number): LessonReward {
  const milestoneReached = completedLessons > 0 && completedLessons % LESSON_MILESTONE_SIZE === 0
  const milestoneReachedAt = milestoneReached ? completedLessons : null
  const nextMilestoneAt = milestoneReached
    ? completedLessons + LESSON_MILESTONE_SIZE
    : Math.ceil(Math.max(1, completedLessons) / LESSON_MILESTONE_SIZE) * LESSON_MILESTONE_SIZE
  const lessonsUntilNextMilestone = Math.max(0, nextMilestoneAt - completedLessons)
  const milestoneLabel = milestoneReached
    ? `Milestone reached. Next one in ${LESSON_MILESTONE_SIZE} lessons.`
    : `${lessonsUntilNextMilestone} lessons until the next milestone.`
  const celebrationText = milestoneReached
    ? `Small win: you closed ${completedLessons} lessons. Keep the rhythm.`
    : `Another concept locked in. ${lessonsUntilNextMilestone} lessons until the next threshold.`

  return {
    lessonId,
    normalXp: LESSON_REWARD_NORMAL_XP,
    bonusXp: LESSON_REWARD_BONUS_XP,
    totalXp: LESSON_REWARD_TOTAL_XP,
    completedLessons,
    milestoneSize: LESSON_MILESTONE_SIZE,
    milestoneReached,
    milestoneReachedAt,
    nextMilestoneAt,
    lessonsUntilNextMilestone,
    milestoneLabel,
    celebrationText,
  }
}

function applyAchievementProgress(motivation: MotivationState, deps: MotivationProgressDeps): MotivationState {
  motivation.coursesCompleted = deps.getCoursesCompletedCount()
  motivation.completedLessons = deps.getCompletedLessonsCount()

  const wordMilestones = [200, 1000, 5000, 15000]

  motivation.achievementLevels = {
    lessons: getLessonLevel(motivation.completedLessons),
    courses: getTrackLevel(motivation.coursesCompleted, [1, 3, 5, 10]),
    words: getTrackLevel(motivation.wordsTyped, wordMilestones),
    time: getTrackLevel(motivation.minutesSpent, [30, 120, 600, 1800]),
  }

  if (motivation.coursesCompleted >= 1 && !motivation.badges.includes('course_1')) motivation.badges.push('course_1')
  if (motivation.coursesCompleted >= 3 && !motivation.badges.includes('course_3')) motivation.badges.push('course_3')
  if (motivation.coursesCompleted >= 5 && !motivation.badges.includes('course_5')) motivation.badges.push('course_5')
  if (motivation.coursesCompleted >= 10 && !motivation.badges.includes('course_10')) motivation.badges.push('course_10')

  if (motivation.wordsTyped >= 200 && !motivation.badges.includes('words_200')) motivation.badges.push('words_200')
  if (motivation.wordsTyped >= 1000 && !motivation.badges.includes('words_1000')) motivation.badges.push('words_1000')
  if (motivation.wordsTyped >= 5000 && !motivation.badges.includes('words_5000')) motivation.badges.push('words_5000')
  if (motivation.wordsTyped >= 15000 && !motivation.badges.includes('words_15000')) motivation.badges.push('words_15000')

  if (motivation.minutesSpent >= 30 && !motivation.badges.includes('time_30')) motivation.badges.push('time_30')
  if (motivation.minutesSpent >= 120 && !motivation.badges.includes('time_120')) motivation.badges.push('time_120')
  if (motivation.minutesSpent >= 600 && !motivation.badges.includes('time_600')) motivation.badges.push('time_600')
  if (motivation.minutesSpent >= 1800 && !motivation.badges.includes('time_1800')) motivation.badges.push('time_1800')

  return motivation
}

function maybeGrantFreeze(motivation: MotivationState, today: string): void {
  const daysSinceGrant = motivation.lastFreezeGrantDate
    ? daysBetween(motivation.lastFreezeGrantDate, today)
    : Infinity

  if (daysSinceGrant >= 7 && (motivation.freezesAvailable ?? 0) < 1) {
    motivation.freezesAvailable = 1
    motivation.lastFreezeGrantDate = today
  }
}

function daysBetween(left: string, right: string): number {
  if (!left || !right) return Infinity

  const leftTime = new Date(left + 'T00:00:00').getTime()
  const rightTime = new Date(right + 'T00:00:00').getTime()
  return Math.round((rightTime - leftTime) / 86_400_000)
}

function getTrackLevel(value: number, milestones: number[]): number {
  let level = 1
  for (const milestone of milestones) {
    if (value >= milestone) level += 1
  }
  return level
}