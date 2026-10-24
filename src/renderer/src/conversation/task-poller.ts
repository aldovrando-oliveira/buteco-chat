import type { ChatError, Result, TaskState } from '../../../shared/api'

export type TaskSnapshot = { state: TaskState; text: string | null; timestamp: string | null }
export type PendingState = 'TASK_STATE_SUBMITTED' | 'TASK_STATE_WORKING'

export const POLL_INTERVAL_MS = 1000
export const POLL_DEADLINE_MS = 90_000

export interface TaskPollerDeps<TimerHandle = unknown> {
  getTask(taskId: string): Promise<Result<TaskSnapshot>>
  now(): number
  setTimeout(callback: () => void, ms: number): TimerHandle
  clearTimeout(handle: TimerHandle): void
  intervalMs?: number
  deadlineMs?: number
}

export interface TaskPollerEvents {
  /** Estado não terminal da última consulta. */
  onState(state: PendingState): void
  /** Primeiro estado terminal: COMPLETED, FAILED ou REJECTED. */
  onDone(snapshot: TaskSnapshot): void
  /** Prazo esgotado; a task fica guardada para `extend()`. */
  onTimeout(lastState: PendingState): void
  /** Erro que encerra o turno (inclusive `unauthorized`, que o chamador trata como sessão terminada). */
  onError(error: ChatError): void
}

export interface TaskPoller {
  /** Começa a acompanhar `taskId`; o prazo conta a partir de `startedAt` (relógio do `now` injetado). */
  start(taskId: string, startedAt: number, initialState: PendingState): void
  /** Continuar aguardando: mesma task, prazo novo a partir de agora. */
  extend(): void
  stop(): void
}

function isTerminal(state: TaskState): boolean {
  return state === 'TASK_STATE_COMPLETED' || state === 'TASK_STATE_FAILED' || state === 'TASK_STATE_REJECTED'
}

/** Queda de rede ou reinício da API: o turno continua até o prazo (D8). */
function isTransient(error: ChatError): boolean {
  return error.kind === 'unreachable' || (error.kind === 'http' && error.status >= 500 && error.status <= 599)
}

/**
 * Polling de uma task (design D8). Uma consulta por vez: a próxima só é agendada depois da resposta da anterior.
 * O prazo é medido por `now()`, nunca por contagem de consultas: o Chromium desacelera timers de janelas ocultas.
 * Cada `start`/`stop` troca a geração, e a resposta de uma geração antiga é descartada sem agendar nada.
 */
export function createTaskPoller<TimerHandle>(deps: TaskPollerDeps<TimerHandle>, events: TaskPollerEvents): TaskPoller {
  const intervalMs = deps.intervalMs ?? POLL_INTERVAL_MS
  const deadlineMs = deps.deadlineMs ?? POLL_DEADLINE_MS
  let generation = 0
  let timer: { handle: TimerHandle } | null = null
  let task: { id: string; deadline: number; lastState: PendingState } | null = null

  function clearTimer(): void {
    if (timer !== null) deps.clearTimeout(timer.handle)
    timer = null
  }

  function schedule(myGeneration: number): void {
    timer = { handle: deps.setTimeout(() => void poll(myGeneration), intervalMs) }
  }

  /** Depois de uma resposta não terminal: prazo vencido → timeout; senão, próxima consulta. */
  function continueOrTimeout(myGeneration: number): void {
    if (task === null) return
    if (deps.now() >= task.deadline) {
      events.onTimeout(task.lastState)
      return
    }
    schedule(myGeneration)
  }

  async function poll(myGeneration: number): Promise<void> {
    timer = null
    if (task === null) return
    const result = await deps.getTask(task.id)
    if (myGeneration !== generation || task === null) return

    if (!result.ok) {
      if (isTransient(result.error)) continueOrTimeout(myGeneration)
      else {
        task = null
        events.onError(result.error)
      }
      return
    }
    const { state } = result.value
    if (isTerminal(state)) {
      task = null
      events.onDone(result.value)
      return
    }
    task.lastState = state as PendingState
    events.onState(task.lastState)
    continueOrTimeout(myGeneration)
  }

  return {
    start(taskId, startedAt, initialState) {
      clearTimer()
      const myGeneration = ++generation
      task = { id: taskId, deadline: startedAt + deadlineMs, lastState: initialState }
      schedule(myGeneration)
    },
    extend() {
      if (task === null) return
      clearTimer()
      const myGeneration = ++generation
      task.deadline = deps.now() + deadlineMs
      schedule(myGeneration)
    },
    stop() {
      clearTimer()
      generation++
      task = null
    }
  }
}
