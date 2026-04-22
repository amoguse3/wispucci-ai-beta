import { app, ipcMain, shell } from 'electron'
import { createServer, type IncomingMessage, type ServerResponse } from 'http'
import { createReadStream, existsSync } from 'fs'
import { extname, join, normalize } from 'path'
import { initDB, getState, saveDBSync, setState } from './db'
import { setClaudeApiKey } from './claude'
import { setGroqApiKey } from './groq'
import { registerIpcHandlers } from './ipc-handlers'
import { registerEducatorIpc, reconcileInterruptedCourseGeneration } from './educator-ipc'
import { registerVoiceIpc } from './voice-ipc'
import { registerGamesIpc } from './games-ipc'
import { registerSyncIpc } from './sync-ipc'
import { registerMemoryIpc } from './memory-ipc'

type IpcInvokeHandler = (event: any, ...args: any[]) => any

const PORT = Number(process.env['AURA_WEB_PORT'] || 4315)
const HOST = process.env['AURA_WEB_HOST'] || '127.0.0.1'
const RENDERER_DIR = join(__dirname, '../renderer')

const invokeHandlers = new Map<string, IpcInvokeHandler>()
const sseClients = new Map<string, ServerResponse<IncomingMessage>>()

function isDeepSeekKey(value: string | null | undefined): value is string {
  return typeof value === 'string' && /^sk-(?!ant-)/.test(value.trim())
}

function isGroqKey(value: string | null | undefined): value is string {
  return typeof value === 'string' && /^gsk_/.test(value.trim())
}

function patchIpcForWebBridge(): void {
  const ipc = ipcMain as any
  if (ipc.__auraWebBridgePatched) return

  ipc.__auraWebBridgePatched = true
  ipc.handle = (channel: string, listener: IpcInvokeHandler) => {
    invokeHandlers.set(channel, listener)
  }
  ipc.on = (_channel: string, _listener: (...args: any[]) => void) => {
    // Browser-only local web mode does not need Electron event channels.
  }
}

function publish(clientId: string | null | undefined, channel: string, payload: unknown): void {
  if (!clientId) return
  const client = sseClients.get(clientId)
  if (!client || client.destroyed) return
  client.write(`event: ${channel}\n`)
  client.write(`data: ${JSON.stringify(payload)}\n\n`)
}

function createEvent(clientId?: string | null): any {
  return {
    sender: {
      send: (channel: string, payload: unknown) => publish(clientId, channel, payload),
    },
    reply: (channel: string, payload: unknown) => publish(clientId, channel, payload),
  }
}

async function readJsonBody(req: IncomingMessage): Promise<any> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    const totalSize = chunks.reduce((size, item) => size + item.length, 0)
    if (totalSize > 5 * 1024 * 1024) {
      throw new Error('Request body too large')
    }
  }

  if (chunks.length === 0) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

function sendJson(res: ServerResponse<IncomingMessage>, status: number, value: unknown): void {
  const body = JSON.stringify(value)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body),
  })
  res.end(body)
}

function getContentType(filePath: string): string {
  switch (extname(filePath).toLowerCase()) {
    case '.html':
      return 'text/html; charset=utf-8'
    case '.js':
      return 'text/javascript; charset=utf-8'
    case '.css':
      return 'text/css; charset=utf-8'
    case '.json':
      return 'application/json; charset=utf-8'
    case '.svg':
      return 'image/svg+xml'
    case '.png':
      return 'image/png'
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.woff2':
      return 'font/woff2'
    default:
      return 'application/octet-stream'
  }
}

function resolveStaticFile(urlPath: string): string {
  const cleaned = decodeURIComponent((urlPath || '/').split('?')[0])
  const normalizedPath = cleaned === '/' ? '/index.html' : cleaned
  const candidate = normalize(join(RENDERER_DIR, normalizedPath))

  if (candidate.startsWith(RENDERER_DIR) && existsSync(candidate)) {
    return candidate
  }

  return join(RENDERER_DIR, 'index.html')
}

function setSecurityHeaders(res: ServerResponse<IncomingMessage>): void {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Referrer-Policy', 'no-referrer')
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; connect-src 'self'; img-src 'self' data:; font-src 'self' https://fonts.gstatic.com; frame-ancestors 'none'; base-uri 'self'",
  )
}

