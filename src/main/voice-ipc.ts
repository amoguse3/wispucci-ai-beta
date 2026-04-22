import { ipcMain } from 'electron'
import { getState, setState } from './db'

export interface VoiceSettings {
  ttsEnabled: boolean
  sttEnabled: boolean
  ttsRate: number
  ttsPitch: number
  ttsVolume: number
  language: string
  voiceName: string
}

const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  ttsEnabled: true,
  sttEnabled: true,
  ttsRate: 0.9,
  ttsPitch: 0.95,
  ttsVolume: 1,
  language: 'ro-RO',
  voiceName: ''
}

export function registerVoiceIpc() {
  ipcMain.handle('voice:getSettings', async () => {
    return (getState('voiceSettings') as VoiceSettings) || DEFAULT_VOICE_SETTINGS
  })

  ipcMain.handle('voice:saveSettings', async (_e, settings: VoiceSettings) => {
    setState('voiceSettings', settings)
  })
}
