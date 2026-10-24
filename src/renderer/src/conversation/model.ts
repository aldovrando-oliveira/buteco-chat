import type { AgentSummary, ChatError } from '../../../shared/api'
import type { PendingState } from './task-poller'

/** Estado da tentativa de um turno (design D17 da conversa-a2a). Reenviar troca a tentativa do mesmo turno. */
export type Attempt =
  | { kind: 'sending' }
  // `resumed`: o polling recomeçou pela abertura da conversa (historico-conversas, D7). Passa adiante para `timeout` e
  // `awaiting-login` / `poll`, e volta ao `pending` em Continuar aguardando e na retomada depois do novo login.
  | {
      kind: 'pending'
      taskId: string
      state: PendingState
      submittedAt: string | null
      startedAtLocal: number
      resumed: boolean
    }
  // `durationSeconds` nulo: resposta retomada sem os horários do servidor (historico-conversas, D7).
  | { kind: 'completed'; taskId: string; text: string; receivedAt: number; durationSeconds: number | null }
  | { kind: 'failed'; taskId: string }
  | { kind: 'rejected'; taskId: string }
  | {
      kind: 'timeout'
      taskId: string
      lastState: PendingState
      submittedAt: string | null
      startedAtLocal: number
      resumed: boolean
    }
  | { kind: 'send-error'; error: ChatError }
  | { kind: 'poll-error'; taskId: string }
  // Sessão expirada (sessao-expirada, D4): o que retomar depois do novo login.
  | { kind: 'awaiting-login'; resume: 'send' }
  | {
      kind: 'awaiting-login'
      resume: 'poll'
      taskId: string
      state: PendingState
      submittedAt: string | null
      startedAtLocal: number
      resumed: boolean
    }
  // Normalização ao reabrir (historico-conversas, D15): envio interrompido pelo fechamento e envio retido.
  | { kind: 'interrupted' }
  | { kind: 'not-sent' }

export interface Turn {
  id: number
  text: string
  sentAt: number
  attempt: Attempt
}

/** Conversa (historico-conversas, D1). Sem turnos, é o rascunho, que nunca é gravado. */
export interface Conversation {
  id: string
  agent: AgentSummary
  contextId: string | null
  title: string | null
  createdAt: number
  lastActivityAt: number
  turns: Turn[]
}
