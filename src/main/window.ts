import { BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'

export function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    transparent: false,
    backgroundColor: '#080606',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#080606',
      symbolColor: '#d97706',
      height: 36
    },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true
    },
    show: false
  })

  win.on('ready-to-show', () => {
    win.show()
  })

  // Security: block navigation to external URLs
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://') && !url.startsWith('http://localhost')) {
      event.preventDefault()
    }
  })

  // Security: open external links in system browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) {
      shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  // Security: disable dev tools in production
  if (!is.dev) {
    win.webContents.on('before-input-event', (event, input) => {
      if (input.key === 'F12' ||
        (input.control && input.shift && (input.key === 'I' || input.key === 'J' || input.key === 'C')) ||
        (input.control && input.key === 'u')) {
        event.preventDefault()
      }
    })
  }

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}
