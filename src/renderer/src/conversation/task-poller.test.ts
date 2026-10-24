import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChatError, Result } from '../../../shared/api'
import { createTaskPoller, POLL_DEADLINE_MS, type TaskSnapshot } from './task-poller'

const START = Date.parse('2026-10-24T18:00:00.000Z')

function snapshot(state: TaskSnapshot['state'], text: string | null = null): Result<TaskSnapshot> {
  return { ok: true, value: { state, text, timestamp: null } }
}

function failure(error: ChatError): Result<TaskSnapshot> {
  return { ok: false, error }
}

function setup(getTask: (taskId: string) => Promise<Result<TaskSnapshot>>) {
  const events = { onState: vi.fn(), onDone: vi.fn(), onTimeout: vi.fn(), onError: vi.fn() }
  const getTaskMock = vi.fn(getTask)
  const poller = createTaskPoller(
    {
      getTask: getTaskMock,
      now: () => Date.now(),
      setTimeout: (callback, ms) => setTimeout(callback, ms),
      clearTimeout: (handle) => clearTimeout(handle)
    },
    events
  )
  return { poller, events, getTask: getTaskMock }
}

/** Respostas em sequência; a última se repete. */
function sequence(...results: Result<TaskSnapshot>[]) {
  let i = 0
  return async () => results[Math.min(i++, results.length - 1)]!
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(START)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('consulta encadeada', () => {
  it('a primeira consulta sai 1 s depois do início', async () => {
    const { poller, getTask } = setup(sequence(snapshot('TASK_STATE_WORKING')))

    poller.start('t-1', Date.now(), 'TASK_STATE_SUBMITTED')
    await vi.advanceTimersByTimeAsync(999)
    expect(getTask).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    expect(getTask).toHaveBeenCalledWith('t-1')
  })

  it('a próxima só é agendada 1 s depois da resposta, mesmo com a anterior demorando 3 s', async () => {
    const { poller, getTask, events } = setup(
      () => new Promise((resolve) => setTimeout(() => resolve(snapshot('TASK_STATE_WORKING')), 3000))
    )

    poller.start('t-1', Date.now(), 'TASK_STATE_SUBMITTED')
    await vi.advanceTimersByTimeAsync(1000) // primeira consulta sai
    expect(getTask).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(2999) // ainda esperando a resposta: nenhuma consulta nova
    expect(getTask).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(1) // resposta chega
    expect(events.onState).toHaveBeenCalledWith('TASK_STATE_WORKING')
    await vi.advanceTimersByTimeAsync(999)
    expect(getTask).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(1)
    expect(getTask).toHaveBeenCalledTimes(2)
  })

  it('para no primeiro estado terminal', async () => {
    const done = snapshot('TASK_STATE_COMPLETED', 'oi')
    const { poller, getTask, events } = setup(sequence(snapshot('TASK_STATE_WORKING'), done))

    poller.start('t-1', Date.now(), 'TASK_STATE_SUBMITTED')
    await vi.advanceTimersByTimeAsync(10_000)

    expect(getTask).toHaveBeenCalledTimes(2)
    expect(events.onDone).toHaveBeenCalledWith({ state: 'TASK_STATE_COMPLETED', text: 'oi', timestamp: null })
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each(['TASK_STATE_FAILED', 'TASK_STATE_REJECTED'] as const)('%s também é terminal', async (state) => {
    const { poller, events } = setup(sequence(snapshot(state)))

    poller.start('t-1', Date.now(), 'TASK_STATE_SUBMITTED')
    await vi.advanceTimersByTimeAsync(1000)

    expect(events.onDone).toHaveBeenCalledWith({ state, text: null, timestamp: null })
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('prazo', () => {
  it('esgota aos 90 s', async () => {
    const { poller, events } = setup(sequence(snapshot('TASK_STATE_WORKING')))

    poller.start('t-1', Date.now(), 'TASK_STATE_SUBMITTED')
    await vi.advanceTimersByTimeAsync(POLL_DEADLINE_MS - 1000)
    expect(events.onTimeout).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1000)
    expect(events.onTimeout).toHaveBeenCalledWith('TASK_STATE_WORKING')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('com timers atrasados, esgota pelo tempo decorrido e não pelo número de consultas', async () => {
    // Janela oculta: cada consulta agendada para 1 s dispara 20 s depois (o relógio pula 19 s a mais).
    const { poller, getTask, events } = setup(async () => {
      vi.setSystemTime(Date.now() + 19_000)
      return snapshot('TASK_STATE_WORKING')
    })

    poller.start('t-1', Date.now(), 'TASK_STATE_SUBMITTED')
    await vi.advanceTimersByTimeAsync(10_000)

    expect(getTask).toHaveBeenCalledTimes(5) // 5 × 20 s = 100 s ≥ 90 s
    expect(events.onTimeout).toHaveBeenCalledTimes(1)
  })

  it('a task que completa na consulta que passa do prazo é mostrada como concluída', async () => {
    const { poller, events } = setup(async () => {
      vi.setSystemTime(Date.now() + POLL_DEADLINE_MS)
      return snapshot('TASK_STATE_COMPLETED', 'oi')
    })

    poller.start('t-1', Date.now(), 'TASK_STATE_SUBMITTED')
    await vi.advanceTimersByTimeAsync(1000)

    expect(events.onDone).toHaveBeenCalled()
    expect(events.onTimeout).not.toHaveBeenCalled()
  })

  it('extend dá mais 90 s a partir do clique, na mesma task', async () => {
    const { poller, getTask, events } = setup(sequence(snapshot('TASK_STATE_WORKING')))

    poller.start('t-1', Date.now(), 'TASK_STATE_SUBMITTED')
    await vi.advanceTimersByTimeAsync(POLL_DEADLINE_MS)
    expect(events.onTimeout).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(30_000) // o usuário demora para clicar
    getTask.mockClear()
    poller.extend()
    await vi.advanceTimersByTimeAsync(POLL_DEADLINE_MS - 1000)
    expect(events.onTimeout).toHaveBeenCalledTimes(1)
    expect(getTask).toHaveBeenCalledWith('t-1')

    await vi.advanceTimersByTimeAsync(1000)
    expect(events.onTimeout).toHaveBeenCalledTimes(2)
  })
})

describe('erros na consulta', () => {
  it.each([
    ['unreachable', { kind: 'unreachable', message: 'net::ERR_FAILED' }],
    ['http 503', { kind: 'http', status: 503 }]
  ] as const)('%s é passageiro: o polling continua', async (_label, error) => {
    const { poller, events } = setup(sequence(failure(error), snapshot('TASK_STATE_COMPLETED', 'oi')))

    poller.start('t-1', Date.now(), 'TASK_STATE_SUBMITTED')
    await vi.advanceTimersByTimeAsync(2000)

    expect(events.onError).not.toHaveBeenCalled()
    expect(events.onDone).toHaveBeenCalled()
  })

  it('erro passageiro até o fim do prazo vira timeout', async () => {
    const { poller, events } = setup(sequence(failure({ kind: 'unreachable', message: 'timeout' })))

    poller.start('t-1', Date.now(), 'TASK_STATE_WORKING')
    await vi.advanceTimersByTimeAsync(POLL_DEADLINE_MS)

    expect(events.onTimeout).toHaveBeenCalledWith('TASK_STATE_WORKING')
  })

  it.each([
    ['rpc -32001', { kind: 'rpc', code: -32001, message: 'Task não encontrada.' }],
    ['bad-response', { kind: 'bad-response' }],
    ['http 404', { kind: 'http', status: 404 }],
    ['unauthorized', { kind: 'unauthorized' }]
  ] as const)('%s encerra o turno', async (_label, error) => {
    const { poller, getTask, events } = setup(sequence(failure(error)))

    poller.start('t-1', Date.now(), 'TASK_STATE_SUBMITTED')
    await vi.advanceTimersByTimeAsync(10_000)

    expect(getTask).toHaveBeenCalledTimes(1)
    expect(events.onError).toHaveBeenCalledWith(error)
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('stop', () => {
  it('durante uma consulta em andamento, descarta a resposta e não agenda nada', async () => {
    let respond!: (result: Result<TaskSnapshot>) => void
    const { poller, events } = setup(() => new Promise((resolve) => (respond = resolve)))

    poller.start('t-1', Date.now(), 'TASK_STATE_SUBMITTED')
    await vi.advanceTimersByTimeAsync(1000)
    poller.stop()
    respond(snapshot('TASK_STATE_COMPLETED', 'tarde demais'))
    await vi.advanceTimersByTimeAsync(5000)

    expect(events.onDone).not.toHaveBeenCalled()
    expect(events.onState).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('start de outra task descarta a resposta da anterior', async () => {
    const responders: ((result: Result<TaskSnapshot>) => void)[] = []
    const { poller, events } = setup(() => new Promise((resolve) => responders.push(resolve)))

    poller.start('t-1', Date.now(), 'TASK_STATE_SUBMITTED')
    await vi.advanceTimersByTimeAsync(1000)
    poller.start('t-2', Date.now(), 'TASK_STATE_SUBMITTED')
    responders[0]!(snapshot('TASK_STATE_COMPLETED', 'da t-1'))
    await vi.advanceTimersByTimeAsync(0)

    expect(events.onDone).not.toHaveBeenCalled()
  })
})
