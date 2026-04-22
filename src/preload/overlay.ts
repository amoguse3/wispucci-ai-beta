import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('overlayAPI', {
  getReminder: () => ipcRenderer.invoke('overlay:getReminder'),
  openMain: () => ipcRenderer.send('overlay:openMain'),
  sendToChat: (message: string) => ipcRenderer.send('overlay:sendToChat', message),
  getOrbSize: () => ipcRenderer.invoke('overlay:getOrbSize'),
  onSizeChange: (callback: (size: string) => void) => {
    ipcRenderer.on('overlay:sizeChange', (_event, size) => callback(size))
  },
  setClickThrough: (ignore: boolean) => ipcRenderer.send('overlay:setClickThrough', ignore),
  dragMove: (dx: number, dy: number) => ipcRenderer.send('overlay:dragMove', dx, dy),
})
