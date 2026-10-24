import { useCallback, useEffect, useRef, useState } from 'react'
import type { AgentSummary, ChatError, TaskState } from '../../../shared/api'
import { conversationTitle, durationSeconds } from './format'
import { createTaskPoller, type PendingState, type TaskPoller, type TaskSnapshot } from './task-poller'

/** Estado da tentativa de um turno (design D17). Reenviar troca a tentativa do mesmo turno. */
export type Attempt =
  | { kind: 'sending' }
  | { kind: 'pending'; taskId: string; state: PendingState; submittedAt: string | null; startedAtLocal: number }
  | { kind: 'completed'; taskId: string; text: string; receivedAt: number; durationSeconds: number }
  | { kind: 'failed'; taskId: string }
  | { kind: 'rejected'; taskId: string }
  | { kind: 'timeout'; taskId: string; lastState: PendingState; submittedAt: string | null; startedAtLocal: number }
  | { kind: 'send-error'; error: ChatError }
  | { kind: 'poll-error'; taskId: string }

export interface Turn {
  id: number
  text: string
  sentAt: number
  attempt: Attempt
}

export interface Conversation {
  agent: AgentSummary
  contextId: string | null
  title: string | null
  turns: Turn[]
}

export type AgentsState = { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; agents: AgentSummary[] }

type Pending = Extract<Attempt, { kind: 'pending' }>

const BUSY: readonly Attempt['kind'][] = ['sending', 'pending', 'timeout']

function isTerminal(state: TaskState): boolean {
  return state === 'TASK_STATE_COMPLETED' || state === 'TASK_STATE_FAILED' || state === 'TASK_STATE_REJECTED'
}

/** Tentativa final a partir de um estado terminal, com a duração de D11. */
function finished(pending: Pending, snapshot: TaskSnapshot): Attempt {
  if (snapshot.state === 'TASK_STATE_FAILED') return { kind: 'failed', taskId: pending.taskId }
  if (snapshot.state === 'TASK_STATE_REJECTED') return { kind: 'rejected', taskId: pending.taskId }
  const receivedAt = Date.now()
  return {
    kind: 'completed',
    taskId: pending.taskId,
    text: snapshot.text ?? '',
    receivedAt,
    durationSeconds: durationSeconds(
      { submittedAt: pending.submittedAt, timestamp: snapshot.timestamp },
      { startedAt: pending.startedAtLocal, endedAt: receivedAt }
    )
  }
}

/**
 * Estado da tela de conversas: lista de agentes, a conversa atual (em memória) e o turno em andamento.
 * `onSessionEnded` é chamado em qualquer `unauthorized` (D14), depois de parar o polling.
 */
