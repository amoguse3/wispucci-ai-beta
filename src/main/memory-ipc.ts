import { ipcMain } from 'electron'
import {
  listMemories,
  addMemory,
  deleteMemory,
  pickCallbackMemory,
  markMemoryRecalled,
  decayMemories,
  getSemanticFacts,
  type MemoryKind,
} from './db'

/**
 * Memory IPC — exposes the 3-tier memory system to the renderer.
 *
 * Tiers:
 *   - working:  session context, decays in ~6h
 *   - episodic: tagged moments (wins, struggles, goals), decays slowly
 *   - semantic: stable facts (name, job, preferences) — never decays
 */
export function registerMemoryIpc() {
  ipcMain.handle('memory:list', async (_e, kind?: MemoryKind) => {
    return listMemories(kind)
  })

  ipcMain.handle('memory:add', async (_e, content: string, kind?: MemoryKind, tag?: string | null, importance?: number) => {
    try {
      return addMemory(content, kind || 'episodic', tag ?? null, importance ?? 3)
    } catch (err) {
      return null
    }
  })

  ipcMain.handle('memory:delete', async (_e, id: number) => {
    deleteMemory(id)
    return { ok: true }
  })

  ipcMain.handle('memory:pickCallback', async () => {
    const row = pickCallbackMemory()
    if (row) markMemoryRecalled(row.id)
    return row
  })

  ipcMain.handle('memory:decay', async () => {
    decayMemories()
    return { ok: true }
  })

  ipcMain.handle('memory:semantic', async () => {
    return getSemanticFacts()
  })
}
