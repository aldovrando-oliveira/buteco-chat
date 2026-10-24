import { MAX_MESSAGE_LENGTH, type AgentSummary, type ChatError } from '../../../shared/api'
import { isGuid, isTaskOrContextId } from '../../../shared/ids'
import type { Attempt, Conversation, Turn } from '../conversation/model'

/**
 * Validação de uma conversa lida do disco (historico-conversas, D5). A unidade de descarte é a conversa: tirar um
 * turno do meio deixaria a timeline incoerente. A timeline, a Markdown e o poller confiam nos tipos.
 */

type Json = Record<string, unknown>

const PENDING_STATES = ['TASK_STATE_SUBMITTED', 'TASK_STATE_WORKING']

function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isStringOrNull(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}

function isPendingState(value: unknown): boolean {
  return typeof value === 'string' && PENDING_STATES.includes(value)
}

function isAgent(value: unknown): value is AgentSummary {
  if (!isObject(value)) return false
  const { id, name, description, isActive, skills } = value
  if (!isGuid(id) || typeof name !== 'string' || name === '' || typeof isActive !== 'boolean') return false
  if (!isStringOrNull(description) || !Array.isArray(skills)) return false
  return skills.every((skill) => isObject(skill) && typeof skill['name'] === 'string' && isStringOrNull(skill['description']))
}

function isChatError(value: unknown): value is ChatError {
  if (!isObject(value)) return false
  switch (value['kind']) {
    case 'unauthorized':
    case 'invalid-credentials':
    case 'bad-response':
      return true
    case 'unreachable':
      return typeof value['message'] === 'string'
    case 'rpc':
      return Number.isInteger(value['code']) && typeof value['message'] === 'string'
    case 'http':
      return Number.isInteger(value['status'])
    default:
      return false
  }
}

/** Os campos que `pending`, `timeout` e `awaiting-login` / `poll` têm em comum, inclusive `resumed` (D7). */
function hasTaskTiming(value: Json, stateField: 'state' | 'lastState'): boolean {
  return (
    isTaskOrContextId(value['taskId']) &&
    isPendingState(value[stateField]) &&
    isStringOrNull(value['submittedAt']) &&
    isFiniteNumber(value['startedAtLocal']) &&
    typeof value['resumed'] === 'boolean'
  )
}

function isAttempt(value: unknown): value is Attempt {
  if (!isObject(value)) return false
  switch (value['kind']) {
    case 'sending':
    case 'interrupted':
    case 'not-sent':
      return true
    case 'pending':
      return hasTaskTiming(value, 'state')
    case 'completed':
      return (
        isTaskOrContextId(value['taskId']) &&
        typeof value['text'] === 'string' &&
        isFiniteNumber(value['receivedAt']) &&
        (value['durationSeconds'] === null || isFiniteNumber(value['durationSeconds']))
      )
    case 'failed':
    case 'rejected':
    case 'poll-error':
      return isTaskOrContextId(value['taskId'])
    case 'timeout':
      return hasTaskTiming(value, 'lastState')
    case 'send-error':
      return isChatError(value['error'])
    case 'awaiting-login':
      if (value['resume'] === 'send') return true
      return value['resume'] === 'poll' && hasTaskTiming(value, 'state')
    default:
      return false
  }
}

function isTurn(value: unknown): value is Turn {
  if (!isObject(value)) return false
  const { id, text, sentAt, attempt } = value
  return (
    Number.isInteger(id) &&
    (id as number) > 0 &&
    typeof text === 'string' &&
    text.length <= MAX_MESSAGE_LENGTH &&
    isFiniteNumber(sentAt) &&
    isAttempt(attempt)
  )
}

/** Conversa gravada válida, ou `null`. Uma conversa sem turnos não deveria existir no disco (D3) e é inválida. */
export function parseStoredConversation(value: unknown): Conversation | null {
  if (!isObject(value)) return null
  const { id, agent, contextId, title, createdAt, lastActivityAt, turns } = value
  if (typeof id !== 'string' || id === '' || !isAgent(agent)) return null
  if (contextId !== null && !isTaskOrContextId(contextId)) return null
  if (!isStringOrNull(title) || !isFiniteNumber(createdAt) || !isFiniteNumber(lastActivityAt)) return null
  if (!Array.isArray(turns) || turns.length === 0 || !turns.every(isTurn)) return null
  const ids = new Set(turns.map((turn) => turn.id))
  if (ids.size !== turns.length) return null
  return value as unknown as Conversation
}
