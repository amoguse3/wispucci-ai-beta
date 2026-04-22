import { app, BrowserWindow, session } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { createMainWindow } from './window'
import { createTray } from './tray'
import { registerHotkey, unregisterHotkeys } from './hotkey'
import { registerIpcHandlers } from './ipc-handlers'
import { registerEducatorIpc, reconcileInterruptedCourseGeneration } from './educator-ipc'
import { registerVoiceIpc } from './voice-ipc'
import { registerGamesIpc } from './games-ipc'
import { registerSyncIpc } from './sync-ipc'
import { registerMemoryIpc } from './memory-ipc'
import { initDB, getState, saveDBSync, setState } from './db'
import { setClaudeApiKey } from './claude'
import { setGroqApiKey } from './groq'
import { registerOverlayIpc, initOverlay, showOverlay, hideOverlay } from './overlay'
import { startTelemetryLoop, getMachineId } from './telemetry'
import { initAutoUpdater } from './updater'

let mainWindow: BrowserWindow | null = null

function getWindow(): BrowserWindow | null {
  return mainWindow
}

function isDeepSeekKey(value: string | null | undefined): value is string {
  return typeof value === 'string' && /^sk-(?!ant-)/.test(value.trim())
}

function isGroqKey(value: string | null | undefined): value is string {
  return typeof value === 'string' && /^gsk_/.test(value.trim())
}

app.whenReady().then(async () => {
  // Security: set strict CSP
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; connect-src 'self' https://api.groq.com https://api.deepseek.com https://wisp-flow.vercel.app; img-src 'self' data:; font-src 'self' https://fonts.gstatic.com"
        ]
      }
    })
  })

  // Security: disable remote module, prevent new window creation
  app.on('web-contents-created', (_event, contents) => {
    contents.on('will-attach-webview', (event) => {
      event.preventDefault()
    })
  })

  electronApp.setAppUserModelId('app.wispflow.wispucci-ai-beta')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Initialize database
  await initDB()

  // Restore API keys from DB
  const savedClaudeKey = getState('claudeApiKey') as string | null
  const envClaudeKey = process.env['DEEPSEEK_API_KEY'] || process.env['CLAUDE_API_KEY'] || process.env['ANTHROPIC_API_KEY'] || ''
  const resolvedClaudeKey = isDeepSeekKey(savedClaudeKey)
    ? savedClaudeKey.trim()
    : isDeepSeekKey(envClaudeKey)
      ? envClaudeKey.trim()
      : ''

  setClaudeApiKey(resolvedClaudeKey)
  if (resolvedClaudeKey && savedClaudeKey !== resolvedClaudeKey) {
    setState('claudeApiKey', resolvedClaudeKey)
  }

  const savedGroqKey = getState('groqApiKey') as string | null
  const envGroqKey = process.env['GROQ_API_KEY'] || ''
  const resolvedGroqKey = isGroqKey(savedGroqKey)
    ? savedGroqKey.trim()
    : isGroqKey(envGroqKey)
      ? envGroqKey.trim()
      : ''

  setGroqApiKey(resolvedGroqKey)
  if (resolvedGroqKey && savedGroqKey !== resolvedGroqKey) {
    setState('groqApiKey', resolvedGroqKey)
  }

  // Register IPC handlers
  registerIpcHandlers()
  registerEducatorIpc()
  reconcileInterruptedCourseGeneration()
  registerVoiceIpc()
  registerGamesIpc()
  registerSyncIpc()
  registerMemoryIpc()
  registerOverlayIpc(getWindow)

  // Create main window
  mainWindow = createMainWindow()

  // Create system tray
  createTray(getWindow)

  // Register global hotkey
  registerHotkey(getWindow)

  // Floating orb overlay
  initOverlay()

  // Telemetry — register machine & periodic heartbeat
  getMachineId() // ensure ID exists
  startTelemetryLoop()

  // Auto-updates from GitHub releases (packaged app only)
  initAutoUpdater(getWindow)

  mainWindow.on('minimize', () => showOverlay())
  mainWindow.on('hide', () => showOverlay())
  mainWindow.on('restore', () => hideOverlay())
  mainWindow.on('show', () => hideOverlay())

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow()
    }
  })
})

app.on('will-quit', () => {
  saveDBSync()
  unregisterHotkeys()
})

app.on('window-all-closed', () => {
  // Keep running in tray
  // Don't quit on all windows closed
})
