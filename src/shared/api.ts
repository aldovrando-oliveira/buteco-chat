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
    ): Promise<Result<{ taskId: string; contextId: string; state: TaskState }>>
    getTask(agentId: string, taskId: string): Promise<Result<{ state: TaskState; text: string | null }>>
  }
}

/** Namespaces de `ButecoApi` que o preload expõe de fato. Cada change acrescenta o que implementar. */
export const EXPOSED_NAMESPACES = ['auth'] as const satisfies readonly (keyof ButecoApi)[]

/** Tipo de `window.buteco`, derivado de `EXPOSED_NAMESPACES` para os dois nunca divergirem. */
export type ExposedApi = Pick<ButecoApi, (typeof EXPOSED_NAMESPACES)[number]>
