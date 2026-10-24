import { useCallback, useEffect, useRef, useState } from 'react'
import type { AgentSummary, TaskState } from '../../../shared/api'
import { createHistoryStore, type HistoryStore } from '../history/storage'
import { conversationTitle, durationSeconds, serverDurationSeconds } from './format'
import type { Attempt, Conversation, Turn } from './model'
import { createTaskPoller, type PendingState, type TaskPoller, type TaskSnapshot } from './task-poller'

export type { Attempt, Conversation, Turn } from './model'

export type AgentsState = { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; agents: AgentSummary[] }

/** Estado do agente da conversa aberta (historico-conversas, D12): desconhecido até a lista carregar. */
export type AgentStatus = 'unknown' | 'active' | 'inactive'

/** O que o banner e o modal da sessão expirada explicam (sessao-expirada, D11 #1 e #2). */
export type ExpiredCase = 'poll' | 'send' | 'idle'

type Pending = Extract<Attempt, { kind: 'pending' }>

/** Lista de conversas e a aberta (historico-conversas, D1). */
interface State {
  conversations: Conversation[]
  openId: string | null
}

/** A task que o poller acompanha, com o agente da conversa a que ela pertence (D2). */
interface Polling {
  conversationId: string
  turnId: number
  agentId: string
}

const BUSY: readonly Attempt['kind'][] = ['sending', 'pending', 'timeout', 'awaiting-login']
const RESENDABLE: readonly Attempt['kind'][] = ['failed', 'send-error', 'poll-error', 'interrupted', 'not-sent']

function awaitingPoll({ taskId, state, submittedAt, startedAtLocal, resumed }: Pending): Attempt {
  return { kind: 'awaiting-login', resume: 'poll', taskId, state, submittedAt, startedAtLocal, resumed }
}

function isTerminal(state: TaskState): boolean {
  return state === 'TASK_STATE_COMPLETED' || state === 'TASK_STATE_FAILED' || state === 'TASK_STATE_REJECTED'
}

/**
 * Tentativa final a partir de um estado terminal, com a duração da D11 da conversa-a2a. Numa resposta retomada pela
 * abertura da conversa, o relógio local mediria também a ausência: sem os horários do servidor, fica sem duração (D7).
 */
function finished(pending: Pending, snapshot: TaskSnapshot): Attempt {
  if (snapshot.state === 'TASK_STATE_FAILED') return { kind: 'failed', taskId: pending.taskId }
  if (snapshot.state === 'TASK_STATE_REJECTED') return { kind: 'rejected', taskId: pending.taskId }
  const receivedAt = Date.now()
  const server = { submittedAt: pending.submittedAt, timestamp: snapshot.timestamp }
  return {
    kind: 'completed',
    taskId: pending.taskId,
    text: snapshot.text ?? '',
    receivedAt,
    durationSeconds: pending.resumed
      ? serverDurationSeconds(server)
      : durationSeconds(server, { startedAt: pending.startedAtLocal, endedAt: receivedAt })
  }
}

/** Grava quando a tentativa muda de tipo, ou de estado dentro de `pending` (D4). Uma consulta repetida não grava. */
function isStructural(previous: Attempt, next: Attempt): boolean {
  if (previous.kind !== next.kind) return true
  return previous.kind === 'pending' && next.kind === 'pending' && previous.state !== next.state
}

function draft(agent: AgentSummary): Conversation {
  const now = Date.now()
  return { id: crypto.randomUUID(), agent, contextId: null, title: null, createdAt: now, lastActivityAt: now, turns: [] }
}

function mostRecent(conversations: readonly Conversation[]): Conversation | null {
  let best: Conversation | null = null
  for (const conversation of conversations) {
    if (best === null || conversation.lastActivityAt > best.lastActivityAt) best = conversation
  }
  return best
}

function initialState(store: HistoryStore): State {
  const conversations = store.load()
  return { conversations, openId: mostRecent(conversations)?.id ?? null }
}

/**
 * Estado da tela de conversas: lista de agentes, as conversas do serviço (guardadas no `localStorage`), a aberta, o
 * turno em andamento e a sessão expirada. Um `unauthorized` nunca sai da tela: guarda o que retomar e espera o novo
 * login (sessao-expirada, D1). Todo resultado vai para a conversa que fez a chamada (historico-conversas, D2).
 */
