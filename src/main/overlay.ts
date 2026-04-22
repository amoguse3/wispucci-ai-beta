import { BrowserWindow, screen, ipcMain } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { getState } from './db'

let overlayWindow: BrowserWindow | null = null

function shouldUseOverlay(): boolean {
  const profile = getState('profile') as any
  return Boolean(profile?.onboardingDone) && profile?.orbEnabled !== false
}

const REMINDERS = [
  'Don\'t forget to drink water! 💧',
  'You have unfinished courses! 📚',
  'A short break helps your brain.',
  'Let\'s learn something new!',
  'Progress is built step by step.',
  'You\'re on the right track! ⭐',
  'Memory improves with daily reps.',
  'Focus. You can do this. 💪',
  'One small step today = success tomorrow.',
  'Did you check your tasks today?',
]

function createWindow(): BrowserWindow {
  const { width: screenW, height: screenH } = screen.getPrimaryDisplay().workAreaSize
  const winW = 300
  const winH = 350

  const win = new BrowserWindow({
    width: winW,
    height: winH,
    x: screenW - winW - 16,
    y: screenH - winH - 16,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    webPreferences: {
      preload: join(__dirname, '../preload/overlay.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'] + '/overlay.html')
  } else {
    win.loadFile(join(__dirname, '../renderer/overlay.html'))
  }

  // Click-through on transparent areas
  win.setIgnoreMouseEvents(true, { forward: true })

  win.on('closed', () => {
    overlayWindow = null
  })

  return win
}

export function registerOverlayIpc(getMainWindow: () => BrowserWindow | null): void {
  // Mouse forwarding — renderer tells us when cursor enters/leaves visible elements
  ipcMain.on('overlay:setClickThrough', (_, ignore: boolean) => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      if (ignore) {
        overlayWindow.setIgnoreMouseEvents(true, { forward: true })
      } else {
        overlayWindow.setIgnoreMouseEvents(false)
      }
    }
  })

  // Custom drag — renderer sends dx,dy deltas
  ipcMain.on('overlay:dragMove', (_, dx: number, dy: number) => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      const [x, y] = overlayWindow.getPosition()
      const [w, h] = overlayWindow.getSize()
      const display = screen.getDisplayNearestPoint({ x, y })
      const { x: sx, y: sy, width: sw, height: sh } = display.workArea
      const nx = Math.max(sx, Math.min(sx + sw - w, x + dx))
      const ny = Math.max(sy, Math.min(sy + sh - h, y + dy))
      overlayWindow.setPosition(nx, ny)
    }
  })

  ipcMain.handle('overlay:getReminder', () => {
    return { text: REMINDERS[Math.floor(Math.random() * REMINDERS.length)] }
  })

  ipcMain.handle('overlay:getOrbSize', () => {
    const profile = getState('profile') as any
    return profile?.orbSize || 'medium'
  })

  ipcMain.on('overlay:openMain', () => {
    const main = getMainWindow()
    if (main) {
      main.show()
      main.focus()
    }
    overlayWindow?.hide()
  })

  ipcMain.on('overlay:sendToChat', (_, message: string) => {
    const main = getMainWindow()
    if (main) {
      main.show()
      main.focus()
      main.webContents.send('overlay:chatMessage', message)
    }
    overlayWindow?.hide()
  })

  ipcMain.handle('overlay:setEnabled', (_, enabled: boolean) => {
    if (enabled) {
      ensureOverlayWindow()
    } else {
      hideOverlay()
    }
  })

  ipcMain.handle('overlay:setSize', (_, size: string) => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.webContents.send('overlay:sizeChange', size)
    }
  })
}

function ensureOverlayWindow(): BrowserWindow {
  if (overlayWindow && !overlayWindow.isDestroyed()) return overlayWindow
  overlayWindow = createWindow()
  return overlayWindow
}

export function initOverlay(): void {
  if (shouldUseOverlay()) {
    overlayWindow = createWindow()
  }
}

export function showOverlay(): void {
  if (!shouldUseOverlay()) return
  ensureOverlayWindow()
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.showInactive()
  }
}

export function hideOverlay(): void {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.hide()
  }
}
