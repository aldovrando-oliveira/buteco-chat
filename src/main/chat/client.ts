import type { AgentSummary, ChatError, Result, TaskState } from '../../shared/api'
import { isGuid, isTaskOrContextId } from '../../shared/ids'
import type { AuthService } from '../auth/service'
import { classifyRejection, ISO_DATE_TIME, isOpaqueRedirect, type FetchLike } from '../http/classify'

export interface ChatClientDeps<TimerHandle = unknown> {
  fetch: FetchLike
  auth: Pick<AuthService, 'status' | 'getToken'>
  // Injetados para o timeout obedecer aos timers falsos do Vitest (login-operador, D3).
  setTimeout(callback: () => void, ms: number): TimerHandle
  clearTimeout(handle: TimerHandle): void
  randomUUID(): string
}

export interface SendResult {
  taskId: string
  contextId: string
  state: TaskState
  submittedAt: string | null
}

export interface TaskResult {
  state: TaskState
  text: string | null
  timestamp: string | null
}

export interface ChatClient {
  listAgents(): Promise<Result<AgentSummary[]>>
  send(agentId: string, text: string, contextId: string | null): Promise<Result<SendResult>>
  getTask(agentId: string, taskId: string): Promise<Result<TaskResult>>
}

export const REQUEST_TIMEOUT_MS = 15_000
// `/agents` traz as `instructions` de cada agente, descartadas só aqui (D2).
export const MAX_AGENTS_BODY = 2 * 1024 * 1024
export const MAX_RPC_BODY = 1024 * 1024
export const MAX_RPC_MESSAGE = 500

const TASK_STATES: readonly TaskState[] = [
  'TASK_STATE_SUBMITTED',
  'TASK_STATE_WORKING',
  'TASK_STATE_COMPLETED',
  'TASK_STATE_FAILED',
  'TASK_STATE_REJECTED'
]

const BAD: { ok: false; error: ChatError } = { ok: false, error: { kind: 'bad-response' } }

type Json = Record<string, unknown>

