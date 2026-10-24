import { vi } from 'vitest'
import type { AgentSummary, ButecoApi, ExposedApi, Result, TaskState } from '../../../shared/api'
import { loggedIn } from '../auth/test-auth'

type Chat = ButecoApi['chat']
type Auth = ButecoApi['auth']
type SendValue = Extract<Awaited<ReturnType<Chat['send']>>, { ok: true }>['value']
type TaskValue = Extract<Awaited<ReturnType<Chat['getTask']>>, { ok: true }>['value']

export const ATENDENTE: AgentSummary = {
  id: 'aaaaaaaa-0000-4000-8000-000000000001',
  name: 'Atendente',
  description: 'Responde dúvidas',
  isActive: true,
  skills: [
    { name: 'Resumo', description: null },
    { name: 'Tradução', description: 'pt ↔ en' }
  ]
}

export const TRADUTOR: AgentSummary = {
  id: 'bbbbbbbb-0000-4000-8000-000000000002',
  name: 'Tradutor',
  description: null,
  isActive: true,
  skills: []
}

export const ANTIGO: AgentSummary = {
  id: 'cccccccc-0000-4000-8000-000000000003',
  name: 'Antigo',
  description: null,
  isActive: false,
  skills: []
}

export const CONTEXT_ID = '3a7d9f10-1b2c-4d5e-8f90-0a1b2c3d4e5f'
export const TASK_ID = '1a2b3c4d-0000-4000-8000-00000000000a'

export function sent(state: TaskState = 'TASK_STATE_SUBMITTED', overrides: Partial<SendValue> = {}): Result<SendValue> {
  return {
    ok: true,
    value: { taskId: TASK_ID, contextId: CONTEXT_ID, state, submittedAt: '2026-10-24T18:24:00.000Z', ...overrides }
  }
}

export function task(state: TaskState, text: string | null = null, timestamp: string | null = null): Result<TaskValue> {
  return { ok: true, value: { state, text, timestamp } }
}

/** `window.buteco` completo: logado como `ana`, lista com Atendente, Antigo (inativo) e Tradutor. */
export function mockButeco(agents: AgentSummary[] = [ATENDENTE, ANTIGO, TRADUTOR]) {
  const api = {
    auth: {
      login: vi.fn<Auth['login']>(async () => ({ ok: true, value: { expiresAt: new Date().toISOString() } })),
      logout: vi.fn<Auth['logout']>(async () => {}),
      status: vi.fn<Auth['status']>(async () => loggedIn())
    },
    agents: { list: vi.fn<ButecoApi['agents']['list']>(async () => ({ ok: true, value: agents })) },
    chat: {
      send: vi.fn<Chat['send']>(async () => sent()),
      getTask: vi.fn<Chat['getTask']>(async () => task('TASK_STATE_WORKING'))
    },
    clipboard: { writeText: vi.fn<ButecoApi['clipboard']['writeText']>(async () => {}) }
  }
  window.buteco = api satisfies ExposedApi
  return api
}
