import { app, BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'

function sendUpdateStatus(mainWindow: BrowserWindow | null, text: string): void {
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.webContents.send('app:updateStatus', text)
}

export function initAutoUpdater(getMainWindow: () => BrowserWindow | null): void {
  if (!app.isPackaged) return

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => {
    sendUpdateStatus(getMainWindow(), 'Checking for updates...')
  })

  autoUpdater.on('update-available', (info) => {
    sendUpdateStatus(getMainWindow(), `Update available: v${info.version}`)
  })

  autoUpdater.on('update-not-available', () => {
    sendUpdateStatus(getMainWindow(), 'The app is up to date.')
  })

  autoUpdater.on('download-progress', (progress) => {
    sendUpdateStatus(getMainWindow(), `Downloading update: ${Math.round(progress.percent)}%`)
  })

  autoUpdater.on('update-downloaded', (info) => {
    sendUpdateStatus(getMainWindow(), `Update downloaded (v${info.version}). It will install on the next close.`)
  })

  autoUpdater.on('error', (err) => {
    sendUpdateStatus(getMainWindow(), `Update error: ${err.message}`)
  })

  const safeCheck = () => {
    autoUpdater.checkForUpdates().catch(() => {
      // avoid crashing on transient network/release config issues
    })
  }

  setTimeout(safeCheck, 15000)
  setInterval(safeCheck, 30 * 60 * 1000)
}
