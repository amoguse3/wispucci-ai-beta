import { useRef } from 'react'
import { useTheme } from '../contexts/ThemeContext'
import { THEME_LIST, FONT_PRESETS, type ThemeId } from '../../../../shared/themes'

/**
 * Theme picker used inside <Settings />.
 * - Preset theme grid
 * - Font family chips
 * - Sliders for orb glow / orb opacity / background opacity
 * - Custom PNG uploads for orb + background (stored as base64 in localStorage)
 */
export default function ThemePicker() {
  const { themeId, theme, overrides, setThemeId, patchOverrides, resetOverrides } = useTheme()
  const bgFileRef = useRef<HTMLInputElement | null>(null)
  const orbFileRef = useRef<HTMLInputElement | null>(null)

  const handleFile = (
    file: File | undefined,
    onDone: (dataUrl: string) => void,
  ) => {
    if (!file) return
    if (file.size > 1024 * 1024 * 2) {
      // 2 MB soft cap — localStorage has ~5 MB total
      alert('PNG too large (>2 MB). Choose a smaller file to avoid filling storage.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') onDone(reader.result)
    }
    reader.onerror = () => alert('Could not read the file. Try another image.')
    reader.readAsDataURL(file)
  }

  // ── styling helpers ──────────────────────────────────────────────────────
  const sectionWrap: React.CSSProperties = {
    padding: '14px 14px',
    borderRadius: 10,
    marginBottom: 18,
    background: 'rgba(4,14,8,0.6)',
    border: '1px solid rgba(196,154,60,0.1)',
  }

  const sectionLabel: React.CSSProperties = {
    fontFamily: "'Press Start 2P', monospace",
    fontSize: 5,
    letterSpacing: '0.18em',
    color: 'rgba(196,154,60,0.28)',
    marginBottom: 12,
    lineHeight: 2,
    textTransform: 'uppercase',
  }

  const chip = (active: boolean, color = '196,154,60'): React.CSSProperties => ({
    padding: '7px 12px',
    borderRadius: 7,
    fontFamily: "'Press Start 2P', monospace",
    fontSize: 5,
    lineHeight: 2,
    letterSpacing: '0.08em',
    cursor: 'pointer',
    border: `1px solid rgba(${color},${active ? 0.32 : 0.12})`,
    background: active ? `rgba(${color},0.1)` : 'rgba(13,29,22,0.45)',
    color: active
      ? `rgba(${color === '196,154,60' ? '232,197,106' : color},0.85)`
      : 'rgba(196,154,60,0.3)',
    transition: 'all 0.2s',
  })

  const slider = (
    label: string,
    key: 'orbGlow' | 'orbOpacity' | 'bgOpacity',
    min: number,
    max: number,
    step: number,
  ) => (
    <div style={{ marginTop: 10 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontFamily: "'Press Start 2P', monospace",
          fontSize: 5,
          color: 'rgba(196,154,60,0.4)',
          marginBottom: 4,
        }}
      >
        <span>{label}</span>
        <span style={{ color: 'rgba(232,197,106,0.7)' }}>
          {Math.round(overrides[key] * 100)}%
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={overrides[key]}
        onChange={e => patchOverrides({ [key]: Number(e.target.value) })}
        style={{
          width: '100%',
          accentColor: theme.accent,
          height: 4,
        }}
      />
    </div>
  )

  return (
    <>
      {/* ── Preset themes ─────────────────────────────────────────────────── */}
      <div style={sectionWrap}>
        <div style={sectionLabel}>TEME</div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 7 }}>
          {THEME_LIST.map(t => {
            const active = t.id === themeId
            return (
              <button
                key={t.id}
                onClick={() => setThemeId(t.id as ThemeId)}
                style={{
                  ...chip(active, t.accentRgb),
                  textAlign: 'left',
                  padding: '10px 10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span style={{ fontSize: 14, lineHeight: 1 }}>{t.emoji}</span>
                <span style={{ flex: 1 }}>{t.name}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Font ──────────────────────────────────────────────────────────── */}
      <div style={sectionWrap}>
        <div style={sectionLabel}>FONT TEXT</div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
          <button
            onClick={() => patchOverrides({ fontOverride: null })}
            style={chip(!overrides.fontOverride)}
          >
            Auto ({theme.name})
          </button>
          {FONT_PRESETS.map(f => (
            <button
              key={f.id}
              onClick={() => patchOverrides({ fontOverride: f.id })}
              style={{ ...chip(overrides.fontOverride === f.id), fontFamily: f.stack }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Orb / Background intensity ───────────────────────────────────── */}
      <div style={sectionWrap}>
        <div style={sectionLabel}>INTENSITY</div>
        {slider('Orb glow', 'orbGlow', 0, 2, 0.05)}
        {slider('Orb opacity', 'orbOpacity', 0.15, 1, 0.05)}
        {slider('Background opacity', 'bgOpacity', 0.1, 1, 0.05)}
      </div>

      {/* ── Custom PNG uploads ───────────────────────────────────────────── */}
      <div style={sectionWrap}>
        <div style={sectionLabel}>CUSTOM PNG</div>

        {/* Background PNG */}
        <div style={{ marginBottom: 10 }}>
          <div
            style={{
              fontFamily: "'Press Start 2P', monospace",
              fontSize: 5,
              color: 'rgba(196,154,60,0.4)',
              marginBottom: 6,
            }}
          >
            BACKGROUND
          </div>
          <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
            <button onClick={() => bgFileRef.current?.click()} style={chip(false, '56,189,248')}>
              ↑ Upload PNG
            </button>
            {overrides.customBgDataUrl && (
              <>
                <div
                  style={{
                    width: 28,
                    height: 18,
                    borderRadius: 4,
                    border: '1px solid rgba(196,154,60,0.2)',
                    background: `center/cover no-repeat url(${overrides.customBgDataUrl})`,
                  }}
                />
                <button
                  onClick={() => patchOverrides({ customBgDataUrl: null })}
                  style={chip(false, '220,80,80')}
                >
                  ✕
                </button>
              </>
            )}
          </div>
          <input
            ref={bgFileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            style={{ display: 'none' }}
            onChange={e => {
              handleFile(e.target.files?.[0], url =>
                patchOverrides({ customBgDataUrl: url }),
              )
              e.target.value = ''
            }}
          />
        </div>

        {/* Orb PNG */}
        <div>
          <div
            style={{
              fontFamily: "'Press Start 2P', monospace",
              fontSize: 5,
              color: 'rgba(196,154,60,0.4)',
              marginBottom: 6,
            }}
          >
            ORB
          </div>
          <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
            <button onClick={() => orbFileRef.current?.click()} style={chip(false, '249,168,212')}>
              ↑ Upload PNG
            </button>
            {overrides.customOrbDataUrl && (
              <>
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    border: '1px solid rgba(196,154,60,0.2)',
                    background: `center/cover no-repeat url(${overrides.customOrbDataUrl})`,
                  }}
                />
                <button
                  onClick={() => patchOverrides({ customOrbDataUrl: null })}
                  style={chip(false, '220,80,80')}
                >
                  ✕
                </button>
              </>
            )}
          </div>
          <input
            ref={orbFileRef}
            type="file"
            accept="image/png,image/webp"
            style={{ display: 'none' }}
            onChange={e => {
              handleFile(e.target.files?.[0], url =>
                patchOverrides({ customOrbDataUrl: url }),
              )
              e.target.value = ''
            }}
          />
        </div>

        <div
          style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: 5,
            color: 'rgba(196,154,60,0.25)',
            marginTop: 10,
            lineHeight: 2.2,
          }}
        >
          PNG with a transparent background. Max ~2 MB.
        </div>
      </div>

      {/* ── Reset ─────────────────────────────────────────────────────────── */}
      <button
        onClick={resetOverrides}
        style={{
          width: '100%',
          padding: 10,
          borderRadius: 10,
          fontFamily: "'Press Start 2P', monospace",
          fontSize: 6,
          letterSpacing: '0.08em',
          lineHeight: 2,
          cursor: 'pointer',
          transition: 'all 0.28s ease',
          border: '1px solid rgba(196,154,60,0.18)',
          background: 'rgba(196,154,60,0.05)',
          color: 'rgba(232,197,106,0.7)',
          marginBottom: 16,
        }}
      >
        RESETEAZA OVERRIDES
      </button>
    </>
  )
}
