import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createAuthService, LOGIN_TIMEOUT_MS, type FetchLike } from './service'

const NOW = Date.parse('2026-10-24T05:00:00.000Z')
const IN_30_MIN = '2026-10-24T05:30:00.000Z'

let clock = NOW

function json(status: number, body: unknown): Response {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  })
}

function ok(token = 'tok-secreto', expiresAt = IN_30_MIN): Response {
  return json(200, { token, expiresAt })
}

/** `fetch` que só termina quando o sinal aborta, como uma requisição sem resposta. */
const hanging: FetchLike = (_url, init) =>
  new Promise((_resolve, reject) => {
    init.signal?.addEventListener('abort', () => reject(new DOMException('This operation was aborted', 'AbortError')))
  })

/** `fetch` que devolve uma promessa controlada pelo teste e ignora o sinal (resposta tardia). */
function deferred() {
  let resolve!: (response: Response) => void
  const fetch = vi.fn<FetchLike>(() => new Promise<Response>((r) => (resolve = r)))
  return { fetch, respond: (response: Response) => resolve(response) }
}

function service(fetch: FetchLike) {
  return createAuthService({
    fetch,
    now: () => clock,
    setTimeout: (callback, ms) => setTimeout(callback, ms),
    clearTimeout: (handle) => clearTimeout(handle)
  })
}