async function handleInvoke(req: IncomingMessage, res: ServerResponse<IncomingMessage>): Promise<void> {
  const body = await readJsonBody(req)
  const channel = String(body?.channel || '').trim()
  const args = Array.isArray(body?.args) ? body.args : []
  const clientId = typeof body?.clientId === 'string' ? body.clientId : null

  const handler = invokeHandlers.get(channel)
  if (!handler) {
    sendJson(res, 404, { error: `Unknown channel: ${channel}` })
    return
  }

  try {
    const result = await handler(createEvent(clientId), ...args)
    if (typeof result === 'undefined') {
      res.writeHead(204, { 'Cache-Control': 'no-store' })
      res.end()
      return
    }
    sendJson(res, 200, { value: result })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || 'Unknown error')
    sendJson(res, 500, { error: message })
  }
}

function handleEvents(req: IncomingMessage, res: ServerResponse<IncomingMessage>): void {
  const url = new URL(req.url || '/api/events', `http://${HOST}:${PORT}`)
  const clientId = url.searchParams.get('clientId') || ''

  if (!clientId) {
    sendJson(res, 400, { error: 'Missing clientId' })
    return
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  })
  res.write('retry: 1000\n\n')
  sseClients.set(clientId, res)

  const heartbeat = setInterval(() => {
    if (!res.destroyed) {
      res.write(': keep-alive\n\n')
    }
  }, 15_000)

  req.on('close', () => {
    clearInterval(heartbeat)
    sseClients.delete(clientId)
  })
}

function serveStatic(req: IncomingMessage, res: ServerResponse<IncomingMessage>): void {
  const filePath = resolveStaticFile(req.url || '/')
  setSecurityHeaders(res)
  res.writeHead(200, {
    'Content-Type': getContentType(filePath),
    'Cache-Control': filePath.endsWith('.html') ? 'no-store' : 'public, max-age=31536000, immutable',
  })
  createReadStream(filePath).pipe(res)
}

function restoreProviderKeys(): void {
  const savedClaudeKey = getState('claudeApiKey') as string | null
  const envClaudeKey = process.env['DEEPSEEK_API_KEY'] || process.env['CLAUDE_API_KEY'] || process.env['ANTHROPIC_API_KEY'] || ''
  const resolvedClaudeKey = isDeepSeekKey(savedClaudeKey)
    ? savedClaudeKey.trim()
    : isDeepSeekKey(envClaudeKey)
      ? envClaudeKey.trim()
      : ''

  setClaudeApiKey(resolvedClaudeKey)
  if (resolvedClaudeKey && savedClaudeKey !== resolvedClaudeKey) {
    setState('claudeApiKey', resolvedClaudeKey)
  }

  const savedGroqKey = getState('groqApiKey') as string | null
  const envGroqKey = process.env['GROQ_API_KEY'] || ''
  const resolvedGroqKey = isGroqKey(savedGroqKey)
    ? savedGroqKey.trim()
    : isGroqKey(envGroqKey)
      ? envGroqKey.trim()
      : ''

  setGroqApiKey(resolvedGroqKey)
  if (resolvedGroqKey && savedGroqKey !== resolvedGroqKey) {
    setState('groqApiKey', resolvedGroqKey)
  }
}

async function bootstrap(): Promise<void> {
  patchIpcForWebBridge()
  await initDB()
  restoreProviderKeys()

  registerIpcHandlers()
  registerEducatorIpc()
  reconcileInterruptedCourseGeneration()
  registerVoiceIpc()
  registerGamesIpc()
  registerSyncIpc()
  registerMemoryIpc()

  const server = createServer(async (req, res) => {
    try {
      if (!req.url) {
        sendJson(res, 400, { error: 'Missing URL' })
        return
      }

      if (req.method === 'GET' && req.url.startsWith('/api/events')) {
        handleEvents(req, res)
        return
      }

      if (req.method === 'GET' && req.url === '/api/health') {
        sendJson(res, 200, { ok: true })
        return
      }

      if (req.method === 'POST' && req.url === '/api/invoke') {
        await handleInvoke(req, res)
        return
      }

      if (req.method === 'GET' || req.method === 'HEAD') {
        serveStatic(req, res)
        return
      }

      sendJson(res, 405, { error: 'Method not allowed' })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error || 'Unknown error')
      sendJson(res, 500, { error: message })
    }
  })

  server.listen(PORT, HOST, async () => {
    const url = `http://${HOST}:${PORT}`
    console.log(`[aura-web-local] running at ${url}`)
    if (process.env['AURA_WEB_NO_OPEN'] !== '1') {
      await shell.openExternal(url).catch(() => undefined)
    }
  })

  const shutdown = () => {
    server.close(() => {
      saveDBSync()
      app.quit()
    })
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
  app.on('before-quit', () => {
    saveDBSync()
    server.close()
  })
}

app.whenReady().then(() => bootstrap()).catch((error) => {
  console.error('[aura-web-local] failed to start', error)
  app.exit(1)
})