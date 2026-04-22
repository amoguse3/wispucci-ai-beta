import { useState } from 'react'
import { useLanguage } from '../contexts/LanguageContext'

const PX = "'Press Start 2P', monospace"

interface Props {
  onRetry: () => void
}

export default function AIError({ onRetry }: Props) {
  const { t } = useLanguage()
  const [key, setKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    if (!key.trim()) return
    setSaving(true)
    setError('')
    try {
      const res = await window.aura.claude.setKey(key.trim())
      if (res?.ok) {
        onRetry()
      } else {
        setError(t('aiError.invalidKey'))
      }
    } catch {
      setError(t('aiError.saveError'))
    }
    setSaving(false)
  }

  return (
    <div className="relative z-20 h-full flex items-center justify-center p-6">
      <div className="w-full max-w-sm text-center animate-fade-in-up">
        <div className="mx-auto mb-6 w-16 h-16 rounded-full animate-breathe" style={{
          background: 'radial-gradient(circle, rgba(239,68,68,0.3) 0%, transparent 70%)',
          boxShadow: '0 0 40px rgba(239,68,68,0.15)'
        }}>
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-2xl">⚠️</span>
          </div>
        </div>

        <h2 style={{ fontFamily: PX, fontSize: 10, color: 'rgba(200,220,255,0.85)', marginBottom: 8 }}>
          {t('aiError.title')}
        </h2>

        <p style={{ fontFamily: PX, fontSize: 6, color: 'rgba(200,220,255,0.35)', lineHeight: 2.2, marginBottom: 16 }}>
          {t('aiError.subtitle')}
        </p>

        <input
          type="password"
          value={key}
          onChange={e => setKey(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
          placeholder="sk-..."
          style={{
            width: '100%', padding: '10px 14px', borderRadius: 8, marginBottom: 8,
            fontFamily: PX, fontSize: 7,
            color: 'rgba(200,220,255,0.7)', background: 'rgba(10,15,30,0.8)',
            border: '1px solid rgba(100,160,240,0.15)', outline: 'none',
          }}
        />

        {error && (
          <p style={{ fontFamily: PX, fontSize: 5, color: 'rgba(239,68,68,0.7)', marginBottom: 8 }}>{error}</p>
        )}

        <button onClick={handleSave} disabled={saving || !key.trim()}
          className="w-full py-3 rounded-xl text-sm font-medium transition-all hover:scale-[1.02]"
          style={{
            fontFamily: PX, fontSize: 7,
            background: key.trim() ? 'linear-gradient(135deg, #d97706, #b45309)' : 'rgba(100,100,100,0.15)',
            color: key.trim() ? '#fff' : 'rgba(200,220,255,0.3)',
            boxShadow: key.trim() ? '0 0 20px rgba(217,119,6,0.2)' : 'none',
            cursor: key.trim() ? 'pointer' : 'default',
            marginBottom: 8,
          }}>
          {saving ? '· · ·' : t('aiError.save')}
        </button>

        <button onClick={onRetry}
          style={{
            fontFamily: PX, fontSize: 5, color: 'rgba(100,160,240,0.25)',
            background: 'none', border: 'none', cursor: 'pointer',
          }}>
          {t('aiError.recheck')}
        </button>
      </div>
    </div>
  )
}
