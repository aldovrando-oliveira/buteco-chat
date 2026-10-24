import { pathToFileURL } from 'node:url'
import { beforeEach, describe, expect, it, vi } from 'vitest'

type Listener = (event: unknown, ...args: unknown[]) => unknown
const handlers = new Map<string, Listener>()

vi.mock('electron', () => ({
  ipcMain: { handle: (channel: string, listener: Listener) => handlers.set(channel, listener) },
  BrowserWindow: { fromWebContents: () => ({}) }
}))

const { rendererLocation, setTrustedRenderer } = await import('../ipc/handle')
const { LOGIN_ARG_LIMITS, parseLoginArgs, parseNoArgs, registerAuthHandlers } = await import('./ipc')
const { createAuthService } = await import('./service')

const INDEX_HTML = '/Applications/Buteco Chat.app/Contents/Resources/app.asar/out/renderer/index.html'
const frame = { url: pathToFileURL(INDEX_HTML).href, parent: null }

function invoke(channel: string, ...args: unknown[]): unknown {
  const listener = handlers.get(channel)
  if (!listener) throw new Error(`canal ${channel} não registrado`)
  return listener({ sender: {}, senderFrame: frame }, ...args)
}

/** Lança o erro de `fn` com mensagem e `cause`, para inspecionar ambos. */
function thrown(fn: () => unknown): Error {
  try {
    fn()
  } catch (error) {
    return error as Error
  }
  throw new Error('esperava erro')
}

describe('parseLoginArgs', () => {
  it('aceita três strings dentro dos limites', () => {
    const args = [
      'http://localhost:5017/' + 'a'.repeat(LOGIN_ARG_LIMITS.serviceUrl - 22),
      'u'.repeat(LOGIN_ARG_LIMITS.username),
      'p'.repeat(LOGIN_ARG_LIMITS.password)
    ]
    expect(args[0]).toHaveLength(LOGIN_ARG_LIMITS.serviceUrl)

    expect(parseLoginArgs(args)).toEqual(args)
  })

  it.each([
    ['número no lugar de string', ['http://localhost:5017', 1, 'p']],
    ['null', [null, 'u', 'p']],
    ['dois argumentos', ['http://localhost:5017', 'u']],
    ['quatro argumentos', ['http://localhost:5017', 'u', 'p', 'x']],
    ['endereço com 2049', ['http://localhost:5017/' + 'a'.repeat(LOGIN_ARG_LIMITS.serviceUrl - 21), 'u', 'p']],
    ['usuário com 257', ['http://localhost:5017', 'u'.repeat(LOGIN_ARG_LIMITS.username + 1), 'p']],
    ['senha com 1025', ['http://localhost:5017', 'u', 'p'.repeat(LOGIN_ARG_LIMITS.password + 1)]],
    ['endereço inválido', ['localhost:5017', 'u', 'p']]
  ])('recusa %s', (_label, args) => {
    expect(() => parseLoginArgs(args)).toThrow()
  })

  it('aceita usuário e senha vazios (a plataforma responde 401)', () => {
    expect(parseLoginArgs(['http://localhost:5017', '', ''])).toEqual(['http://localhost:5017', '', ''])
  })
})

describe('parseNoArgs', () => {
  it('aceita zero argumentos e recusa qualquer um', () => {
    expect(parseNoArgs([])).toEqual([])
    expect(() => parseNoArgs([undefined])).toThrow()
  })
})

describe('canais auth:*', () => {
  const fetch = vi.fn(async () => new Response(JSON.stringify({ token: 'tok-secreto', expiresAt: '2099-01-01T00:00:00Z' })))
  let auth: ReturnType<typeof createAuthService>

  beforeEach(() => {
    handlers.clear()
    fetch.mockClear()
    setTrustedRenderer(rendererLocation({ kind: 'file' }, INDEX_HTML))
    auth = createAuthService({
      fetch,
      now: () => Date.parse('2026-10-24T05:00:00Z'),
      setTimeout: (callback, ms) => setTimeout(callback, ms),
      clearTimeout: (handle) => clearTimeout(handle)
    })
    registerAuthHandlers(auth)
  })

  it('registra exatamente auth:login, auth:logout e auth:status', () => {
    expect([...handlers.keys()].sort()).toEqual(['auth:login', 'auth:logout', 'auth:status'])
  })

  it('o resultado de auth:login não contém o token', async () => {
    const result = await invoke('auth:login', 'http://localhost:5017', 'ana', 's3nha')

    expect(result).toEqual({ ok: true, value: { expiresAt: '2099-01-01T00:00:00.000Z' } })
    expect(JSON.stringify(result)).not.toContain('tok-secreto')
    expect(JSON.stringify(await invoke('auth:status'))).not.toContain('tok-secreto')
  })

  it('auth:logout e auth:status chegam ao serviço', async () => {
    await invoke('auth:login', 'http://localhost:5017', 'ana', 's3nha')
    expect(await invoke('auth:status')).toMatchObject({ authenticated: true, username: 'ana' })

    await invoke('auth:logout')

    expect(await invoke('auth:status')).toMatchObject({ authenticated: false })
  })

  it.each([
    ['auth:login', [1, 'u', 'p']],
    ['auth:login', ['http://localhost:5017', 'u']],
    ['auth:status', ['x']],
    ['auth:logout', ['x']]
  ])('%s com argumentos inválidos é rejeitado sem chamar o serviço', (channel, args) => {
    expect(() => invoke(channel, ...args)).toThrow(/Argumentos IPC inválidos/)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('a rejeição de um endereço com credenciais não repete nenhum valor, nem na cause', () => {
    const error = thrown(() => invoke('auth:login', 'http://user:pass@host', 'operador-x', 'senha-y'))
    const cause = error.cause as Error

    for (const text of [error.message, cause.message]) {
      for (const secret of ['user', 'pass', 'http://', 'host', 'operador-x', 'senha-y']) {
        expect(text).not.toContain(secret)
      }
    }
    expect(fetch).not.toHaveBeenCalled()
  })
})
