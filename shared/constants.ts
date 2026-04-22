export const LEVELS = [
  { nameKey: 'level.1', minXP: 0 },
  { nameKey: 'level.2', minXP: 100 },
  { nameKey: 'level.3', minXP: 250 },
  { nameKey: 'level.4', minXP: 500 },
  { nameKey: 'level.5', minXP: 900 },
  { nameKey: 'level.6', minXP: 1400 },
  { nameKey: 'level.7', minXP: 2000 },
  { nameKey: 'level.8', minXP: 3000 }
] as const

export const LESSON_MILESTONE_SIZE = 3
export const LESSON_REWARD_BASE_XP = 20
export const LESSON_REWARD_NORMAL_XP = 12
export const LESSON_REWARD_BONUS_XP = 5
export const LESSON_REWARD_TOTAL_XP = LESSON_REWARD_NORMAL_XP + LESSON_REWARD_BONUS_XP

export const BADGES = [
  { id: 'first_session', nameKey: 'badge.first_session', icon: '🌱' },
  { id: 'streak_3', nameKey: 'badge.streak_3', icon: '🔥' },
  { id: 'streak_7', nameKey: 'badge.streak_7', icon: '⚡' },
  { id: 'streak_30', nameKey: 'badge.streak_30', icon: '👑' },
  { id: 'level_3', nameKey: 'badge.level_3', icon: '⭐' },
  { id: 'level_5', nameKey: 'badge.level_5', icon: '💎' },
  { id: 'xp_500', nameKey: 'badge.xp_500', icon: '🏅' },
  { id: 'xp_1000', nameKey: 'badge.xp_1000', icon: '🏆' },
  { id: 'first_course', nameKey: 'badge.first_course', icon: '📚' },
  { id: 'course_complete', nameKey: 'badge.course_complete', icon: '🎓' },
  { id: 'course_1', nameKey: 'badge.course_1', icon: '🪵' },
  { id: 'course_3', nameKey: 'badge.course_3', icon: '🪨' },
  { id: 'course_5', nameKey: 'badge.course_5', icon: '⛓️' },
  { id: 'course_10', nameKey: 'badge.course_10', icon: '💠' },
  { id: 'words_200', nameKey: 'badge.words_200', icon: '✍️' },
  { id: 'words_1000', nameKey: 'badge.words_1000', icon: '📜' },
  { id: 'words_5000', nameKey: 'badge.words_5000', icon: '📚' },
  { id: 'words_15000', nameKey: 'badge.words_15000', icon: '🧠' },
  { id: 'time_30', nameKey: 'badge.time_30', icon: '🕯️' },
  { id: 'time_120', nameKey: 'badge.time_120', icon: '⏰' },
  { id: 'time_600', nameKey: 'badge.time_600', icon: '⌛' },
  { id: 'time_1800', nameKey: 'badge.time_1800', icon: '🏰' }
] as const

export const CRISIS_KEYWORDS = [
  // English
  'suicide', 'kill myself', 'want to die', 'end my life', 'self-harm', 'cut myself',
  // Russian
  'суицид', 'убить себя', 'хочу умереть', 'не хочу жить', 'самоповреждение',
  // Romanian
  'sinucid', 'suicid', 'omor', 'vreau să mor', 'nu mai vreau să trăiesc',
  'mă omor', 'mă sinucid', 'nu mai pot trăi', 'viața nu are sens',
  'automutilare', 'mă tai', 'mă rănesc'
]

export const MOOD_MAP: Record<string, { labelKey: string; color: string; emoji: string }> = {
  happy: { labelKey: 'mood.happy', color: '#f59e0b', emoji: '😊' },
  excited: { labelKey: 'mood.excited', color: '#ef4444', emoji: '🔥' },
  think: { labelKey: 'mood.think', color: '#8b5cf6', emoji: '🤔' },
  sleepy: { labelKey: 'mood.sleepy', color: '#6b7280', emoji: '😴' },
  sad: { labelKey: 'mood.sad', color: '#3b82f6', emoji: '😢' },
  love: { labelKey: 'mood.love', color: '#ec4899', emoji: '💜' },
  focus: { labelKey: 'mood.focus', color: '#10b981', emoji: '🎯' }
}
