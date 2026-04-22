// DeepSeek transport behind the existing Claude compatibility layer.
const DEFAULT_DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions'
const CLAUDE_CONNECT_TIMEOUT_MS = 20_000
const CLAUDE_REQUEST_TIMEOUT_MS = 45_000
const CLAUDE_MAX_ATTEMPTS = 2

type ClaudeMessage = { role: string; content: string }
type ClaudeStreamChunk = { token: string; done: boolean; inputTokens?: number; outputTokens?: number }
type DeepSeekRole = 'system' | 'user' | 'assistant'
export interface ClaudeRequestOptions {
  timeoutMs?: number
  maxAttempts?: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function resolveClaudeApiUrl(): string {
  const raw = (process.env['DEEPSEEK_API_URL'] || DEFAULT_DEEPSEEK_API_URL || '').trim()
  if (!raw || raw.startsWith('sk-')) {
    return DEFAULT_DEEPSEEK_API_URL
  }
  try {
    return new URL(raw).toString()
  } catch {
    return DEFAULT_DEEPSEEK_API_URL
  }
}

function extractClaudeErrorCode(err: unknown): string {
  if (!isRecord(err)) return ''

  if (typeof err.code === 'string' && err.code) return err.code

  if (isRecord(err.cause)) {
    if (typeof err.cause.code === 'string' && err.cause.code) return err.cause.code
    if (typeof err.cause.name === 'string' && err.cause.name) return err.cause.name
  }

  return typeof err.name === 'string' ? err.name : ''
}

function extractClaudeErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    const causeMessage = isRecord(err.cause) && typeof err.cause.message === 'string'
      ? err.cause.message
      : ''
    return causeMessage && causeMessage !== err.message ? `${err.message} (${causeMessage})` : err.message
  }
  return String(err || '')
}

function formatClaudeNetworkError(err: unknown): string {
  const code = extractClaudeErrorCode(err)
  const message = extractClaudeErrorMessage(err).toLowerCase()

  if (code === 'ENOTFOUND') {
    return 'Cannot resolve api.deepseek.com. Check DNS, VPN, or firewall settings.'
  }
  if (code === 'ECONNRESET' || code === 'UND_ERR_SOCKET') {
    return 'The connection to DeepSeek was interrupted suddenly. Try again.'
  }
  if (code === 'ETIMEDOUT' || code === 'UND_ERR_CONNECT_TIMEOUT' || code === 'AbortError' || code === 'ABORT_ERR') {
    return 'DeepSeek did not respond in time. Try again in a few seconds.'
  }
  if (code === 'ENETUNREACH' || code === 'EHOSTUNREACH') {
    return 'The local network cannot currently reach DeepSeek.'
  }
  if (code === 'CERT_HAS_EXPIRED' || code === 'SELF_SIGNED_CERT_IN_CHAIN' || code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') {
    return 'The TLS connection to DeepSeek failed. Check the certificate, antivirus, or HTTPS proxy.'
  }
  if (message.includes('fetch failed')) {
    return 'The connection to DeepSeek failed temporarily. Try again.'
  }
  if (message.includes('timeout') || message.includes('timed out')) {
    return 'DeepSeek is responding too slowly right now. Try again.'
  }

  return `The connection to DeepSeek failed: ${extractClaudeErrorMessage(err) || 'unknown error'}`
}

function isRetryableClaudeError(err: unknown): boolean {
  const code = extractClaudeErrorCode(err)
  if (['ENOTFOUND', 'ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN', 'UND_ERR_SOCKET', 'UND_ERR_CONNECT_TIMEOUT', 'AbortError', 'ABORT_ERR'].includes(code)) {
    return true
  }

  const message = extractClaudeErrorMessage(err).toLowerCase()
  return message.includes('fetch failed') || message.includes('timeout') || message.includes('timed out')
}

function formatClaudeLogError(err: unknown): string {
  const code = extractClaudeErrorCode(err)
  const message = extractClaudeErrorMessage(err) || 'unknown error'
  return code ? `${code}: ${message}` : message
}