export function createChatClient<TimerHandle>(deps: ChatClientDeps<TimerHandle>): ChatClient {
  let rpcId = 0

  /** Uma requisição autenticada (D1, D2): devolve o corpo de um 200 ou o erro mapeado. */
  async function request(path: string, body: string | null, maxBody: number): Promise<Result<string>> {
    const baseUrl = deps.auth.status().serviceUrl
    const token = deps.auth.getToken()
    if (baseUrl === null || token === null) return { ok: false, error: { kind: 'unauthorized' } }

    const controller = new AbortController()
    let timedOut = false
    const timer = deps.setTimeout(() => {
      timedOut = true
      controller.abort()
    }, REQUEST_TIMEOUT_MS)

    const headers: Record<string, string> = { accept: 'application/json', authorization: `Bearer ${token}` }
    if (body !== null) headers['content-type'] = 'application/json'

    try {
      // Concatenação sobre o baseUrl normalizado, nunca `new URL(path, base)` (login-operador, D6).
      const response = await deps.fetch(`${baseUrl}${path}`, {
        method: body === null ? 'GET' : 'POST',
        headers,
        ...(body === null ? {} : { body }),
        credentials: 'omit',
        cache: 'no-store',
        redirect: 'manual',
        signal: controller.signal
      })
      if (isOpaqueRedirect(response)) return { ok: false, error: { kind: 'http', status: 0 } }
      // 401 chega com corpo vazio, antes do JSON-RPC: o corpo nem é lido.
      if (response.status === 401) return { ok: false, error: { kind: 'unauthorized' } }
      if (response.status !== 200) return { ok: false, error: { kind: 'http', status: response.status } }
      const text = await response.text()
      if (text.length > maxBody) return BAD
      return { ok: true, value: text }
    } catch (error) {
      if (timedOut) return { ok: false, error: { kind: 'unreachable', message: 'timeout' } }
      return { ok: false, error: classifyRejection(error) }
    } finally {
      deps.clearTimeout(timer)
    }
  }

  /** Chamada JSON-RPC: `error` é verificado antes de `result` (D2). */
  async function rpc(agentId: string, method: 'SendMessage' | 'GetTask', params: Json): Promise<Result<unknown>> {
    // O parseArgs do IPC já recusa; isto só protege uso interno. Mensagem sem o valor (D5).
    if (!isGuid(agentId)) throw new Error('agentId inválido.')
    const body = JSON.stringify({ jsonrpc: '2.0', id: ++rpcId, method, params })
    const response = await request(`/agents/${agentId}/a2a`, body, MAX_RPC_BODY)
    if (!response.ok) return response
    const data = parseJson(response.value)
    if (!isObject(data)) return BAD
    if (data['error'] !== undefined && data['error'] !== null) {
      const error = data['error']
      if (!isObject(error) || !Number.isInteger(error['code']) || typeof error['message'] !== 'string') return BAD
      return {
        ok: false,
        error: { kind: 'rpc', code: error['code'] as number, message: error['message'].slice(0, MAX_RPC_MESSAGE) }
      }
    }
    return { ok: true, value: data['result'] }
  }

  return {
    async listAgents() {
      const response = await request('/agents', null, MAX_AGENTS_BODY)
      if (!response.ok) return response
      const data = parseJson(response.value)
      if (!Array.isArray(data)) return BAD
      return { ok: true, value: data.flatMap((item) => toAgentSummary(item) ?? []) }
    },

    async send(agentId, text, contextId) {
      const message: Json = {
        role: 'ROLE_USER',
        parts: [{ text }],
        messageId: deps.randomUUID(),
        // Omitido na primeira mensagem; nunca `taskId`: cada turno é uma task nova no mesmo contexto.
        ...(contextId === null ? {} : { contextId })
      }
      const response = await rpc(agentId, 'SendMessage', { message })
      if (!response.ok) return response
      const task = isObject(response.value) ? response.value['task'] : undefined
      if (!isObject(task)) return BAD
      const { id, contextId: returnedContextId } = task
      const status = readStatus(task['status'])
      if (!isTaskOrContextId(id) || !isTaskOrContextId(returnedContextId) || status === null) return BAD
      return {
        ok: true,
        value: { taskId: id, contextId: returnedContextId, state: status.state, submittedAt: status.timestamp }
      }
    },

    async getTask(agentId, taskId) {
      const response = await rpc(agentId, 'GetTask', { id: taskId })
      if (!response.ok) return response
      const task = response.value
      if (!isObject(task) || task['id'] !== taskId) return BAD
      const status = readStatus(task['status'])
      if (status === null) return BAD
      const text = status.state === 'TASK_STATE_COMPLETED' ? lastArtifactText(task['artifacts']) : null
      return { ok: true, value: { state: status.state, text, timestamp: status.timestamp } }
    }
  }
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

/** Item de `/agents` reduzido ao `AgentSummary`; inválido → descartado sozinho (D12). */
function toAgentSummary(item: unknown): AgentSummary | null {
  if (!isObject(item)) return null
  const { id, name, isActive } = item
  if (!isGuid(id) || typeof name !== 'string' || name.length === 0 || typeof isActive !== 'boolean') return null
  const skills = Array.isArray(item['skills']) ? item['skills'] : []
  return {
    id,
    name,
    description: nullableString(item['description']),
    isActive,
    skills: skills.flatMap((skill) =>
      isObject(skill) && typeof skill['name'] === 'string'
        ? [{ name: skill['name'], description: nullableString(skill['description']) }]
        : []
    )
  }
}

/** `status` da task: estado entre os cinco produzidos (D3) e horário normalizado, ou `null` se ausente/inválido. */
function readStatus(status: unknown): { state: TaskState; timestamp: string | null } | null {
  if (!isObject(status)) return null
  const state = status['state']
  if (!TASK_STATES.includes(state as TaskState)) return null
  return { state: state as TaskState, timestamp: normalizeTimestamp(status['timestamp']) }
}

function normalizeTimestamp(value: unknown): string | null {
  if (typeof value !== 'string' || !ISO_DATE_TIME.test(value)) return null
  const ms = Date.parse(value)
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null
}

/** Partes de texto do último artifact, unidas com "\n\n" (D4). Sem texto: "". */
function lastArtifactText(artifacts: unknown): string {
  if (!Array.isArray(artifacts)) return ''
  const last: unknown = artifacts.at(-1)
  const parts = isObject(last) && Array.isArray(last['parts']) ? last['parts'] : []
  return parts
    .flatMap((part) => (isObject(part) && typeof part['text'] === 'string' ? [part['text']] : []))
    .join('\n\n')
}
