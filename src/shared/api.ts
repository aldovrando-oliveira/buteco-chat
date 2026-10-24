/**
 * Contrato inicial entre main e renderer (documento de construção, "API exposta ao renderer").
 * Uma change pode alterá-lo, registrando a alteração e o motivo no próprio design.md.
 */

export type ChatError =
  | { kind: 'unauthorized' } // HTTP 401: token ausente/expirado
  | { kind: 'invalid-credentials' } // 401 no /auth/login
  | { kind: 'unreachable'; message: string } // falha de rede, DNS, recusa de conexão
  | { kind: 'rpc'; code: number; message: string } // erro JSON-RPC no corpo (HTTP 200)
  | { kind: 'http'; status: number } // qualquer outro status inesperado; 0 ou 3xx = redirecionamento não seguido
  | { kind: 'bad-response' } // HTTP 200 com corpo fora do contrato (login-operador, D9)

/** Limite do texto de uma mensagem, em unidades UTF-16 (`length`), no composer e no IPC (conversa-a2a, D16). */
export const MAX_MESSAGE_LENGTH = 16_000

export type Result<T> = { ok: true; value: T } | { ok: false; error: ChatError }

export interface AgentSummary {
  id: string
  name: string
  description: string | null
  isActive: boolean
  skills: { name: string; description: string | null }[]
}

export type TaskState =
  | 'TASK_STATE_SUBMITTED'
  | 'TASK_STATE_WORKING'
  | 'TASK_STATE_COMPLETED'
  | 'TASK_STATE_FAILED'
  | 'TASK_STATE_REJECTED'

export interface ButecoApi {
  auth: {
    login(serviceUrl: string, username: string, password: string): Promise<Result<{ expiresAt: string }>>
    logout(): Promise<void>
    status(): Promise<{
      authenticated: boolean
      serviceUrl: string | null
      username: string | null // acrescentado na login-operador (D9)
      expiresAt: string | null
    }>
  }
  agents: {
    list(): Promise<Result<AgentSummary[]>>
  }
  chat: {
    send(
      agentId: string,
      text: string,
      contextId: string | null
    ): Promise<Result<{ taskId: string; contextId: string; state: TaskState; submittedAt: string | null }>> // submittedAt: conversa-a2a, D7
    // timestamp: conversa-a2a, D7. text: só em COMPLETED (D4).
    getTask(agentId: string, taskId: string): Promise<Result<{ state: TaskState; text: string | null; timestamp: string | null }>>
  }
  /** Cópia pelo main: a fundação nega a permissão de clipboard ao renderer (conversa-a2a, D6). */
  clipboard: {
    writeText(text: string): Promise<void>
  }
}

/** Namespaces de `ButecoApi` que o preload expõe de fato. Cada change acrescenta o que implementar. */
export const EXPOSED_NAMESPACES = ['auth', 'agents', 'chat', 'clipboard'] as const satisfies readonly (keyof ButecoApi)[]

/** Tipo de `window.buteco`, derivado de `EXPOSED_NAMESPACES` para os dois nunca divergirem. */
export type ExposedApi = Pick<ButecoApi, (typeof EXPOSED_NAMESPACES)[number]>
