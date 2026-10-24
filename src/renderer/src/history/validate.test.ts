import { describe, expect, it } from 'vitest'
import type { Attempt } from '../conversation/model'
import { ATENDENTE, CONTEXT_ID, TASK_ID } from '../conversation/test-chat'
import { parseStoredConversation } from './validate'

const timing = { taskId: TASK_ID, submittedAt: '2026-10-24T18:24:00.000Z', startedAtLocal: 1000, resumed: false }
const { resumed: _resumed, ...withoutResumed } = timing

const ATTEMPTS: Attempt[] = [
  { kind: 'sending' },
  { kind: 'pending', ...timing, state: 'TASK_STATE_WORKING', resumed: false },
  { kind: 'completed', taskId: TASK_ID, text: 'oi', receivedAt: 2000, durationSeconds: 3.2 },
  { kind: 'completed', taskId: TASK_ID, text: '', receivedAt: 2000, durationSeconds: null },
  { kind: 'failed', taskId: TASK_ID },
  { kind: 'rejected', taskId: TASK_ID },
  { kind: 'timeout', ...timing, lastState: 'TASK_STATE_SUBMITTED' },
  { kind: 'send-error', error: { kind: 'unreachable', message: 'timeout' } },
  { kind: 'send-error', error: { kind: 'rpc', code: -32600, message: 'Requisição inválida.' } },
  { kind: 'send-error', error: { kind: 'http', status: 500 } },
  { kind: 'send-error', error: { kind: 'bad-response' } },
  { kind: 'poll-error', taskId: TASK_ID },
  { kind: 'awaiting-login', resume: 'send' },
  { kind: 'awaiting-login', resume: 'poll', ...timing, state: 'TASK_STATE_SUBMITTED' },
  { kind: 'interrupted' },
  { kind: 'not-sent' }
]

function stored(overrides: Record<string, unknown> = {}, attempt: unknown = ATTEMPTS[2]) {
  return {
    id: 'c1',
    agent: ATENDENTE,
    contextId: CONTEXT_ID,
    title: 'Olá',
    createdAt: 1000,
    lastActivityAt: 2000,
    turns: [{ id: 1, text: 'Olá', sentAt: 1000, attempt }],
    ...overrides
  }
}

describe('parseStoredConversation', () => {
  it.each(ATTEMPTS.map((attempt) => [attempt.kind, attempt]))('aceita a tentativa %s', (_kind, attempt) => {
    expect(parseStoredConversation(stored({}, attempt))).not.toBeNull()
  })

  it('aceita contextId e título nulos', () => {
    expect(parseStoredConversation(stored({ contextId: null, title: null }))).not.toBeNull()
  })

  it.each([
    ['não é objeto', 'x'],
    ['sem id', stored({ id: undefined })],
    ['id vazio', stored({ id: '' })],
    ['agent.id não GUID', stored({ agent: { ...ATENDENTE, id: '../x' } })],
    ['agent sem name', stored({ agent: { ...ATENDENTE, name: '' } })],
    ['agent com isActive não booleano', stored({ agent: { ...ATENDENTE, isActive: 'sim' } })],
    ['skill sem name', stored({ agent: { ...ATENDENTE, skills: [{ description: null }] } })],
    ['contextId inválido', stored({ contextId: '../x' })],
    ['título numérico', stored({ title: 3 })],
    ['createdAt não finito', stored({ createdAt: Number.NaN })],
    ['lastActivityAt texto', stored({ lastActivityAt: '2026' })],
    ['sem turnos', stored({ turns: [] })],
    ['turnos não array', stored({ turns: {} })]
  ])('descarta: %s', (_name, value) => {
    expect(parseStoredConversation(value)).toBeNull()
  })

  it.each([
    ['id de turno repetido', [
      { id: 1, text: 'a', sentAt: 1, attempt: ATTEMPTS[2] },
      { id: 1, text: 'b', sentAt: 2, attempt: ATTEMPTS[2] }
    ]],
    ['id de turno zero', [{ id: 0, text: 'a', sentAt: 1, attempt: ATTEMPTS[2] }]],
    ['id de turno fracionário', [{ id: 1.5, text: 'a', sentAt: 1, attempt: ATTEMPTS[2] }]],
    ['texto com 16 001 caracteres', [{ id: 1, text: 'x'.repeat(16_001), sentAt: 1, attempt: ATTEMPTS[2] }]],
    ['sentAt ausente', [{ id: 1, text: 'a', attempt: ATTEMPTS[2] }]]
  ])('descarta turno inválido: %s', (_name, turns) => {
    expect(parseStoredConversation(stored({ turns }))).toBeNull()
  })

  it('aceita texto com exatamente 16 000 caracteres', () => {
    const turns = [{ id: 1, text: 'x'.repeat(16_000), sentAt: 1, attempt: ATTEMPTS[2] }]
    expect(parseStoredConversation(stored({ turns }))).not.toBeNull()
  })

  it.each([
    ['kind desconhecido', { kind: 'other' }],
    ['pending sem resumed', { kind: 'pending', ...withoutResumed, state: 'TASK_STATE_WORKING' }],
    ['timeout sem resumed', { kind: 'timeout', ...withoutResumed, lastState: 'TASK_STATE_WORKING' }],
    ['awaiting-login poll sem resumed', { kind: 'awaiting-login', resume: 'poll', ...withoutResumed, state: 'TASK_STATE_WORKING' }],
    ['pending com estado terminal', { kind: 'pending', ...timing, state: 'TASK_STATE_COMPLETED', resumed: false }],
    ['pending com taskId inválido', { kind: 'pending', ...timing, taskId: '../x', state: 'TASK_STATE_WORKING', resumed: false }],
    ['completed sem texto', { kind: 'completed', taskId: TASK_ID, receivedAt: 1, durationSeconds: 1 }],
    ['completed com duração texto', { kind: 'completed', taskId: TASK_ID, text: '', receivedAt: 1, durationSeconds: '1' }],
    ['failed sem taskId', { kind: 'failed' }],
    ['timeout sem lastState', { kind: 'timeout', ...timing }],
    ['send-error com erro desconhecido', { kind: 'send-error', error: { kind: 'other' } }],
    ['send-error rpc sem code', { kind: 'send-error', error: { kind: 'rpc', message: 'x' } }],
    ['awaiting-login com resume desconhecido', { kind: 'awaiting-login', resume: 'other' }],
    ['awaiting-login poll sem task', { kind: 'awaiting-login', resume: 'poll', state: 'TASK_STATE_WORKING' }]
  ])('descarta tentativa inválida: %s', (_name, attempt) => {
    expect(parseStoredConversation(stored({}, attempt))).toBeNull()
  })
})
