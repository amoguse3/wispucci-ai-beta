import type { DailyLeaderboard, GamePoints } from '../../../../../shared/types'
import { useLanguage } from '../../contexts/LanguageContext'

const GAME_ICONS: Record<string, string> = {
  math_speed: '🧮', memory_tiles: '🧠', pattern_match: '🔢',
  reaction_time: '⚡', word_scramble: '🔤', color_stroop: '🎨'
}

const GAME_NAMES: Record<string, string> = {
  math_speed: 'Math Speed', memory_tiles: 'Memory Tiles', pattern_match: 'Pattern Match',
  reaction_time: 'Reaction', word_scramble: 'Word Scramble', color_stroop: 'Color Stroop'
}

interface Props {
  data: DailyLeaderboard[]
  points: GamePoints | null
  onBack: () => void
  onRedeem: () => Promise<{ success: boolean; remaining: number }>
}

export default function Leaderboard({ data, points, onBack, onRedeem }: Props) {
  const { t, lang } = useLanguage()
  const today = data[0]
  const weekTotal = data.reduce((sum, d) => sum + d.totalDailyPoints, 0)
  const locale = lang === 'ru' ? 'ru-RU' : lang === 'ro' ? 'ro-RO' : 'en-US'

  const getGameName = (gameType: string) => {
    switch (gameType) {
      case 'math_speed':
        return t('games.mathSpeed')
      case 'memory_tiles':
        return t('games.memoryTiles')
      case 'pattern_match':
        return t('games.patternMatch')
      case 'reaction_time':
        return t('games.reactionTime')
      case 'word_scramble':
        return t('games.wordScramble')
      case 'color_stroop':
        return t('games.colorStroop')
      default:
        return gameType
    }
  }

  return (
    <div className="flex-1 flex flex-col relative z-10 overflow-y-auto">
      {/* Header */}
      <div className="p-4 pb-2">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={onBack} className="text-aura-muted hover:text-aura-text text-sm transition-colors">←</button>
          <h1 className="text-lg font-semibold text-aura-text">{t('leaderboard.title')}</h1>
        </div>

        {/* Points summary */}
        <div className="p-4 rounded-xl mb-4" style={{
          background: 'linear-gradient(135deg, rgba(217,119,6,0.15), rgba(249,115,22,0.1))',
          border: '1px solid rgba(217,119,6,0.2)'
        }}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-2xl font-bold text-aura-orange">{points?.total || 0}</p>
              <p className="text-[10px] text-aura-muted">{t('leaderboard.totalPoints')}</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-semibold text-emerald-400">+{points?.todayEarned || 0}</p>
              <p className="text-[10px] text-aura-muted">{t('leaderboard.today')}</p>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[10px] text-aura-muted">
              {t('leaderboard.proDaysRedeemed', { count: points?.proDaysRedeemed || 0 })}
            </span>
            {(points?.total || 0) >= 100 && (
              <button onClick={onRedeem}
                className="px-3 py-1 rounded-full text-[10px] font-medium hover:scale-105 transition-all"
                style={{ background: 'rgba(16,185,129,0.2)', border: '1px solid rgba(16,185,129,0.3)', color: '#6ee7b7' }}>
                {t('leaderboard.redeem')}
              </button>
            )}
          </div>
        </div>

        {/* Week total */}
        <div className="flex items-center justify-between p-3 rounded-xl mb-4" style={{
          background: 'rgba(26,23,20,0.6)', border: '1px solid rgba(42,37,32,0.3)'
        }}>
          <span className="text-xs text-aura-muted">{t('leaderboard.thisWeek')}</span>
          <span className="text-sm font-semibold text-aura-text">{weekTotal} {t('leaderboard.points')}</span>
        </div>
      </div>

      {/* Daily breakdown */}
      <div className="px-4">
        {data.map((day, dayIdx) => {
          const isToday = dayIdx === 0
          const dayName = isToday ? t('leaderboard.todayLabel') : new Date(day.date).toLocaleDateString(locale, { weekday: 'short', day: 'numeric' })

          return (
            <div key={day.date} className="mb-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className={`text-xs font-medium ${isToday ? 'text-aura-orange' : 'text-aura-muted'}`}>
                  {dayName}
                </span>
                <span className="text-[10px] text-aura-muted">{day.totalDailyPoints} {t('leaderboard.points')}</span>
              </div>

              {day.entries.length === 0 ? (
                <p className="text-[10px] text-aura-muted pl-2">{t('leaderboard.noGames')}</p>
              ) : (
                <div className="space-y-1">
                  {day.entries.map((entry, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 rounded-lg" style={{
                      background: 'rgba(26,23,20,0.4)',
                      border: '1px solid rgba(42,37,32,0.2)'
                    }}>
                      <span className="text-sm">{GAME_ICONS[entry.gameType] || '🎮'}</span>
                      <span className="text-xs text-aura-text flex-1">{getGameName(entry.gameType)}</span>
                      <span className="text-xs font-mono font-medium text-aura-orange">{entry.bestScore}</span>
                      <span className="text-[10px] text-aura-muted">{t('leaderboard.best')}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Rankings info */}
      <div className="p-4 mt-auto">
        <div className="p-3 rounded-xl text-center" style={{
          background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.15)'
        }}>
          <p className="text-[10px] text-violet-300">
            {t('leaderboard.dailyHint')}
          </p>
        </div>
      </div>
    </div>
  )
}
