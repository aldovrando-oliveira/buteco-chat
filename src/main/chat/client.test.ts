import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FetchLike } from '../http/classify'
import { createAuthService } from '../auth/service'
import { createChatClient, MAX_AGENTS_BODY, REQUEST_TIMEOUT_MS } from './client'

const AGENT = '3a7d9f10-1b2c-4d5e-8f90-0a1b2c3d4e5f'
const OTHER_AGENT = '00000000-0000-4000-8000-000000000001'
const TOKEN = 'tok-secreto'

function json(status: number, body: unknown): Response {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  })
}

function rpcResult(result: unknown): Response {
  return json(200, { jsonrpc: '2.0', id: 1, result })
}

function task(state: string, extra: Record<string, unknown> = {}) {
  return { id: 't-1', contextId: 'c-1', status: { state, timestamp: '2026-10-24T18:24:00Z' }, ...extra }
}

/** `fetch` que só termina quando o sinal aborta. */
const hanging: FetchLike = (_url, init) =>
  new Promise((_resolve, reject) => {
    init.signal?.addEventListener('abort', () => reject(new DOMException('This operation was aborted', 'AbortError')))
  })

let uuid = 0
const discard = vi.fn<(token: string) => void>()

function client(fetch: FetchLike, session: { serviceUrl: string | null; token: string | null } = {
  serviceUrl: 'http://localhost:5017',
  token: TOKEN
}) {
  return createChatClient({
    fetch,
    auth: {
      status: () => ({
        authenticated: session.token !== null,
        serviceUrl: session.serviceUrl,
        username: session.token === null ? null : 'ana',
        expiresAt: null
      }),
      getToken: () => session.token,
      discard
    },
    setTimeout: (callback, ms) => setTimeout(callback, ms),
    clearTimeout: (handle) => clearTimeout(handle),
    randomUUID: () => `00000000-0000-4000-8000-${String(++uuid).padStart(12, '0')}`
  })
}

/** Corpo JSON enviado na chamada `n` do `fetch` simulado. */
function sentBody(fetch: ReturnType<typeof vi.fn<FetchLike>>, n = 0): Record<string, any> {
  const init = fetch.mock.calls[n]?.[1]
  return JSON.parse(String(init?.body))
}

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  discard.mockReset()
})