export function useConversation(serviceUrl: string) {
  const storeRef = useRef<HistoryStore | null>(null)
  const stateRef = useRef<State | null>(null)
  if (storeRef.current === null) {
    storeRef.current = createHistoryStore(() => localStorage, serviceUrl)
    stateRef.current = initialState(storeRef.current)
  }
  const [state, setState] = useState<State>(stateRef.current!)
  const [agents, setAgents] = useState<AgentsState>({ kind: 'loading' })
  const [expired, setExpired] = useState(false)

  // Refs para os callbacks assíncronos lerem o estado atual sem depender de re-render.
  const agentsRef = useRef<AgentsState>(agents)
  // Muda só no Sair e na desmontagem: trocar de conversa não descarta resultado nenhum (D2).
  const generation = useRef(0)
  // Turnos com ids únicos entre todas as conversas, a partir do maior id lido do disco.
  const nextTurnId = useRef(
    1 + Math.max(0, ...stateRef.current!.conversations.flatMap((conversation) => conversation.turns.map((turn) => turn.id)))
  )
  const pollingRef = useRef<Polling | null>(null)
  const pollerRef = useRef<TaskPoller | null>(null)
  const expiredRef = useRef(false)
  // Época da sessão, trocada a cada novo login (D7 da sessao-expirada): um `unauthorized` de uma chamada iniciada antes
  // dele é do token antigo e não expira a sessão nova.
  const epoch = useRef(0)
  // Carga da lista recusada com `unauthorized`, refeita depois do novo login (D8 da sessao-expirada).
  const agentsAfterLogin = useRef<'initial' | 'reload' | null>(null)

  /** Troca o estado; com `persist`, grava e tira da lista o que o armazenamento removeu pelo teto ou pela cota (D4). */
  const commit = useCallback((next: State, persist: boolean) => {
    let value = next
    if (persist) {
      const removed = storeRef.current!.save(next.conversations, next.openId)
      if (removed.length > 0) {
        value = { ...next, conversations: next.conversations.filter((conversation) => !removed.includes(conversation.id)) }
      }
    }
    stateRef.current = value
    setState(value)
  }, [])

  const find = useCallback((conversationId: string) => {
    return stateRef.current!.conversations.find((conversation) => conversation.id === conversationId) ?? null
  }, [])

  /** Muda uma conversa; uma conversa que não existe mais (excluída) é ignorada. */
  const mutate = useCallback(
    (conversationId: string, change: (conversation: Conversation) => Conversation, persist: boolean) => {
      const current = stateRef.current!
      if (!current.conversations.some((conversation) => conversation.id === conversationId)) return
      const conversations = current.conversations.map((conversation) =>
        conversation.id === conversationId ? change(conversation) : conversation
      )
      commit({ ...current, conversations }, persist)
    },
    [commit]
  )

  /** `touch`: envio ou estado terminal, que atualizam a última atividade (D9). */
  const updateTurn = useCallback(
    (conversationId: string, turnId: number, attempt: Attempt, touch = false) => {
      const previous = find(conversationId)?.turns.find((turn) => turn.id === turnId)?.attempt
      if (previous === undefined) return
      mutate(
        conversationId,
        (conversation) => ({
          ...conversation,
          lastActivityAt: touch ? Date.now() : conversation.lastActivityAt,
          turns: conversation.turns.map((turn) => (turn.id === turnId ? { ...turn, attempt } : turn))
        }),
        touch || isStructural(previous, attempt)
      )
    },
    [find, mutate]
  )

  const pendingOf = useCallback(
    (conversationId: string, turnId: number): Pending | null => {
      const turn = find(conversationId)?.turns.find((t) => t.id === turnId)
      return turn?.attempt.kind === 'pending' ? turn.attempt : null
    },
    [find]
  )

  /** O poller deixa de acompanhar a task. A resposta de uma consulta em andamento é descartada pela geração dele. */
  const stopPolling = useCallback(() => {
    pollerRef.current?.stop()
    pollingRef.current = null
  }, [])

  /** Polling da conversa aberta. `startedAt` conta o prazo: o do envio, ou agora numa retomada (D6). */
  const startPolling = useCallback(
    (conversationId: string, turnId: number, pending: Pending, startedAt: number) => {
      const conversation = find(conversationId)
      if (conversation === null) return
      updateTurn(conversationId, turnId, pending)
      pollingRef.current = { conversationId, turnId, agentId: conversation.agent.id }
      pollerRef.current!.start(pending.taskId, startedAt, pending.state)
    },
    [find, updateTurn]
  )

  /**
   * Entra na sessão expirada (D1 da sessao-expirada), idempotente. Não troca a geração: um `chat.send` em andamento
   * tem o resultado aproveitado (D4 dela). O polling para, e a task pendente fica guardada no turno.
   */
  const expire = useCallback(() => {
    if (!expiredRef.current) {
      expiredRef.current = true
      setExpired(true)
    }
    const polling = pollingRef.current
    const pending = polling === null ? null : pendingOf(polling.conversationId, polling.turnId)
    if (polling === null || !pending) return
    stopPolling()
    updateTurn(polling.conversationId, polling.turnId, awaitingPoll(pending))
  }, [pendingOf, stopPolling, updateTurn])

  /**
   * Abre `next` (D6, D10): o poller para na que sai, o rascunho que sai some da lista, e uma resposta pendente da que
   * entra é retomada com prazo novo, ou guardada para o novo login na sessão expirada (D14).
   */
  const open = useCallback(
    (next: Conversation) => {
      const current = stateRef.current!
      if (current.openId !== null && current.openId !== next.id) stopPolling()
      // O rascunho que sai não tem nada a guardar, e nunca foi gravado: some só da lista.
      const kept = current.conversations.filter(
        (conversation) => conversation.id === next.id || conversation.id !== current.openId || conversation.turns.length > 0
      )
      const list = kept.some((conversation) => conversation.id === next.id) ? kept : [next, ...kept]
      commit({ conversations: list, openId: next.id }, false)
      const last = next.turns.at(-1)
      if (last?.attempt.kind !== 'pending' || pollingRef.current !== null) return
      if (expiredRef.current) return updateTurn(next.id, last.id, awaitingPoll(last.attempt))
      startPolling(next.id, last.id, { ...last.attempt, resumed: true }, Date.now())
    },
    [commit, startPolling, stopPolling, updateTurn]
  )

  const loadAgents = useCallback(
    async (initial: boolean) => {
      if (initial) {
        agentsRef.current = { kind: 'loading' }
        setAgents(agentsRef.current)
      }
      const myEpoch = epoch.current
      const result = await window.buteco.agents.list()
      if (!result.ok) {
        // Sessão expirada nunca é silenciosa; outras falhas de recarga mantêm a lista anterior (D12 da conversa-a2a).
        if (result.error.kind === 'unauthorized') {
          const neverLoaded = initial || agentsRef.current.kind !== 'ready'
          // Recusada com o token de antes do novo login: carrega de novo, com o token novo (D7).
          if (myEpoch !== epoch.current) return void loadAgents(neverLoaded)
          if (agentsAfterLogin.current !== 'initial') agentsAfterLogin.current = neverLoaded ? 'initial' : 'reload'
          expire()
        } else if (initial || agentsRef.current.kind !== 'ready') {
          agentsRef.current = { kind: 'error' }
          setAgents(agentsRef.current)
        }
        return
      }
      agentsRef.current = { kind: 'ready', agents: result.value }
      setAgents(agentsRef.current)
      // Sem histórico: o rascunho do primeiro ativo (D11).
      if (stateRef.current!.openId === null) {
        const firstActive = result.value.find((agent) => agent.isActive)
        if (firstActive) open(draft(firstActive))
      }
    },
    [expire, open]
  )

  const finish = useCallback(
    (conversationId: string, turnId: number, pending: Pending, snapshot: TaskSnapshot) => {
      const polling = pollingRef.current
      if (polling?.conversationId === conversationId && polling.turnId === turnId) pollingRef.current = null
      updateTurn(conversationId, turnId, finished(pending, snapshot), true)
      if (snapshot.state === 'TASK_STATE_REJECTED') void loadAgents(false)
    },
    [loadAgents, updateTurn]
  )

  // O poller é criado uma vez e guarda os callbacks deste primeiro render. Por isso `pendingOf`, `updateTurn`, `finish`
  // e `expire` precisam continuar estáveis (só dependências estáveis nos `useCallback`). Uma dependência nova em
  // qualquer um deles exige trocar estes eventos por refs, senão o poller chamaria a versão antiga.
  if (pollerRef.current === null) {
    pollerRef.current = createTaskPoller(
      {
        getTask: (taskId) => window.buteco.chat.getTask(pollingRef.current!.agentId, taskId),
        now: () => Date.now(),
        setTimeout: (callback, ms) => setTimeout(callback, ms),
        clearTimeout: (handle) => clearTimeout(handle)
      },
      {
        onState(state) {
          const polling = pollingRef.current
          const pending = polling === null ? null : pendingOf(polling.conversationId, polling.turnId)
          if (polling !== null && pending) updateTurn(polling.conversationId, polling.turnId, { ...pending, state })
        },
        onDone(snapshot) {
          const polling = pollingRef.current
          const pending = polling === null ? null : pendingOf(polling.conversationId, polling.turnId)
          if (polling !== null && pending) finish(polling.conversationId, polling.turnId, pending, snapshot)
        },
        onTimeout(lastState) {
          const polling = pollingRef.current
          const pending = polling === null ? null : pendingOf(polling.conversationId, polling.turnId)
          if (polling === null || !pending) return
          const { taskId, submittedAt, startedAtLocal, resumed } = pending
          const timeout: Attempt = { kind: 'timeout', taskId, lastState, submittedAt, startedAtLocal, resumed }
          updateTurn(polling.conversationId, polling.turnId, timeout)
        },
        onError(error) {
          // `unauthorized`: `expire` guarda a task do turno ainda pendente para a retomada (D4).
          if (error.kind === 'unauthorized') return expire()
          const polling = pollingRef.current
          pollingRef.current = null
          const pending = polling === null ? null : pendingOf(polling.conversationId, polling.turnId)
          if (polling !== null && pending) updateTurn(polling.conversationId, polling.turnId, { kind: 'poll-error', taskId: pending.taskId })
        }
      }
    )
  }

  /**
   * Um envio (novo, Reenviar ou retomada) para o turno `turnId` da conversa `conversationId`, no `contextId` atual
   * dela. Com a sessão expirada, nada sai: o turno espera o novo login (D4 da sessao-expirada). O resultado vai para a
   * conversa de origem, mesmo que outra esteja aberta (D2).
   */
  const dispatch = useCallback(
    async (conversationId: string, turnId: number, text: string) => {
      const conversation = find(conversationId)
      if (conversation === null) return
      if (expiredRef.current) return updateTurn(conversationId, turnId, { kind: 'awaiting-login', resume: 'send' })
      const myGeneration = generation.current
      const myEpoch = epoch.current
      updateTurn(conversationId, turnId, { kind: 'sending' }, true)
      const startedAtLocal = Date.now()
      const result = await window.buteco.chat.send(conversation.agent.id, text, conversation.contextId)
      // Uma conversa excluída no intervalo é ignorada por `mutate` e por `startPolling` (D13).
      if (myGeneration !== generation.current) return
      if (!result.ok) {
        // 401 no envio: a mensagem não foi registrada. Com o token de antes do novo login, vai de novo agora; senão,
        // depois do novo login (D4, D7).
        if (result.error.kind === 'unauthorized' && myEpoch !== epoch.current) return dispatch(conversationId, turnId, text)
        if (result.error.kind === 'unauthorized') {
          updateTurn(conversationId, turnId, { kind: 'awaiting-login', resume: 'send' })
          return expire()
        }
        return updateTurn(conversationId, turnId, { kind: 'send-error', error: result.error })
      }
      const { taskId, contextId, state, submittedAt } = result.value
      if (find(conversationId)?.contextId === null) mutate(conversationId, (c) => ({ ...c, contextId }), true)
      const pending: Pending = {
        kind: 'pending',
        taskId,
        state: isTerminal(state) ? 'TASK_STATE_SUBMITTED' : (state as PendingState),
        submittedAt,
        startedAtLocal,
        resumed: false
      }
      if (isTerminal(state)) return finish(conversationId, turnId, pending, { state, text: null, timestamp: submittedAt })
      // A sessão expirou durante o envio: a task existe, e o polling dela começa depois do novo login (D4).
      if (expiredRef.current) return updateTurn(conversationId, turnId, awaitingPoll(pending))
      // Origem fechada: a task fica pendente e é retomada quando a conversa for aberta (D2, D6).
      if (stateRef.current!.openId !== conversationId) return updateTurn(conversationId, turnId, pending)
      startPolling(conversationId, turnId, pending, startedAtLocal)
    },
    [expire, find, finish, mutate, startPolling, updateTurn]
  )

  const openConversation = useCallback((): Conversation | null => {
    const { openId } = stateRef.current!
    return openId === null ? null : find(openId)
  }, [find])

  const send = useCallback(
    (text: string) => {
      const current = openConversation()
      if (current === null) return
      const last = current.turns.at(-1)
      if (last && BUSY.includes(last.attempt.kind)) return
      const turn: Turn = { id: nextTurnId.current++, text, sentAt: Date.now(), attempt: { kind: 'sending' } }
      mutate(current.id, (c) => ({ ...c, title: c.title ?? conversationTitle(text), turns: [...c.turns, turn] }), true)
      void dispatch(current.id, turn.id, text)
    },
    [dispatch, mutate, openConversation]
  )

  /** Reenviar (D9 da conversa-a2a): depois do prazo, consulta antes a task original e mostra a resposta se ela já completou. */
  const resend = useCallback(
    async (turnId: number) => {
      const conversation = openConversation()
      const turn = conversation?.turns.at(-1)
      if (!conversation || !turn || turn.id !== turnId) return
      const { attempt } = turn
      if (attempt.kind === 'timeout') {
        if (expiredRef.current) return
        const myGeneration = generation.current
        const myEpoch = epoch.current
        stopPolling()
        updateTurn(conversation.id, turnId, { kind: 'sending' })
        const original = await window.buteco.chat.getTask(conversation.agent.id, attempt.taskId)
        if (myGeneration !== generation.current) return
        // Nada foi enviado: o turno volta ao prazo esgotado, e a decisão continua do usuário depois do login (D4).
        if (!original.ok && original.error.kind === 'unauthorized') {
          updateTurn(conversation.id, turnId, attempt)
          // Com o token de antes do novo login, a sessão nova continua (D7).
          return myEpoch === epoch.current ? expire() : undefined
        }
        if (original.ok && original.value.state === 'TASK_STATE_COMPLETED') {
          const { taskId, submittedAt, startedAtLocal, resumed } = attempt
          const pending: Pending = { kind: 'pending', taskId, state: attempt.lastState, submittedAt, startedAtLocal, resumed }
          return finish(conversation.id, turnId, pending, original.value)
        }
      } else if (expiredRef.current || !RESENDABLE.includes(attempt.kind)) return
      await dispatch(conversation.id, turnId, turn.text)
    },
    [dispatch, expire, find, finish, openConversation, stopPolling, updateTurn]
  )

  /**
   * Continuar aguardando: mesma task, prazo novo (D9 da conversa-a2a). `start` em vez de `extend`: depois de um 401 no
   * `getTask` prévio de Reenviar, o poller já não guarda a task (sessao-expirada, D4).
   */
  const keepWaiting = useCallback(
    (turnId: number) => {
      const conversation = openConversation()
      const turn = conversation?.turns.at(-1)
      if (expiredRef.current || !conversation || !turn || turn.id !== turnId || turn.attempt.kind !== 'timeout') return
      const { taskId, lastState, submittedAt, startedAtLocal, resumed } = turn.attempt
      const pending: Pending = { kind: 'pending', taskId, state: lastState, submittedAt, startedAtLocal, resumed }
      startPolling(conversation.id, turnId, pending, Date.now())
    },
    [openConversation, startPolling]
  )

  /**
   * Novo login bem-sucedido (D7 da sessao-expirada): síncrono, e só com a sessão expirada, para um segundo sucesso não
   * retomar nada. Em todas as conversas, um envio retido sai uma vez; uma task guardada volta a pendente e só a da
   * conversa aberta retoma o polling (historico-conversas, D14). A lista recusada é recarregada.
   */
  const renew = useCallback(() => {
    if (!expiredRef.current) return
    expiredRef.current = false
    epoch.current++
    setExpired(false)
    const { openId } = stateRef.current!
    for (const conversation of stateRef.current!.conversations) {
      const turn = conversation.turns.at(-1)
      if (turn?.attempt.kind !== 'awaiting-login') continue
      const { attempt } = turn
      if (attempt.resume === 'send') {
        void dispatch(conversation.id, turn.id, turn.text)
        continue
      }
      const { taskId, state, submittedAt, startedAtLocal, resumed } = attempt
      const pending: Pending = { kind: 'pending', taskId, state, submittedAt, startedAtLocal, resumed }
      if (conversation.id === openId) startPolling(conversation.id, turn.id, pending, Date.now())
      else updateTurn(conversation.id, turn.id, pending)
    }
    const agentsLoad = agentsAfterLogin.current
    agentsAfterLogin.current = null
    if (agentsLoad !== null) void loadAgents(agentsLoad === 'initial')
  }, [dispatch, loadAgents, startPolling, updateTurn])

  /** Abre uma conversa da lista. */
  const select = useCallback(
    (conversationId: string) => {
      const conversation = find(conversationId)
      if (conversation !== null && conversation.id !== stateRef.current!.openId) open(conversation)
    },
    [find, open]
  )

  /**
   * Nova conversa (D10), sem modal: com a lista ainda não carregada só a recarrega; com a aberta vazia não cria outra;
   * senão, um rascunho com o agente aberto, se ativo, ou o primeiro ativo.
   */
  const newConversation = useCallback(() => {
    const list = agentsRef.current
    if (list.kind !== 'ready') return void loadAgents(true)
    const current = openConversation()
    if (current !== null && current.turns.length === 0) return void loadAgents(false)
    const listed = current === null ? undefined : list.agents.find((agent) => agent.id === current.agent.id)
    const agent = listed?.isActive ? listed : list.agents.find((a) => a.isActive)
    if (agent) open(draft(agent))
    void loadAgents(false)
  }, [loadAgents, open, openConversation])

  /** Troca de agente no seletor (D10): muda o rascunho aberto, ou abre um rascunho com o agente escolhido. */
  const selectAgent = useCallback(
    (agent: AgentSummary) => {
      const current = openConversation()
      if (current !== null && current.turns.length === 0) return mutate(current.id, (c) => ({ ...c, agent }), false)
      open(draft(agent))
    },
    [mutate, open, openConversation]
  )

  /** Excluir (D13): sai da memória e do disco; a aberta dá lugar a um rascunho com o mesmo agente. */
  const remove = useCallback(
    (conversationId: string) => {
      const current = stateRef.current!
      const conversation = find(conversationId)
      if (conversation === null || expiredRef.current) return
      const rest = current.conversations.filter((c) => c.id !== conversationId)
      if (current.openId !== conversationId) return commit({ ...current, conversations: rest }, true)
      stopPolling()
      const next = draft(conversation.agent)
      commit({ conversations: [next, ...rest], openId: next.id }, true)
    },
    [commit, find, stopPolling]
  )

  /** Para tudo antes do Sair: nenhuma consulta pode terminar em `unauthorized` depois do logout. */
  const stop = useCallback(() => {
    stopPolling()
    generation.current++
  }, [stopPolling])

  useEffect(() => {
    void loadAgents(true)
    // Conversa guardada aberta ao entrar: a resposta pendente dela é retomada (D6, D11).
    const { openId } = stateRef.current!
    const opened = openId === null ? null : find(openId)
    const last = opened?.turns.at(-1)
    if (opened && last?.attempt.kind === 'pending' && pollingRef.current === null) {
      startPolling(opened.id, last.id, { ...last.attempt, resumed: true }, Date.now())
    }
    const poller = pollerRef.current
    return () => {
      poller?.stop()
      pollingRef.current = null
      generation.current++
    }
  }, [find, loadAgents, startPolling])

  const conversation = state.openId === null ? null : (state.conversations.find((c) => c.id === state.openId) ?? null)
  const last = conversation?.turns.at(-1)
  const busy = last !== undefined && BUSY.includes(last.attempt.kind)
  const listed = agents.kind === 'ready' ? agents.agents.find((a) => a.id === conversation?.agent.id) : undefined
  // Ausente da lista conta como inativo (D12 da conversa-a2a); antes da lista, desconhecido (historico-conversas, D12).
  const agentStatus: AgentStatus = agents.kind !== 'ready' ? 'unknown' : listed?.isActive ? 'active' : 'inactive'
  const expiredCase: ExpiredCase = last?.attempt.kind === 'awaiting-login' ? last.attempt.resume : 'idle'

  return {
    agents,
    conversations: state.conversations,
    conversation,
    busy,
    agentStatus,
    expired,
    expiredCase,
    expire,
    renew,
    retryAgents: () => void loadAgents(true),
    send,
    resend: (turnId: number) => void resend(turnId),
    keepWaiting,
    select,
    newConversation,
    selectAgent,
    remove,
    stop
  }
}
