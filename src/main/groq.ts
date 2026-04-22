const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
const GROQ_MODEL = 'llama-3.3-70b-versatile'

export function setGroqApiKey(key: string) {
  ;(globalThis as any).__groqApiKey = key
}

export function getGroqApiKey(): string {
  return (globalThis as any).__groqApiKey || ''
}

export async function checkGroqHealth(): Promise<boolean> {
  const key = getGroqApiKey()
  if (!key) return false
  try {
    const res = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1
      }),
      signal: AbortSignal.timeout(5000)
    })
    return res.ok
  } catch {
    return false
  }
}

export async function* streamChat(
  messages: Array<{ role: string; content: string }>,
  systemPrompt: string,
  maxTokens = 2048
): AsyncGenerator<{ token: string; done: boolean }> {
  const body = {
    model: GROQ_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages.slice(-20)
    ],
    stream: true,
    temperature: 0.7,
    top_p: 0.9,
    max_tokens: maxTokens
  }

  const key = getGroqApiKey()
  if (!key) {
    yield { token: 'Groq API key not configured. Set it in Settings.', done: true }
    return
  }

  let res: Response
  try {
    res = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    })
  } catch (err: any) {
    yield { token: `Groq connection error: ${err.message}`, done: true }
    return
  }

  if (!res.ok || !res.body) {
    const errText = await res.text().catch(() => '')
    yield { token: `Groq API error: ${res.status} — ${errText.slice(0, 100)}`, done: true }
    return
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || !trimmed.startsWith('data: ')) continue
      const data = trimmed.slice(6)
      if (data === '[DONE]') {
        yield { token: '', done: true }
        return
      }
      try {
        const json = JSON.parse(data)
        const content = json.choices?.[0]?.delta?.content
        if (content) {
          yield { token: content, done: false }
        }
      } catch {
        // skip malformed SSE
      }
    }
  }

  // If stream ended without [DONE]
  yield { token: '', done: true }
}