function buildClaudeHeaders(key: string): Record<string, string> {
  return {
    Authorization: `Bearer ${key}`,
    'content-type': 'application/json',
  }
}

async function wait(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchClaudeResponse(
  payload: Record<string, unknown>,
  options?: { timeoutMs?: number; maxAttempts?: number }
): Promise<Response> {
  const key = getClaudeApiKey()
  if (!key) throw new Error('DeepSeek API key not set')

  const apiUrl = resolveClaudeApiUrl()
  const body = JSON.stringify(payload)
  const timeoutMs = Math.max(1_000, options?.timeoutMs ?? CLAUDE_REQUEST_TIMEOUT_MS)
  const maxAttempts = Math.max(1, options?.maxAttempts ?? CLAUDE_MAX_ATTEMPTS)
  let lastError: unknown = null

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController()
    let timedOut = false
    const timeout = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, timeoutMs)

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: buildClaudeHeaders(key),
        body,
        signal: controller.signal,
      })
      clearTimeout(timeout)
      return response
    } catch (err) {
      clearTimeout(timeout)
      const normalizedError = timedOut
        ? new Error(`DeepSeek request timed out after ${timeoutMs}ms`)
        : err

      lastError = normalizedError
      console.error(`[DeepSeek] request attempt ${attempt}/${maxAttempts} failed: ${formatClaudeLogError(normalizedError)}`)

      if (attempt >= maxAttempts || !isRetryableClaudeError(normalizedError)) {
        throw normalizedError
      }

      await wait(250 * attempt)
    }
  }

  throw (lastError instanceof Error ? lastError : new Error('DeepSeek request failed'))
}

// Kept under the existing export names to avoid rewiring renderer/main imports.
export const CLAUDE_CHAT_MODEL = 'deepseek-chat'
export const CLAUDE_CHAT_DEEP_MODEL = 'deepseek-reasoner'
export const CLAUDE_COURSE_MODEL = 'deepseek-chat'
export const CLAUDE_TEACHER_MODEL = 'deepseek-chat'

