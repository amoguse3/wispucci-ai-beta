import { useState } from 'react'
import type { Flashcard } from '../../../../shared/types'
import { useLanguage } from '../contexts/LanguageContext'

interface Props {
  moduleId: number
  cards: Flashcard[]
  onBack: () => void
}

export default function FlashcardDeck({ cards, onBack }: Props) {
  const { t } = useLanguage()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [reviewed, setReviewed] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [done, setDone] = useState(false)

  const card = cards[currentIndex]

  const review = async (quality: number) => {
    if (!card) return
    try {
      await window.aura.educator.reviewFlashcard(card.id, quality)
    } catch {
      // ignore — UX continues regardless of backend state
    }
    if (quality >= 3) setCorrect(c => c + 1)
    setReviewed(r => r + 1)
    setFlipped(false)

    if (currentIndex + 1 >= cards.length) {
      setDone(true)
    } else {
      setCurrentIndex(i => i + 1)
    }
  }

  if (cards.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center animate-fade-in">
          <span className="text-3xl opacity-30">🃏</span>
          <p className="text-sm text-aura-muted mt-2">{t('flashcard.noCards')}</p>
          <button onClick={onBack} className="text-xs text-aura-orange mt-3 hover:underline">{t('flashcard.back')}</button>
        </div>
      </div>
    )
  }

  if (done) {
    const accuracy = Math.round((correct / reviewed) * 100)
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center animate-fade-in-up">
          <div className="text-4xl mb-3">{accuracy >= 80 ? '🎉' : accuracy >= 50 ? '👍' : '💪'}</div>
          <h3 className="text-base font-semibold text-aura-text mb-1" style={{ fontFamily: 'Georgia, serif' }}>
            {t('flashcard.done')}
          </h3>
          <p className="text-sm mb-1" style={{
            color: accuracy >= 80 ? '#6ee7b7' : accuracy >= 50 ? '#f59e0b' : '#fca5a5'
          }}>
            {correct}/{reviewed} ({t('flashcard.accuracy', { percent: accuracy })})
          </p>
          <button onClick={onBack}
            className="px-5 py-2.5 rounded-xl text-xs font-medium transition-all hover:scale-105 mt-5"
            style={{
              background: 'linear-gradient(135deg, rgba(217,119,6,0.15), rgba(217,119,6,0.08))',
              border: '1px solid rgba(217,119,6,0.2)',
              color: '#f59e0b'
            }}>
            {t('common.back')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col p-4">
      <button onClick={onBack} className="text-xs text-aura-muted hover:text-aura-text mb-3 transition-colors">
        {t('flashcard.back')}
      </button>

      {/* Progress */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(42,37,32,0.5)' }}>
          <div className="h-full rounded-full transition-all duration-500" style={{
            width: `${((currentIndex) / cards.length) * 100}%`,
            background: 'linear-gradient(90deg, #8b5cf6, #a78bfa)'
          }} />
        </div>
        <span className="text-[10px] text-aura-muted">{currentIndex + 1}/{cards.length}</span>
      </div>

      {/* Card */}
      <div className="flex-1 flex items-center justify-center">
        <button
          onClick={() => setFlipped(!flipped)}
          className="w-full max-w-sm aspect-[3/2] rounded-2xl p-6 flex items-center justify-center transition-all duration-500 cursor-pointer hover:scale-[1.02]"
          style={{
            background: flipped
              ? 'linear-gradient(135deg, rgba(16,185,129,0.1), rgba(16,185,129,0.04))'
              : 'linear-gradient(135deg, rgba(139,92,246,0.1), rgba(139,92,246,0.04))',
            border: `1px solid ${flipped ? 'rgba(16,185,129,0.2)' : 'rgba(139,92,246,0.2)'}`,
            boxShadow: `0 0 30px ${flipped ? 'rgba(16,185,129,0.1)' : 'rgba(139,92,246,0.1)'}`,
            transform: `perspective(600px) rotateY(${flipped ? '0' : '0'}deg)`
          }}>
          <div className="text-center">
            <p className="text-[10px] text-aura-muted mb-2 uppercase tracking-wider">
              {flipped ? 'Answer' : 'Question'}
            </p>
            <p className="text-sm text-aura-text leading-relaxed">
              {flipped ? card.back : card.front}
            </p>
            {!flipped && (
              <p className="text-[10px] text-aura-muted mt-4">{t('flashcard.tap')}</p>
            )}
          </div>
        </button>
      </div>

      {/* Review buttons (visible when flipped) */}
      {flipped && (
        <div className="flex gap-2 mt-4 animate-fade-in-up">
          <button onClick={() => review(1)}
            className="flex-1 py-3 rounded-xl text-xs font-medium transition-all hover:scale-[1.02]"
            style={{
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.2)',
              color: '#fca5a5'
            }}>
            {t('flashcard.hard')}
          </button>
          <button onClick={() => review(3)}
            className="flex-1 py-3 rounded-xl text-xs font-medium transition-all hover:scale-[1.02]"
            style={{
              background: 'rgba(245,158,11,0.1)',
              border: '1px solid rgba(245,158,11,0.2)',
              color: '#fcd34d'
            }}>
            {t('flashcard.medium')}
          </button>
          <button onClick={() => review(5)}
            className="flex-1 py-3 rounded-xl text-xs font-medium transition-all hover:scale-[1.02]"
            style={{
              background: 'rgba(16,185,129,0.1)',
              border: '1px solid rgba(16,185,129,0.2)',
              color: '#6ee7b7'
            }}>
            {t('flashcard.easy')}
          </button>
        </div>
      )}
    </div>
  )
}
