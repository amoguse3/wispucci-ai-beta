import { globalShortcut, BrowserWindow } from 'electron'

export function registerHotkey(getWindow: () => BrowserWindow | null) {
  globalShortcut.register('CommandOrControl+Shift+A', () => {
    const win = getWindow()
    if (!win) return

    if (win.isVisible()) {
      win.hide()
    } else {
      win.show()
      win.focus()
    }
  })
}

export function unregisterHotkeys() {
  globalShortcut.unregisterAll()
}