const DEEP_CHAT_PATTERN = /```|\b(debug|bug|refactor|architecture|arhitectur|design|trade-?off|compare|critic|review|analiz|analysis|eseu|essay|proof|derive|strategy|strategie|complex|plan detaliat|de ce|why exactly)\b/i

function pickClaudeChatModel(messages: ClaudeMessage[], maxTokens: number): string {
  const userMessages = messages.filter((message) => message.role === 'user')
  const lastUserMessage = userMessages[userMessages.length - 1]?.content || ''
  const totalChars = userMessages.reduce((sum, message) => sum + String(message.content || '').length, 0)
  const lineCount = (lastUserMessage.match(/\n/g) || []).length + 1

  let complexityScore = 0
  if (DEEP_CHAT_PATTERN.test(lastUserMessage)) complexityScore += 2
  if (lastUserMessage.length >= 320) complexityScore += 1
  if (lineCount >= 6) complexityScore += 1
  if (messages.length >= 8) complexityScore += 1
  if (totalChars >= 1_200) complexityScore += 1
  if (maxTokens > 1_200) complexityScore += 1

  return complexityScore >= 2 ? CLAUDE_CHAT_DEEP_MODEL : CLAUDE_CHAT_MODEL
}

export function setClaudeApiKey(key: string) {
  ;(globalThis as { __claudeApiKey?: string }).__claudeApiKey = key
}

export function getClaudeApiKey(): string {
  return (globalThis as { __claudeApiKey?: string }).__claudeApiKey || ''
}

function formatClaudeHttpError(status: number, errText: string): string {
  if (status === 401) {
    return 'Invalid or expired API key. Set a valid DeepSeek key in the app.'
  }
  if (status === 402) {
    return 'DeepSeek billing or balance is unavailable for this request. Check the account.'
  }
  if (status === 403) {
    return 'Access denied for this account or model. Check your DeepSeek plan.'
  }
  if (status === 429) {
    return 'DeepSeek is rate-limiting requests right now. Try again in a moment.'
  }
  return `DeepSeek API error: ${status} - ${errText.slice(0, 200)}`
}

function normalizeMessages(messages: ClaudeMessage[], systemPrompt = ''): Array<{ role: DeepSeekRole; content: string }> {
  const normalized: Array<{ role: DeepSeekRole; content: string }> = []

  if (systemPrompt.trim()) {
    normalized.push({ role: 'system', content: systemPrompt.trim() })
  }

  for (const message of messages) {
    const content = String(message.content || '').trim()
    if (!content) continue

    const role: DeepSeekRole = message.role === 'assistant'
      ? 'assistant'
      : message.role === 'system'
        ? 'system'
        : 'user'

    const last = normalized[normalized.length - 1]
    if (last && last.role === role) {
      last.content += `\n${content}`
    } else {
      normalized.push({ role, content })
    }
  }

  return normalized
}

function extractTextPart(part: unknown): string {
  if (typeof part === 'string') return part
  if (!isRecord(part)) return ''
  return typeof part.text === 'string' ? part.text : ''
}

function extractMessageText(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content.map(extractTextPart).join('')
  }
  return ''
}

function extractResponseText(data: unknown): string {
  if (!isRecord(data) || !Array.isArray(data.choices) || data.choices.length === 0) {
    return ''
  }

  const firstChoice = data.choices[0]
  if (!isRecord(firstChoice) || !isRecord(firstChoice.message)) {
    return ''
  }

  return extractMessageText(firstChoice.message.content)
}

function extractDeltaText(data: unknown): string {
  if (!isRecord(data) || !Array.isArray(data.choices) || data.choices.length === 0) {
    return ''
  }

  const firstChoice = data.choices[0]
  if (!isRecord(firstChoice) || !isRecord(firstChoice.delta)) {
    return ''
  }

  return extractMessageText(firstChoice.delta.content)
}

function extractUsage(data: unknown): { inputTokens: number; outputTokens: number } {
  if (!isRecord(data) || !isRecord(data.usage)) {
    return { inputTokens: 0, outputTokens: 0 }
  }

  const usage = data.usage
  const inputTokens = typeof usage.prompt_tokens === 'number'
    ? usage.prompt_tokens
    : typeof usage.input_tokens === 'number'
      ? usage.input_tokens
      : 0
  const outputTokens = typeof usage.completion_tokens === 'number'
    ? usage.completion_tokens
    : typeof usage.output_tokens === 'number'
      ? usage.output_tokens
      : 0

  return { inputTokens, outputTokens }
}

export async function checkClaudeHealth(): Promise<boolean> {
  const key = getClaudeApiKey()
  if (!key) return false

  try {
    const res = await fetchClaudeResponse({
      model: CLAUDE_CHAT_MODEL,
      max_tokens: 8,
      stream: false,
      messages: normalizeMessages([{ role: 'user', content: 'ping' }]),
    }, {
      timeoutMs: 8_000,
      maxAttempts: 1,
    })

    return res.ok
  } catch {
    return false
  }
}

export interface ClaudeTextResult {
  text: string
  inputTokens: number
  outputTokens: number
}

export async function generateWithClaudeWithUsage(
  systemPrompt: string,
  userMessage: string,
  maxTokens = 8192,
  model = CLAUDE_COURSE_MODEL,
  requestOptions?: ClaudeRequestOptions
): Promise<ClaudeTextResult> {
  let res: Response
  try {
    res = await fetchClaudeResponse({
      model,
      max_tokens: maxTokens,
      stream: false,
      messages: normalizeMessages([{ role: 'user', content: userMessage }], systemPrompt),
    }, {
      timeoutMs: requestOptions?.timeoutMs ?? CLAUDE_REQUEST_TIMEOUT_MS,
      maxAttempts: requestOptions?.maxAttempts ?? CLAUDE_MAX_ATTEMPTS,
    })
  } catch (err) {
    throw new Error(formatClaudeNetworkError(err))
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(formatClaudeHttpError(res.status, errText))
  }

  const data = await res.json()
  const usage = extractUsage(data)
  return {
    text: extractResponseText(data),
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
  }
}

export async function generateWithClaude(
  systemPrompt: string,
  userMessage: string,
  maxTokens = 8192,
  model = CLAUDE_COURSE_MODEL,
  requestOptions?: ClaudeRequestOptions
): Promise<string> {
  const result = await generateWithClaudeWithUsage(systemPrompt, userMessage, maxTokens, model, requestOptions)
  return result.text
}

async function* streamDeepSeekResponse(res: Response): AsyncGenerator<ClaudeStreamChunk> {
  if (!res.body) {
    yield { token: '', done: true }
    return
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let inputTokens = 0
  let outputTokens = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue

        const data = trimmed.slice(5).trim()
        if (!data) continue
        if (data === '[DONE]') {
          yield { token: '', done: true, inputTokens, outputTokens }
          return
        }

        try {
          const json = JSON.parse(data)
          const deltaText = extractDeltaText(json)
          if (deltaText) {
            yield { token: deltaText, done: false }
          }

          const usage = extractUsage(json)
          if (usage.inputTokens > 0) inputTokens = usage.inputTokens
          if (usage.outputTokens > 0) outputTokens = usage.outputTokens
        } catch {
          // Skip malformed SSE fragments.
        }
      }
    }
  } catch (err) {
    yield { token: formatClaudeNetworkError(err), done: true, inputTokens, outputTokens }
    return
  }

  yield { token: '', done: true, inputTokens, outputTokens }
}

export async function* streamClaude(
  systemPrompt: string,
  userMessage: string,
  maxTokens = 4096,
  model = CLAUDE_TEACHER_MODEL,
  requestOptions?: ClaudeRequestOptions
): AsyncGenerator<ClaudeStreamChunk> {
  if (!getClaudeApiKey()) {
    yield { token: 'DeepSeek API key not configured.', done: true }
    return
  }

  let res: Response
  try {
    res = await fetchClaudeResponse({
      model,
      max_tokens: maxTokens,
      stream: true,
      messages: normalizeMessages([{ role: 'user', content: userMessage }], systemPrompt),
    }, {
      timeoutMs: requestOptions?.timeoutMs ?? CLAUDE_CONNECT_TIMEOUT_MS,
      maxAttempts: requestOptions?.maxAttempts ?? CLAUDE_MAX_ATTEMPTS,
    })
  } catch (err) {
    yield { token: formatClaudeNetworkError(err), done: true }
    return
  }

  if (!res.ok || !res.body) {
    const errText = await res.text().catch(() => '')
    yield { token: formatClaudeHttpError(res.status, errText), done: true }
    return
  }

  yield* streamDeepSeekResponse(res)
}

export async function* streamClaudeChat(
  messages: ClaudeMessage[],
  systemPrompt: string,
  maxTokens = 1024
): AsyncGenerator<ClaudeStreamChunk> {
  if (!getClaudeApiKey()) {
    yield { token: 'API key not configured. Enter a DeepSeek key in Settings.', done: true }
    return
  }

  const trimmedMessages = messages.slice(-20)
  const model = pickClaudeChatModel(trimmedMessages, maxTokens)

  let res: Response
  try {
    res = await fetchClaudeResponse({
      model,
      max_tokens: maxTokens,
      stream: true,
      messages: normalizeMessages(trimmedMessages, systemPrompt),
    }, {
      timeoutMs: CLAUDE_CONNECT_TIMEOUT_MS,
      maxAttempts: CLAUDE_MAX_ATTEMPTS,
    })
  } catch (err) {
    yield { token: formatClaudeNetworkError(err), done: true }
    return
  }

  if (!res.ok || !res.body) {
    const errText = await res.text().catch(() => '')
    yield { token: formatClaudeHttpError(res.status, errText), done: true }
    return
  }

  yield* streamDeepSeekResponse(res)
}
