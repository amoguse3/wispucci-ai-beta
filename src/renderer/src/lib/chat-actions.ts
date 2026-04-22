export type ChatActionKind =
  | 'OPEN_TASKS'
  | 'OPEN_COURSES'
  | 'OPEN_COURSE_CREATOR'
  | 'OPEN_COURSE'
  | 'OPEN_FLASHCARDS'
  | 'OPEN_TEACHER'

export interface ChatAction {
  kind: ChatActionKind
  courseId?: number
}

export interface ParsedChatAssistantResponse {
  visibleText: string
  actions: ChatAction[]
}

const ACTION_PATTERN = /\[\[AURA_ACTION:([A-Z_]+)(?::#?(\d+))?\]\]/g

function normalizeWhitespace(text: string): string {
  return text
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

function parseKind(rawKind: string, rawCourseId?: string): ChatAction | null {
  switch (rawKind) {
    case 'OPEN_TASKS':
      return { kind: 'OPEN_TASKS' }
    case 'OPEN_COURSES':
      return { kind: 'OPEN_COURSES' }
    case 'OPEN_COURSE_CREATOR':
      return { kind: 'OPEN_COURSE_CREATOR' }
    case 'OPEN_FLASHCARDS':
      return { kind: 'OPEN_FLASHCARDS' }
    case 'OPEN_COURSE': {
      const courseId = Number(rawCourseId)
      return Number.isFinite(courseId) && courseId > 0 ? { kind: 'OPEN_COURSE', courseId } : null
    }
    case 'OPEN_TEACHER': {
      const courseId = Number(rawCourseId)
      return Number.isFinite(courseId) && courseId > 0 ? { kind: 'OPEN_TEACHER', courseId } : null
    }
    default:
      return null
  }
}

export function parseChatAssistantResponse(text: string): ParsedChatAssistantResponse {
  const actions: ChatAction[] = []
  const seen = new Set<string>()

  const visibleText = normalizeWhitespace(
    String(text || '').replace(ACTION_PATTERN, (_match, rawKind: string, rawCourseId?: string) => {
      const action = parseKind(rawKind, rawCourseId)
      if (action) {
        const dedupeKey = `${action.kind}:${action.courseId || ''}`
        if (!seen.has(dedupeKey)) {
          seen.add(dedupeKey)
          actions.push(action)
        }
      }
      return ''
    }),
  )

  return { visibleText, actions }
}

export function getChatActionLabel(action: ChatAction, t?: (key: string) => string): string {
  switch (action.kind) {
    case 'OPEN_TASKS':
      return t?.('chatAction.openTasks') ?? 'View tasks'
    case 'OPEN_COURSES':
      return t?.('chatAction.openCourses') ?? 'View courses'
    case 'OPEN_COURSE_CREATOR':
      return t?.('chatAction.openCreator') ?? 'Open creator'
    case 'OPEN_FLASHCARDS':
      return t?.('chatAction.openFlashcards') ?? 'Review flashcards'
    case 'OPEN_COURSE':
      return t?.('chatAction.openCourse') ?? 'Continue course'
    case 'OPEN_TEACHER':
      return t?.('chatAction.openTeacher') ?? 'Open Teacher Mode'
    default:
      return t?.('chatAction.open') ?? 'Open'
  }
}