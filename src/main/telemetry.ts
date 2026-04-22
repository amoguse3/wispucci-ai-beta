import { randomUUID } from 'crypto'
import { app } from 'electron'
import { getState, setState } from './db'
import type { TierMode } from '../../shared/types'

const TELEMETRY_API = 'https://wisp-flow.vercel.app/api/telemetry'

interface TokenStatsBucket {
  input: number
  output: number
  requests: number
}

interface TokenStats {
  totalInput: number
  totalOutput: number
  totalRequests: number
  firstUsed: string | null
  byTier: Record<TierMode, TokenStatsBucket>
  bySource: Record<string, TokenStatsBucket>
}

interface TokenMeta {
  source?: string
  tierMode?: TierMode
}

function emptyBucket(): TokenStatsBucket {
  return { input: 0, output: 0, requests: 0 }
}

function normalizeBucket(raw: Partial<TokenStatsBucket> | null | undefined): TokenStatsBucket {
  return {
    input: Number(raw?.input) || 0,
    output: Number(raw?.output) || 0,
    requests: Number(raw?.requests) || 0,
  }
}

function normalizeTokenStats(raw: Partial<TokenStats> | null | undefined): TokenStats {
  const byTierRaw = raw?.byTier as Partial<Record<TierMode, Partial<TokenStatsBucket>>> | undefined
  const bySourceRaw = raw?.bySource as Record<string, Partial<TokenStatsBucket>> | undefined

  const byTier: Record<TierMode, TokenStatsBucket> = {
    free: normalizeBucket(byTierRaw?.free),
    premium: normalizeBucket(byTierRaw?.premium),
    'dev-unlimited': normalizeBucket(byTierRaw?.['dev-unlimited']),
  }

  const bySource: Record<string, TokenStatsBucket> = {}
  for (const [key, value] of Object.entries(bySourceRaw || {})) {
    bySource[key] = normalizeBucket(value)
  }

  return {
    totalInput: Number(raw?.totalInput) || 0,
    totalOutput: Number(raw?.totalOutput) || 0,
    totalRequests: Number(raw?.totalRequests) || 0,
    firstUsed: typeof raw?.firstUsed === 'string' ? raw.firstUsed : null,
    byTier,
    bySource,
  }
}

/** Get or create persistent machine ID */
export function getMachineId(): string {
  let id = getState('machineId') as string | null
  if (!id) {
    id = randomUUID()
    setState('machineId', id)
  }
  return id
}

/** Track cumulative token usage (never resets, separate from rate-limit) */
export function addTotalTokens(input: number, output: number, meta?: TokenMeta): void {
  const stats = normalizeTokenStats(getState('tokenStats') as TokenStats | null)
  if (!stats.firstUsed) stats.firstUsed = new Date().toISOString()
  stats.totalInput += input
  stats.totalOutput += output
  stats.totalRequests += 1

  const tierMode = meta?.tierMode
  if (tierMode && stats.byTier[tierMode]) {
    stats.byTier[tierMode].input += input
    stats.byTier[tierMode].output += output
    stats.byTier[tierMode].requests += 1
  }

  if (meta?.source) {
    if (!stats.bySource[meta.source]) {
      stats.bySource[meta.source] = emptyBucket()
    }
    stats.bySource[meta.source].input += input
    stats.bySource[meta.source].output += output
    stats.bySource[meta.source].requests += 1
  }

  setState('tokenStats', stats)
}

export function getTokenStats(): TokenStats {
  return normalizeTokenStats(getState('tokenStats') as TokenStats | null)
}

/** Send registration / heartbeat to remote API so admin can see all users */
export async function sendTelemetry(): Promise<void> {
  try {
    const machineId = getMachineId()
    const profile = getState('profile') as any
    const tokenStats = getTokenStats()
    const motivation = getState('motivation') as any

    await fetch(TELEMETRY_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(10000),
      body: JSON.stringify({
        machineId,
        appVersion: app.getVersion(),
        name: profile?.name || null,
        language: profile?.language || 'ro',
        onboarded: !!profile?.onboardingDone,
        tokensInput: tokenStats.totalInput,
        tokensOutput: tokenStats.totalOutput,
        totalRequests: tokenStats.totalRequests,
        tokensByTier: tokenStats.byTier,
        tokensBySource: tokenStats.bySource,
        xp: motivation?.xp || 0,
        level: motivation?.level || 1,
        streak: motivation?.streak || 0,
        timestamp: new Date().toISOString(),
      }),
    })
  } catch {
    // Silent — telemetry should never block the app
  }
}

/** Start periodic telemetry (every 10 min) */
export function startTelemetryLoop(): void {
  // First ping after 5s (let DB & profile load)
  setTimeout(() => sendTelemetry(), 5000)
  // Then every 10 minutes
  setInterval(() => sendTelemetry(), 10 * 60 * 1000)
}
