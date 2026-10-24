import type { ChatError } from '../../shared/api'

/** Forma mínima de `fetch` usada no main. Em produção, `net.fetch` do Electron (login-operador, D1). */
export type FetchLike = (url: string, init: RequestInit) => Promise<Response>

// Fração de 0 a 7 casas: o .NET serializa DateTimeOffset com sete (login-operador, D5). Fuso obrigatório.
export const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,7})?(Z|[+-]\d{2}:\d{2})$/

/** Redirecionamento visto na resposta: opaca/status 0 (especificação Fetch). O 3xx cai no status inesperado. */
export function isOpaqueRedirect(response: Response): boolean {
  return response.type === 'opaqueredirect' || response.status === 0
}

/**
 * Rejeições do `fetch` (login-operador, D2 e D4). No Electron 45 o `redirect: 'manual'` rejeita com "Redirect was
 * cancelled"; erros de rede vêm como `net::ERR_…`. Os erros só têm `message`, sem `code`.
 */
export function classifyRejection(error: unknown): ChatError {
  const message = error instanceof Error ? error.message : ''
  if (message.startsWith('net::')) return { kind: 'unreachable', message }
  if (/redirect/i.test(message)) return { kind: 'http', status: 0 }
  return { kind: 'unreachable', message: 'network' }
}