export function useConversation(onSessionEnded: () => void) {
  const [agents, setAgents] = useState<AgentsState>({ kind: 'loading' })
  const [conversation, setConversation] = useState<Conversation | null>(null)

  // Refs para os callbacks assíncronos lerem o estado atual sem depender de re-render.
  const conversationRef = useRef<Conversation | null>(null)
  const agentsRef = useRef<AgentsState>(agents)
  const generation = useRef(0)
  const nextTurnId = useRef(1)
  const pollingTurn = useRef<number | null>(null)
  const pollerRef = useRef<TaskPoller | null>(null)
  const onSessionEndedRef = useRef(onSessionEnded)
  onSessionEndedRef.current = onSessionEnded

  const commit = useCallback((next: Conversation | null) => {
    conversationRef.current = next
    setConversation(next)
  }, [])

  const updateTurn = useCallback(
    (turnId: number, attempt: Attempt) => {
      const current = conversationRef.current
      if (current === null) return
      commit({ ...current, turns: current.turns.map((turn) => (turn.id === turnId ? { ...turn, attempt } : turn)) })
    },
    [commit]
  )

  const endSession = useCallback(() => {
    pollerRef.current?.stop()
    pollingTurn.current = null
    generation.current++
    onSessionEndedRef.current()
  }, [])

  const loadAgents = useCallback(
    async (initial: boolean) => {
      if (initial) {
        agentsRef.current = { kind: 'loading' }
        setAgents(agentsRef.current)
      }
      const result = await window.buteco.agents.list()
      if (!result.ok) {
        // Sessão terminada nunca é silenciosa; outras falhas de recarga mantêm a lista anterior (D12).
        if (result.error.kind === 'unauthorized') endSession()
        else if (initial || agentsRef.current.kind !== 'ready') {
          agentsRef.current = { kind: 'error' }
          setAgents(agentsRef.current)
        }
        return
      }
      agentsRef.current = { kind: 'ready', agents: result.value }
      setAgents(agentsRef.current)
      if (conversationRef.current === null) {
        const firstActive = result.value.find((agent) => agent.isActive)
        if (firstActive) commit({ agent: firstActive, contextId: null, title: null, turns: [] })
      }
    },
    [commit, endSession]
  )

  const pendingOf = useCallback((turnId: number): Pending | null => {
    const turn = conversationRef.current?.turns.find((t) => t.id === turnId)
    return turn?.attempt.kind === 'pending' ? turn.attempt : null
  }, [])

  const finish = useCallback(
    (turnId: number, pending: Pending, snapshot: TaskSnapshot) => {
      pollingTurn.current = null
      updateTurn(turnId, finished(pending, snapshot))
      if (snapshot.state === 'TASK_STATE_REJECTED') void loadAgents(false)
    },
    [loadAgents, updateTurn]
  )

  // O poller é criado uma vez e guarda os callbacks deste primeiro render. Por isso `pendingOf`, `updateTurn`, `finish`
  // e `endSession` precisam continuar estáveis (só dependências estáveis nos `useCallback`). Uma dependência nova em
  // qualquer um deles exige trocar estes eventos por refs, senão o poller chamaria a versão antiga.
  if (pollerRef.current === null) {
    pollerRef.current = createTaskPoller(
      {
        getTask: (taskId) => window.buteco.chat.getTask(conversationRef.current!.agent.id, taskId),
        now: () => Date.now(),
        setTimeout: (callback, ms) => setTimeout(callback, ms),
        clearTimeout: (handle) => clearTimeout(handle)
      },
      {
        onState(state) {
          const turnId = pollingTurn.current
          const pending = turnId === null ? null : pendingOf(turnId)
          if (turnId !== null && pending) updateTurn(turnId, { ...pending, state })
        },
        onDone(snapshot) {
          const turnId = pollingTurn.current
          const pending = turnId === null ? null : pendingOf(turnId)
          if (turnId !== null && pending) finish(turnId, pending, snapshot)
        },
        onTimeout(lastState) {
          const turnId = pollingTurn.current
          const pending = turnId === null ? null : pendingOf(turnId)
          if (turnId === null || !pending) return
          const { taskId, submittedAt, startedAtLocal } = pending
          updateTurn(turnId, { kind: 'timeout', taskId, lastState, submittedAt, startedAtLocal })
        },
        onError(error) {
          const turnId = pollingTurn.current
          pollingTurn.current = null
          if (error.kind === 'unauthorized') return endSession()
          const pending = turnId === null ? null : pendingOf(turnId)
          if (turnId !== null && pending) updateTurn(turnId, { kind: 'poll-error', taskId: pending.taskId })
        }
      }
    )
  }

  /** Um envio (novo ou Reenviar) para o turno `turnId`, no `contextId` atual da conversa. */
  const dispatch = useCallback(
    async (turnId: number, text: string) => {
      const current = conversationRef.current
      if (current === null) return
      const myGeneration = generation.current
      updateTurn(turnId, { kind: 'sending' })
      const startedAtLocal = Date.now()
      const result = await window.buteco.chat.send(current.agent.id, text, current.contextId)
      if (myGeneration !== generation.current) return
      if (!result.ok) {
        if (result.error.kind === 'unauthorized') return endSession()
        return updateTurn(turnId, { kind: 'send-error', error: result.error })
      }
      const { taskId, contextId, state, submittedAt } = result.value
      const latest = conversationRef.current
      if (latest !== null && latest.contextId === null) commit({ ...latest, contextId })
      const pending: Pending = {
        kind: 'pending',
        taskId,
        state: isTerminal(state) ? 'TASK_STATE_SUBMITTED' : (state as PendingState),
        submittedAt,
        startedAtLocal
      }
      if (isTerminal(state)) {
        finish(turnId, pending, { state, text: null, timestamp: submittedAt })
        return
      }
      updateTurn(turnId, pending)
      pollingTurn.current = turnId
      pollerRef.current!.start(taskId, startedAtLocal, pending.state)
    },
    [commit, endSession, finish, updateTurn]
  )

  const send = useCallback(
    (text: string) => {
      const current = conversationRef.current
      if (current === null) return
      const last = current.turns.at(-1)
      if (last && BUSY.includes(last.attempt.kind)) return
      const turn: Turn = { id: nextTurnId.current++, text, sentAt: Date.now(), attempt: { kind: 'sending' } }
      commit({ ...current, title: current.title ?? conversationTitle(text), turns: [...current.turns, turn] })
      void dispatch(turn.id, text)
    },
    [commit, dispatch]
  )

  /** Reenviar (D9): depois do prazo, consulta antes a task original e mostra a resposta se ela já completou. */
  const resend = useCallback(
    async (turnId: number) => {
      const turn = conversationRef.current?.turns.at(-1)
      if (!turn || turn.id !== turnId) return
      const { attempt } = turn
      if (attempt.kind === 'timeout') {
        const myGeneration = generation.current
        pollerRef.current!.stop()
        updateTurn(turnId, { kind: 'sending' })
        const original = await window.buteco.chat.getTask(conversationRef.current!.agent.id, attempt.taskId)
        if (myGeneration !== generation.current) return
        // Sessão terminada não vira reenvio: o envio daria `unauthorized` de novo, depois de um request inútil (D14).
        if (!original.ok && original.error.kind === 'unauthorized') return endSession()
        if (original.ok && original.value.state === 'TASK_STATE_COMPLETED') {
          const { taskId, submittedAt, startedAtLocal } = attempt
          const pending: Pending = { kind: 'pending', taskId, state: attempt.lastState, submittedAt, startedAtLocal }
          return finish(turnId, pending, original.value)
        }
      } else if (!['failed', 'send-error', 'poll-error'].includes(attempt.kind)) return
      await dispatch(turnId, turn.text)
    },
    [dispatch, endSession, finish, updateTurn]
  )

  /** Continuar aguardando: mesma task, prazo novo (D9). */
  const keepWaiting = useCallback(
    (turnId: number) => {
      const turn = conversationRef.current?.turns.at(-1)
      if (!turn || turn.id !== turnId || turn.attempt.kind !== 'timeout') return
      const { taskId, lastState, submittedAt, startedAtLocal } = turn.attempt
      updateTurn(turnId, { kind: 'pending', taskId, state: lastState, submittedAt, startedAtLocal })
      pollingTurn.current = turnId
      pollerRef.current!.extend()
    },
    [updateTurn]
  )

  /** Nova conversa ou troca de agente (D13): descarta a atual e para o polling. A confirmação é da tela. */
  const startConversation = useCallback(
    (agent: AgentSummary, reloadAgents: boolean) => {
      pollerRef.current!.stop()
      pollingTurn.current = null
      generation.current++
      commit({ agent, contextId: null, title: null, turns: [] })
      if (reloadAgents) void loadAgents(false)
    },
    [commit, loadAgents]
  )

  /** Para tudo antes do Sair: nenhuma consulta pode terminar em `unauthorized` depois do logout. */
  const stop = useCallback(() => {
    pollerRef.current!.stop()
    pollingTurn.current = null
    generation.current++
  }, [])

  useEffect(() => {
    void loadAgents(true)
    const poller = pollerRef.current
    return () => {
      poller?.stop()
      generation.current++
    }
  }, [loadAgents])

  const last = conversation?.turns.at(-1)
  const busy = last !== undefined && BUSY.includes(last.attempt.kind)
  const listed = agents.kind === 'ready' ? agents.agents.find((a) => a.id === conversation?.agent.id) : undefined
  // Ausente da lista conta como inativo (D12). Antes da lista carregar não há conversa.
  const agentActive = conversation !== null && listed !== undefined && listed.isActive

  return {
    agents,
    conversation,
    busy,
    agentActive,
    retryAgents: () => void loadAgents(true),
    send,
    resend: (turnId: number) => void resend(turnId),
    keepWaiting,
    startConversation,
    stop
  }
}
