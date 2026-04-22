import BackgroundOrbs from './BackgroundOrbs'
import { useTheme } from '../contexts/ThemeContext'

/**
 * Switches the background layer based on the active theme:
 *   - 'cosmos' → the original <BackgroundOrbs /> (stars, planets, meteors)
 *   - anything else → a static CSS background (colour / gradient / image)
 *
 * Also applies the user's bg-opacity override.
 */
export default function ThemedBackground() {
  const { backgroundCss, overrides } = useTheme()
  const opacity = Math.max(0, Math.min(1, overrides.bgOpacity))

  if (backgroundCss === 'cosmos') {
    return (
      <div
        className="fixed inset-0"
        style={{ zIndex: 0, opacity, pointerEvents: 'none' }}
      >
        <BackgroundOrbs />
      </div>
    )
  }

  // Static backgrounds (colour / gradient / image)
  const isImage = backgroundCss.startsWith('center') || backgroundCss.startsWith('url(')
  return (
    <div
      className="fixed inset-0 pointer-events-none"
      style={{
        zIndex: 0,
        opacity,
        background: isImage ? backgroundCss : undefined,
        backgroundColor: !isImage && !backgroundCss.includes('gradient') ? backgroundCss : undefined,
        backgroundImage:
          !isImage && backgroundCss.includes('gradient') ? backgroundCss : undefined,
      }}
    >
      {/* subtle vignette so overlays stay readable */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.35) 100%)',
        }}
      />
    </div>
  )
}
