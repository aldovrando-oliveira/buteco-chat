import type { ChatError, Result } from '../../shared/api'
import { parseServiceUrl } from '../../shared/service-url'
import { classifyRejection, ISO_DATE_TIME, isOpaqueRedirect, type FetchLike } from '../http/classify'

export type { FetchLike }

export interface AuthServiceDeps<TimerHandle = unknown> {
  fetch: FetchLike
  now(): number
  // Injetados para o timeout obedecer aos timers falsos do Vitest; `AbortSignal.timeout` não obedece (D3).
  setTimeout(callback: () => void, ms: number): TimerHandle
  clearTimeout(handle: TimerHandle): void
}

export interface AuthStatus {
  authenticated: boolean
  serviceUrl: string | null
  username: string | null
  expiresAt: string | null
}

export interface AuthService {
  login(serviceUrl: string, username: string, password: string): Promise<Result<{ expiresAt: string }>>
  logout(): void
  status(): AuthStatus
  /** Só para o main (próximas changes). Nunca exposto por IPC. */
  getToken(): string | null
}

export const LOGIN_TIMEOUT_MS = 15_000
const MAX_BODY_LENGTH = 64 * 1024
const MAX_TOKEN_LENGTH = 8192

/** Sem campo de senha por construção: a senha só existe nos parâmetros de `login` e no corpo da requisição. */
interface Session {
  baseUrl: string
  username: string
  token: string
  expiresAtMs: number
}

type AbortReason = 'timeout' | 'cancelled'

interface Call {
  controller: AbortController
  reason: AbortReason | null
}

type Outcome = { ok: true; token: string; expiresAtMs: number } | { ok: false; error: ChatError }

export function createAuthService<TimerHandle>(deps: AuthServiceDeps<TimerHandle>): AuthService {
  let session: Session | null = null
  let generation = 0
  let inFlight: Call | null = null

  function cancelInFlight(): void {
    if (inFlight === null) return
    inFlight.reason = 'cancelled'
    inFlight.controller.abort()
    inFlight = null
  }

  /** Expiração verificada na leitura, sem timer (D8). */
  function currentSession(): Session | null {
    if (session !== null && deps.now() >= session.expiresAtMs) session = null
    return session
  }

  async function login(serviceUrl: string, username: string, password: string): Promise<Result<{ expiresAt: string }>> {
    const parsed = parseServiceUrl(serviceUrl)
    // O parseArgs do IPC já recusa endereço inválido; isto só protege uso interno. Mensagem sem o valor (D7).
    if (!parsed.ok) throw new Error('serviceUrl inválido.')

    cancelInFlight()
    session = null
    const myGeneration = ++generation
    const call: Call = { controller: new AbortController(), reason: null }
    inFlight = call
    const timer = deps.setTimeout(() => {
      call.reason = 'timeout'
      call.controller.abort()
    }, LOGIN_TIMEOUT_MS)

    try {
      const outcome = await request(`${parsed.baseUrl}/auth/login`, username, password, call)
      if (myGeneration !== generation) return { ok: false, error: { kind: 'unreachable', message: 'cancelled' } }
      if (!outcome.ok) return outcome
      session = { baseUrl: parsed.baseUrl, username, token: outcome.token, expiresAtMs: outcome.expiresAtMs }
      return { ok: true, value: { expiresAt: new Date(outcome.expiresAtMs).toISOString() } }
    } finally {
      deps.clearTimeout(timer)
      if (inFlight === call) inFlight = null
    }
  }

  async function request(url: string, username: string, password: string, call: Call): Promise<Outcome> {
    try {
      const response = await deps.fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ username, password }),
        credentials: 'omit',
        cache: 'no-store',
        // Nunca seguir: um 307/308 reenviaria a senha a outro endereço (D2).
        redirect: 'manual',
        signal: call.controller.signal
      })
      return await classifyResponse(response, deps.now())
    } catch (error) {
      if (call.reason !== null) return { ok: false, error: { kind: 'unreachable', message: call.reason } }
      return { ok: false, error: classifyRejection(error) }
    }
  }

  return {
    login,
    logout() {
      cancelInFlight()
      generation++
      session = null
    },
    status() {
      const current = currentSession()
      if (current === null) return { authenticated: false, serviceUrl: null, username: null, expiresAt: null }
      return {
        authenticated: true,
        serviceUrl: current.baseUrl,
        username: current.username,
        expiresAt: new Date(current.expiresAtMs).toISOString()
      }
    },
    getToken() {
      return currentSession()?.token ?? null
    }
  }
}

/** Mapeamento de D4. Redirecionamento pela resposta: opaca/status 0 (especificação Fetch) ou 3xx. */
async function classifyResponse(response: Response, now: number): Promise<Outcome> {
  if (isOpaqueRedirect(response)) return { ok: false, error: { kind: 'http', status: 0 } }
  if (response.status === 401) return { ok: false, error: { kind: 'invalid-credentials' } }
  if (response.status !== 200) return { ok: false, error: { kind: 'http', status: response.status } }
  const body = await response.text()
  return parseLoginBody(body, now)
}

/** Critérios de `bad-response` (D5). */
function parseLoginBody(body: string, now: number): Outcome {
  const bad: Outcome = { ok: false, error: { kind: 'bad-response' } }
  if (body.length > MAX_BODY_LENGTH) return bad
  let data: unknown
  try {
    data = JSON.parse(body)
  } catch {
    return bad
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return bad
  const { token, expiresAt } = data as Record<string, unknown>
  if (typeof token !== 'string' || token.length === 0 || token.length > MAX_TOKEN_LENGTH) return bad
  if (typeof expiresAt !== 'string' || !ISO_DATE_TIME.test(expiresAt)) return bad
  // O V8 aceita as sete casas do .NET e trunca para milissegundos (conferido no Electron 45 e no Node 26, D5).
  const expiresAtMs = Date.parse(expiresAt)
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= now) return bad
  return { ok: true, token, expiresAtMs }
}