describe('GET /agents', () => {
  it('devolve só os campos do AgentSummary, mantendo inativos', async () => {
    const fetch = vi.fn<FetchLike>(async () =>
      json(200, [
        {
          id: AGENT,
          name: 'Atendente',
          description: null,
          isActive: false,
          skills: [{ name: 'Resumo', description: null, extra: 1 }],
          instructions: 'segredo do prompt',
          provider: 'openai',
          model: 'gpt',
          knowledgeBaseIds: []
        }
      ])
    )

    const result = await client(fetch).listAgents()

    expect(result).toEqual({
      ok: true,
      value: [{ id: AGENT, name: 'Atendente', description: null, isActive: false, skills: [{ name: 'Resumo', description: null }] }]
    })
    expect(JSON.stringify(result)).not.toContain('segredo do prompt')
  })

  it('descarta itens inválidos sozinhos, e skills sem nome', async () => {
    const valid = { id: OTHER_AGENT, name: 'Válido', description: 'd', isActive: true, skills: [{ description: 'x' }, { name: 'S' }] }
    const fetch = vi.fn<FetchLike>(async () =>
      json(200, [
        { id: '../x', name: 'Travessia', isActive: true },
        { id: AGENT, name: '', isActive: true },
        { id: AGENT, name: 'Sem isActive' },
        null,
        valid
      ])
    )

    expect(await client(fetch).listAgents()).toEqual({
      ok: true,
      value: [{ id: OTHER_AGENT, name: 'Válido', description: 'd', isActive: true, skills: [{ name: 'S', description: null }] }]
    })
  })

  it('monta a URL sobre o prefixo e envia Bearer e as opções fixas', async () => {
    const fetch = vi.fn<FetchLike>(async () => json(200, []))

    await client(fetch, { serviceUrl: 'https://host/buteco', token: TOKEN }).listAgents()

    const [url, init] = fetch.mock.calls[0]!
    expect(url).toBe('https://host/buteco/agents')
    expect(init.method).toBe('GET')
    expect(init.body).toBeUndefined()
    expect(new Headers(init.headers).get('authorization')).toBe(`Bearer ${TOKEN}`)
    expect(new Headers(init.headers).get('accept')).toBe('application/json')
    expect(init).toMatchObject({ credentials: 'omit', cache: 'no-store', redirect: 'manual' })
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it.each([
    ['objeto no lugar do array', json(200, {})],
    ['texto que não é JSON', new Response('<html>', { status: 200 })],
    ['corpo acima do limite', new Response(`[${' '.repeat(MAX_AGENTS_BODY)}]`, { status: 200 })]
  ])('%s → bad-response', async (_label, response) => {
    expect(await client(async () => response).listAgents()).toEqual({ ok: false, error: { kind: 'bad-response' } })
  })

  it('401 → unauthorized; 500 → http', async () => {
    expect(await client(async () => new Response(null, { status: 401 })).listAgents()).toEqual({
      ok: false,
      error: { kind: 'unauthorized' }
    })
    expect(await client(async () => new Response('x', { status: 500 })).listAgents()).toEqual({
      ok: false,
      error: { kind: 'http', status: 500 }
    })
  })

  it('redirecionamento nas três formas, com uma única chamada', async () => {
    const rejected = vi.fn<FetchLike>(async () => {
      throw new Error('Redirect was cancelled')
    })
    const opaque = vi.fn<FetchLike>(async () => Response.error())
    const status302 = vi.fn<FetchLike>(async () => new Response(null, { status: 302, headers: { location: '/x' } }))

    expect(await client(rejected).listAgents()).toEqual({ ok: false, error: { kind: 'http', status: 0 } })
    expect(await client(opaque).listAgents()).toEqual({ ok: false, error: { kind: 'http', status: 0 } })
    expect(await client(status302).listAgents()).toEqual({ ok: false, error: { kind: 'http', status: 302 } })
    for (const fetch of [rejected, opaque, status302]) expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('erro de rede → unreachable com a mensagem net::', async () => {
    const fetch: FetchLike = async () => {
      throw new Error('net::ERR_CONNECTION_REFUSED')
    }

    expect(await client(fetch).listAgents()).toEqual({
      ok: false,
      error: { kind: 'unreachable', message: 'net::ERR_CONNECTION_REFUSED' }
    })
  })

  it('timeout de 15 s com timers falsos', async () => {
    vi.useFakeTimers()
    const pending = client(hanging).listAgents()

    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS - 1)
    let settled = false
    void pending.then(() => (settled = true))
    await Promise.resolve()
    expect(settled).toBe(false)

    await vi.advanceTimersByTimeAsync(1)
    expect(await pending).toEqual({ ok: false, error: { kind: 'unreachable', message: 'timeout' } })
  })

  it('a resposta antes do prazo cancela o timer', async () => {
    vi.useFakeTimers()
    await client(async () => json(200, [])).listAgents()

    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('JSON-RPC: erros', () => {
  it('error em HTTP 200 → rpc com code e message', async () => {
    const fetch: FetchLike = async () =>
      json(200, { jsonrpc: '2.0', id: 1, error: { code: -32600, message: 'Requisição inválida.' } })

    expect(await client(fetch).send(AGENT, 'oi', null)).toEqual({
      ok: false,
      error: { kind: 'rpc', code: -32600, message: 'Requisição inválida.' }
    })
  })

  it('error e result juntos → rpc (error antes de result)', async () => {
    const fetch: FetchLike = async () =>
      json(200, { jsonrpc: '2.0', id: 1, result: { task: task('TASK_STATE_SUBMITTED') }, error: { code: -32001, message: 'x' } })

    expect(await client(fetch).getTask(AGENT, 't-1')).toEqual({ ok: false, error: { kind: 'rpc', code: -32001, message: 'x' } })
  })

  it('message cortada em 500 caracteres', async () => {
    const fetch: FetchLike = async () => json(200, { jsonrpc: '2.0', id: 1, error: { code: -32600, message: 'm'.repeat(800) } })

    const result = await client(fetch).send(AGENT, 'oi', null)

    expect(result.ok === false && result.error.kind === 'rpc' && result.error.message).toHaveLength(500)
  })

  it.each([
    ['code não inteiro', { code: 1.5, message: 'x' }],
    ['sem message', { code: -32600 }],
    ['error string', 'falhou']
  ])('error malformado (%s) → bad-response', async (_label, error) => {
    const fetch: FetchLike = async () => json(200, { jsonrpc: '2.0', id: 1, error })

    expect(await client(fetch).send(AGENT, 'oi', null)).toEqual({ ok: false, error: { kind: 'bad-response' } })
  })

  it('401 com corpo vazio → unauthorized', async () => {
    expect(await client(async () => new Response(null, { status: 401 })).send(AGENT, 'oi', null)).toEqual({
      ok: false,
      error: { kind: 'unauthorized' }
    })
  })

  it('corpo que não é objeto JSON → bad-response', async () => {
    expect(await client(async () => json(200, [1])).getTask(AGENT, 't-1')).toEqual({ ok: false, error: { kind: 'bad-response' } })
  })

  it('agentId inválido lança erro sem o valor, sem chamar a rede', async () => {
    const fetch = vi.fn<FetchLike>()

    await expect(client(fetch).send('../segredo', 'oi', null)).rejects.toThrow(/^agentId inválido\.$/)
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe('SendMessage', () => {
  it('primeira mensagem: corpo JSON-RPC, sem contextId nem taskId', async () => {
    const fetch = vi.fn<FetchLike>(async () => rpcResult({ task: task('TASK_STATE_SUBMITTED') }))

    await client(fetch).send(AGENT, 'oi', null)

    const [url, init] = fetch.mock.calls[0]!
    expect(url).toBe(`http://localhost:5017/agents/${AGENT}/a2a`)
    expect(init.method).toBe('POST')
    expect(new Headers(init.headers).get('content-type')).toBe('application/json')
    const body = sentBody(fetch)
    expect(body).toMatchObject({ jsonrpc: '2.0', method: 'SendMessage' })
    expect(Number.isInteger(body['id'])).toBe(true)
    expect(Object.keys(body['params'])).toEqual(['message'])
    const message = body['params']['message']
    expect(message).toEqual({ role: 'ROLE_USER', parts: [{ text: 'oi' }], messageId: expect.any(String) })
    expect(message.messageId).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('mensagem seguinte com contextId e sem taskId', async () => {
    const fetch = vi.fn<FetchLike>(async () => rpcResult({ task: task('TASK_STATE_SUBMITTED') }))

    await client(fetch).send(AGENT, 'e agora?', 'ctx-1')

    const message = sentBody(fetch)['params']['message']
    expect(message.contextId).toBe('ctx-1')
    expect(message).not.toHaveProperty('taskId')
  })

  it('messageId novo a cada envio', async () => {
    const fetch = vi.fn<FetchLike>(async () => rpcResult({ task: task('TASK_STATE_SUBMITTED') }))
    const chat = client(fetch)

    await chat.send(AGENT, 'oi', 'ctx-1')
    await chat.send(AGENT, 'oi', 'ctx-1')

    expect(sentBody(fetch, 0)['params']['message'].messageId).not.toBe(sentBody(fetch, 1)['params']['message'].messageId)
  })

  it('resultado com submittedAt no formato do .NET normalizado', async () => {
    const fetch: FetchLike = async () =>
      rpcResult({
        task: { id: 't-1', contextId: 'c-1', status: { state: 'TASK_STATE_SUBMITTED', timestamp: '2026-10-24T18:24:00.1234567+00:00' } }
      })

    expect(await client(fetch).send(AGENT, 'oi', null)).toEqual({
      ok: true,
      value: { taskId: 't-1', contextId: 'c-1', state: 'TASK_STATE_SUBMITTED', submittedAt: '2026-10-24T18:24:00.123Z' }
    })
  })

  it('REJECTED já no SendMessage é sucesso com esse estado', async () => {
    const fetch: FetchLike = async () => rpcResult({ task: task('TASK_STATE_REJECTED') })

    const result = await client(fetch).send(AGENT, 'oi', null)

    expect(result).toMatchObject({ ok: true, value: { state: 'TASK_STATE_REJECTED' } })
  })

  it.each([null, 'ontem', '2026-10-24T18:24:00'])('timestamp %s → submittedAt null', async (timestamp) => {
    const fetch: FetchLike = async () =>
      rpcResult({ task: { id: 't-1', contextId: 'c-1', status: { state: 'TASK_STATE_WORKING', timestamp } } })

    expect(await client(fetch).send(AGENT, 'oi', null)).toMatchObject({ ok: true, value: { submittedAt: null } })
  })

  it.each([
    ['estado fora do contrato', { task: task('TASK_STATE_INPUT_REQUIRED') }],
    ['contextId inválido', { task: { ...task('TASK_STATE_SUBMITTED'), contextId: 'a/b' } }],
    ['taskId inválido', { task: { ...task('TASK_STATE_SUBMITTED'), id: 'x'.repeat(129) } }],
    ['sem task', { message: {} }],
    ['sem status', { task: { id: 't-1', contextId: 'c-1' } }]
  ])('%s → bad-response', async (_label, result) => {
    expect(await client(async () => rpcResult(result)).send(AGENT, 'oi', null)).toEqual({
      ok: false,
      error: { kind: 'bad-response' }
    })
  })
})

describe('GetTask', () => {
  it('corpo com o id da task', async () => {
    const fetch = vi.fn<FetchLike>(async () => rpcResult(task('TASK_STATE_WORKING')))

    await client(fetch).getTask(AGENT, 't-1')

    expect(sentBody(fetch)).toMatchObject({ jsonrpc: '2.0', method: 'GetTask', params: { id: 't-1' } })
  })

  it.each(['TASK_STATE_SUBMITTED', 'TASK_STATE_WORKING', 'TASK_STATE_FAILED', 'TASK_STATE_REJECTED'])(
    '%s → text null',
    async (state) => {
      const fetch: FetchLike = async () =>
        rpcResult(task(state, { artifacts: [{ artifactId: 'a', parts: [{ text: 'ignorado' }] }] }))

      expect(await client(fetch).getTask(AGENT, 't-1')).toEqual({
        ok: true,
        value: { state, text: null, timestamp: '2026-10-24T18:24:00.000Z' }
      })
    }
  )

  it('COMPLETED: partes de texto do último artifact unidas com \\n\\n', async () => {
    const fetch: FetchLike = async () =>
      rpcResult(
        task('TASK_STATE_COMPLETED', {
          status: { state: 'TASK_STATE_COMPLETED', message: { parts: [{ text: 'não é aqui' }] } },
          artifacts: [
            { artifactId: '1', parts: [{ text: 'rascunho' }] },
            { artifactId: '2', parts: [{ text: 'a' }, { data: {} }, { text: 'b' }] }
          ]
        })
      )

    expect(await client(fetch).getTask(AGENT, 't-1')).toEqual({
      ok: true,
      value: { state: 'TASK_STATE_COMPLETED', text: 'a\n\nb', timestamp: null }
    })
  })

  it('COMPLETED sem artifacts → text ""', async () => {
    const fetch: FetchLike = async () => rpcResult(task('TASK_STATE_COMPLETED'))

    expect(await client(fetch).getTask(AGENT, 't-1')).toMatchObject({ ok: true, value: { text: '' } })
  })

  it.each([
    ['task de outro id', { ...task('TASK_STATE_WORKING'), id: 't-2' }],
    ['estado fora do contrato', task('TASK_STATE_CANCELED')],
    ['result nulo', null]
  ])('%s → bad-response', async (_label, result) => {
    expect(await client(async () => rpcResult(result)).getTask(AGENT, 't-1')).toEqual({
      ok: false,
      error: { kind: 'bad-response' }
    })
  })
})

describe('sessão e token', () => {
  it.each([
    ['sem sessão', { serviceUrl: null, token: null }],
    ['sessão expirada (getToken null)', { serviceUrl: 'http://localhost:5017', token: null }]
  ])('%s → unauthorized sem chamar a rede', async (_label, session) => {
    const fetch = vi.fn<FetchLike>()
    const chat = client(fetch, session)

    for (const result of [await chat.listAgents(), await chat.send(AGENT, 'oi', null), await chat.getTask(AGENT, 't-1')]) {
      expect(result).toEqual({ ok: false, error: { kind: 'unauthorized' } })
    }
    expect(fetch).not.toHaveBeenCalled()
  })

  it('nenhum resultado serializado contém o token', async () => {
    const responses = [
      () => json(200, [{ id: AGENT, name: 'A', description: null, isActive: true, skills: [] }]),
      () => rpcResult({ task: task('TASK_STATE_SUBMITTED') }),
      () => rpcResult(task('TASK_STATE_COMPLETED', { artifacts: [{ parts: [{ text: 'oi' }] }] })),
      () => new Response(null, { status: 401 }),
      () => json(200, { jsonrpc: '2.0', id: 1, error: { code: -32600, message: 'x' } }),
      () => json(200, '{')
    ]
    for (const respond of responses) {
      const chat = client(async () => respond())
      for (const result of [await chat.listAgents(), await chat.send(AGENT, 'oi', null), await chat.getTask(AGENT, 't-1')]) {
        expect(JSON.stringify(result)).not.toContain(TOKEN)
      }
    }
  })

  it('não escreve no console', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((level) => vi.spyOn(console, level))
    const chat = client(async () => json(200, '{'))

    await chat.listAgents()
    await chat.send(AGENT, 'oi', null)
    await client(async () => {
      throw new Error('net::ERR_FAILED')
    }).getTask(AGENT, 't-1')

    for (const spy of spies) expect(spy).not.toHaveBeenCalled()
  })
})

describe('401 descarta o token usado (sessao-expirada, D3)', () => {
  it('em /agents, SendMessage e GetTask, discard recebe o token da requisição', async () => {
    const chat = client(async () => new Response(null, { status: 401 }))

    for (const result of [await chat.listAgents(), await chat.send(AGENT, 'oi', null), await chat.getTask(AGENT, 't-1')]) {
      expect(result).toEqual({ ok: false, error: { kind: 'unauthorized' } })
    }
    expect(discard.mock.calls).toEqual([[TOKEN], [TOKEN], [TOKEN]])
  })

  it('sem token: unauthorized sem rede e sem discard', async () => {
    const fetch = vi.fn<FetchLike>()
    await client(fetch, { serviceUrl: 'http://localhost:5017', token: null }).getTask(AGENT, 't-1')

    expect(fetch).not.toHaveBeenCalled()
    expect(discard).not.toHaveBeenCalled()
  })

  it.each([
    ['rpc', () => json(200, { jsonrpc: '2.0', id: 1, error: { code: -32001, message: 'x' } })],
    ['http 500', () => new Response(null, { status: 500 })],
    [
      'unreachable',
      () => {
        throw new Error('net::ERR_CONNECTION_REFUSED')
      }
    ]
  ])('%s não chama discard', async (_label, respond) => {
    await client(async () => respond()).getTask(AGENT, 't-1')

    expect(discard).not.toHaveBeenCalled()
  })

  it('401 de uma requisição com o token antigo não derruba a sessão de um login mais novo', async () => {
    const tokens = ['velho', 'novo']
    const auth = createAuthService({
      fetch: async () => json(200, { token: tokens.shift(), expiresAt: '2099-01-01T00:00:00Z' }),
      now: () => Date.now(),
      setTimeout: (callback, ms) => setTimeout(callback, ms),
      clearTimeout: (handle) => clearTimeout(handle)
    })
    await auth.login('http://localhost:5017', 'ana', 's3nha')
    let respond!: (response: Response) => void
    const chat = createChatClient({
      fetch: () => new Promise<Response>((resolve) => (respond = resolve)),
      auth,
      setTimeout: (callback, ms) => setTimeout(callback, ms),
      clearTimeout: (handle) => clearTimeout(handle),
      randomUUID: () => '00000000-0000-4000-8000-000000000000'
    })

    const pending = chat.getTask(AGENT, 't-1')
    await auth.login('http://localhost:5017', 'ana', 's3nha')
    respond(new Response(null, { status: 401 }))

    expect(await pending).toEqual({ ok: false, error: { kind: 'unauthorized' } })
    expect(auth.getToken()).toBe('novo')
  })
})
