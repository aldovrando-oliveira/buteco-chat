import { vi } from 'vitest'
import type { ButecoApi, ExposedApi } from '../../../shared/api'

type Auth = ButecoApi['auth']
type Status = Awaited<ReturnType<Auth['status']>>

export const LOGGED_OUT: Status = { authenticated: false, serviceUrl: null, username: null, expiresAt: null }

export function loggedIn(minutes = 30, serviceUrl = 'http://localhost:5017', username = 'ana'): Status {
  return { authenticated: true, serviceUrl, username, expiresAt: new Date(Date.now() + minutes * 60_000).toISOString() }
}

/** Instala um `window.buteco.auth` simulado. Por padrão: deslogado, login com sucesso. */
export function mockAuth() {
  const auth = {
    login: vi.fn<Auth['login']>(async () => ({ ok: true, value: { expiresAt: new Date().toISOString() } })),
    logout: vi.fn<Auth['logout']>(async () => {}),
    status: vi.fn<Auth['status']>(async () => LOGGED_OUT)
  }
  // Os outros namespaces respondem o mínimo; a tela de conversas tem o seu simulado completo em test-chat.ts.
  window.buteco = {
    auth,
    agents: { list: vi.fn(async () => ({ ok: true as const, value: [] })) },
    chat: {
      send: vi.fn(async () => ({ ok: false as const, error: { kind: 'unreachable' as const, message: 'network' } })),
      getTask: vi.fn(async () => ({ ok: false as const, error: { kind: 'unreachable' as const, message: 'network' } }))
    },
    clipboard: { writeText: vi.fn(async () => {}) }
  } satisfies ExposedApi
  return auth
}
