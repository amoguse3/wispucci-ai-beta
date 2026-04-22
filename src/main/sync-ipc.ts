import { ipcMain } from 'electron'
import { getState, setState, getDB } from './db'
import type { MotivationState, SyncState } from '../../shared/types'

// Wisp+Flow API base URL
const SYNC_API = 'https://wisp-flow.vercel.app/api'

function defaultSyncState(): SyncState {
  return { linked: false, linkCode: null, lastSync: null, syncStatus: 'idle', webUsername: null }
}

function getSyncState(): SyncState {
  return (getState('syncState') as SyncState) || defaultSyncState()
}

export function registerSyncIpc() {
  // Get sync state
  ipcMain.handle('sync:getState', async () => {
    return getSyncState()
  })

  // Link with web account using 6-char code
  ipcMain.handle('sync:link', async (_event, code: string) => {
    try {
      const upperCode = code.toUpperCase().trim()

      // Verify the code exists
      const verifyRes = await fetch(`${SYNC_API}/link-device?code=${upperCode}`, {
        signal: AbortSignal.timeout(10000)
      })
      const verifyData = await verifyRes.json()

      if (!verifyData.valid) {
        return { success: false, error: 'Cod invalid. Verifică codul din aplicația web.' }
      }

      // Save link
      const syncState: SyncState = {
        linked: true,
        linkCode: upperCode,
        lastSync: null,
        syncStatus: 'idle',
        webUsername: verifyData.user?.username || null
      }
      setState('syncState', syncState)

      // Do initial sync
      const syncResult = await doSync(upperCode)

      return {
        success: true,
        username: verifyData.user?.username
      }
    } catch (e: any) {
      return { success: false, error: e.message || 'Connection error' }
    }
  })

  // Unlink
  ipcMain.handle('sync:unlink', async () => {
    setState('syncState', defaultSyncState())
  })

  // Manual sync
  ipcMain.handle('sync:syncNow', async () => {
    const state = getSyncState()
    if (!state.linked || !state.linkCode) {
      return { success: false, error: 'Not linked' }
    }

    return doSync(state.linkCode)
  })

  // Auto-sync every 5 minutes
  setInterval(() => {
    const state = getSyncState()
    if (state.linked && state.linkCode) {
      doSync(state.linkCode).catch(() => {})
    }
  }, 5 * 60 * 1000)
}

async function doSync(linkCode: string): Promise<{ success: boolean; merged?: any; error?: string }> {
  const syncState = getSyncState()
  syncState.syncStatus = 'syncing'
  setState('syncState', syncState)

  try {
    const motivation = (getState('motivation') as MotivationState) || {
      xp: 0, level: 1, streak: 0, badges: [], weeklyXP: [], lastActive: '', graceDayUsed: false
    }

    // Get game points and course count
    const db = getDB()

    let gamePoints = 0
    let courseCount = 0
    try {
      const gpStmt = db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM game_points')
      if (gpStmt.step()) gamePoints = (gpStmt.getAsObject().total as number) || 0
      gpStmt.free()

      const ccStmt = db.prepare('SELECT COUNT(*) as cnt FROM courses')
      if (ccStmt.step()) courseCount = (ccStmt.getAsObject().cnt as number) || 0
      ccStmt.free()
    } catch {
      // Tables might not exist yet
    }

    const res = await fetch(`${SYNC_API}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({
        linkCode,
        xp: motivation.xp,
        level: motivation.level,
        streak: motivation.streak,
        badges: motivation.badges,
        totalSessions: 0,
        courses: courseCount,
        gamePoints
      })
    })

    const data = await res.json()

    if (data.success && data.merged) {
      // Update local motivation with merged data (take higher values)
      motivation.xp = Math.max(motivation.xp, data.merged.xp)
      motivation.level = Math.max(motivation.level, data.merged.level)
      motivation.streak = Math.max(motivation.streak, data.merged.streak)
      motivation.badges = [...new Set([...motivation.badges, ...(data.merged.badges || [])])]
      setState('motivation', motivation)

      syncState.syncStatus = 'success'
      syncState.lastSync = new Date().toISOString()
      setState('syncState', syncState)

      return { success: true, merged: data.merged }
    }

    syncState.syncStatus = 'error'
    setState('syncState', syncState)
    return { success: false, error: data.error || 'Sync failed' }
  } catch (e: any) {
    const s = getSyncState()
    s.syncStatus = 'error'
    setState('syncState', s)
    return { success: false, error: e.message || 'Network error' }
  }
}
