import { Tray, Menu, nativeImage, BrowserWindow, app } from 'electron'
import { join } from 'path'

let tray: Tray | null = null

export function createTray(getWindow: () => BrowserWindow | null): Tray {
  const iconPath = join(__dirname, '../../resources/icon.png')
  let icon: Electron.NativeImage
  try {
    icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
  } catch {
    icon = nativeImage.createEmpty()
  }

  tray = new Tray(icon)
  tray.setToolTip('Wispucci Ai beta')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Wispucci AI beta',
      click: () => {
        const win = getWindow()
        if (win) {
          win.show()
          win.focus()
        }
      }
    },
    {
      label: 'Ascunde',
      click: () => {
        const win = getWindow()
        if (win) win.hide()
      }
    },
    { type: 'separator' },
    {
      label: 'Ctrl+Shift+A — toggle rapid',
      enabled: false
    },
    { type: 'separator' },
    {
      label: 'Quit Wispucci AI beta',
      click: () => {
        app.quit()
      }
    }
  ])

  tray.setContextMenu(contextMenu)

  tray.on('click', () => {
    const win = getWindow()
    if (!win) return
    if (win.isVisible()) {
      win.focus()
    } else {
      win.show()
      win.focus()
    }
  })

  return tray
}
