import { describe, expect, it } from 'vitest'
import type { Attempt, Conversation } from '../conversation/model'
import { ATENDENTE, TASK_ID } from '../conversation/test-chat'
import { normalizeAttempt, normalizeConversation } from './normalize'

const timing = { taskId: TASK_ID, submittedAt: '2026-10-24T18:24:00.000Z', startedAtLocal: 1000, resumed: false }

describe('normalizeAttempt', () => {
  it('sending vira envio interrompido', () => {
    expect(normalizeAttempt({ kind: 'sending' })).toEqual({ kind: 'interrupted' })
  })

  it('envio retido vira "não enviada"', () => {
    expect(normalizeAttempt({ kind: 'awaiting-login', resume: 'send' })).toEqual({ kind: 'not-sent' })
  })

  it.each([false, true])('task retida volta a pendente com os mesmos dados (resumed %s)', (resumed) => {
    expect(normalizeAttempt({ kind: 'awaiting-login', resume: 'poll', ...timing, state: 'TASK_STATE_WORKING', resumed })).toEqual({
      kind: 'pending',
      ...timing,
      state: 'TASK_STATE_WORKING',
      resumed
    })
  })

  it.each<Attempt>([
    { kind: 'pending', ...timing, state: 'TASK_STATE_SUBMITTED' },
    { kind: 'completed', taskId: TASK_ID, text: 'oi', receivedAt: 2000, durationSeconds: 1 },
    { kind: 'failed', taskId: TASK_ID },
    { kind: 'rejected', taskId: TASK_ID },
    { kind: 'timeout', ...timing, lastState: 'TASK_STATE_WORKING' },
    { kind: 'send-error', error: { kind: 'bad-response' } },
    { kind: 'poll-error', taskId: TASK_ID },
    { kind: 'interrupted' },
    { kind: 'not-sent' }
  ])('$kind fica como está', (attempt) => {
    expect(normalizeAttempt(attempt)).toBe(attempt)
  })
})

describe('normalizeConversation', () => {
  it('normaliza cada turno sem mudar a última atividade', () => {
    const conversation: Conversation = {
      id: 'c1',
      agent: ATENDENTE,
      contextId: null,
      title: 'Olá',
      createdAt: 1000,
      lastActivityAt: 5000,
      turns: [
        { id: 1, text: 'a', sentAt: 1000, attempt: { kind: 'failed', taskId: TASK_ID } },
        { id: 2, text: 'b', sentAt: 2000, attempt: { kind: 'sending' } }
      ]
    }
    const normalized = normalizeConversation(conversation)
    expect(normalized.lastActivityAt).toBe(5000)
    expect(normalized.turns.map((turn) => turn.attempt.kind)).toEqual(['failed', 'interrupted'])
  })
})