beforeEach(() => {
  clock = NOW
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('login bem-sucedido', () => {
  it('devolve só expiresAt e preenche o status', async () => {
    const auth = service(async () => ok())

    const result = await auth.login('http://localhost:5017', 'ana', 's3nha')

    expect(result).toEqual({ ok: true, value: { expiresAt: IN_30_MIN } })
    expect(JSON.stringify(result)).not.toContain('tok-secreto')
    expect(auth.status()).toEqual({
      authenticated: true,
      serviceUrl: 'http://localhost:5017',
      username: 'ana',
      expiresAt: IN_30_MIN
    })
    expect(auth.getToken()).toBe('tok-secreto')
  })

  it('aceita a data no formato do .NET (sete casas, fuso numérico) e normaliza', async () => {
    const auth = service(async () => ok('t', '2026-10-24T05:24:00.1234567+00:00'))

    expect(await auth.login('http://localhost:5017', 'ana', 's3nha')).toEqual({
      ok: true,
      value: { expiresAt: '2026-10-24T05:24:00.123Z' }
    })
  })

  it('aceita fuso negativo e data sem fração', async () => {
    const withOffset = service(async () => ok('t', '2026-10-24T05:24:00.1234567-03:00'))
    const withoutFraction = service(async () => ok('t', '2026-10-24T05:24:00Z'))

    expect(await withOffset.login('http://localhost:5017', 'a', 'b')).toEqual({
      ok: true,
      value: { expiresAt: '2026-10-24T08:24:00.123Z' }
    })
    expect(await withoutFraction.login('http://localhost:5017', 'a', 'b')).toEqual({
      ok: true,
      value: { expiresAt: '2026-10-24T05:24:00.000Z' }
    })
  })

  it('envia a requisição com prefixo, corpo e opções de D1', async () => {
    const fetch = vi.fn<FetchLike>(async () => ok())
    const auth = service(fetch)

    await auth.login('https://host/buteco/', 'ana', 's3nha')

    expect(fetch).toHaveBeenCalledTimes(1)
    const [url, init] = fetch.mock.calls[0]!
    expect(url).toBe('https://host/buteco/auth/login')
    expect(init).toMatchObject({
      method: 'POST',
      body: '{"username":"ana","password":"s3nha"}',
      redirect: 'manual',
      credentials: 'omit',
      cache: 'no-store'
    })
    expect(init.headers).toMatchObject({ 'content-type': 'application/json' })
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })
})

describe('erros do login', () => {
  it('401 vira invalid-credentials', async () => {
    const auth = service(async () => json(401, { title: 'Usuário ou senha inválidos.' }))

    expect(await auth.login('http://localhost:5017', 'ana', 'errada')).toEqual({
      ok: false,
      error: { kind: 'invalid-credentials' }
    })
  })

  it('erro de rede vira unreachable com a mensagem net::', async () => {
    const auth = service(async () => {
      throw new Error('net::ERR_CONNECTION_REFUSED')
    })

    expect(await auth.login('http://localhost:5017', 'ana', 's3nha')).toEqual({
      ok: false,
      error: { kind: 'unreachable', message: 'net::ERR_CONNECTION_REFUSED' }
    })
  })

  it('outra rejeição vira unreachable genérico, sem repetir a mensagem', async () => {
    const auth = service(async () => {
      throw new TypeError('falha com dados internos')
    })

    expect(await auth.login('http://localhost:5017', 'ana', 's3nha')).toEqual({
      ok: false,
      error: { kind: 'unreachable', message: 'network' }
    })
  })

  it('aborta depois de 15 s e devolve timeout', async () => {
    vi.useFakeTimers()
    const auth = service(hanging)

    const pending = auth.login('http://localhost:5017', 'ana', 's3nha')
    await vi.advanceTimersByTimeAsync(LOGIN_TIMEOUT_MS - 1)
    expect(vi.getTimerCount()).toBe(1)
    await vi.advanceTimersByTimeAsync(1)

    expect(await pending).toEqual({ ok: false, error: { kind: 'unreachable', message: 'timeout' } })
    expect(auth.status().authenticated).toBe(false)
  })

  it('resposta antes de 15 s cancela o timer', async () => {
    vi.useFakeTimers()
    const auth = service(async () => ok())

    await auth.login('http://localhost:5017', 'ana', 's3nha')

    expect(vi.getTimerCount()).toBe(0)
  })

  it.each([404, 500, 204])('status %i vira http', async (status) => {
    const auth = service(async () => new Response(status === 204 ? null : 'x', { status }))

    expect(await auth.login('http://localhost:5017', 'ana', 's3nha')).toEqual({
      ok: false,
      error: { kind: 'http', status }
    })
  })

  describe('redirecionamento, sem segunda requisição', () => {
    it('resposta 3xx', async () => {
      const fetch = vi.fn<FetchLike>(async () => new Response(null, { status: 307, headers: { location: 'http://outro/' } }))

      expect(await service(fetch).login('http://localhost:5017', 'ana', 's3nha')).toEqual({
        ok: false,
        error: { kind: 'http', status: 307 }
      })
      expect(fetch).toHaveBeenCalledTimes(1)
    })

    it('resposta opaca de status 0', async () => {
      const opaque = { type: 'opaqueredirect', status: 0 } as Response
      const fetch = vi.fn<FetchLike>(async () => opaque)

      expect(await service(fetch).login('http://localhost:5017', 'ana', 's3nha')).toEqual({
        ok: false,
        error: { kind: 'http', status: 0 }
      })
      expect(fetch).toHaveBeenCalledTimes(1)
    })

    it('rejeição do Electron 45 ("Redirect was cancelled")', async () => {
      const fetch = vi.fn<FetchLike>(async () => {
        throw new Error('Redirect was cancelled')
      })

      expect(await service(fetch).login('http://localhost:5017', 'ana', 's3nha')).toEqual({
        ok: false,
        error: { kind: 'http', status: 0 }
      })
      expect(fetch).toHaveBeenCalledTimes(1)
    })
  })

  it.each([
    ['corpo que não é JSON', 'isto não é json'],
    ['JSON que não é objeto', '[1,2]'],
    ['sem token', { expiresAt: IN_30_MIN }],
    ['token vazio', { token: '', expiresAt: IN_30_MIN }],
    ['token maior que 8192', { token: 'x'.repeat(8193), expiresAt: IN_30_MIN }],
    ['token não string', { token: 123, expiresAt: IN_30_MIN }],
    ['sem expiresAt', { token: 't' }],
    ['expiresAt sem fuso', { token: 't', expiresAt: '2099-01-01T00:00:00' }],
    ['expiresAt com oito casas', { token: 't', expiresAt: '2099-01-01T00:00:00.12345678Z' }],
    ['expiresAt não ISO', { token: 't', expiresAt: '1' }],
    ['expiresAt inválido no formato certo', { token: 't', expiresAt: '2099-13-45T99:99:99Z' }],
    ['expiresAt no passado', { token: 't', expiresAt: '2026-10-24T04:59:59.000Z' }],
    ['expiresAt igual a agora', { token: 't', expiresAt: '2026-10-24T05:00:00.000Z' }],
    ['corpo maior que 64 KiB', { token: 't', expiresAt: IN_30_MIN, padding: 'x'.repeat(64 * 1024) }]
  ])('200 com %s vira bad-response', async (_name, body) => {
    const auth = service(async () => json(200, body))

    expect(await auth.login('http://localhost:5017', 'ana', 's3nha')).toEqual({
      ok: false,
      error: { kind: 'bad-response' }
    })
    expect(auth.status().authenticated).toBe(false)
  })

  it('token de 8192 caracteres é aceito', async () => {
    const auth = service(async () => ok('x'.repeat(8192)))

    expect((await auth.login('http://localhost:5017', 'ana', 's3nha')).ok).toBe(true)
  })
})

describe('ciclo da sessão', () => {
  it('um login que falha limpa a sessão anterior', async () => {
    const responses = [ok(), json(401, {})]
    const auth = service(async () => responses.shift()!)

    await auth.login('http://localhost:5017', 'ana', 's3nha')
    await auth.login('http://localhost:5017', 'ana', 'errada')

    expect(auth.status().authenticated).toBe(false)
    expect(auth.getToken()).toBeNull()
  })

  it('logout durante o login aborta, e um 200 tardio não cria sessão', async () => {
    const { fetch, respond } = deferred()
    const auth = service(fetch)

    const pending = auth.login('http://localhost:5017', 'ana', 's3nha')
    const signal = fetch.mock.calls[0]![1].signal!
    auth.logout()
    respond(ok())

    expect(signal.aborted).toBe(true)
    expect(await pending).toEqual({ ok: false, error: { kind: 'unreachable', message: 'cancelled' } })
    expect(auth.status().authenticated).toBe(false)
    expect(auth.getToken()).toBeNull()
  })

  it('um segundo login substitui o primeiro', async () => {
    const first = deferred()
    const second = deferred()
    const calls = [first.fetch, second.fetch]
    const auth = service((url, init) => calls.shift()!(url, init))

    const pendingFirst = auth.login('http://localhost:5017', 'ana', 's3nha')
    const pendingSecond = auth.login('http://localhost:5017', 'bia', 'outra')
    expect(first.fetch.mock.calls[0]![1].signal!.aborted).toBe(true)

    second.respond(ok('tok-bia'))
    first.respond(ok('tok-ana'))

    expect(await pendingFirst).toEqual({ ok: false, error: { kind: 'unreachable', message: 'cancelled' } })
    expect((await pendingSecond).ok).toBe(true)
    expect(auth.status().username).toBe('bia')
    expect(auth.getToken()).toBe('tok-bia')
  })

  it('logout limpa tudo', async () => {
    const auth = service(async () => ok())
    await auth.login('http://localhost:5017', 'ana', 's3nha')

    auth.logout()

    expect(auth.status()).toEqual({ authenticated: false, serviceUrl: null, username: null, expiresAt: null })
    expect(auth.getToken()).toBeNull()
  })

  it('status e getToken respondem deslogado depois da expiração', async () => {
    const auth = service(async () => ok())
    await auth.login('http://localhost:5017', 'ana', 's3nha')

    clock = Date.parse(IN_30_MIN) - 1
    expect(auth.status().authenticated).toBe(true)

    clock = Date.parse(IN_30_MIN)
    expect(auth.status()).toEqual({ authenticated: false, serviceUrl: null, username: null, expiresAt: null })
    expect(auth.getToken()).toBeNull()
  })

  it('não expõe a senha nem escreve no console', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((level) => vi.spyOn(console, level))
    const auth = service(async () => ok())

    const result = await auth.login('http://localhost:5017', 'ana', 'senha-unica-123')

    for (const value of [result, auth.status(), auth.getToken()]) {
      expect(JSON.stringify(value)).not.toContain('senha-unica-123')
    }
    for (const spy of spies) expect(spy).not.toHaveBeenCalled()
  })

  it('endereço inválido lança erro sem repetir o valor', async () => {
    const auth = service(async () => ok())

    await expect(auth.login('http://user:pass@host', 'ana', 's3nha')).rejects.toThrow(/^serviceUrl inválido\.$/)
  })
})
